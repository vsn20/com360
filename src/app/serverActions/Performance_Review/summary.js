'use server';

import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';

// Simple function to decode JWT
const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};

// Helper to get orgid and empid
async function getAuth() {
  const token = cookies().get('jwt_token')?.value;
  if (!token) throw new Error('Authentication token is missing.');

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    throw new Error('Invalid authentication token.');
  }
  
  const pool = await DBconnection();
  const [userRows] = await pool.execute(
    "SELECT empid FROM C_USER WHERE username = ? AND orgid = ?",
    [decoded.userId, decoded.orgid]
  );
  if (userRows.length === 0) {
    throw new Error('User account is not linked to an employee record.');
  }

  return { pool, orgid: decoded.orgid, loggedInEmpId: userRows[0].empid };
}

// UPDATED: User provided date formatting function
const formatDateForDisplay = (date) => {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
};

/**
 * Fetches all summary data for a single employee.
 */
export async function getEmployeeSummary(employeeId, year) {
  try {
    const { pool, orgid } = await getAuth();
    
    if (!employeeId) {
      throw new Error('Employee ID is required.');
    }

    const selectedYear = (year && year !== 'all') ? parseInt(year, 10) : null;

    let employee, goals, reviews, avgRating, availableYears;

    // 1. Fetch Employee Info
    const [empRows] = await pool.query(
      `SELECT 
        e.*, 
        CONCAT(s.EMP_FST_NAME, ' ', s.EMP_LAST_NAME) AS supervisor_name,
        jt.job_title AS job_title_name
       FROM C_EMP e 
       LEFT JOIN C_EMP s ON s.empid = e.superior AND s.orgid = e.orgid
       LEFT JOIN C_ORG_JOBTITLES jt ON e.JOB_TITLE = jt.job_title_id AND e.orgid = jt.orgid
       WHERE e.empid = ? AND e.orgid = ?`,
      [employeeId, orgid]
    );
    
    if (empRows.length === 0) {
      throw new Error('Employee not found.');
    }
    employee = empRows[0];
    employee.name = `${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME}`.trim();
    employee.job_title_name = employee.job_title_name || 'N/A';

    // 2. Fetch Goals
    let goalsQuery = "SELECT * FROM C_EMP_GOALS WHERE employee_id = ? AND orgid = ?";
    const goalsParams = [employeeId, orgid];
    
    if (selectedYear) {
      goalsQuery += " AND ? BETWEEN YEAR(start_date) AND YEAR(end_date)";
      goalsParams.push(selectedYear);
    }
    
    goalsQuery += " ORDER BY end_date ASC";
    const [goalRows] = await pool.query(goalsQuery, goalsParams);
    goals = goalRows.map(g => ({
      ...g,
      start_date: formatDateForDisplay(g.start_date),
      end_date: formatDateForDisplay(g.end_date)
    }));

    // 3. Fetch Reviews
    let reviewsQuery = `
      SELECT r.*, CONCAT(sv.EMP_FST_NAME, ' ', sv.EMP_LAST_NAME) AS supervisor_name 
      FROM C_EMP_REVIEWS r 
      LEFT JOIN C_EMP sv ON sv.empid = r.supervisor_id AND sv.orgid = r.orgid
      WHERE r.employee_id = ? AND r.orgid = ?
    `;
    const reviewsParams = [employeeId, orgid];
    if (selectedYear) {
      reviewsQuery += " AND r.review_year = ?";
      reviewsParams.push(selectedYear);
    }
    reviewsQuery += " ORDER BY r.review_date DESC";
    const [reviewRows] = await pool.query(reviewsQuery, reviewsParams);
    reviews = reviewRows.map(r => ({
      ...r,
      review_date: formatDateForDisplay(r.review_date),
      created_at: formatDateForDisplay(r.created_at)
    }));

    // 4. Fetch Average Rating
    let avgQuery = "SELECT ROUND(AVG(rating), 2) as avgRating FROM C_EMP_REVIEWS WHERE employee_id = ? AND orgid = ?";
    const avgParams = [employeeId, orgid];
    if (selectedYear) {
      avgQuery += " AND review_year = ?";
      avgParams.push(selectedYear);
    }
    const [avgRows] = await pool.query(avgQuery, avgParams);
    avgRating = avgRows[0].avgRating || 'N/A';

    // 5. Fetch Distinct Review Years
    const [yearRows] = await pool.query(
      "SELECT DISTINCT review_year FROM C_EMP_REVIEWS WHERE employee_id = ? AND orgid = ? ORDER BY review_year DESC",
      [employeeId, orgid]
    );
    availableYears = yearRows.map(y => y.review_year.toString());

    return { 
      success: true,
      data: {
        employee,
        goals,
        reviews,
        avgRating,
        availableYears
      }
    };

  } catch (err) {
    console.error('Error getting employee summary:', err);
    return { success: false, error: err.message };
  }
}
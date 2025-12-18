export const dynamic = 'force-dynamic';

import React from 'react';
import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';
import Overview from '@/app/components/Performance_Review/Overview';



// Simple function to decode JWT without verification
const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

/**
 * Fetches all direct and indirect subordinates for a given superior.
 */
async function getSubordinates(pool, superiorId, orgid) {
  const subordinateIds = new Set();
  // Recursive CTE to get full hierarchy
  const recursiveQuery = `
    WITH RECURSIVE EmployeeHierarchy AS (
      SELECT empid FROM C_EMP WHERE superior = ? AND orgid = ?
      UNION ALL
      SELECT e.empid
      FROM C_EMP e
      JOIN EmployeeHierarchy eh ON e.superior = eh.empid
      WHERE e.orgid = ?
    )
    SELECT empid FROM EmployeeHierarchy;
  `;
  try {
    // Note: Varchar IDs might not work with this recursive query if they are not properly indexed
    // or if the superior column doesn't exactly match empid.
    // Assuming superior column stores the empid string directly.
    const [rows] = await pool.query(recursiveQuery, [superiorId, orgid, orgid]);
    rows.forEach(row => subordinateIds.add(row.empid));
  } catch (error) {
    console.error(`Failed to fetch subordinates for ${superiorId}:`, error);
  }
  return Array.from(subordinateIds);
}

/**
 * Formats date for display (YYYY-MM-DD).
 */
const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    // Format to YYYY-MM-DD for HTML input compatibility
    return date.toISOString().split('T')[0];
};

export default async function page() {
  let orgid = null;
  let empid = null; // This will be varchar
  let permissionLevel = 'none';
  let employees = []; // For Goals
  let reviewEmployees = []; // For Reviews (respects new rules)
  let goals = [];
  let reviews = []; // NEW
  let visibleEmpIds = [];

  let hasAllData = false;
  let hasTeamData = false;
  let hasIndividualData = false;
  
  try {
    const pool = await DBconnection();
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      throw new Error("Authentication token is missing.");
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.userId) {
      throw new Error("Invalid authentication token.");
    }

    orgid = decoded.orgid;
    const username = decoded.userId;

    // 1. Get Logged In Employee ID
    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ? AND orgid = ?", [username, orgid]);
    if (userRows.length === 0) {
        throw new Error("User account is not linked to an employee record.");
    }
    empid = userRows[0].empid; // This is a varchar

    // 2. Get Permissions
    const [userRoles] = await pool.query(
      'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
      [empid, orgid]
    );
    const roleIds = userRoles.map(r => r.roleid);

    if (roleIds.length > 0) {
      const [permissions] = await pool.query(
        `SELECT alldata, teamdata, individualdata 
         FROM C_ROLE_MENU_PERMISSIONS 
         WHERE roleid IN (?) AND menuid = 19`, // Menu 19 for Performance
        [roleIds]
      );
      
      for (const p of permissions) {
        if (p.alldata === 1) hasAllData = true;
        if (p.teamdata === 1) hasTeamData = true;
        if (p.individualdata === 1) hasIndividualData = true;
      }
    }
    
    // Calculate effective permission level
    if (hasAllData) {
      permissionLevel = 'all';
    } else if (hasTeamData) {
      permissionLevel = 'team';
    } else if (hasIndividualData) {
      permissionLevel = 'individual';
    }

    // 3. Determine Visible Employees based on Permission
    // --- MODIFIED QUERY to get all details for Summary tab ---
    let employeeQuery = `
      SELECT 
          e.empid, 
          CONCAT(e.EMP_FST_NAME, ' ', e.EMP_LAST_NAME) as name,
          e.email,
          e.JOB_TITLE as role,
          CONCAT(s.EMP_FST_NAME, ' ', s.EMP_LAST_NAME) as supervisor_name
        FROM C_EMP e
        LEFT JOIN C_EMP s ON e.superior = s.empid AND e.orgid = s.orgid
        WHERE e.orgid = ?
    `;
    const queryParams = [orgid];

    if (permissionLevel === 'team') {
        const subordinateIds = await getSubordinates(pool, empid, orgid);
        visibleEmpIds = [empid, ...subordinateIds]; // Goals list includes self
        employeeQuery += ` AND e.empid IN (?)`;
        queryParams.push(visibleEmpIds);
    } else if (permissionLevel === 'individual') {
        visibleEmpIds = [empid];
        employeeQuery += ` AND e.empid = ?`;
        queryParams.push(empid);
    } else if (permissionLevel === 'none') {
        employeeQuery += ` AND 1=0`;
    } 
    
    employeeQuery += ` ORDER BY e.EMP_FST_NAME ASC`;

    const [employeeRows] = await pool.query(employeeQuery, queryParams);
    
    // --- MODIFIED MAPPING to include new fields ---
    employees = employeeRows.map(emp => ({
      empid: emp.empid,
      name: emp.name ? emp.name.trim() : 'N/A',
      email: emp.email || 'N/A',
      role: emp.role || 'N/A',
      supervisor_name: emp.supervisor_name ? emp.supervisor_name.trim() : 'N/A'
    }));
    
    if (permissionLevel === 'all') {
        visibleEmpIds = employees.map(emp => emp.empid);
    }

    // NEW: Create the employee list for REVIEWS
    // (excludes self for 'team', empty for 'individual')
    if (permissionLevel === 'all') {
      reviewEmployees = employees;
    } else if (permissionLevel === 'team') {
      reviewEmployees = employees.filter(emp => String(emp.empid) !== String(empid));
    }
    // else, reviewEmployees remains []

    // 4. Fetch Goals for Visible Employees
    if (visibleEmpIds.length > 0) {
      const goalsQuery = `
        SELECT 
          g.id, g.orgid, g.employee_id, g.description, g.start_date, g.end_date,
          g.completion_percentage, g.employee_comments, g.supervisor_comments,
          CONCAT(e.EMP_FST_NAME, ' ', e.EMP_LAST_NAME) as employee_name
        FROM C_EMP_GOALS g
        JOIN C_EMP e ON g.employee_id = e.empid AND g.orgid = e.orgid
        WHERE g.orgid = ? AND g.employee_id IN (?)
        GROUP BY g.id
        ORDER BY g.end_date DESC
      `;
      
      const [goalRows] = await pool.query(goalsQuery, [orgid, visibleEmpIds]);
      
      goals = goalRows.map(goal => ({
        ...goal,
        id: goal.id.toString(), 
        employee_id: goal.employee_id,
        employee_name: goal.employee_name.trim(),
        start_date: formatDateForDisplay(goal.start_date),
        end_date: formatDateForDisplay(goal.end_date),
      }));
    }

    // 5. NEW: Fetch Reviews for Visible Employees
    if (visibleEmpIds.length > 0 && permissionLevel !== 'individual') {
      const reviewsQuery = `
        SELECT 
          r.id, r.orgid, r.employee_id, r.review_year, r.review_date,
          r.rating, r.review_text, r.supervisor_id, r.comments, r.created_at,
          CONCAT(e.EMP_FST_NAME, ' ', e.EMP_LAST_NAME) as employee_name,
          CONCAT(sv.EMP_FST_NAME, ' ', sv.EMP_LAST_NAME) as supervisor_name
        FROM C_EMP_REVIEWS r
        JOIN C_EMP e ON r.employee_id = e.empid AND r.orgid = e.orgid
        LEFT JOIN C_EMP sv ON r.supervisor_id = sv.empid AND r.orgid = sv.orgid
        WHERE r.orgid = ? AND r.employee_id IN (?)
        ORDER BY r.review_year DESC, r.review_date DESC
      `;
      
      const [reviewRows] = await pool.query(reviewsQuery, [orgid, visibleEmpIds]);
      
      reviews = reviewRows.map(review => ({
        ...review,
        id: review.id.toString(),
        employee_id: review.employee_id,
        supervisor_id: review.supervisor_id,
        review_date: formatDateForDisplay(review.review_date),
        created_at: formatDateForDisplay(review.created_at),
        employee_name: review.employee_name ? review.employee_name.trim() : 'Unknown',
        supervisor_name: review.supervisor_name ? review.supervisor_name.trim() : 'N/A',
      }));
    }

  } catch (err) {
    console.error('Error loading Performance Review data:', err);
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc3545' }}>
        <h3>Error Loading Data</h3>
        <p>{err.message}</p>
      </div>
    );
  }
 
  return (
    <div>
      <Overview
        teamdata={hasTeamData ? 1 : 0}
        individualdata={hasIndividualData ? 1 : 0}
        alldata={hasAllData ? 1 : 0}
        permissionLevel={permissionLevel}
        employees={employees} // For Goals & Summary
        reviewEmployees={reviewEmployees} // For Reviews
        goals={goals}
        reviews={reviews} // NEW
        loggedInEmpId={empid}
        orgid={orgid}
      />
    </div>
  );
}
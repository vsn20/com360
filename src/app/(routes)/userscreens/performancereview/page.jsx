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
    const [rows] = await pool.query(recursiveQuery, [superiorId, orgid, orgid]);
    rows.forEach(row => subordinateIds.add(row.empid));
  } catch (error) {
    console.error(`Failed to fetch subordinates for ${superiorId}:`, error);
  }
  return Array.from(subordinateIds);
}

// UPDATED: User provided date formatting function
const formatDateForDisplay = (date) => {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
};

export default async function page() {
  let orgid = null;
  let empid = null; 
  let permissionLevel = 'none';
  let employees = []; 
  let reviewEmployees = []; 
  let goals = [];
  let reviews = []; 
  let visibleEmpIds = [];

  let hasAllData = false;
  let hasTeamData = false;
  let hasIndividualData = false;
  
  try {
    const pool = await DBconnection();
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) throw new Error("Authentication token is missing.");

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.userId) throw new Error("Invalid authentication token.");

    orgid = decoded.orgid;
    const username = decoded.userId;

    // 1. Get Logged In Employee ID
    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ? AND orgid = ?", [username, orgid]);
    if (userRows.length === 0) throw new Error("User account is not linked to an employee record.");
    empid = userRows[0].empid;

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
         WHERE roleid IN (?) AND menuid = 19`, 
        [roleIds]
      );
      
      for (const p of permissions) {
        if (p.alldata === 1) hasAllData = true;
        if (p.teamdata === 1) hasTeamData = true;
        if (p.individualdata === 1) hasIndividualData = true;
      }
    }
    
    if (hasAllData) permissionLevel = 'all';
    else if (hasTeamData) permissionLevel = 'team';
    else if (hasIndividualData) permissionLevel = 'individual';

    // 3. Determine Visible Employees based on Permission
    let employeeQuery = `
      SELECT 
          e.empid, 
          CONCAT(e.EMP_FST_NAME, ' ', e.EMP_LAST_NAME) as name,
          e.email,
          jt.job_title as job_title_name,
          CONCAT(s.EMP_FST_NAME, ' ', s.EMP_LAST_NAME) as supervisor_name
        FROM C_EMP e
        LEFT JOIN C_EMP s ON e.superior = s.empid AND e.orgid = s.orgid
        LEFT JOIN C_ORG_JOBTITLES jt ON e.JOB_TITLE = jt.job_title_id AND e.orgid = jt.orgid
        WHERE e.orgid = ?
    `;
    const queryParams = [orgid];

    if (permissionLevel === 'team') {
        const subordinateIds = await getSubordinates(pool, empid, orgid);
        visibleEmpIds = [empid, ...subordinateIds]; 
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
    
    employees = employeeRows.map(emp => ({
      empid: emp.empid,
      name: emp.name ? emp.name.trim() : 'N/A',
      email: emp.email || 'N/A',
      role: emp.job_title_name || 'N/A', 
      supervisor_name: emp.supervisor_name ? emp.supervisor_name.trim() : 'N/A'
    }));
    
    if (permissionLevel === 'all') {
        visibleEmpIds = employees.map(emp => emp.empid);
    }

    if (permissionLevel === 'all') {
      reviewEmployees = employees;
    } else if (permissionLevel === 'team') {
      reviewEmployees = employees.filter(emp => String(emp.empid) !== String(empid));
    }

    // 4. Fetch Goals
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

    // 5. Fetch Reviews
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
        employees={employees} 
        reviewEmployees={reviewEmployees} 
        goals={goals}
        reviews={reviews} 
        loggedInEmpId={empid}
        orgid={orgid}
      />
    </div>
  );
}
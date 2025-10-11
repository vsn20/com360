import React from 'react';
import Overview from '@/app/components/Employee/Overview';
import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';
import { fetchLeaveTypes } from '@/app/serverActions/Employee/overview';
import { getAllroles } from "@/app/serverActions/getAllroles";

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

const formatDateForDisplay = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'UTC',
    }).format(date);
};


export default async function OverviewPage({ searchParams }) {
  const { error: queryError } = searchParams || {};
  const error = queryError ? decodeURIComponent(queryError) : null;

  let orgid = null;
  let empid = null;
  let permissionLevel = 'none';
  let employees = [];
  let roles = [];
  let leaveTypes = [];
  let countries = [];
  let states = [];
  let departments = [];
  let payFrequencies = [];
  let jobTitles = [];
  let statuses = [];
  let workerCompClasses = [];
  let suborgs=[];
  let document_types=[];
  let document_purposes=[];
  let document_subtypes=[];
  let timestamp = new Date().getTime();
  
  try {
    const pool = await DBconnection();
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.error('No JWT token found');
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Employee Overview</h1>
          <p style={{ color: 'red' }}>Authentication token is missing. Please log in again.</p>
        </div>
      );
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.userId) {
      console.error('Invalid JWT token or missing orgid/userId:', decoded);
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Employee Overview</h1>
          <p style={{ color: 'red' }}>Invalid authentication token. Please log in again.</p>
        </div>
      );
    }

    orgid = decoded.orgid;
    const username = decoded.userId;
    console.log(`[DEBUG] 1. Decoded from JWT -> username: ${username}, orgid: ${orgid}`);

    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ? AND orgid = ?", [username, orgid]);
    if (userRows.length === 0) {
        console.error(`[DEBUG] FAILURE: No user found in C_USER with username: ${username} for orgid: ${orgid}`);
        return (
            <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
              <h1>Employee Overview</h1>
              <p style={{ color: 'red' }}>Your user account is not linked to an employee record.</p>
            </div>
        );
    }
    empid = userRows[0].empid;
    console.log(`[DEBUG] 2. Looked up User -> Found empid: ${empid}`);

    const [userRoles] = await pool.query(
      'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
      [empid, orgid]
    );
    const roleIds = userRoles.map(r => r.roleid);
    console.log(`[DEBUG] 3. Looked up Roles for empid ${empid} -> Found roleIds:`, roleIds);

    if (roleIds.length === 0) {
        console.warn(`[DEBUG] WARNING: No roles found for empid ${empid} in C_EMP_ROLE_ASSIGN. Permission will default to 'none'.`);
    }

    let hasAllData = false;
    let hasTeamData = false;
    let hasIndividualData = false;

    if (roleIds.length > 0) {
      const [permissions] = await pool.query(
        `SELECT alldata, teamdata, individualdata 
         FROM C_ROLE_MENU_PERMISSIONS 
         WHERE roleid IN (?) AND menuid = 2 AND submenuid = 3`,
        [roleIds]
      );
      
      for (const p of permissions) {
        if (p.alldata === 1) hasAllData = true;
        if (p.teamdata === 1) hasTeamData = true;
        if (p.individualdata === 1) hasIndividualData = true;
      }
    }
    
    if (hasAllData) {
      permissionLevel = 'all';
    } else if (hasTeamData) {
      permissionLevel = 'team';
    } else if (hasIndividualData) {
      permissionLevel = 'individual';
    }
    console.log(`[DEBUG] 4. Calculated Permission Level -> ${permissionLevel}`);
    
    let employeeQuery = `
      SELECT 
         e.empid, e.EMP_FST_NAME, e.EMP_LAST_NAME, e.email, e.HIRE, 
         e.MOBILE_NUMBER, e.GENDER, e.STATUS,
         GROUP_CONCAT(era.roleid) AS roleids
       FROM C_EMP e
       LEFT JOIN C_EMP_ROLE_ASSIGN era ON e.empid = era.empid AND e.orgid = era.orgid
       WHERE e.orgid = ?
    `;
    const queryParams = [orgid];

    if (permissionLevel === 'team') {
        const subordinateIds = await getSubordinates(pool, empid, orgid);
        const visibleEmpIds = [empid, ...subordinateIds];
        console.log(`[DEBUG] 5. Team Data -> Found subordinates: [${subordinateIds.join(', ')}]. Total visible IDs: [${visibleEmpIds.join(', ')}]`);
        
        employeeQuery += ` AND e.empid IN (?)`;
        queryParams.push(visibleEmpIds);

    } else if (permissionLevel === 'individual') {
        console.log(`[DEBUG] 5. Individual Data -> Restricting to self (empid: ${empid})`);
        employeeQuery += ` AND e.empid = ?`;
        queryParams.push(empid);

    } else if (permissionLevel === 'none') {
        console.log(`[DEBUG] 5. No Permissions -> Query will return no results.`);
        employeeQuery += ` AND 1=0`;
    } else {
        console.log(`[DEBUG] 5. All Data -> No additional employee filter needed.`);
    }
    
    employeeQuery += ` GROUP BY e.empid`;

    console.log("[DEBUG] 6. Final SQL Query:", pool.format(employeeQuery, queryParams));

    const [employeeRows] = await pool.query(employeeQuery, queryParams);

    employees = employeeRows.map(emp => ({
      ...emp,
      roleids: emp.roleids ? emp.roleids.split(',').map(id => id.trim()) : [],
      formattedHireDate: formatDateForDisplay(emp.HIRE)
    }));
    
    console.log(`[DEBUG] 7. Fetched Employees -> Found ${employees.length} record(s).`);

    [departments] = await pool.query('SELECT id, name FROM C_ORG_DEPARTMENTS WHERE orgid = ? AND isactive = 1', [orgid]);
    [payFrequencies] = await pool.query('SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 4 AND orgid = ? AND isactive = 1', [orgid]);
    [jobTitles] = await pool.query('SELECT job_title_id,job_title, level, min_salary, max_salary FROM C_ORG_JOBTITLES WHERE orgid = ? AND is_active = 1', [orgid]);
    [statuses] = await pool.query('SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 3  AND orgid = ? AND isactive = 1', [orgid]);
    [countries] = await pool.query('SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1');
    [states] = await pool.query('SELECT ID, VALUE FROM C_STATE WHERE ACTIVE = 1');
    [workerCompClasses] = await pool.query('SELECT class_code, phraseology FROM C_WORK_COMPENSATION_CLASS');
    [suborgs] = await pool.query('SELECT suborgid, suborgname FROM C_SUB_ORG WHERE orgid = ? AND isstatus = 1',[orgid]);
    [document_types] = await pool.query('SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 18 AND orgid = ? AND isactive = 1', [orgid]);
    [document_purposes] = await pool.query('SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 20 AND orgid = ? AND isactive = 1', [orgid]);
    [document_subtypes] = await pool.query('SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 19 AND orgid = ? AND isactive = 1', [orgid]);

    const { success, roles: fetchedRoles, error: fetchError } = await getAllroles();
    if (!success) {
      console.error('Failed to fetch roles:', fetchError);
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Employee Overview</h1>
          <p style={{ color: 'red' }}>{fetchError || 'Failed to load roles.'}</p>
        </div>
      );
    }
    roles = fetchedRoles;
    leaveTypes = await fetchLeaveTypes();

  } catch (error) {
    console.error('Error fetching data:', error);
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>Employee Overview</h1>
        <p style={{ color: 'red' }}>An error occurred while loading data: {error.message}</p>
      </div>
    );
  }

  return (
    <Overview
      roles={roles}
      loggedInEmpId={empid}
      permissionLevel={permissionLevel}
      orgid={orgid}
      error={error}
      employees={employees}
      leaveTypes={leaveTypes}
      countries={countries}
      states={states}
      departments={departments}
      payFrequencies={payFrequencies}
      jobTitles={jobTitles}
      statuses={statuses}
      workerCompClasses={workerCompClasses}
      timestamp={timestamp}
      suborgs={suborgs}
      document_types={document_types}
      document_purposes={document_purposes}
      document_subtypes={document_subtypes}
    />
  );
}
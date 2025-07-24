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

export default async function OverviewPage({ searchParams }) {
  const { error: queryError } = searchParams || {};
  const error = queryError ? decodeURIComponent(queryError) : null;

  // Initialize variables
  let orgid = null;
  let empid = null;
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
  let timestamp = new Date().getTime();
  try {
    // Establish database connection
    const pool = await DBconnection();

    // Get orgid and empid from token
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.error('No JWT token found in cookies');
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Employee Overview</h1>
          <p style={{ color: 'red' }}>Authentication token is missing. Please log in again.</p>
        </div>
      );
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.empid) {
      console.error('Invalid JWT token or missing orgid/empid:', decoded);
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Employee Overview</h1>
          <p style={{ color: 'red' }}>Invalid authentication token. Please log in again.</p>
        </div>
      );
    }

    orgid = decoded.orgid;
    empid = decoded.empid;

    // Fetch all employees for the given orgid with their roles from emp_role_assign
    const [employeeRows] = await pool.query(
      `SELECT 
         e.empid, 
         e.EMP_FST_NAME, 
         e.EMP_LAST_NAME, 
         e.email, 
         e.HIRE, 
         e.MOBILE_NUMBER, 
         e.GENDER,
         GROUP_CONCAT(era.roleid) AS roleids
       FROM C_EMP e
       LEFT JOIN emp_role_assign era ON e.empid = era.empid AND e.orgid = era.orgid
       WHERE e.orgid = ?
       GROUP BY e.empid`,
      [orgid]
    );

    // Transform employee data to include roleids as an array
    employees = employeeRows.map(emp => ({
      ...emp,
      roleids: emp.roleids ? emp.roleids.split(',').map(id => id.trim()) : []
    }));

    // Fetch active departments for the organization
    [departments] = await pool.query(
      'SELECT id, name FROM org_departments WHERE orgid = ? AND isactive = 1',
      [orgid]
    );

    // Fetch active pay frequencies for the organization
    [payFrequencies] = await pool.query(
      'SELECT id, Name FROM generic_values WHERE g_id = 4 AND orgid = ? AND isactive = 1',
      [orgid]
    );

    // Fetch active job titles for the organization
    [jobTitles] = await pool.query(
      'SELECT job_title_id,job_title, level, min_salary, max_salary FROM org_jobtitles WHERE orgid = ? AND is_active = 1',
      [orgid]
    );

    // Fetch active statuses for the organization
    [statuses] = await pool.query(
      'SELECT id, Name FROM generic_values WHERE g_id = 3  AND orgid = ? AND isactive = 1',
      [orgid]
    );

    // Fetch active countries
    [countries] = await pool.query(
      'SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1'
    );

    // Fetch active states
    [states] = await pool.query(
      'SELECT ID, VALUE FROM C_STATE WHERE ACTIVE = 1'
    );

    // Fetch worker compensation classes
    [workerCompClasses] = await pool.query(
      'SELECT class_code, phraseology FROM worker_comp'
    );

    // Fetch all roles for the role dropdown
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

    // Fetch leave types
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
      empid={empid}
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
    />
  );
}
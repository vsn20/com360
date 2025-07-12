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
  let currentrole = null;
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

  try {
    // Establish database connection
    const pool = await DBconnection();

    // Get orgid and currentrole from token
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.orgid) {
        orgid = decoded.orgid;

        // Fetch the current role based on orgid and roleid from the token
        const [roleRows] = await pool.query(
          'SELECT roleid, rolename FROM org_role_table WHERE orgid = ? AND roleid = ? LIMIT 1',
          [orgid, decoded.roleid]
        );

        if (roleRows && roleRows.length > 0) {
          currentrole = roleRows[0].rolename || roleRows[0].roleid.toString();
        }

        // Fetch all employees for the given orgid
        [employees] = await pool.query(
          'SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, roleid, email, HIRE, MOBILE_NUMBER, GENDER FROM C_EMP WHERE orgid = ?',
          [orgid]
        );

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
          'SELECT job_title, level FROM org_jobtitles WHERE orgid = ? AND is_active = 1',
          [orgid]
        );

        // Fetch active statuses for the organization
        [statuses] = await pool.query(
          'SELECT id, Name FROM generic_values WHERE g_id = 3 AND cutting = 1 AND orgid = ? AND isactive = 1',
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
      }
    }

    // Fetch all roles for the role dropdown
    const { success, roles: fetchedRoles, error: fetchError } = await getAllroles();
    if (success) {
      roles = fetchedRoles;
    } else {
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Employee Overview</h1>
          <p style={{ color: 'red' }}>{fetchError || 'Failed to load roles.'}</p>
        </div>
      );
    }

    // Fetch leave types
    leaveTypes = await fetchLeaveTypes();

  } catch (error) {
    console.error('Error fetching data:', error);
    // Proceed with partial data
  }

  return (
    <Overview
      roles={roles}
      currentrole={currentrole}
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
    />
  );
}
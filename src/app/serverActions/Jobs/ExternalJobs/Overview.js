'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const decodeJwt = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error decoding JWT:', error.message);
    return null;
  }
};

const getdisplayprojectid = (prjid) => {
    return prjid.split('_')[1] || prjid;
  };

const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId);
      return 'unknown';
    }
    let empid = userRows[0].empid;

    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (empRows.length === 0) {
      console.error('Employee not found in C_EMP for empid:', empid);
      return `${empid}-unknown`;
    }
    const { EMP_FST_NAME, EMP_LAST_NAME } = empRows[0];
    empid=getdisplayprojectid(empid);
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

export async function fetchExternalJobsByOrgId() {
  let pool;
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      throw new Error('Invalid token or orgid not found.');
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      throw new Error('Organization ID is missing or invalid.');
    }

    console.log(`Fetching external jobs for orgId: ${orgId}`);
    pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT jobid, orgid, posteddate, lastdate_for_application, addresslane1, addresslane2,
              zipcode, stateid, custom_state_name, countryid, active, expected_job_title,
              expected_role, expected_department, display_job_name, job_type, description,
              no_of_vacancies, created_by, last_updated_by
       FROM externaljobs WHERE orgid = ?`,
      [orgId]
    );
    console.log('Fetched external jobs:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching external jobs:', error.message);
    throw new Error(`Failed to fetch external jobs: ${error.message}`);
  }
}

export async function fetchExternalJobById(jobid) {
  let pool;
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      throw new Error('Invalid token or orgid not found.');
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      throw new Error('Organization ID is missing or invalid.');
    }

    if (!jobid) {
      console.log('Job ID is required');
      throw new Error('Job ID is required.');
    }

    console.log(`Fetching external job for jobid: ${jobid}, orgId: ${orgId}`);
    pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT jobid, orgid, posteddate, lastdate_for_application, addresslane1, addresslane2,
              zipcode, stateid, custom_state_name, countryid, active, expected_job_title,
              expected_role, expected_department, display_job_name, job_type, description,
              no_of_vacancies, created_by, last_updated_by
       FROM externaljobs WHERE jobid = ? AND orgid = ?`,
      [jobid, orgId]
    );

    if (rows.length === 0) {
      console.log('No external job found for jobid:', jobid);
      throw new Error('No external job found for the given ID.');
    }

    console.log('Fetched external job:', rows[0]);
    return rows[0];
  } catch (error) {
    console.error('Error fetching external job:', error.message);
    throw new Error(`Failed to fetch external job: ${error.message}`);
  }
}

export async function updateExternalJob(formData) {
  const jobid = formData.get('jobid')?.trim();
  const section = formData.get('section')?.trim();

  console.log('updateExternalJob FormData:', {
    jobid,
    section,
    formData: Object.fromEntries(formData),
  });

  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('No token found');
    return { error: 'No token found. Please log in.' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Invalid token or orgid/userId not found');
    return { error: 'Invalid token or orgid/userId not found.' };
  }

  const orgId = decoded.orgid;
  const userId = decoded.userId;

  if (!jobid) {
    console.log('Job ID is required');
    return { error: 'Job ID is required.' };
  }

  let pool;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
      console.log(`Attempting to connect to MySQL (attempt ${retryCount + 1})...`);
      pool = await DBconnection();

      const [existing] = await pool.execute(
        'SELECT jobid FROM externaljobs WHERE jobid = ? AND orgid = ?',
        [jobid, orgId]
      );
      if (existing.length === 0) {
        console.log('External job not found');
        return { error: 'External job not found.' };
      }

      const updatedBy = await getCurrentUserEmpIdName(pool, userId, orgId);
      let affectedRows = 0;

      if (section === 'basic') {
        const displayJobName = formData.get('displayJobName')?.trim();
        const expectedJobTitle = formData.get('expectedJobTitle')?.trim();
        const expectedRole = formData.get('expectedRole')?.trim();
        const expectedDepartment = formData.get('expectedDepartment')?.trim();
        const jobType = formData.get('jobType')?.trim();
        const description = formData.get('description')?.trim();
        const noOfVacancies = formData.get('noOfVacancies') ? parseInt(formData.get('noOfVacancies'), 10) : null;

        console.log('Basic details:', {
          displayJobName,
          expectedJobTitle,
          expectedRole,
          expectedDepartment,
          jobType,
          description,
          noOfVacancies,
          updatedBy,
        });

        if (!displayJobName) return { error: 'Display Job Name is required.' };
        if (!expectedJobTitle) return { error: 'Expected Job Title is required.' };
        if (!expectedRole) return { error: 'Expected Role is required.' };
        if (!expectedDepartment) return { error: 'Expected Department is required.' };
        if (!jobType) return { error: 'Job Type is required.' };
        if (!description) return { error: 'Description is required.' };
        //if (!noOfVacancies || isNaN(noOfVacancies)) return { error: 'Number of Vacancies is required and must be a valid number.' };

        const [jobTitleCheck] = await pool.execute(
          'SELECT job_title_id FROM org_jobtitles WHERE job_title_id = ? AND orgid = ? AND is_active = 1',
          [expectedJobTitle, orgId]
        );
        if (jobTitleCheck.length === 0) return { error: 'Invalid or inactive job title.' };

        const [roleCheck] = await pool.execute(
          'SELECT roleid FROM org_role_table WHERE roleid = ? AND orgid = ?',
          [expectedRole, orgId]
        );
        if (roleCheck.length === 0) return { error: 'Invalid or inactive role.' };

        const [deptCheck] = await pool.execute(
          'SELECT id FROM org_departments WHERE id = ? AND orgid = ? AND isactive = 1',
          [expectedDepartment, orgId]
        );
        if (deptCheck.length === 0) return { error: 'Invalid or inactive department.' };

        const [jobTypeCheck] = await pool.execute(
          'SELECT id FROM generic_values WHERE id = ? AND g_id = 14 AND orgid = ? AND isactive = 1',
          [jobType, orgId]
        );
        if (jobTypeCheck.length === 0) return { error: 'Invalid or inactive job type.' };

        const [result] = await pool.query(
          `UPDATE externaljobs 
           SET display_job_name = ?, expected_job_title = ?, expected_role = ?, 
               expected_department = ?, job_type = ?, description = ?, no_of_vacancies = ?,
               last_updated_by = ?
           WHERE jobid = ? AND orgid = ?`,
          [
            displayJobName,
            expectedJobTitle,
            expectedRole,
            expectedDepartment,
            jobType,
            description,
            noOfVacancies,
            updatedBy,
            jobid,
            orgId,
          ]
        );

        affectedRows += result.affectedRows;
        console.log(`Basic details update result: ${result.affectedRows} rows affected for jobid ${jobid}`);
      } else if (section === 'additional') {
        const addressLane1 = formData.get('addressLane1')?.trim() || null;
        const addressLane2 = formData.get('addressLane2')?.trim() || null;
        const zipcode = formData.get('zipcode')?.trim() || null;
        const stateId = formData.get('stateId') || null;
        const countryId = formData.get('countryId') || null;
        const customStateName = formData.get('customStateName')?.trim() || 'N/A';
        const lastDateForApplication = formData.get('lastDateForApplication') || null;
        const active = formData.get('active') === '1' ? 1 : 0;

        console.log('Additional details:', {
          addressLane1,
          addressLane2,
          zipcode,
          stateId,
          countryId,
          customStateName,
          lastDateForApplication,
          active,
          updatedBy,
        });

        if (stateId) {
          const [stateCheck] = await pool.execute(
            'SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1',
            [stateId]
          );
          if (stateCheck.length === 0) return { error: 'Invalid or inactive state.' };
        }

        if (countryId) {
          const [countryCheck] = await pool.execute(
            'SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1',
            [countryId]
          );
          if (countryCheck.length === 0) return { error: 'Invalid or inactive country.' };
        }

        const [result] = await pool.query(
          `UPDATE externaljobs 
           SET addresslane1 = ?, addresslane2 = ?, zipcode = ?, stateid = ?, 
               custom_state_name = ?, countryid = ?, lastdate_for_application = ?, 
               active = ?, last_updated_by = ?
           WHERE jobid = ? AND orgid = ?`,
          [
            addressLane1,
            addressLane2,
            zipcode,
            stateId ? parseInt(stateId, 10) : null,
            customStateName,
            countryId ? parseInt(countryId, 10) : null,
            lastDateForApplication,
            active,
            updatedBy,
            jobid,
            orgId,
          ]
        );

        affectedRows += result.affectedRows;
        console.log(`Additional details update result: ${result.affectedRows} rows affected for jobid ${jobid}`);
      } else {
        console.log('Invalid section:', section);
        return { error: 'Invalid section specified.' };
      }

      if (affectedRows === 0) {
        console.log('No rows updated for jobid:', jobid);
        return { error: 'No changes were applied.' };
      }

      console.log(`External job updated: jobid ${jobid}, section ${section}, affectedRows: ${affectedRows}`);
      return { success: true, updatedBy };
    } catch (error) {
      console.error('Error updating external job:', error.message);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        console.log('Pool is closed, retrying connection...');
        retryCount++;
        continue;
      }
      return { error: `Failed to update external job: ${error.message}` };
    }
  }

  return { error: 'Failed to update external job after multiple retries: Pool is closed' };
}
'use server';
import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

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
      console.error('User not found in C_USER for username:', userId, 'orgid:', orgId);
      return 'unknown';
    }
    let empid = userRows[0].empid;

    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (empRows.length === 0) {
      console.error('Employee not found in C_EMP for empid:', empid, 'orgid:', orgId);
      return `${empid}-unknown`;
    }
    const { EMP_FST_NAME, EMP_LAST_NAME } = empRows[0];
    empid = getdisplayprojectid(empid);
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

export async function fetchDetailsById({ orgid, interview_id, acceptingtime, empid }) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { success: false, error: 'No token found. Please log in.' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Redirecting: Invalid token or orgid/userId not found');
    return { success: false, error: 'Invalid token or orgid/userId not found.' };
  }

  try {
    const pool = await DBconnection();
    const [rows] = await pool.query(
      `SELECT c.applicationid, b.interview_id, d.first_name, d.last_name, e.job_title, c.status,
              b.start_date, b.start_time, b.start_am_pm, b.end_date, b.end_time, b.end_am_pm,
              b.meeting_link, d.email, c.resumepath, c.offerletter_timestamp
       FROM interview_panel AS a
       JOIN interview_table AS b ON a.interview_id = b.interview_id AND a.orgid = b.orgid
       JOIN applications AS c ON c.applicationid = b.application_id
       JOIN candidate AS d ON d.cid = c.candidate_id
       JOIN org_jobtitles AS e ON e.job_title_id = c.jobid
       WHERE b.interview_id = ? AND a.orgid = ?`,
      [interview_id, orgid]
    );

    if (rows.length === 0) {
      console.error('No interview found for interview_id:', interview_id, 'orgid:', orgid, 'empid:', empid);
      return { success: false, error: 'No interview found' };
    }

    const interview = rows[0];
    let canEdit = true;
    if (interview.offerletter_timestamp) {
      const acceptingHours = acceptingtime ? parseInt(acceptingtime, 10) : 0;
      if (isNaN(acceptingHours)) {
        console.error('Invalid acceptingtime:', acceptingtime);
        return { success: false, error: 'Invalid accepting time' };
      }
      const offerTimestamp = new Date(interview.offerletter_timestamp);
      const currentTime = new Date();
      const maxEditTime = new Date(offerTimestamp.getTime() + acceptingHours * 60 * 60 * 1000);
      if (currentTime > maxEditTime) {
        canEdit = false;
      }
    }

    return {
      success: true,
      interview,
      canEdit,
    };
  } catch (error) {
    console.error('Error in fetchDetailsById:', error);
    return {
      success: false,
      error: 'Failed to fetch interview details',
    };
  }
};

export async function update({ orgid, empid, interview_id, status, acceptingtime }) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { success: false, error: 'No token found. Please log in.' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Redirecting: Invalid token or orgid/userId not found');
    return { success: false, error: 'Invalid token or orgid/userId not found.' };
  }
  const userId = decoded.userId;

  try {
    const pool = await DBconnection();

    // Fetch applicationid and offerletter_timestamp from interview_table and applications
    const [applicationRows] = await pool.query(
      `SELECT a.applicationid, a.offerletter_timestamp 
       FROM applications AS a 
       JOIN interview_table AS b 
       ON a.applicationid = b.application_id 
       WHERE b.interview_id = ? AND a.orgid = ?`,
      [interview_id, orgid]
    );

    if (applicationRows.length === 0) {
      console.error('No application found for interview_id:', interview_id, 'orgid:', orgid);
      return { success: false, error: 'No application found for the given interview ID' };
    }

    const { applicationid, offerletter_timestamp } = applicationRows[0];

    // Check if editing is allowed based on offerletter_timestamp and acceptingtime
    let canEdit = true;
    if (offerletter_timestamp) {
      const acceptingHours = acceptingtime ? parseInt(acceptingtime, 10) : 0;
      if (isNaN(acceptingHours)) {
        console.error('Invalid acceptingtime:', acceptingtime);
        return { success: false, error: 'Invalid accepting time' };
      }

      const offerTimestamp = new Date(offerletter_timestamp);
      const currentTime = new Date();
      const maxEditTime = new Date(offerTimestamp.getTime() + acceptingHours * 60 * 60 * 1000);

      if (currentTime > maxEditTime) {
        canEdit = false;
      }
    }

    if (!canEdit) {
      console.log('Edit not allowed: Time window for editing has expired');
      return { success: false, error: 'Editing is not allowed as the time window has expired' };
    }

    // Update applications table with status and offerletter_timestamp
    if (status === 'offerletter-processing') {
      await pool.query(
        `UPDATE applications 
         SET status = ?, offerletter_timestamp = ? 
         WHERE orgid = ? AND applicationid = ?`,
        [status, new Date(), orgid, applicationid]
      );
    } else {
      await pool.query(
        `UPDATE applications 
         SET status = ?, offerletter_timestamp = ? 
         WHERE orgid = ? AND applicationid = ?`,
        [status, null, orgid, applicationid]
      );
    }

    // Log activity in applications_activity
    const employeename = await getCurrentUserEmpIdName(pool, userId, orgid);
    console.log('Employee Name:', employeename);
    const description = `Status(${status}) changed by ${employeename}(after interviewing) on ${new Date().toISOString()}`;
    await pool.query(
      `INSERT INTO applications_activity (orgid, application_id, activity_description) 
       VALUES (?, ?, ?)`,
      [orgid, applicationid, description]
    );

    console.log('Interview status updated:', { interview_id, status });
    return {
      success: true,
      message: 'Interview status updated successfully',
    };
  } catch (error) {
    console.error('Error in update:', error);
    return {
      success: false,
      error: 'Failed to update interview status',
    };
  }
}
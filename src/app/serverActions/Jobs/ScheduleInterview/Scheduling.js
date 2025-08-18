'use server';
import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';

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

export async function getEmployees(orgid) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.query(
      `SELECT e.empid, e.EMP_FST_NAME, e.EMP_LAST_NAME, e.email
       FROM C_EMP e
       JOIN C_EMP_ROLE_ASSIGN era ON e.empid = era.empid AND e.orgid = era.orgid
       JOIN C_ROLE_MENU_PERMISSIONS rmp ON era.roleid = rmp.roleid
       JOIN C_SUBMENU sm ON rmp.submenuid = sm.id
       WHERE e.orgid = ? AND e.STATUS = 'ACTIVE' AND sm.url = '/userscreens/jobs/interview'`,
      [orgid]
    );
    return { success: true, employees: rows };
  } catch (error) {
    console.error('Error fetching employees:', error);
    return { success: false, error: 'Failed to fetch employees' };
  }
}

export async function deleteInterviewRound(orgid, roundId) {
  try {
    const pool = await DBconnection();
    await pool.query(
      `DELETE FROM C_INTERVIEW_PANELS WHERE orgid = ? AND Roundid = ?`,
      [orgid, roundId]
    );
    await pool.query(
      `DELETE FROM C_INTERVIEW_ROUNDS WHERE orgid = ? AND Roundid = ?`,
      [orgid, roundId]
    );
    return { success: true };
  } catch (error) {
    console.error('Error deleting interview round:', error);
    return { error: `Failed to delete interview round: ${error.message}` };
  }
}

export async function scheduleInterview(formData) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { error: 'No token found. Please log in.' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Redirecting: Invalid token or orgid/userId not found');
    return { error: 'Invalid token or orgid/userId not found.' };
  }
  const userId = decoded.userId;

  try {
    const pool = await DBconnection();

    const orgid = formData.get('orgid');
    const application_id = formData.get('application_id');
    const empid = formData.get('empid');
    const applicationStatus = formData.get('applicationStatus');
    const rounds = JSON.parse(formData.get('rounds'));

    // Update C_APPLICATIONS table with status
    await pool.query(
      `UPDATE C_APPLICATIONS SET status = ? WHERE applicationid = ? AND orgid = ?`,
      [applicationStatus, application_id, orgid]
    );

    const employeename = await getCurrentUserEmpIdName(pool, userId, orgid);
    if (employeename === 'unknown' || employeename === 'system') {
      throw new Error(`Failed to fetch valid employee name for userId: ${userId}`);
    }

    // Log application status change
    const statusDescription = `Application status changed to ${applicationStatus} by ${employeename} on ${new Date().toISOString()}`;
    await pool.query(
      `INSERT INTO applications_activity (orgid, application_id, activity_description) VALUES (?, ?, ?)`,
      [orgid, application_id, statusDescription]
    );

    // If no rounds provided, just return after updating status
    if (rounds.length === 0) {
      return { success: true };
    }

    // Generate or verify interview_id
    let interview_id;
    const [existingInterview] = await pool.query(
      'SELECT interview_id FROM C_INTERVIEW_TABLES WHERE orgid = ? AND application_id = ?',
      [orgid, application_id]
    );

    if (existingInterview.length === 0) {
      const [s] = await pool.query(
        'SELECT COUNT(*) AS count FROM C_INTERVIEW_TABLES WHERE orgid = ?',
        [orgid]
      );
      const m = s[0].count;
      interview_id = `${orgid}-${m + 1}`;

      // Insert into C_INTERVIEW_TABLES
      if (applicationStatus === 'scheduled') {
        await pool.query(
          `INSERT INTO C_INTERVIEW_TABLES (orgid, interview_id, application_id, confirm)
           VALUES (?, ?, ?, 1)`,
          [orgid, interview_id, application_id]
        );
      } else {
        await pool.query(
          `INSERT INTO C_INTERVIEW_TABLES (orgid, interview_id, application_id, confirm)
           VALUES (?, ?, ?, 0)`,
          [orgid, interview_id, application_id]
        );
      }
    } else {
      interview_id = existingInterview[0].interview_id;
    }

    for (const round of rounds) {
      const { name, start_date, start_am_pm, end_date, end_am_pm, start_time, end_time, meeting_link, panelMembers } = round;

      // Validate required fields and date/time logic
      if (!start_date || !start_time) {
        throw new Error('Start date and time are required for scheduled status.');
      }
      if (!start_am_pm || !['AM', 'PM'].includes(start_am_pm)) {
        throw new Error('Start AM/PM must be AM or PM.');
      }
      if (end_date) {
        if (start_date > end_date) {
          throw new Error('Start date must be earlier than or equal to end date.');
        }
        if (start_date === end_date && end_time) {
          if (!end_am_pm || !['AM', 'PM'].includes(end_am_pm)) {
            throw new Error('End AM/PM must be AM or PM when end time is provided.');
          }
          let startHours = parseInt(start_time.split(':')[0], 10);
          let startMinutes = parseInt(start_time.split(':')[1], 10);
          let endHours = parseInt(end_time.split(':')[0], 10);
          let endMinutes = parseInt(end_time.split(':')[1], 10);

          if (start_am_pm === 'PM' && startHours !== 12) startHours += 12;
          if (start_am_pm === 'AM' && startHours === 12) startHours = 0;
          if (end_am_pm === 'PM' && endHours !== 12) endHours += 12;
          if (end_am_pm === 'AM' && endHours === 12) endHours = 0;

          const startTotalMinutes = startHours * 60 + startMinutes;
          const endTotalMinutes = endHours * 60 + endMinutes;

          if (startTotalMinutes >= endTotalMinutes) {
            throw new Error('Start time must be earlier than end time on the same date.');
          }
        }
      }
      if (panelMembers.length === 0) {
        throw new Error('At least one panel member is required for scheduled status.');
      }
      const hasEmployee = panelMembers.some(member => member.is_he_employee === '1');
      if (!hasEmployee) {
        throw new Error('At least one panel member must be a company employee.');
      }

      // Insert into C_INTERVIEW_ROUNDS with name as RoundNo
      const [result] = await pool.query(
        `INSERT INTO C_INTERVIEW_ROUNDS (
          orgid, interview_id, application_id, RoundNo, start_date, start_am_pm, 
          end_date, end_am_pm, start_time, end_time, meeting_link, status, Confirm
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', '1')`,
        [
          orgid,
          interview_id,
          application_id,
          name || `Round ${rounds.indexOf(round) + 1}`,
          start_date || null,
          start_am_pm || null,
          end_date || null,
          end_am_pm || null,
          start_time || null,
          end_time || null,
          meeting_link || null,
        ]
      );

      const roundId = result.insertId;

      // Insert panel members
      for (const member of panelMembers) {
        let emailToInsert = member.email;
        if (member.is_he_employee === '1' && (!member.email || member.email === 'null')) {
          const [empRows] = await pool.query(
            'SELECT email FROM C_EMP WHERE empid = ? AND orgid = ? AND STATUS = "ACTIVE"',
            [member.empid, orgid]
          );
          if (empRows.length === 0 || !empRows[0].email) {
            throw new Error(`No valid email found for employee ID ${member.empid}`);
          }
          emailToInsert = empRows[0].email;
        }

        await pool.query(
          `INSERT INTO C_INTERVIEW_PANELS (orgid, interview_id, empid, email, is_he_employee, Roundid)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            orgid,
            interview_id,
            member.empid || null,
            emailToInsert,
            member.is_he_employee,
            roundId,
          ]
        );
      }

      // Log round scheduling activity
      const description = `Scheduled ${name || `Round ${rounds.indexOf(round) + 1}`} by ${employeename}(while shortlisting) on ${new Date().toISOString()}`;
      await pool.query(
        `INSERT INTO applications_activity (orgid, application_id, activity_description) VALUES (?, ?, ?)`,
        [orgid, application_id, description]
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Error scheduling interview:', error);
    return { error: `Failed to schedule interview: ${error.message}` };
  }
}
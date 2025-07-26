'use server';
import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';

const getdisplayprojectid = (prjid) => {
  return prjid.split('_')[1] || prjid;
};

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

const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    if (!userId || !orgId) {
      console.error('Invalid userId or orgId:', { userId, orgId });
      return 'system';
    }
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
       JOIN emp_role_assign era ON e.empid = era.empid AND e.orgid = era.orgid
       JOIN role_menu_permissions rmp ON era.roleid = rmp.roleid
       JOIN submenu sm ON rmp.submenuid = sm.id
       WHERE e.orgid = ? AND e.STATUS = 'ACTIVE' AND sm.url = '/userscreens/jobs/interview'`,
      [orgid]
    );
    return { success: true, employees: rows };
  } catch (error) {
    console.error('Error fetching employees:', error);
    return { success: false, error: 'Failed to fetch employees' };
  }
}

export async function fetchInterviewData(orgid, application_id) {
  try {
    const pool = await DBconnection();
    const [interviewRows] = await pool.query(
      `SELECT i.start_date, i.start_am_pm, i.end_date, i.end_am_pm, i.start_time, i.end_time, i.meeting_link, i.interview_id, a.status
       FROM interview_table i
       JOIN applications a ON i.application_id = a.applicationid AND i.orgid = a.orgid
       WHERE i.orgid = ? AND i.application_id = ?`,
      [orgid, application_id]
    );
    if (interviewRows.length === 0) {
      return { success: false, error: 'Interview not found.' };
    }

    const interview_id = interviewRows[0].interview_id;
    const [panelRows] = await pool.query(
      'SELECT empid, email, is_he_employee FROM interview_panel WHERE orgid = ? AND interview_id = ?',
      [orgid, interview_id]
    );

    const employeeResult = await getEmployees(orgid);
    const employeeRows = employeeResult.success ? employeeResult.employees : [];

    return {
      success: true,
      interview: interviewRows[0],
      panelMembers: panelRows.map(member => ({
        ...member,
        is_he_employee: String(member.is_he_employee),
      })),
      employees: employeeRows,
    };
  } catch (error) {
    console.error('Error fetching interview data:', error);
    return { success: false, error: 'Failed to fetch interview data.' };
  }
}

export async function updateInterview(formData) {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

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
    const start_date = formData.get('start_date') === '0000-00-00' || formData.get('start_date') === '000000' ? null : formData.get('start_date');
    const start_am_pm = formData.get('start_am_pm');
    const end_date = formData.get('end_date') === '0000-00-00' || formData.get('end_date') === '000000' ? null : formData.get('end_date');
    const end_am_pm = formData.get('end_am_pm');
    const start_time = formData.get('start_time');
    const end_time = formData.get('end_time');
    const meeting_link = formData.get('meeting_link');
    const status = formData.get('status');
    const empid = formData.get('empid');
    const panelMembers = JSON.parse(formData.get('panelMembers'));

    console.log('EmpID:', empid, 'OrgID:', orgid, 'UserID:', userId);

    // Validate required fields and date/time logic for scheduled status
    if (status === 'scheduled') {
      if (!start_date || !start_time) {
        throw new Error('Start date and time are required for scheduled status.');
      }
      if (!start_am_pm || !['AM', 'PM'].includes(start_am_pm)) {
        throw new Error('Start AM/PM must be AM or PM.');
      }
      if (end_date) {
        // Validate start_date <= end_date
        if (start_date > end_date) {
          throw new Error('Start date must be earlier than or equal to end date.');
        }
        // If start_date === end_date and end_time is provided, validate start_time < end_time
        if (start_date === end_date && end_time) {
          if (!end_am_pm || !['AM', 'PM'].includes(end_am_pm)) {
            throw new Error('End AM/PM must be AM or PM when end time is provided.');
          }
          // Convert times to 24-hour format for comparison
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
    }

    // Fetch interview_id
    let interview_id;
    let isNewRecord = false;
    const [interviewRows] = await pool.query(
      'SELECT interview_id FROM interview_table WHERE orgid = ? AND application_id = ?',
      [orgid, application_id]
    );
    if (interviewRows.length === 0) {
      // Generate interview_id
      const [s] = await pool.query(
        'SELECT COUNT(*) AS count FROM interview_table WHERE orgid = ?',
        [orgid]
      );
      const m = s[0].count;
      interview_id = `${orgid}-${m + 1}`;

      // Insert new record into interview_table
      const insertFields = ['orgid', 'application_id', 'interview_id', 'confirm'];
      const insertValues = [orgid, application_id, interview_id, status === 'scheduled' ? '1' : '0'];
      const placeholders = ['?', '?', '?', '?'];

      if (status === 'scheduled') {
        if (start_date) {
          insertFields.push('start_date');
          insertValues.push(start_date);
          placeholders.push('?');
        }
        if (start_am_pm) {
          insertFields.push('start_am_pm');
          insertValues.push(start_am_pm);
          placeholders.push('?');
        }
        if (end_date) {
          insertFields.push('end_date');
          insertValues.push(end_date);
          placeholders.push('?');
        }
        if (end_am_pm) {
          insertFields.push('end_am_pm');
          insertValues.push(end_am_pm);
          placeholders.push('?');
        }
        if (start_time) {
          insertFields.push('start_time');
          insertValues.push(start_time);
          placeholders.push('?');
        }
        if (end_time) {
          insertFields.push('end_time');
          insertValues.push(end_time);
          placeholders.push('?');
        }
        if (meeting_link) {
          insertFields.push('meeting_link');
          insertValues.push(meeting_link);
          placeholders.push('?');
        }
      }

      await pool.query(
        `INSERT INTO interview_table (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`,
        insertValues
      );
      isNewRecord = true;

      // Insert panel members for new record if status is scheduled
      if (status === 'scheduled') {
        if (panelMembers.length === 0) {
          throw new Error('At least one panel member is required for scheduled status.');
        }
        const hasEmployee = panelMembers.some(member => member.is_he_employee === '1');
        if (!hasEmployee) {
          throw new Error('At least one panel member must be a company employee.');
        }

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
            `INSERT INTO interview_panel (orgid, interview_id, empid, email, is_he_employee)
             VALUES (?, ?, ?, ?, ?)`,
            [
              orgid,
              interview_id,
              member.empid || null,
              emailToInsert,
              member.is_he_employee,
            ]
          );
        }
      }
    } else {
      interview_id = interviewRows[0].interview_id;
    }

    // Update interview_table only for existing records
    if (!isNewRecord) {
      if (status === 'hold' || status === 'rejected') {
        // Only update confirm to 0 for hold or rejected
        await pool.query(
          'UPDATE interview_table SET confirm = ? WHERE orgid = ? AND interview_id = ?',
          ['0', orgid, interview_id]
        );
      } else if (status === 'scheduled') {
        // Update confirm and other fields for scheduled
        const updateFields = ['confirm = ?'];
        const updateValues = ['1'];

        if (start_date) {
          updateFields.push('start_date = ?');
          updateValues.push(start_date);
        }
        if (start_am_pm) {
          updateFields.push('start_am_pm = ?');
          updateValues.push(start_am_pm);
        }
        if (end_date) {
          updateFields.push('end_date = ?');
          updateValues.push(end_date);
        }
        if (end_am_pm) {
          updateFields.push('end_am_pm = ?');
          updateValues.push(end_am_pm);
        }
        if (start_time) {
          updateFields.push('start_time = ?');
          updateValues.push(start_time);
        }
        if (end_time) {
          updateFields.push('end_time = ?');
          updateValues.push(end_time);
        }
        if (meeting_link) {
          updateFields.push('meeting_link = ?');
          updateValues.push(meeting_link);
        }

        updateValues.push(orgid, interview_id);
        await pool.query(
          `UPDATE interview_table SET ${updateFields.join(', ')} WHERE orgid = ? AND interview_id = ?`,
          updateValues
        );
      }
    }

    // Update applications table
    await pool.query(
      `UPDATE applications SET status = ? WHERE orgid = ? AND applicationid = ?`,
      [status, orgid, application_id]
    );

    // Handle interview_panel for existing records
    if (!isNewRecord) {
      await pool.query(
        'DELETE FROM interview_panel WHERE orgid = ? AND interview_id = ?',
        [orgid, interview_id]
      );

      if (status === 'scheduled') {
        // Validate panel members
        if (panelMembers.length === 0) {
          throw new Error('At least one panel member is required for scheduled status.');
        }
        const hasEmployee = panelMembers.some(member => member.is_he_employee === '1');
        if (!hasEmployee) {
          throw new Error('At least one panel member must be a company employee.');
        }

        // Insert new panel members
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
            `INSERT INTO interview_panel (orgid, interview_id, empid, email, is_he_employee)
             VALUES (?, ?, ?, ?, ?)`,
            [
              orgid,
              interview_id,
              member.empid || null,
              emailToInsert,
              member.is_he_employee,
            ]
          );
        }
      }
    }

    // Insert into applications_activity
    const employeename = await getCurrentUserEmpIdName(pool, userId, orgid);
    console.log('Employee Name:', employeename);
    if (employeename === 'unknown' || employeename === 'system') {
      throw new Error(`Failed to fetch valid employee name for userId: ${userId}`);
    }
    const description = `Interview updated to ${status}(after scheduled) by ${employeename} on ${new Date().toISOString()}`;
    await pool.query(
      `INSERT INTO applications_activity (orgid, application_id, activity_description) VALUES (?, ?, ?)`,
      [orgid, application_id, description]
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating interview:', error);
    return { error: `Failed to update interview: ${error.message}` };
  }
}
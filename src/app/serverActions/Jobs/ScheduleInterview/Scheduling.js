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

export async function scheduleInterview(formData) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;
  
  if (!token) 
  {
      console.log('Redirecting: No token found');
      return { error: 'No token found. Please log in.' };
  }
  
  // Decode the token to get the orgid and userId
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) 
  {
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
    const empid = formData.get('empid');
    const panelMembers = JSON.parse(formData.get('panelMembers'));

    // Log empid and orgid for debugging
    console.log('EmpID:', empid, 'OrgID:', orgid);

    // Generate unique interview_id
    const [s] = await pool.query(
      'SELECT COUNT(*) AS count FROM interview_table WHERE orgid = ?',
      [orgid]
    );
    const m = s[0].count;
    const interview_id = `${orgid}-${m + 1}`;

    // Insert into interview_table
    await pool.query(
      `INSERT INTO interview_table (orgid, interview_id, application_id, start_date, start_am_pm, end_date, end_am_pm, end_time, meeting_link, start_time, confirm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1')`,
      [
        orgid,
        interview_id,
        application_id,
        start_date,
        start_am_pm,
        end_date,
        end_am_pm || null,
        end_time || null,
        meeting_link || null,
        start_time,
      ]
    );

    // Insert panel members into interview_panel
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

    // Update applications table status
    await pool.query(
      `UPDATE applications SET status = 'scheduled' WHERE applicationid = ? AND orgid = ?`,
      [application_id, orgid]
    );

    // Insert into applications_activity
    const employeename = await getCurrentUserEmpIdName(pool, userId, orgid);
    console.log('Employee Name:', employeename);
    const description = `Scheduled by ${employeename} on ${new Date().toISOString()}`;
    await pool.query(
      `INSERT INTO applications_activity (orgid, application_id, activity_description) VALUES (?, ?, ?)`,
      [orgid, application_id, description]
    );

    return { success: true };
  } catch (error) {
    console.error('Error scheduling interview:', error);
    return { error: `Failed to schedule interview: ${error.message}` };
  }
}
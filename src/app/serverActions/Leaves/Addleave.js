'use server'
import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import { fetchEmployeesUnderSuperior } from '@/app/serverActions/Leaves/Overview';

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

export async function addEmployeeLeave(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId || !decoded.orgid) {
      console.log('Invalid token or userId/orgid not found');
      return { error: 'Invalid token or userId/orgid not found.' };
    }

    const userId = decoded.userId;
    const orgid = decoded.orgid;
    const empid = formData.get('empid');

    if (!empid) {
      console.log('Employee ID is missing');
      return { error: 'Employee ID is required.' };
    }

    const leaveid = parseInt(formData.get('leaveid'), 10);
    const startdate = formData.get('startdate');
    const enddate = formData.get('enddate');
    const am_pm = formData.get('am_pm');
    const description = formData.get('description') || '';

    if (!leaveid || !startdate || !enddate || !am_pm) {
      console.log('Missing required fields');
      return { error: 'All fields are required except reason.' };
    }

    const pool = await DBconnection();

    // Verify empid exists in C_EMP
    const [empRows] = await pool.execute(
      'SELECT empid FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgid]
    );
    if (empRows.length === 0) {
      console.log('Employee not found for empid:', empid, 'orgid:', orgid);
      return { error: 'Employee not found.' };
    }

    // Verify leaveid is valid
    const [leaveTypeRows] = await pool.execute(
      'SELECT id FROM generic_values WHERE g_id = ? AND orgid = ? AND id = ? AND isactive = 1',
      [1, orgid, leaveid]
    );
    if (leaveTypeRows.length === 0) {
      console.log('Invalid leaveid or leave type not active:', leaveid);
      return { error: 'Invalid or inactive leave type selected.' };
    }

    // Validate dates
    const startDateObj = new Date(startdate);
    const endDateObj = new Date(enddate);

    if (isNaN(startDateObj) || isNaN(endDateObj)) {
      console.log('Invalid date format - startdate:', startdate, 'enddate:', enddate);
      return { error: 'Invalid date format.' };
    }
    if (startDateObj > endDateObj) {
      console.log('Start date must not be after end date');
      return { error: 'Start date must not be after end date.' };
    }

    // Calculate noofnoons
    const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
    const requestedDays = am_pm === 'both' ? daysDiff : daysDiff * 0.5;
    const noofnoons = am_pm === 'both' ? daysDiff * 2 : daysDiff;

    // Check available leaves
    const [assignRows] = await pool.execute(
      'SELECT noofleaves FROM employee_leaves_assign WHERE empid = ? AND orgid = ? AND leaveid = ?',
      [empid, orgid, leaveid]
    );
    if (assignRows.length === 0 || assignRows[0].noofleaves < requestedDays) {
      console.log('Insufficient leaves available:', { requestedDays, available: assignRows[0]?.noofleaves });
      return { error: 'You do not have sufficient leaves available.' };
    }

    // Insert into employee_leaves
    const [result] = await pool.execute(
      `INSERT INTO employee_leaves (empid, orgid, g_id, leaveid, startdate, enddate, status, noofnoons, am_pm, description)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [empid, orgid, 1, leaveid, startdate, enddate, noofnoons, am_pm, description]
    );

    if (result.affectedRows === 0) {
      console.log('Failed to insert leave request for empid:', empid, 'leaveid:', leaveid);
      return { error: 'Failed to insert leave request.' };
    }

    console.log('Leave request added successfully with ID:', result.insertId);
    return { success: true, leaveId: result.insertId };
  } catch (error) {
    console.error('Error adding leave request:', error.message);
    return { error: `Failed to add leave request: ${error.message}` };
  }
}

export async function fetchLeaveTypes() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      return { error: 'Invalid token or orgid not found.' };
    }

    const orgId = decoded.orgid;

    const pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT id, Name FROM generic_values WHERE g_id = ? AND orgid = ? AND isactive = 1`,
      [1, orgId]
    );

    if (rows.length === 0) {
      console.log('No active leave types found for orgId:', orgId);
      return [];
    }

    console.log('Fetched leave types:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching leave types:', error.message);
    return { error: `Failed to fetch leave types: ${error.message}` };
  }
}

export async function approveEmployeeLeave(leaveId, action) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId || !decoded.orgid) {
      console.log('Invalid token or userId/orgid not found');
      return { error: 'Invalid token or userId/orgid not found.' };
    }

    const userId = decoded.userId;
    const orgid = decoded.orgid;

    const pool = await DBconnection();

    // Get current user's empid
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgid]
    );
    if (userRows.length === 0) {
      console.log('User not found for userId:', userId, 'orgid:', orgid);
      return { error: 'User not found.' };
    }
    const currentEmpId = userRows[0].empid;

    // Verify user is authorized to approve (is superior)
    const { employees } = await fetchEmployeesUnderSuperior();
    const subordinateEmpIds = employees.map(emp => emp.empid).filter(id => id !== currentEmpId);
    if (!subordinateEmpIds.length) {
      console.log('User is not authorized to approve leaves - no subordinates found for empid:', currentEmpId);
      return { error: 'You are not authorized to approve leaves.' };
    }

    // Fetch leave request
    const [leaveRows] = await pool.execute(
      'SELECT empid, leaveid, noofnoons, am_pm, status FROM employee_leaves WHERE id = ? AND orgid = ?',
      [leaveId, orgid]
    );
    console.log('Fetched leave rows for approval:', leaveRows);
    if (leaveRows.length === 0) {
      console.log('Leave request not found for leaveId:', leaveId, 'orgid:', orgid);
      return { error: 'Leave request not found.' };
    }
    const leave = leaveRows[0];

    // Verify the leave belongs to a subordinate
    if (!subordinateEmpIds.includes(leave.empid)) {
      console.log('User is not authorized to approve leave for empid:', leave.empid, 'leaveId:', leaveId);
      return { error: 'You are not authorized to approve this leave request.' };
    }

    if (leave.status !== 'pending') {
      console.log('Leave already processed for leaveId:', leaveId);
      return { error: 'Leave request already processed.' };
    }

    const noofnoons = leave.noofnoons || 0;
    const leaveDays = leave.am_pm === 'both' ? 1.0 * noofnoons : 0.5 * noofnoons;

    // Get superior's details
    const [superiorInfo] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME, roleid FROM C_EMP WHERE empid = ?',
      [currentEmpId]
    );
    const superiorName = `${superiorInfo[0]?.EMP_FST_NAME} ${superiorInfo[0]?.EMP_LAST_NAME || ''}`.trim();
    const [roleInfo] = await pool.execute(
      'SELECT rolename FROM org_role_table WHERE roleid = ? AND orgid = ?',
      [superiorInfo[0]?.roleid, orgid]
    );
    const superiorRole = roleInfo[0]?.rolename || 'Unknown Role';

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    // Update employee_leaves
    const [updateResult] = await pool.execute(
      `UPDATE employee_leaves SET status = ?, approved_by = ?, approved_role = ? WHERE id = ?`,
      [newStatus, superiorName, superiorRole, leaveId]
    );

    if (updateResult.affectedRows === 0) {
      console.log('Failed to update leave request for leaveId:', leaveId);
      return { error: 'Failed to update leave request.' };
    }

    // If accepted, update leave balance
    if (newStatus === 'accepted') {
      const [assignRows] = await pool.execute(
        'SELECT noofleaves FROM employee_leaves_assign WHERE empid = ? AND orgid = ? AND leaveid = ?',
        [leave.empid, orgid, leave.leaveid]
      );
      if (assignRows.length === 0 || assignRows[0].noofleaves < leaveDays) {
        // Revert status if insufficient leaves
        await pool.execute(
          `UPDATE employee_leaves SET status = 'pending', approved_by = NULL, approved_role = NULL WHERE id = ?`,
          [leaveId]
        );
        console.log('Insufficient leaves for approval - empid:', leave.empid, 'leaveid:', leave.leaveid);
        return { error: 'Insufficient leaves available for approval.' };
      }

      const [updateBalanceResult] = await pool.execute(
        'UPDATE employee_leaves_assign SET noofleaves = noofleaves - ? WHERE empid = ? AND orgid = ? AND leaveid = ?',
        [leaveDays, leave.empid, orgid, leave.leaveid]
      );
      if (updateBalanceResult.affectedRows === 0) {
        console.log('Failed to update leave balance for empid:', leave.empid, 'leaveid:', leave.leaveid);
        return { error: 'Failed to update leave balance.' };
      }
    }

    console.log('Leave request processed successfully - leaveId:', leaveId, 'status:', newStatus);
    return { success: true, leaveId, status: newStatus };
  } catch (error) {
    console.error('Error approving leave request:', error.message);
    return { error: `Failed to approve leave request: ${error.message}` };
  }
}
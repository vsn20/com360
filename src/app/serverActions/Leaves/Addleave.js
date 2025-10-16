"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
// Import the central permission function
import { getLeaveManagementScope } from "./Overview"; 

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
    const token = cookies().get('jwt_token')?.value;
    if (!token) return { error: 'No token found. Please log in.' };
    
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId || !decoded.orgid) return { error: 'Invalid token.' };

    const { userId, orgid } = decoded;
    const pool = await DBconnection();
    const [userRows] = await pool.execute('SELECT empid FROM C_USER WHERE username = ?', [userId]);
    if(userRows.length === 0) return { error: 'User not found.' };
    const empid = userRows[0].empid;

    const leaveid = parseInt(formData.get('leaveid'), 10);
    const startdate = formData.get('startdate');
    const enddate = formData.get('enddate');
    const am_pm = formData.get('am_pm');
    const description = formData.get('description') || '';

    if (!leaveid || !startdate || !enddate || !am_pm) return { error: 'All fields are required except reason.' };
    if (new Date(startdate) > new Date(enddate)) return { error: 'Start date must not be after end date.' };

    const daysDiff = Math.ceil((new Date(enddate) - new Date(startdate)) / (1000 * 60 * 60 * 24)) + 1;
    const requestedDays = am_pm === 'both' ? daysDiff : daysDiff * 0.5;
    const noofnoons = am_pm === 'both' ? daysDiff * 2 : daysDiff;

    const [assignRows] = await pool.execute(
      'SELECT noofleaves FROM C_EMPLOYEE_LEAVES_ASSIGN WHERE empid = ? AND orgid = ? AND leaveid = ?',
      [empid, orgid, leaveid]
    );
    if (assignRows.length === 0 || assignRows[0].noofleaves < requestedDays) {
      return { error: 'You do not have sufficient leaves available.' };
    }

    await pool.execute(
      `INSERT INTO C_EMPLOYEE_LEAVES (empid, orgid, g_id, leaveid, startdate, enddate, status, noofnoons, am_pm, description)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [empid, orgid, 1, leaveid, startdate, enddate, noofnoons, am_pm, description]
    );
    return { success: true };
  } catch (error) {
    console.error('Error adding leave request:', error.message);
    return { error: `Failed to add leave request: ${error.message}` };
  }
}

export async function approveEmployeeLeave(leaveId, action) {
  try {
    const token = cookies().get('jwt_token')?.value;
    if (!token) return { error: 'No token found. Please log in.' };
    
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId || !decoded.orgid) return { error: 'Invalid token.' };

    const { userId, orgid } = decoded;
    const pool = await DBconnection();

    const [userRows] = await pool.execute('SELECT empid FROM C_USER WHERE username = ? AND orgid = ?', [userId, orgid]);
    if (userRows.length === 0) return { error: 'User not found.' };
    const currentEmpId = userRows[0].empid;

    const [leaveRows] = await pool.execute('SELECT * FROM C_EMPLOYEE_LEAVES WHERE id = ? AND orgid = ?', [leaveId, orgid]);
    if (leaveRows.length === 0) return { error: 'Leave request not found.' };
    const leave = leaveRows[0];

    // *** PERMISSION CHECK using corrected scope function ***
    const scope = await getLeaveManagementScope(pool, currentEmpId, orgid);
    if (!scope.manageableEmpIds.includes(leave.empid)) {
        return { error: 'You are not authorized to approve this leave request.' };
    }

    if (leave.status !== 'pending') return { error: 'Leave request already processed.' };

    const leaveDays = leave.am_pm === 'both' ? (leave.noofnoons || 0) / 2.0 : (leave.noofnoons || 0) * 0.5;
    const [superiorInfo] = await pool.execute('SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?', [currentEmpId]);
    const superiorName = superiorInfo.length > 0 ? `${superiorInfo[0].EMP_FST_NAME} ${superiorInfo[0].EMP_LAST_NAME || ''}`.trim() : 'System';
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    await pool.execute(`UPDATE C_EMPLOYEE_LEAVES SET status = ?, approved_by = ? WHERE id = ?`, [newStatus, superiorName, leaveId]);

    if (newStatus === 'accepted') {
        const [assignRows] = await pool.execute('SELECT noofleaves FROM C_EMPLOYEE_LEAVES_ASSIGN WHERE empid = ? AND leaveid = ?', [leave.empid, leave.leaveid]);
        if (assignRows.length === 0 || assignRows[0].noofleaves < leaveDays) {
            await pool.execute(`UPDATE C_EMPLOYEE_LEAVES SET status = 'pending', approved_by = NULL WHERE id = ?`, [leaveId]);
            return { error: 'Insufficient leaves available for approval.' };
        }
        await pool.execute('UPDATE C_EMPLOYEE_LEAVES_ASSIGN SET noofleaves = noofleaves - ? WHERE empid = ? AND leaveid = ?', [leaveDays, leave.empid, leave.leaveid]);
    }
    return { success: true };
  } catch (error) {
    console.error('Error approving leave request:', error.message);
    return { error: `Failed to approve leave request: ${error.message}` };
  }
}

export async function updateEmployeeLeave(leaveId, formData) {
    const pool = await DBconnection();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const token = cookies().get('jwt_token')?.value;
        if (!token) throw new Error('Authentication token not found.');
        const decoded = decodeJwt(token);
        if (!decoded || !decoded.userId || !decoded.orgid) throw new Error('Invalid authentication token.');
        
        const { userId, orgid } = decoded;
        const [userRows] = await connection.execute('SELECT empid FROM C_USER WHERE username = ?', [userId]);
        if (userRows.length === 0) throw new Error('User not found.');
        const currentEmpId = userRows[0].empid;

        const [leaveRows] = await connection.execute('SELECT * FROM C_EMPLOYEE_LEAVES WHERE id = ? AND orgid = ?', [leaveId, orgid]);
        if (leaveRows.length === 0) throw new Error('Leave request not found.');
        const originalLeave = leaveRows[0];
        
        // *** PERMISSION CHECK using corrected scope function ***
        const scope = await getLeaveManagementScope(connection, currentEmpId, orgid);
        const canEditAnytime = scope.manageableEmpIds.includes(originalLeave.empid);
        const canEditOwnPending = (currentEmpId === originalLeave.empid) && (originalLeave.status === 'pending');
        
        if (!canEditAnytime && !canEditOwnPending) {
            throw new Error('You are not authorized to edit this leave request.');
        }

        const leaveid = parseInt(formData.get('leaveid'), 10);
        const startdate = formData.get('startdate');
        const enddate = formData.get('enddate');
        const am_pm = formData.get('am_pm');
        const description = formData.get('description') || '';
        const status = canEditAnytime ? formData.get('status') : originalLeave.status;

        if (new Date(startdate) > new Date(enddate)) throw new Error('Start date cannot be after end date.');
        
        const calculateDays = (noons, duration) => noons ? (duration === 'both' ? noons / 2.0 : noons * 0.5) : 0;

        const originalDays = calculateDays(originalLeave.noofnoons, originalLeave.am_pm);
        const newDaysDiff = Math.ceil((new Date(enddate) - new Date(startdate)) / (1000 * 60 * 60 * 24)) + 1;
        const newNoons = am_pm === 'both' ? newDaysDiff * 2 : newDaysDiff;
        const newDays = am_pm === 'both' ? newDaysDiff : newDaysDiff * 0.5;

        if (originalLeave.status === 'accepted') {
            await connection.execute(
                'UPDATE C_EMPLOYEE_LEAVES_ASSIGN SET noofleaves = noofleaves + ? WHERE empid = ? AND leaveid = ? AND orgid = ?',
                [originalDays, originalLeave.empid, originalLeave.leaveid, orgid]
            );
        }

        if (status === 'accepted') {
            const [assignRows] = await connection.execute(
                'SELECT noofleaves FROM C_EMPLOYEE_LEAVES_ASSIGN WHERE empid = ? AND leaveid = ? AND orgid = ?',
                [originalLeave.empid, leaveid, orgid]
            );
            if (assignRows.length === 0 || assignRows[0].noofleaves < newDays) {
                throw new Error('Insufficient leave balance for this change.');
            }
            await connection.execute(
                'UPDATE C_EMPLOYEE_LEAVES_ASSIGN SET noofleaves = noofleaves - ? WHERE empid = ? AND leaveid = ? AND orgid = ?',
                [newDays, originalLeave.empid, leaveid, orgid]
            );
        }

        const [approverRows] = await connection.execute('SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?', [currentEmpId]);
        const approverName = approverRows.length > 0 ? `${approverRows[0].EMP_FST_NAME} ${approverRows[0].EMP_LAST_NAME || ''}`.trim() : 'System';

        await connection.execute(
            `UPDATE C_EMPLOYEE_LEAVES 
             SET leaveid = ?, startdate = ?, enddate = ?, status = ?, noofnoons = ?, am_pm = ?, description = ?, approved_by = ?
             WHERE id = ?`,
            [leaveid, startdate, enddate, status, newNoons, am_pm, description, status !== 'pending' ? approverName : null, leaveId]
        );
        
        await connection.commit();
        return { success: true };
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating leave request:', error.message);
        return { error: `Failed to update leave request: ${error.message}` };
    } finally {
        if (connection) connection.release();
    }
}

// **RESTORED**: fetchLeaveTypes is back in this file and exported.
export async function fetchLeaveTypes() {
  try {
    const token = cookies().get('jwt_token')?.value;
    if (!token) return { error: 'No token found.' };
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) return { error: 'Invalid token.' };

    const pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1`,
      [1, decoded.orgid]
    );
    return rows;
  } catch (error) {
    return { error: `Failed to fetch leave types: ${error.message}` };
  }
}
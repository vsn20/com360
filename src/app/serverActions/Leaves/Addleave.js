"use server";

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

// Internal helper functions, not exported
const isUserAdmin = async (pool, empId, orgId) => {
  if (!empId || !orgId) return false;
  const [rows] = await pool.execute(
    `SELECT 1 FROM C_EMP_ROLE_ASSIGN era 
     JOIN C_ORG_ROLE_TABLE r ON era.roleid = r.roleid AND era.orgid = r.orgid
     WHERE era.empid = ? AND era.orgid = ? AND r.isadmin = 1 LIMIT 1`,
    [empId, orgId]
  );
  return rows.length > 0;
};

const getAllSubordinatesCTE = async (pool, superiorEmpId) => {
  if (!superiorEmpId) return [];
  const query = `
      WITH RECURSIVE SubordinateHierarchy AS (
          SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, superior FROM C_EMP WHERE superior = ?
          UNION ALL
          SELECT e.empid, e.EMP_FST_NAME, e.EMP_LAST_NAME, e.superior FROM C_EMP e
          INNER JOIN SubordinateHierarchy sh ON e.superior = sh.empid
      )
      SELECT DISTINCT empid, EMP_FST_NAME, EMP_LAST_NAME FROM SubordinateHierarchy;
  `;
  const [rows] = await pool.execute(query, [superiorEmpId]);
  return rows;
};

const getDelegatedSubordinatesCTE = async (pool, userEmpId) => {
  const [delegateRows] = await pool.execute(
    `SELECT senderempid FROM C_DELEGATE WHERE receiverempid = ? AND menuid = (SELECT id FROM C_MENU WHERE name = 'Leaves') AND isactive = 1 AND (submenuid IS NULL OR submenuid = 0)`,
    [userEmpId]
  );
  if (delegateRows.length === 0) return [];
  
  const delegatedSuperiorIds = delegateRows.map(row => row.senderempid);
  const placeholders = delegatedSuperiorIds.map(() => '?').join(',');

  const query = `
      WITH RECURSIVE DelegatedHierarchy AS (
          SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid IN (${placeholders})
          UNION ALL
          SELECT e.empid, e.EMP_FST_NAME, e.EMP_LAST_NAME FROM C_EMP e
          INNER JOIN DelegatedHierarchy dh ON e.superior = dh.empid
      )
      SELECT DISTINCT empid, EMP_FST_NAME, EMP_LAST_NAME FROM DelegatedHierarchy;
  `;
  const [allRelatedEmployees] = await pool.execute(query, [...delegatedSuperiorIds]);
  return allRelatedEmployees.filter(emp => emp.empid !== userEmpId && !delegatedSuperiorIds.includes(emp.empid));
};

export async function fetchEmployeesUnderSuperior() {
  try {
    const token = cookies().get("jwt_token")?.value;
    if (!token) return { error: "No token found." };

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId) return { error: "Invalid token." };

    const pool = await DBconnection();
    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
    if (!userRows.length) return { error: "User not found." };
    const superiorEmpId = userRows[0].empid;

    const [selfRows] = await pool.execute("SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?", [superiorEmpId]);
    const currentEmployee = selfRows[0] || {};
    
    const directSubordinates = await getAllSubordinatesCTE(pool, superiorEmpId);
    const delegatedSubordinates = await getDelegatedSubordinatesCTE(pool, superiorEmpId);

    let allEmployees = [currentEmployee, ...directSubordinates, ...delegatedSubordinates];
    
    const uniqueEmployees = allEmployees.reduce((acc, current) => {
        if (!acc.find(item => item.empid === current.empid)) acc.push(current);
        return acc;
    }, []);

    return { employees: uniqueEmployees };
  } catch (error) {
    console.error("Error fetching employees under superior:", error.message);
    return { error: `Failed to fetch employees: ${error.message}` };
  }
}

export async function addEmployeeLeave(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
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
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
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

    const isAdmin = await isUserAdmin(pool, currentEmpId, orgid);
    const directSubordinates = await getAllSubordinatesCTE(pool, currentEmpId);
    const delegatedSubordinates = await getDelegatedSubordinatesCTE(pool, currentEmpId);
    const allManageableEmployees = [...directSubordinates, ...delegatedSubordinates]
        .filter((sub, index, self) => index === self.findIndex((s) => s.empid === sub.empid));

    const isSuperior = allManageableEmployees.some(sub => sub.empid === leave.empid);
    const isAdminSelfApproving = isAdmin && currentEmpId === leave.empid;

    if (!isSuperior && !isAdminSelfApproving) return { error: 'You are not authorized to approve this leave request.' };
    if (leave.status !== 'pending') return { error: 'Leave request already processed.' };

    const leaveDays = leave.am_pm === 'both' ? (leave.noofnoons || 0) / 2.0 : (leave.noofnoons || 0) * 0.5;
    const [superiorInfo] = await pool.execute('SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?', [currentEmpId]);
    const superiorName = superiorInfo.length > 0 ? `${superiorInfo[0].EMP_FST_NAME} ${superiorInfo[0].EMP_LAST_NAME || ''}`.trim() : 'Admin';
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
        const leaveOwnerEmpId = originalLeave.empid;
        
        const isAdmin = await isUserAdmin(connection, currentEmpId, orgid);
        const directAndIndirectSubordinates = await getAllSubordinatesCTE(connection, currentEmpId);
        const delegatedSubordinates = await getDelegatedSubordinatesCTE(connection, currentEmpId);
        
        const allManageableEmployees = [...directAndIndirectSubordinates, ...delegatedSubordinates]
            .filter((sub, index, self) => index === self.findIndex((s) => s.empid === sub.empid));

        const isSuperior = allManageableEmployees.some(sub => sub.empid === leaveOwnerEmpId);
        const canEditOwnLeave = (currentEmpId === leaveOwnerEmpId) && (originalLeave.status === 'pending' || isAdmin);

        if (!isSuperior && !canEditOwnLeave) {
            throw new Error('You are not authorized to edit this leave request.');
        }

        const leaveid = parseInt(formData.get('leaveid'), 10);
        const startdate = formData.get('startdate');
        const enddate = formData.get('enddate');
        const am_pm = formData.get('am_pm');
        const description = formData.get('description') || '';
        const status = (isAdmin || isSuperior) ? formData.get('status') : originalLeave.status;

        if (new Date(startdate) > new Date(enddate)) throw new Error('Start date cannot be after end date.');
        
        const calculateDays = (noons, duration) => {
            if (!noons) return 0;
            return duration === 'both' ? noons / 2.0 : noons * 0.5;
        };

        const originalDays = calculateDays(originalLeave.noofnoons, originalLeave.am_pm);
        
        const newDaysDiff = Math.ceil((new Date(enddate) - new Date(startdate)) / (1000 * 60 * 60 * 24)) + 1;
        const newNoons = am_pm === 'both' ? newDaysDiff * 2 : newDaysDiff;
        const newDays = am_pm === 'both' ? newDaysDiff : newDaysDiff * 0.5;

        if (originalLeave.status === 'accepted') {
            await connection.execute(
                'UPDATE C_EMPLOYEE_LEAVES_ASSIGN SET noofleaves = noofleaves + ? WHERE empid = ? AND leaveid = ? AND orgid = ?',
                [originalDays, leaveOwnerEmpId, originalLeave.leaveid, orgid]
            );
        }

        if (status === 'accepted') {
            const [assignRows] = await connection.execute(
                'SELECT noofleaves FROM C_EMPLOYEE_LEAVES_ASSIGN WHERE empid = ? AND leaveid = ? AND orgid = ?',
                [leaveOwnerEmpId, leaveid, orgid]
            );
            if (assignRows.length === 0 || assignRows[0].noofleaves < newDays) {
                throw new Error('Insufficient leave balance for this change.');
            }
            await connection.execute(
                'UPDATE C_EMPLOYEE_LEAVES_ASSIGN SET noofleaves = noofleaves - ? WHERE empid = ? AND leaveid = ? AND orgid = ?',
                [newDays, leaveOwnerEmpId, leaveid, orgid]
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
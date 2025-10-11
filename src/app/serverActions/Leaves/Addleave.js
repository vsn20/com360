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

const formatDate = (date) => {
  if (!date || isNaN(new Date(date))) return '';
  const d = new Date(date);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${month}/${day}/${d.getUTCFullYear()}`;
};



const getAllSubordinates = async (pool, superiorEmpId, visited = new Set()) => {
  if (visited.has(superiorEmpId)) return [];
  visited.add(superiorEmpId);

  try {
    const [directSubordinates] = await pool.execute(
      "SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE superior = ?",
      [superiorEmpId]
    );
    console.log("Direct subordinates for:", superiorEmpId, directSubordinates);

    let allSubordinates = [...directSubordinates];
    for (const subordinate of directSubordinates) {
      const nestedSubordinates = await getAllSubordinates(pool, subordinate.empid, visited);
      allSubordinates = allSubordinates.concat(nestedSubordinates);
    }

    // Exclude the superiorEmpId itself from the subordinates list
    const [self] = await pool.execute(
      "SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?",
      [superiorEmpId]
    );
    if (self.length > 0) {
      allSubordinates = allSubordinates.filter(sub => sub.empid !== superiorEmpId);
    }

    const uniqueSubordinates = allSubordinates.reduce((unique, item) => {
      return unique.findIndex(existing => existing.empid === item.empid) === -1
        ? [...unique, item]
        : unique;
    }, []);

    return uniqueSubordinates;
  } catch (error) {
    console.error("Error in getAllSubordinates:", error);
    return [];
  }
};

const getDelegatedSubordinates = async (pool, userEmpId) => {
  const [delegateRows] = await pool.execute(
    "SELECT senderempid FROM C_DELEGATE WHERE receiverempid = ? AND menuid = (SELECT id FROM C_MENU WHERE name = 'Leaves') AND isactive = 1 AND (submenuid IS NULL OR submenuid = 0)",
    [userEmpId]
  );
  const delegatedSuperiors = delegateRows.map(row => row.senderempid);
  console.log("Delegated superiors for Leaves:", delegatedSuperiors);

  let allSubordinates = [];
  for (const superiorId of delegatedSuperiors) {
    const subordinates = await getAllSubordinates(pool, superiorId, new Set());
    allSubordinates = allSubordinates.concat(subordinates);
  }

  if (delegatedSuperiors.length > 0) {
    const placeholders = delegatedSuperiors.map(() => '?').join(',');
    const [hierarchyRows] = await pool.execute(
      `SELECT empid, superior FROM C_EMP WHERE superior IN (${placeholders})`,
      [...delegatedSuperiors]
    );
    const subordinateIds = hierarchyRows.map(row => row.empid);
    for (const subId of subordinateIds) {
      const nestedSubordinates = await getAllSubordinates(pool, subId, new Set());
      allSubordinates = allSubordinates.concat(nestedSubordinates);
    }
  }

  // Exclude the userEmpId (receiver) and delegated superiors from the subordinates list
  return allSubordinates.filter((sub, index, self) =>
    index === self.findIndex((s) => s.empid === sub.empid) &&
    sub.empid !== userEmpId &&
    !delegatedSuperiors.includes(sub.empid)
  ); // Deduplicate and exclude superiors
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
    const empid = decoded.empid;

    console.log("empidddd",empid);

    if (!empid) {
      console.log('Employee ID is missingddddddddddd');
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

    const [empRows] = await pool.execute(
      'SELECT empid FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgid]
    );
    if (empRows.length === 0) {
      console.log('Employee not found for empid:', empid, 'orgid:', orgid);
      return { error: 'Employee not found.' };
    }

    const [leaveTypeRows] = await pool.execute(
      'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND id = ? AND isactive = 1',
      [1, orgid, leaveid]
    );
    if (leaveTypeRows.length === 0) {
      console.log('Invalid leaveid or leave type not active:', leaveid);
      return { error: 'Invalid or inactive leave type selected.' };
    }

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

    const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
    const requestedDays = am_pm === 'both' ? daysDiff : daysDiff * 0.5;
    const noofnoons = am_pm === 'both' ? daysDiff * 2 : daysDiff;

    const [assignRows] = await pool.execute(
      'SELECT noofleaves FROM C_EMPLOYEE_LEAVES_ASSIGN WHERE empid = ? AND orgid = ? AND leaveid = ?',
      [empid, orgid, leaveid]
    );
    if (assignRows.length === 0 || assignRows[0].noofleaves < requestedDays) {
      console.log('Insufficient leaves available:', { requestedDays, available: assignRows[0]?.noofleaves });
      return { error: 'You do not have sufficient leaves available.' };
    }

    const [result] = await pool.execute(
      `INSERT INTO C_EMPLOYEE_LEAVES (empid, orgid, g_id, leaveid, startdate, enddate, status, noofnoons, am_pm, description)
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
      `SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1`,
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

    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgid]
    );
    if (userRows.length === 0) {
      console.log('User not found for userId:', userId, 'orgid:', orgid);
      return { error: 'User not found.' };
    }
    const currentEmpId = userRows[0].empid;

    const directSubordinates = await getAllSubordinates(pool, currentEmpId);
    const delegatedSubordinates = await getDelegatedSubordinates(pool, currentEmpId);
    const allSubordinates = [...directSubordinates, ...delegatedSubordinates]
      .filter((sub, index, self) => index === self.findIndex((s) => s.empid === sub.empid) && sub.empid !== currentEmpId);

    if (!allSubordinates.length) {
      console.log('User is not authorized to approve leaves - no subordinates found for empid:', currentEmpId);
      return { error: 'You are not authorized to approve leaves.' };
    }

    const [leaveRows] = await pool.execute(
      'SELECT empid, leaveid, noofnoons, am_pm, status FROM C_EMPLOYEE_LEAVES WHERE id = ? AND orgid = ?',
      [leaveId, orgid]
    );
    console.log('Fetched leave rows for approval:', leaveRows);
    if (leaveRows.length === 0) {
      console.log('Leave request not found for leaveId:', leaveId, 'orgid:', orgid);
      return { error: 'Leave request not found.' };
    }
    const leave = leaveRows[0];

    if (!allSubordinates.some(sub => sub.empid === leave.empid)) {
      console.log('User is not authorized to approve leave for empid:', leave.empid, 'leaveId:', leaveId);
      return { error: 'You are not authorized to approve this leave request.' };
    }

    if (leave.status !== 'pending') {
      console.log('Leave already processed for leaveId:', leaveId);
      return { error: 'Leave request already processed.' };
    }

    const noofnoons = leave.noofnoons || 0;
    const leaveDays = leave.am_pm === 'both' ? 1.0 * noofnoons : 0.5 * noofnoons;

    const [superiorInfo] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?',
      [currentEmpId, orgid]
    );
    if (superiorInfo.length === 0) {
      console.log('Superior not found for empid:', currentEmpId);
      return { error: 'Approving employee not found.' };
    }
    const superiorName = `${superiorInfo[0].EMP_FST_NAME} ${superiorInfo[0].EMP_LAST_NAME || ''}`.trim();

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    const [updateResult] = await pool.execute(
      `UPDATE C_EMPLOYEE_LEAVES SET status = ?, approved_by = ?, approved_role = NULL WHERE id = ? AND orgid = ?`,
      [newStatus, superiorName, leaveId, orgid]
    );

    if (updateResult.affectedRows === 0) {
      console.log('Failed to update leave request for leaveId:', leaveId);
      return { error: 'Failed to update leave request.' };
    }

    if (newStatus === 'accepted') {
      const [assignRows] = await pool.execute(
        'SELECT noofleaves FROM C_EMPLOYEE_LEAVES_ASSIGN WHERE empid = ? AND orgid = ? AND leaveid = ?',
        [leave.empid, orgid, leave.leaveid]
      );
      if (assignRows.length === 0 || assignRows[0].noofleaves < leaveDays) {
        await pool.execute(
          `UPDATE C_EMPLOYEE_LEAVES SET status = 'pending', approved_by = NULL, approved_role = NULL WHERE id = ?`,
          [leaveId]
        );
        console.log('Insufficient leaves for approval - empid:', leave.empid, 'leaveid:', leave.leaveid);
        return { error: 'Insufficient leaves available for approval.' };
      }

      const [updateBalanceResult] = await pool.execute(
        'UPDATE C_EMPLOYEE_LEAVES_ASSIGN SET noofleaves = noofleaves - ? WHERE empid = ? AND orgid = ? AND leaveid = ?',
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

export async function fetchEmployeeLeaves(empId) {
  try {
    const token = cookies().get("jwt_token")?.value;
    if (!token) throw new Error("No token found. Please log in.");

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId) throw new Error("Invalid token or userId not found.");

    const userId = decoded.userId;
    const pool = await DBconnection();

    const [userRows] = await pool.execute(
      "SELECT empid FROM C_USER WHERE username = ?",
      [userId]
    );
    if (!userRows.length) throw new Error("User not found.");

    const currentEmpId = userRows[0].empid;
    const orgId = decoded.orgid;
    if (!orgId) throw new Error("Organization ID is missing or invalid.");

    const directSubordinates = await getAllSubordinates(pool, currentEmpId);
    const delegatedSubordinates = await getDelegatedSubordinates(pool, currentEmpId);
    const allSubordinates = [...directSubordinates, ...delegatedSubordinates]
      .filter((sub, index, self) => index === self.findIndex((s) => s.empid === sub.empid) && sub.empid !== currentEmpId);

    const authorizedEmpIds = [currentEmpId, ...allSubordinates.map(sub => sub.empid)].includes(empId) ? [empId] : [currentEmpId];

    const [rows] = await pool.execute(
      `SELECT l.id, l.empid, l.orgid, l.g_id, gv.Name AS leave_name, l.startdate, l.enddate, l.status, l.noofnoons, l.am_pm, l.description, l.approved_by, l.approved_role 
       FROM C_EMPLOYEE_LEAVES l
       LEFT JOIN C_GENERIC_VALUES gv ON l.leaveid = gv.id AND gv.g_id = 1 AND gv.orgid = l.orgid AND gv.isactive = 1
       WHERE l.empid IN (${authorizedEmpIds.map(() => '?').join(',')}) AND l.orgid = ?`,
      [...authorizedEmpIds, orgId]
    );

    const formattedRows = rows.map(row => {
      let startdateStr = null;
      let enddateStr = null;

      if (row.startdate) {
        startdateStr = formatDate(startDate);
      }
      if (row.enddate) {
        enddateStr = formatDate(endDate);
      }

      return {
        ...row,
        startdate: startdateStr,
        enddate: enddateStr,
      };
    });
    return formattedRows;
  } catch (error) {
    console.error("Error fetching employee leaves:", error.message);
    return { error: `Failed to fetch employee leaves: ${error.message}` };
  }
}

export async function fetchPendingLeaves() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };
  const superiorEmpId = userRows[0].empid;

  const directSubordinates = await getAllSubordinates(pool, superiorEmpId);
  const delegatedSubordinates = await getDelegatedSubordinates(pool, superiorEmpId);
  const allSubordinates = [...directSubordinates, ...delegatedSubordinates]
    .filter((sub, index, self) => index === self.findIndex((s) => s.empid === sub.empid) && sub.empid !== superiorEmpId);

  if (!allSubordinates.length) return { error: "You are not authorized to view pending leaves." };

  const employeeIds = allSubordinates.map(emp => emp.empid);
  const [leaveRows] = await pool.execute(
    `SELECT l.id, l.empid, l.orgid, l.g_id, gv.Name AS leave_name, l.startdate, l.enddate, l.status, l.noofnoons, l.am_pm, l.description,
            e.EMP_FST_NAME, e.EMP_LAST_NAME
     FROM C_EMPLOYEE_LEAVES l
     LEFT JOIN C_GENERIC_VALUES gv ON l.leaveid = gv.id AND gv.g_id = 1 AND gv.orgid = l.orgid AND gv.isactive = 1
     LEFT JOIN C_EMP e ON l.empid = e.empid
     WHERE l.empid IN (${employeeIds.map(() => '?').join(',')}) AND l.status = 'pending'`,
    employeeIds
  );

  const leaves = leaveRows.map(leave => ({
    ...leave,
    employee_name: `${leave.EMP_FST_NAME} ${leave.EMP_LAST_NAME || ''}`.trim(),
  }));

  return { leaves, employees: allSubordinates };
}

export async function fetchEmployeesUnderSuperior() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };
  const superiorEmpId = userRows[0].empid;

  // Fetch the logged-in employee's details
  const [selfRows] = await pool.execute(
    "SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?",
    [superiorEmpId]
  );
  const currentEmployee = selfRows[0] || {};

  // Fetch direct and delegated subordinates
  const directSubordinates = await getAllSubordinates(pool, superiorEmpId);
  const delegatedSubordinates = await getDelegatedSubordinates(pool, superiorEmpId);

  // Combine all employees, starting with the logged-in employee
  let allEmployees = [currentEmployee, ...directSubordinates, ...delegatedSubordinates];

  // Deduplicate and sort alphabetically by full name
  allEmployees = allEmployees.reduce((unique, item) => {
    return unique.findIndex(existing => existing.empid === item.empid) === -1
      ? [...unique, item]
      : unique;
  }, []).sort((a, b) => {
    const nameA = `${a.EMP_FST_NAME} ${a.EMP_LAST_NAME || ''}`.toLowerCase();
    const nameB = `${b.EMP_FST_NAME} ${b.EMP_LAST_NAME || ''}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Ensure the logged-in employee is first
  const loggedInEmployee = allEmployees.find(emp => emp.empid === superiorEmpId);
  if (loggedInEmployee) {
    allEmployees = [loggedInEmployee, ...allEmployees.filter(emp => emp.empid !== superiorEmpId)];
  }

  return { employees: allEmployees };
}

export async function fetchLeaveAssignments(empid) {
  try {
    const token = cookies().get("jwt_token")?.value;
    if (!token) return { error: "No token found. Please log in." };

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) return { error: "Invalid token or orgid not found." };

    const orgId = decoded.orgid;
    if (!orgId) return { error: "Organization ID is missing or invalid." };

    if (!empid) return { error: "Employee ID is required." };

    console.log(`Fetching leave assignments for empid: ${empid} and orgId: ${orgId}`);

    const pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT ela.leaveid, ela.noofleaves, gv.Name as name
       FROM C_EMPLOYEE_LEAVES_ASSIGN ela
       JOIN C_GENERIC_VALUES gv ON ela.leaveid = gv.id AND ela.orgid = gv.orgid
       WHERE ela.empid = ? AND ela.orgid = ? AND ela.g_id = 1 AND gv.isactive = 1`,
      [empid, orgId]
    );
    console.log('Fetched leave assignments:', rows);
    return rows.reduce((acc, row) => ({ ...acc, [row.leaveid]: { noofleaves: row.noofleaves, name: row.name } }), {});
  } catch (error) {
    console.error("Error fetching leave assignments:", error.message);
    return { error: `Failed to fetch leave assignments: ${error.message}` };
  }
}
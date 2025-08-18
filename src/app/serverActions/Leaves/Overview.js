"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

const decodeJwt = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch (error) {
    console.error("JWT decoding error:", error);
    return null;
  }
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

export async function fetchEmployeeLeaves(empId) {
  try {
    const token = cookies().get("jwt_token")?.value;
    if (!token) throw new Error("No token found. Please log in.");

    const decoded = jwt.verify(token, JWT_SECRET);
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
        const startDate = new Date(row.startdate);
        startdateStr = !isNaN(startDate) ? startDate.toISOString().split('T')[0] : 'Invalid Date';
      }
      if (row.enddate) {
        const endDate = new Date(row.enddate);
        enddateStr = !isNaN(endDate) ? endDate.toISOString().split('T')[0] : 'Invalid Date';
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
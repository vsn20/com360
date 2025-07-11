'use server';

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

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
    return allSubordinates;
  } catch (error) {
    console.error("Error in getAllSubordinates:", error);
    return [];
  }
};

const getDelegatedSubordinates = async (pool, userEmpId) => {
  const [delegateRows] = await pool.execute(
    "SELECT senderempid FROM delegate WHERE receiverempid = ? AND menuid = (SELECT id FROM menu WHERE name = 'TimeSheets') AND isactive = 1 AND (submenuid IS NULL OR submenuid = 0)",
    [userEmpId]
  );
  const delegatedSuperiors = delegateRows.map(row => row.senderempid);
  console.log("Delegated superiors:", delegatedSuperiors);

  let allSubordinates = [];
  for (const superiorId of delegatedSuperiors) {
    const subordinates = await getAllSubordinates(pool, superiorId, new Set());
    allSubordinates = allSubordinates.concat(subordinates);
  }
  // Include all subordinates of the delegator's hierarchy for the receiver
  if (delegatedSuperiors.length > 0) {
    const placeholders = delegatedSuperiors.map(() => '?').join(',');
    const [hierarchyRows] = await pool.execute(
      `SELECT empid, superior FROM C_EMP WHERE superior IN (${placeholders})`,
      delegatedSuperiors
    );
    const subordinateIds = hierarchyRows.map(row => row.empid);
    for (const subId of subordinateIds) {
      const nestedSubordinates = await getAllSubordinates(pool, subId, new Set());
      allSubordinates = allSubordinates.concat(nestedSubordinates);
    }
  }

  return allSubordinates.filter((sub, index, self) =>
    index === self.findIndex((s) => s.empid === sub.empid)
  ); // Deduplicate
};

export async function fetchPendingTimesheets() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) {
    console.log("No token found");
    return { error: "No token found. Please log in." };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) {
    console.log("Invalid token or user ID not found:", decoded);
    return { error: "Invalid token or user ID not found." };
  }

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) {
    console.log("User not found in C_USER table for userId:", decoded.userId);
    return { error: "User not found in C_USER table." };
  }
  const userEmpId = userRows[0].empid;
  console.log("Fetching pending timesheets for user empid:", userEmpId);

  const directSubordinates = await getAllSubordinates(pool, userEmpId);
  const delegatedSubordinates = await getDelegatedSubordinates(pool, userEmpId);
  const allSubordinates = [...directSubordinates, ...delegatedSubordinates].filter((sub, index, self) =>
    index === self.findIndex((s) => s.empid === sub.empid) && sub.empid !== userEmpId
  );
  console.log("All subordinates (direct + delegated):", allSubordinates);

  if (!allSubordinates.length) {
    console.log("No subordinates found for user empid:", userEmpId);
    return { error: "You are not authorized to view pending timesheets." };
  }

  const employeeIds = allSubordinates.map(emp => emp.empid);
  const [timesheetRows] = await pool.execute(
    `SELECT t.*, 
            COALESCE(p.PRJ_NAME, 'Unnamed Project') AS project_name,
            e.EMP_FST_NAME, e.EMP_LAST_NAME
     FROM timesheets t
     LEFT JOIN C_PROJECT p ON t.project_id = p.PRJ_ID
     LEFT JOIN C_EMP e ON t.employee_id = e.empid
     WHERE t.employee_id IN (${employeeIds.map(() => '?').join(',')})
     AND t.is_submitted = 1 AND t.is_approved = 0`,
    employeeIds
  );
  console.log("Pending timesheet rows:", timesheetRows);

  const timesheets = timesheetRows.map(ts => ({
    ...ts,
    employee_name: `${ts.EMP_FST_NAME} ${ts.EMP_LAST_NAME || ''}`.trim(),
    total_hours: ['sun_hours', 'mon_hours', 'tue_hours', 'wed_hours', 'thu_hours', 'fri_hours', 'sat_hours']
      .reduce((sum, day) => sum + (parseFloat(ts[day]) || 0), 0),
  }));

  return { timesheets, employees: allSubordinates };
}

export async function approveTimesheet(timesheetId, employeeId) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) {
    console.log("No token found");
    return { error: "No token found. Please log in." };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) {
    console.log("Invalid token or user ID not found:", decoded);
    return { error: "Invalid token or user ID not found." };
  }

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) {
    console.log("User not found in C_USER table for userId:", decoded.userId);
    return { error: "User not found in C_USER table." };
  }
  const currentUserEmpId = userRows[0].empid;
  console.log("Approving timesheet for user empid:", currentUserEmpId, "timesheetId:", timesheetId, "employeeId:", employeeId);

  const [timesheetRows] = await pool.execute(
    "SELECT * FROM timesheets WHERE timesheet_id = ? AND employee_id = ?",
    [timesheetId, employeeId]
  );
  if (!timesheetRows.length) {
    console.log("Timesheet not found for id:", timesheetId);
    return { error: "Timesheet not found." };
  }

  const isDirectSuperior = (await getAllSubordinates(pool, currentUserEmpId)).some(sub => sub.empid === employeeId);
  const isDelegatedSuperior = (await getDelegatedSubordinates(pool, currentUserEmpId)).some(sub => sub.empid === employeeId);
  console.log("Superior checks:", { isDirectSuperior, isDelegatedSuperior });

  if (!isDirectSuperior && !isDelegatedSuperior) return { error: "You are not authorized to approve this timesheet. Redirecting to timesheets." };

  if (currentUserEmpId === employeeId) return { error: "You cannot approve your own timesheet." };

  const [result] = await pool.execute(
    `UPDATE timesheets SET is_approved = 1, updated_at = CURRENT_TIMESTAMP 
     WHERE timesheet_id = ? AND employee_id = ?`,
    [timesheetId, employeeId]
  );

  if (result.affectedRows === 0) {
    console.log("No rows updated for approval:", { timesheetId, employeeId });
    return { error: "Failed to approve timesheet." };
  }

  return { success: true, timesheetId };
}
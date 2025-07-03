'use server';

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

const decodeJwt = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
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

export async function fetchPendingTimesheets() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };
  const superiorEmpId = userRows[0].empid;

  const subordinates = await getAllSubordinates(pool, superiorEmpId);
  if (!subordinates.length) return { error: "You are not authorized to view pending timesheets." };

  const employeeIds = subordinates.map(emp => emp.empid);
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

  const timesheets = timesheetRows.map(ts => ({
    ...ts,
    employee_name: `${ts.EMP_FST_NAME} ${ts.EMP_LAST_NAME || ''}`.trim(),
    total_hours: ['sun_hours', 'mon_hours', 'tue_hours', 'wed_hours', 'thu_hours', 'fri_hours', 'sat_hours']
      .reduce((sum, day) => sum + (parseFloat(ts[day]) || 0), 0),
  }));

  return { timesheets, employees: subordinates };
}

export async function approveTimesheet(timesheetId, employeeId) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };
  const currentUserEmpId = userRows[0].empid;

  const [timesheetRows] = await pool.execute(
    "SELECT * FROM timesheets WHERE timesheet_id = ? AND employee_id = ?",
    [timesheetId, employeeId]
  );
  if (!timesheetRows.length) return { error: "Timesheet not found." };

  const isUserSuperior = await getAllSubordinates(pool, currentUserEmpId).then(subordinates =>
    subordinates.some(sub => sub.empid === employeeId)
  );
  if (!isUserSuperior) return { error: "You are not authorized to approve this timesheet. Redirecting to timesheets." };

  const [result] = await pool.execute(
    `UPDATE timesheets SET is_approved = 1, updated_at = CURRENT_TIMESTAMP 
     WHERE timesheet_id = ? AND employee_id = ?`,
    [timesheetId, employeeId]
  );

  if (result.affectedRows === 0) return { error: "Failed to approve timesheet." };

  return { success: true, timesheetId };
}
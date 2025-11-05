'use server';

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
// **NEW**: Import the permission function from Overview.js
import { getTimesheetManagementScope } from "./Overview"; 

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

/**
 * **MODIFIED**: Fetches all pending timesheets the user can manage
 */
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
  const [userRows] = await pool.execute("SELECT empid, orgid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) {
    console.log("User not found in C_USER table for userId:", decoded.userId);
    return { error: "User not found in C_USER table." };
  }
  const userEmpId = userRows[0].empid;
  const orgid = userRows[0].orgid;
  console.log("Fetching pending C_TIMESHEETS for user empid:", userEmpId);

  // **MODIFIED**: Use new permission logic
  const { manageableEmpIds } = await getTimesheetManagementScope(pool, userEmpId, orgid);

  if (!manageableEmpIds.length) {
    console.log("No manageable employees found for user empid:", userEmpId);
    return { error: "You are not authorized to view pending C_TIMESHEETS." };
  }

  const employeeIds = manageableEmpIds; // Fetch for *all* manageable employees
  const placeholders = employeeIds.map(() => '?').join(',');
  
  const [timesheetRows] = await pool.execute(
    `SELECT t.*, 
            COALESCE(p.PRJ_NAME, 'Unnamed Project') AS project_name,
            e.EMP_FST_NAME, e.EMP_LAST_NAME
     FROM C_TIMESHEETS t
     LEFT JOIN C_PROJECT p ON t.project_id = p.PRJ_ID
     LEFT JOIN C_EMP e ON t.employee_id = e.empid
     WHERE t.employee_id IN (${placeholders})
     AND t.is_submitted = 1 AND t.is_approved = 0`,
    employeeIds
  );
  console.log("Pending timesheet rows:", timesheetRows);

  // Get employee names for the manageable IDs
  const [employeeNameRows] = await pool.execute(
    `SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid IN (${placeholders})`,
    employeeIds
  );
  const employeeNames = employeeNameRows.reduce((acc, emp) => {
    acc[emp.empid] = `${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}`.trim();
    return acc;
  }, {});
  
  const C_TIMESHEETS = timesheetRows.map(ts => ({
    ...ts,
    employee_name: employeeNames[ts.employee_id] || 'Unknown Employee',
    total_hours: ['sun_hours', 'mon_hours', 'tue_hours', 'wed_hours', 'thu_hours', 'fri_hours', 'sat_hours']
      .reduce((sum, day) => sum + (parseFloat(ts[day]) || 0), 0),
  }));

  return { C_TIMESHEETS };
}

/**
 * **MODIFIED**: Approves a timesheet with permission checks
 */
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
  const [userRows] = await pool.execute("SELECT empid, orgid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) {
    console.log("User not found in C_USER table for userId:", decoded.userId);
    return { error: "User not found in C_USER table." };
  }
  const currentUserEmpId = userRows[0].empid;
  const orgid = userRows[0].orgid;
  console.log("Approving timesheet for user empid:", currentUserEmpId, "timesheetId:", timesheetId, "employeeId:", employeeId);

  const [timesheetRows] = await pool.execute(
    "SELECT * FROM C_TIMESHEETS WHERE timesheet_id = ? AND employee_id = ?",
    [timesheetId, employeeId]
  );
  if (!timesheetRows.length) {
    console.log("Timesheet not found for id:", timesheetId);
    return { error: "Timesheet not found." };
  }

  // **MODIFIED**: New permission check
  const { manageableEmpIds } = await getTimesheetManagementScope(pool, currentUserEmpId, orgid);
  if (!manageableEmpIds.includes(employeeId)) {
      return { error: "You are not authorized to approve this timesheet." };
  }

  const [result] = await pool.execute(
    `UPDATE C_TIMESHEETS SET is_approved = 1, approved_by = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE timesheet_id = ? AND employee_id = ?`,
    [currentUserEmpId, timesheetId, employeeId]
  );

  if (result.affectedRows === 0) {
    console.log("No rows updated for approval:", { timesheetId, employeeId });
    return { error: "Failed to approve timesheet." };
  }

  return { success: true, timesheetId };
}
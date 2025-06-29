// app/serverActions/Timesheets/Overview.js
"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Simple JWT decode function
const decodeJwt = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return null;
  }
};

// Helper function to get week start date (Sunday) in YYYY-MM-DD format
const getWeekStartDate = (date) => {
  try {
    const d = new Date(date);
    if (isNaN(d)) throw new Error("Invalid date provided");
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust to Sunday
    d.setDate(diff);
    const formattedDate = d.toISOString().split("T")[0]; // YYYY-MM-DD
    console.log("Calculated week start date:", formattedDate);
    return formattedDate;
  } catch (error) {
    console.error("Error in getWeekStartDate:", error);
    return null;
  }
};

// Fetch timesheet, projects, and attachments for a given week and project
export async function fetchTimesheetAndProjects(selectedDate, projectId = null) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const username = decoded.userId;
  const pool = await DBconnection();
  console.log("MySQL connected successfully to remote server");

  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [username]);
  if (userRows.length === 0) return { error: "User not found in C_USER table." };
  const employeeId = userRows[0].empid;

  const weekStart = getWeekStartDate(selectedDate);
  if (!weekStart) return { error: "Invalid week start date." };
  const year = new Date(weekStart).getFullYear();

  const query = projectId
    ? "SELECT * FROM timesheets WHERE employee_id = ? AND week_start_date = ? AND project_id = ?"
    : "SELECT * FROM timesheets WHERE employee_id = ? AND week_start_date = ?";
  const params = projectId ? [employeeId, weekStart, projectId] : [employeeId, weekStart];
  const [timesheetRows] = await pool.execute(query, params);
  console.log("Timesheet query result:", timesheetRows);

  const timesheet = timesheetRows[0] || {
    employee_id: employeeId,
    project_id: projectId || "",
    week_start_date: weekStart,
    year,
    sun_hours: null,
    mon_hours: null,
    tue_hours: null,
    wed_hours: null,
    thu_hours: null,
    fri_hours: null,
    sat_hours: null,
    sun_comment: "",
    mon_comment: "",
    tue_comment: "",
    wed_comment: "",
    thu_comment: "",
    fri_comment: "",
    sat_comment: "",
    is_submitted: 0,
    is_approved: 0,
    invoice_path: null,
    invoice_generated_at: null,
  };

  const [projRows] = await pool.execute(
    `SELECT pe.PRJ_ID, COALESCE(p.PRJ_NAME, 'Unnamed Project') AS PRJ_NAME, pe.START_DT, pe.END_DT, pe.BILL_RATE, pe.BILL_TYPE 
     FROM C_PROJ_EMP pe 
     LEFT JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID 
     WHERE pe.EMP_ID = ? AND ? BETWEEN pe.START_DT AND COALESCE(pe.END_DT, '9999-12-31')`,
    [employeeId, weekStart]
  );
  console.log("Projects query result:", projRows);
  const projects = projRows;

  const attachmentQuery = timesheet.timesheet_id
    ? "SELECT ta.attachment_id, ta.file_name, ta.file_path, ta.timesheet_id, ta.employee_id, t.project_id FROM timesheet_attachments ta JOIN timesheets t ON ta.timesheet_id = t.timesheet_id WHERE ta.employee_id = ? AND ta.week_start_date = ? AND ta.timesheet_id = ?"
    : "SELECT ta.attachment_id, ta.file_name, ta.file_path, ta.timesheet_id, ta.employee_id, t.project_id FROM timesheet_attachments ta JOIN timesheets t ON ta.timesheet_id = t.timesheet_id WHERE ta.employee_id = ? AND ta.week_start_date = ?";
  const attachmentParams = timesheet.timesheet_id
    ? [employeeId, weekStart, timesheet.timesheet_id]
    : [employeeId, weekStart];
  const [attachmentRows] = await pool.execute(attachmentQuery, attachmentParams);
  console.log("Attachments query result for employee_id:", employeeId, "week_start_date:", weekStart, "timesheet_id:", timesheet.timesheet_id, "result:", attachmentRows);

  return { timesheet, projects, attachments: attachmentRows };
}

// Fetch timesheet for a specific employee and project
export async function fetchTimesheetForEmployee(selectedDate, employeeId, projectId) {
  const pool = await DBconnection();
  const weekStart = getWeekStartDate(selectedDate);
  if (!weekStart) return { error: "Invalid week start date." };
  const year = new Date(weekStart).getFullYear();

  const [timesheetRows] = await pool.execute(
    "SELECT * FROM timesheets WHERE employee_id = ? AND week_start_date = ? AND project_id = ?",
    [employeeId, weekStart, projectId]
  );
  console.log("Employee timesheet query result:", timesheetRows);
  const timesheet = timesheetRows[0] || {
    employee_id: employeeId,
    project_id: projectId,
    week_start_date: weekStart,
    year,
    sun_hours: null,
    mon_hours: null,
    tue_hours: null,
    wed_hours: null,
    thu_hours: null,
    fri_hours: null,
    sat_hours: null,
    sun_comment: "",
    mon_comment: "",
    tue_comment: "",
    wed_comment: "",
    thu_comment: "",
    fri_comment: "",
    sat_comment: "",
    is_submitted: 0,
    is_approved: 0,
    invoice_path: null,
    invoice_generated_at: null,
  };

  const attachmentQuery = timesheet.timesheet_id
    ? "SELECT ta.attachment_id, ta.file_name, ta.file_path, ta.timesheet_id, ta.employee_id, t.project_id FROM timesheet_attachments ta JOIN timesheets t ON ta.timesheet_id = t.timesheet_id WHERE ta.employee_id = ? AND ta.week_start_date = ? AND ta.timesheet_id = ?"
    : "SELECT ta.attachment_id, ta.file_name, ta.file_path, ta.timesheet_id, ta.employee_id, t.project_id FROM timesheet_attachments ta JOIN timesheets t ON ta.timesheet_id = t.timesheet_id WHERE ta.employee_id = ? AND ta.week_start_date = ?";
  const attachmentParams = timesheet.timesheet_id
    ? [employeeId, weekStart, timesheet.timesheet_id]
    : [employeeId, weekStart];
  const [attachmentRows] = await pool.execute(attachmentQuery, attachmentParams);
  console.log("Employee attachments query result for employee_id:", employeeId, "week_start_date:", weekStart, "timesheet_id:", timesheet.timesheet_id, "result:", attachmentRows);

  return { timesheet, attachments: attachmentRows };
}

// Fetch timesheets, projects, and attachments for a superior's employees
export async function fetchTimesheetsForSuperior(selectedDate) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const username = decoded.userId;
  const pool = await DBconnection();
  console.log("MySQL connected successfully to remote server for superior");

  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [username]);
  if (userRows.length === 0) return { error: "User not found in C_USER table." };
  const superiorEmpId = userRows[0].empid;

  const weekStart = getWeekStartDate(selectedDate);
  if (!weekStart) return { error: "Invalid week start date." };
  const year = new Date(weekStart).getFullYear();

  const [empRows] = await pool.execute(
    "SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE superior = ?",
    [superiorEmpId]
  );
  console.log("Employees under superior:", empRows);
  const employees = empRows;

  let timesheets = [];
  let attachments = {};
  let employeeProjects = {};

  for (const employee of employees) {
    const [timesheetRows] = await pool.execute(
      "SELECT * FROM timesheets WHERE employee_id = ? AND week_start_date = ?",
      [employee.empid, weekStart]
    );
    console.log(`Timesheet for employee ${employee.empid}:`, timesheetRows);
    timesheets = [
      ...timesheets,
      ...timesheetRows.map((t) => ({
        ...t,
        employeeName: `${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME || ""}`,
      })),
    ];

    const [projRows] = await pool.execute(
      `SELECT pe.PRJ_ID, COALESCE(p.PRJ_NAME, 'Unnamed Project') AS PRJ_NAME, pe.START_DT, pe.END_DT, pe.BILL_RATE, pe.BILL_TYPE 
       FROM C_PROJ_EMP pe 
       LEFT JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID 
       WHERE pe.EMP_ID = ? AND ? BETWEEN pe.START_DT AND COALESCE(pe.END_DT, '9999-12-31')`,
      [employee.empid, weekStart]
    );
    console.log(`Projects for employee ${employee.empid}:`, projRows);
    employeeProjects[employee.empid] = projRows;

    let attachmentRows = [];
    if (timesheetRows.length > 0) {
      const timesheetIds = timesheetRows.map((t) => t.timesheet_id);
      const placeholders = timesheetIds.map(() => "?").join(",");
      const attachmentQuery = `SELECT ta.attachment_id, ta.file_name, ta.file_path, ta.timesheet_id, ta.employee_id, t.project_id 
                              FROM timesheet_attachments ta 
                              JOIN timesheets t ON ta.timesheet_id = t.timesheet_id 
                              WHERE ta.employee_id = ? AND ta.week_start_date = ? AND ta.timesheet_id IN (${placeholders})`;
      const attachmentParams = [employee.empid, weekStart, ...timesheetIds];
      [attachmentRows] = await pool.execute(attachmentQuery, attachmentParams);
      console.log(`Attachments query for employee ${employee.empid}:`, { query: attachmentQuery, params: attachmentParams, result: attachmentRows });
    } else {
      const attachmentQuery = "SELECT ta.attachment_id, ta.file_name, ta.file_path, ta.timesheet_id, ta.employee_id, t.project_id FROM timesheet_attachments ta JOIN timesheets t ON ta.timesheet_id = t.timesheet_id WHERE ta.employee_id = ? AND ta.week_start_date = ?";
      const attachmentParams = [employee.empid, weekStart];
      [attachmentRows] = await pool.execute(attachmentQuery, attachmentParams);
      console.log(`Attachments query for employee ${employee.empid} (no timesheets):`, { query: attachmentQuery, params: attachmentParams, result: attachmentRows });
    }
    attachments[employee.empid] = attachmentRows;
  }

  return { timesheets, employees, projects: employeeProjects, attachments };
}

// Save or update timesheet and attachment
export async function saveTimesheet(formData) {
  if (!formData) {
    console.error("formData is undefined in saveTimesheet");
    return { error: "Invalid form data received." };
  }

  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const username = decoded.userId;
  const pool = await DBconnection();
  console.log("MySQL connection established for saveTimesheet");

  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [username]);
  if (userRows.length === 0) return { error: "User not found in C_USER table." };
  const employeeId = userRows[0].empid;

  const projectId = formData.get("project_id");
  const timesheetId = formData.get("timesheet_id");
  let weekStartDate = formData.get("week_start_date");

  // Normalize week_start_date
  weekStartDate = getWeekStartDate(weekStartDate || new Date());
  if (!weekStartDate) return { error: "Invalid week start date provided." };
  const year = new Date(weekStartDate).getFullYear();

  if (!projectId || !weekStartDate) return { error: "Project ID and week start date are required." };

  // Fetch existing timesheet to preserve data
  let existingTimesheet = null;
  if (timesheetId) {
    const [rows] = await pool.execute(
      "SELECT * FROM timesheets WHERE timesheet_id = ?",
      [timesheetId]
    );
    existingTimesheet = rows[0];
  } else {
    const [rows] = await pool.execute(
      "SELECT * FROM timesheets WHERE employee_id = ? AND week_start_date = ? AND project_id = ?",
      [employeeId, weekStartDate, projectId]
    );
    existingTimesheet = rows[0];
  }

  const sunHours = formData.get("sun_hours") !== null ? parseFloat(formData.get("sun_hours")) || null : existingTimesheet?.sun_hours || null;
  const monHours = formData.get("mon_hours") !== null ? parseFloat(formData.get("mon_hours")) || null : existingTimesheet?.mon_hours || null;
  const tueHours = formData.get("tue_hours") !== null ? parseFloat(formData.get("tue_hours")) || null : existingTimesheet?.tue_hours || null;
  const wedHours = formData.get("wed_hours") !== null ? parseFloat(formData.get("wed_hours")) || null : existingTimesheet?.wed_hours || null;
  const thuHours = formData.get("thu_hours") !== null ? parseFloat(formData.get("thu_hours")) || null : existingTimesheet?.thu_hours || null;
  const friHours = formData.get("fri_hours") !== null ? parseFloat(formData.get("fri_hours")) || null : existingTimesheet?.fri_hours || null;
  const satHours = formData.get("sat_hours") !== null ? parseFloat(formData.get("sat_hours")) || null : existingTimesheet?.sat_hours || null;
  const sunComment = formData.get("sun_comment") !== null ? formData.get("sun_comment") || "" : existingTimesheet?.sun_comment || "";
  const monComment = formData.get("mon_comment") !== null ? formData.get("mon_comment") || "" : existingTimesheet?.mon_comment || "";
  const tueComment = formData.get("tue_comment") !== null ? formData.get("tue_comment") || "" : existingTimesheet?.tue_comment || "";
  const wedComment = formData.get("wed_comment") !== null ? formData.get("wed_comment") || "" : existingTimesheet?.wed_comment || "";
  const thuComment = formData.get("thu_comment") !== null ? formData.get("thu_comment") || "" : existingTimesheet?.thu_comment || "";
  const friComment = formData.get("fri_comment") !== null ? formData.get("fri_comment") || "" : existingTimesheet?.fri_comment || "";
  const satComment = formData.get("sat_comment") !== null ? formData.get("sat_comment") || "" : existingTimesheet?.sat_comment || "";
  const isSubmitted = formData.get("submit") === "submit" ? 1 : existingTimesheet?.is_submitted || 0;
  const isApproved = formData.get("is_approved") !== null ? parseInt(formData.get("is_approved") || "0") : existingTimesheet?.is_approved || 0;

  let finalTimesheetId = timesheetId || existingTimesheet?.timesheet_id;

  if (finalTimesheetId) {
    const [result] = await pool.execute(
      `UPDATE timesheets SET 
        sun_hours = ?, mon_hours = ?, tue_hours = ?, wed_hours = ?, thu_hours = ?, fri_hours = ?, sat_hours = ?, 
        sun_comment = ?, mon_comment = ?, tue_comment = ?, wed_comment = ?, thu_comment = ?, fri_comment = ?, sat_comment = ?, 
        is_submitted = ?, is_approved = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE timesheet_id = ?`,
      [
        sunHours,
        monHours,
        tueHours,
        wedHours,
        thuHours,
        friHours,
        satHours,
        sunComment,
        monComment,
        tueComment,
        wedComment,
        thuComment,
        friComment,
        satComment,
        isSubmitted,
        isApproved,
        finalTimesheetId,
      ]
    );
    console.log("Update result for timesheet_id:", finalTimesheetId, result);
    if (result.affectedRows === 0) {
      console.error("No rows updated for timesheet_id:", finalTimesheetId);
      return { error: "Failed to update timesheet." };
    }
  } else {
    const [result] = await pool.execute(
      `INSERT INTO timesheets (
        employee_id, project_id, week_start_date, year, 
        sun_hours, mon_hours, tue_hours, wed_hours, thu_hours, fri_hours, sat_hours, 
        sun_comment, mon_comment, tue_comment, wed_comment, thu_comment, fri_comment, sat_comment, 
        is_submitted, is_approved, invoice_path, invoice_generated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        employeeId,
        projectId,
        weekStartDate,
        year,
        sunHours,
        monHours,
        tueHours,
        wedHours,
        thuHours,
        friHours,
        satHours,
        sunComment,
        monComment,
        tueComment,
        wedComment,
        thuComment,
        friComment,
        satComment,
        isSubmitted,
        isApproved,
        null,
        null,
      ]
    );
    finalTimesheetId = result.insertId;
    console.log("Insert result, new timesheet_id:", finalTimesheetId);
  }

  // Handle attachment
  const attachmentFile = formData.get("attachment");
  if (attachmentFile && attachmentFile.size > 0 && finalTimesheetId) {
    const uploadDir = path.join(process.cwd(), "public/uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const fileExtension = path.extname(attachmentFile.name);
    let fileName = `${uuidv4()}${fileExtension}`;
    let filePath = path.join(uploadDir, fileName);

    await fs.writeFile(filePath, Buffer.from(await attachmentFile.arrayBuffer()));

    await pool.execute(
      "INSERT INTO timesheet_attachments (employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
      [employeeId, weekStartDate, year, finalTimesheetId, filePath, attachmentFile.name]
    );
    console.log("Attachment saved:", { fileName: attachmentFile.name, filePath, timesheet_id: finalTimesheetId });
  }

  // Fetch updated attachments for the timesheet
  const [updatedAttachments] = await pool.execute(
    "SELECT ta.attachment_id, ta.file_name, ta.file_path, ta.timesheet_id, ta.employee_id, t.project_id FROM timesheet_attachments ta JOIN timesheets t ON ta.timesheet_id = t.timesheet_id WHERE ta.employee_id = ? AND ta.week_start_date = ? AND ta.timesheet_id = ?",
    [employeeId, weekStartDate, finalTimesheetId]
  );
  console.log("Updated attachments after save for timesheet_id:", finalTimesheetId, "result:", updatedAttachments);

  return { success: true, timesheetId: finalTimesheetId, attachments: updatedAttachments };
}

// Remove attachment
export async function removeAttachment(attachmentId) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const username = decoded.userId;
  const pool = await DBconnection();

  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [username]);
  if (userRows.length === 0) return { error: "User not found in C_USER table." };
  const employeeId = userRows[0].empid;

  const [attachmentRows] = await pool.execute(
    "SELECT file_path, timesheet_id FROM timesheet_attachments WHERE attachment_id = ? AND employee_id = ?",
    [attachmentId, employeeId]
  );

  if (attachmentRows.length > 0) {
    const { file_path, timesheet_id } = attachmentRows[0];
    try {
      await fs.unlink(file_path);
    } catch (err) {
      console.error("Error deleting file:", err);
    }
    await pool.execute("DELETE FROM timesheet_attachments WHERE attachment_id = ? AND employee_id = ?", [
      attachmentId,
      employeeId,
    ]);
    console.log("Attachment removed:", attachmentId);

    // Fetch updated attachments for the timesheet
    const [updatedAttachments] = await pool.execute(
      "SELECT ta.attachment_id, ta.file_name, ta.file_path, ta.timesheet_id, ta.employee_id, t.project_id FROM timesheet_attachments ta JOIN timesheets t ON ta.timesheet_id = t.timesheet_id WHERE ta.employee_id = ? AND ta.timesheet_id = ?",
      [employeeId, timesheet_id]
    );
    console.log("Updated attachments after remove for timesheet_id:", timesheet_id, "result:", updatedAttachments);

    return { success: true, timesheet_id, attachments: updatedAttachments };
  }
  return { error: "Attachment not found or unauthorized." };
}
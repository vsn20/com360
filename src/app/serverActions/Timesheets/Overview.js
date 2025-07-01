'use server';

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const decodeJwt = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
};

const getWeekStartDate = (date) => {
  try {
    const d = new Date(date);
    if (isNaN(d)) throw new Error("Invalid date");
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
};

const getAllSubordinates = async (pool, superiorEmpId, visited = new Set()) => {
  if (visited.has(superiorEmpId)) return [];
  visited.add(superiorEmpId);

  const [directSubordinates] = await pool.execute(
    "SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, superior FROM C_EMP WHERE superior = ?",
    [superiorEmpId]
  );

  let allSubordinates = [...directSubordinates];
  for (const subordinate of directSubordinates) {
    const nestedSubordinates = await getAllSubordinates(pool, subordinate.empid, visited);
    allSubordinates = allSubordinates.concat(nestedSubordinates);
  }

  return allSubordinates;
};

export async function fetchTimesheetAndProjects(selectedDate) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };
  const employeeId = userRows[0].empid;

  const weekStart = getWeekStartDate(selectedDate);
  const year = new Date(weekStart).getFullYear();

  const [projRows] = await pool.execute(
    `SELECT pe.PRJ_ID, COALESCE(p.PRJ_NAME, 'Unnamed Project') AS PRJ_NAME, pe.BILL_RATE, pe.BILL_TYPE 
     FROM C_PROJ_EMP pe 
     LEFT JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID 
     WHERE pe.EMP_ID = ? AND ? BETWEEN pe.START_DT AND COALESCE(pe.END_DT, '9999-12-31')`,
    [employeeId, weekStart]
  );

  const timesheets = [];
  const attachments = {};
  for (const project of projRows) {
    const [timesheetRows] = await pool.execute(
      "SELECT * FROM timesheets WHERE employee_id = ? AND week_start_date = ? AND project_id = ?",
      [employeeId, weekStart, project.PRJ_ID]
    );
    const timesheet = timesheetRows[0] || {
      employee_id: employeeId,
      project_id: project.PRJ_ID,
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
      temp_key: `temp-${Date.now()}-${project.PRJ_ID}`
    };
    timesheets.push(timesheet);

    const [attachmentRows] = await pool.execute(
      "SELECT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM timesheet_attachments WHERE employee_id = ? AND week_start_date = ? AND timesheet_id = ?",
      [employeeId, weekStart, timesheet.timesheet_id || null]
    );
    attachments[timesheet.timesheet_id || timesheet.temp_key] = attachmentRows;
  }

  return { timesheets, projects: projRows, attachments };
}

export async function fetchTimesheetsForSuperior(selectedDate) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };
  const superiorEmpId = userRows[0].empid;

  const weekStart = getWeekStartDate(selectedDate);
  const year = new Date(weekStart).getFullYear();

  const employees = await getAllSubordinates(pool, superiorEmpId);

  const timesheets = [];
  const projects = {};
  const attachments = {};
  for (const employee of employees) {
    const [projRows] = await pool.execute(
      `SELECT pe.PRJ_ID, COALESCE(p.PRJ_NAME, 'Unnamed Project') AS PRJ_NAME, pe.BILL_RATE, pe.BILL_TYPE 
       FROM C_PROJ_EMP pe 
       LEFT JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID 
       WHERE pe.EMP_ID = ? AND ? BETWEEN pe.START_DT AND COALESCE(pe.END_DT, '9999-12-31')`,
      [employee.empid, weekStart]
    );
    projects[employee.empid] = projRows;

    for (const project of projRows) {
      const [timesheetRows] = await pool.execute(
        "SELECT * FROM timesheets WHERE employee_id = ? AND week_start_date = ? AND project_id = ?",
        [employee.empid, weekStart, project.PRJ_ID]
      );
      const ts = timesheetRows[0] || {
        employee_id: employee.empid,
        project_id: project.PRJ_ID,
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
        temp_key: `temp-${Date.now()}-${project.PRJ_ID}`,
        employeeName: `${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME || ""}`
      };
      timesheets.push(ts);

      const [attachmentRows] = await pool.execute(
        "SELECT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM timesheet_attachments WHERE employee_id = ? AND week_start_date = ? AND timesheet_id = ?",
        [employee.empid, weekStart, ts.timesheet_id || null]
      );
      attachments[ts.timesheet_id || ts.temp_key] = attachmentRows;
    }
  }

  return { timesheets, employees, projects, attachments };
}

export async function saveTimesheet(formData) {
  if (!formData) return { error: "Invalid form data received." };

  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };
  const employeeId = formData.get("employee_id") || userRows[0].empid;

  const projectId = formData.get("project_id");
  const timesheetId = formData.get("timesheet_id");
  const weekStartDate = getWeekStartDate(formData.get("week_start_date") || new Date());
  const year = new Date(weekStartDate).getFullYear();

  if (!projectId || !weekStartDate) return { error: "Project ID and week start date are required." };

  let existingTimesheet = null;
  if (timesheetId) {
    const [rows] = await pool.execute("SELECT * FROM timesheets WHERE timesheet_id = ?", [timesheetId]);
    existingTimesheet = rows[0];
  } else {
    const [rows] = await pool.execute(
      "SELECT * FROM timesheets WHERE employee_id = ? AND week_start_date = ? AND project_id = ?",
      [employeeId, weekStartDate, projectId]
    );
    existingTimesheet = rows[0];
  }

  const fields = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const hours = fields.map((day) => ({
    hours: formData.get(`${day}_hours`) !== null ? parseFloat(formData.get(`${day}_hours`)) || null : existingTimesheet?.[`${day}_hours`] || null,
    comment: formData.get(`${day}_comment`) !== null ? formData.get(`${day}_comment`) || "" : existingTimesheet?.[`${day}_comment`] || ""
  }));
  const isSubmitted = formData.get("is_submitted") !== null ? parseInt(formData.get("is_submitted") || "0") : existingTimesheet?.is_submitted || 0;
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
        ...hours.map((h) => h.hours),
        ...hours.map((h) => h.comment),
        isSubmitted,
        isApproved,
        finalTimesheetId
      ]
    );
    if (result.affectedRows === 0) return { error: "Failed to update timesheet." };
  } else {
    const [result] = await pool.execute(
      `INSERT INTO timesheets (
        employee_id, project_id, week_start_date, year, 
        sun_hours, mon_hours, tue_hours, wed_hours, thu_hours, fri_hours, sat_hours, 
        sun_comment, mon_comment, tue_comment, wed_comment, thu_comment, fri_comment, sat_comment, 
        is_submitted, is_approved, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        employeeId,
        projectId,
        weekStartDate,
        year,
        ...hours.map((h) => h.hours),
        ...hours.map((h) => h.comment),
        isSubmitted,
        isApproved
      ]
    );
    finalTimesheetId = result.insertId;
  }

  const attachmentFile = formData.get("attachment");
  if (attachmentFile && attachmentFile.size > 0 && finalTimesheetId) {
    const uploadDir = path.join(process.cwd(), "public", "uploads", employeeId, weekStartDate.replace(/-/g, ""));
    await fs.mkdir(uploadDir, { recursive: true });
    const fileExtension = path.extname(attachmentFile.name) || '.bin';
    const uniqueFileName = `${uuidv4()}${fileExtension}`; // Ensure unique file name
    const filePath = path.join(uploadDir, uniqueFileName);
    await fs.writeFile(filePath, Buffer.from(await attachmentFile.arrayBuffer()));
    try {
      await pool.execute(
        "INSERT INTO timesheet_attachments (employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        [employeeId, weekStartDate, year, finalTimesheetId, `/uploads/${employeeId}/${weekStartDate.replace(/-/g, "")}/${uniqueFileName}`, attachmentFile.name]
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.warn(`Duplicate attachment entry attempted for employee_id: ${employeeId}, timesheet_id: ${finalTimesheetId}, file_name: ${attachmentFile.name}`);
        // Proceed, as duplicates are allowed
      } else {
        throw error; // Rethrow other errors
      }
    }
  }

  const [updatedAttachments] = await pool.execute(
    "SELECT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM timesheet_attachments WHERE employee_id = ? AND week_start_date = ? AND timesheet_id = ?",
    [employeeId, weekStartDate, finalTimesheetId]
  );

  return { success: true, timesheetId: finalTimesheetId, attachments: updatedAttachments };
}

export async function removeAttachment(attachmentId, timesheetId) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };
  const employeeId = userRows[0].empid;

  const [attachmentRows] = await pool.execute(
    "SELECT file_path, timesheet_id FROM timesheet_attachments WHERE attachment_id = ? AND employee_id = ? AND timesheet_id = ?",
    [attachmentId, employeeId, timesheetId]
  );

  if (attachmentRows.length > 0) {
    const { file_path } = attachmentRows[0];
    try {
      const absolutePath = path.join(process.cwd(), "public", file_path);
      await fs.unlink(absolutePath);
    } catch (err) {
      console.error("Error deleting file:", err);
    }
    await pool.execute("DELETE FROM timesheet_attachments WHERE attachment_id = ? AND employee_id = ? AND timesheet_id = ?", [
      attachmentId,
      employeeId,
      timesheetId
    ]);

    const [updatedAttachments] = await pool.execute(
      "SELECT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM timesheet_attachments WHERE employee_id = ? AND timesheet_id = ?",
      [employeeId, timesheetId]
    );

    return { success: true, timesheet_id: timesheetId, attachments: updatedAttachments };
  }
  return { error: "Attachment not found or unauthorized." };
}
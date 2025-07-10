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

  try {
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
  } catch (error) {
    console.error("Error in getAllSubordinates:", error);
    return [];
  }
};

const isSuperior = async (pool, userEmpId, employeeId) => {
  if (!userEmpId || !employeeId || userEmpId === employeeId) return false;
  const subordinates = await getAllSubordinates(pool, userEmpId);
  const isSuperiorResult = subordinates.some((sub) => sub.empid === employeeId);
  console.log(`isSuperior check: userEmpId=${userEmpId}, employeeId=${employeeId}, result=${isSuperiorResult}, subordinates=`, subordinates.map(s => s.empid));
  return isSuperiorResult;
};

export async function fetchSuperiorName(empId) {
  if (!empId) return { error: "Employee ID is required." };

  try {
    const pool = await DBconnection();
    const [employeeRows] = await pool.execute(
      "SELECT superior FROM C_EMP WHERE empid = ?",
      [empId]
    );
    if (!employeeRows.length) return { error: "Employee not found." };

    const superiorId = employeeRows[0].superior;
    if (!superiorId) return { superiorName: "" };

    const [superiorRows] = await pool.execute(
      "SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?",
      [superiorId]
    );
    if (!superiorRows.length) return { superiorName: "" };

    const superiorName = `${superiorRows[0].EMP_FST_NAME} ${superiorRows[0].EMP_LAST_NAME || ''}`.trim();
    return { superiorName };
  } catch (error) {
    console.error("Error fetching superior name:", error);
    return { error: "Failed to fetch superior name." };
  }
}

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
      [employeeId, weekStart, timesheet.timesheet_id || timesheet.temp_key]
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
        [employee.empid, weekStart, ts.timesheet_id || ts.temp_key]
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
  const currentUserEmpId = userRows[0].empid;
  const employeeId = formData.get("employee_id") || currentUserEmpId;

  const projectId = formData.get("project_id");
  const timesheetId = formData.get("timesheet_id");
  const weekStartDate = getWeekStartDate(formData.get("week_start_date") || new Date());
  const year = new Date(weekStartDate).getFullYear();

  if (!projectId || !weekStartDate) return { error: "Project ID and week start date are required." };

  let existingTimesheet = null;
  if (timesheetId) {
    const [rows] = await pool.execute("SELECT * FROM timesheets WHERE timesheet_id = ? AND employee_id = ?", [timesheetId, employeeId]);
    existingTimesheet = rows[0];
  } else {
    const [rows] = await pool.execute(
      "SELECT * FROM timesheets WHERE employee_id = ? AND week_start_date = ? AND project_id = ?",
      [employeeId, weekStartDate, projectId]
    );
    existingTimesheet = rows[0];
  }

  const isUserSuperior = await isSuperior(pool, currentUserEmpId, employeeId);

  if (!isUserSuperior && existingTimesheet && (existingTimesheet.is_submitted === 1 || existingTimesheet.is_approved === 1)) {
    return { error: "Only superiors can edit submitted or approved timesheets." };
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
        WHERE timesheet_id = ? AND employee_id = ?`,
      [
        ...hours.map((h) => h.hours),
        ...hours.map((h) => h.comment),
        isSubmitted,
        isApproved,
        finalTimesheetId,
        employeeId
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

  // Enhanced file-saving logic to process each file only once
  const attachmentFiles = formData.getAll('attachment');
  const updatedAttachments = [];
  const processedFiles = new Set(); // Track processed files by their unique identifier
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
  const maxFileSize = 5 * 1024 * 1024; // 5MB limit

  if (attachmentFiles.length > 0 && attachmentFiles[0].size > 0) {
    const uploadDir = path.join(process.cwd(), "public", "uploads", employeeId, weekStartDate.replace(/-/g, ""));
    try {
      await fs.mkdir(uploadDir, { recursive: true });

      for (const attachmentFile of attachmentFiles) {
        // Use a unique identifier for the file (e.g., file name + size) to avoid duplicates
        const fileIdentifier = `${attachmentFile.name}-${attachmentFile.size}`;
        if (attachmentFile.size === 0 || processedFiles.has(fileIdentifier)) {
          console.log(`Skipping duplicate or empty file: ${attachmentFile.name} (size: ${attachmentFile.size})`);
          continue;
        }

        if (!allowedTypes.includes(attachmentFile.type)) {
          console.log(`Invalid file type for ${attachmentFile.name}: ${attachmentFile.type}`);
          return { error: `Invalid file type for ${attachmentFile.name}. Allowed types: ${allowedTypes.join(', ')}` };
        }
        if (attachmentFile.size > maxFileSize) {
          console.log(`File ${attachmentFile.name} exceeds size limit: ${attachmentFile.size} bytes`);
          return { error: `File ${attachmentFile.name} exceeds the 5MB size limit.` };
        }

        const fileExtension = path.extname(attachmentFile.name) || '.bin';
        const uniqueFileName = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(uploadDir, uniqueFileName);

        console.log(`Saving file: ${attachmentFile.name} as ${uniqueFileName} to ${filePath}`);

        // Save file to filesystem
        await fs.writeFile(filePath, Buffer.from(await attachmentFile.arrayBuffer()));

        // Insert attachment metadata into database
        const [insertResult] = await pool.execute(
          "INSERT INTO timesheet_attachments (employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
          [
            employeeId,
            weekStartDate,
            year,
            finalTimesheetId,
            `/uploads/${employeeId}/${weekStartDate.replace(/-/g, "")}/${uniqueFileName}`,
            attachmentFile.name
          ]
        );

        console.log(`Inserted attachment: attachment_id=${insertResult.insertId}, file_name=${attachmentFile.name}`);

        updatedAttachments.push({
          attachment_id: insertResult.insertId,
          employee_id: employeeId,
          week_start_date: weekStartDate,
          year,
          timesheet_id: finalTimesheetId,
          file_path: `/uploads/${employeeId}/${weekStartDate.replace(/-/g, "")}/${uniqueFileName}`,
          file_name: attachmentFile.name,
          uploaded_at: new Date().toISOString()
        });

        processedFiles.add(fileIdentifier); // Mark this file as processed
      }
    } catch (error) {
      console.error("Error saving attachment:", error);
      return { error: `Failed to save attachment: ${error.message}` };
    }
  } else {
    console.log("No valid attachment files provided.");
  }

  const [attachmentRows] = await pool.execute(
    "SELECT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM timesheet_attachments WHERE employee_id = ? AND week_start_date = ? AND timesheet_id = ?",
    [employeeId, weekStartDate, finalTimesheetId]
  );

  console.log(`Fetched attachments for timesheet_id=${finalTimesheetId}:`, attachmentRows);

  return { success: true, timesheetId: finalTimesheetId, attachments: attachmentRows };
}

export async function removeAttachment(attachmentId, timesheetId) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };
  const currentUserEmpId = userRows[0].empid;

  try {
    // Fetch attachment and timesheet details
    const [attachmentRows] = await pool.execute(
      "SELECT employee_id, file_path FROM timesheet_attachments WHERE attachment_id = ? AND timesheet_id = ?",
      [attachmentId, timesheetId]
    );
    if (!attachmentRows.length) return { error: "Attachment not found." };

    const { employee_id: employeeId, file_path: filePath } = attachmentRows[0];

    // Fetch timesheet to check submission/approval status
    const [timesheetRows] = await pool.execute(
      "SELECT is_submitted, is_approved FROM timesheets WHERE timesheet_id = ? AND employee_id = ?",
      [timesheetId, employeeId]
    );
    if (!timesheetRows.length) return { error: "Timesheet not found." };

    const { is_submitted, is_approved } = timesheetRows[0];

    // Check if user is superior or the owner
    const isUserSuperior = await isSuperior(pool, currentUserEmpId, employeeId);
    const isOwner = currentUserEmpId === employeeId;

    if (!isUserSuperior && !isOwner) {
      return { error: "You are not authorized to remove this attachment." };
    }

    if (!isUserSuperior && (is_submitted === 1 || is_approved === 1)) {
      return { error: "Cannot remove attachments from submitted or approved timesheets." };
    }

    // Delete attachment from database
    const [deleteResult] = await pool.execute(
      "DELETE FROM timesheet_attachments WHERE attachment_id = ? AND timesheet_id = ?",
      [attachmentId, timesheetId]
    );
    if (deleteResult.affectedRows === 0) {
      return { error: "Failed to delete attachment from database." };
    }

    // Delete file from filesystem
    const absolutePath = path.join(process.cwd(), "public", filePath);
    try {
      await fs.unlink(absolutePath);
      console.log(`Deleted file: ${absolutePath}`);
    } catch (error) {
      console.warn(`Failed to delete file at ${absolutePath}: ${error.message}`);
      // Continue even if file deletion fails (e.g., file already deleted)
    }

    return { success: true };
  } catch (error) {
    console.error("Error removing attachment:", error);
    return { error: `Failed to remove attachment: ${error.message}` };
  }
}
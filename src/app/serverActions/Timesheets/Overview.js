"use server";

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
  } catch (error) {
    console.error("JWT decoding error:", error);
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
  } catch (error) {
    console.error("Invalid date error:", error);
    return new Date().toISOString().split("T")[0];
  }
};

const getWeekEndDate = (weekStart) => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
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

    let allSubordinates = directSubordinates.map(sub => ({ ...sub, isDelegated: false }));
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
  const delegatedSuperiors = delegateRows.map((row) => row.senderempid);
  console.log("Delegated superiors:", delegatedSuperiors);

  let allSubordinates = [];
  for (const superiorId of delegatedSuperiors) {
    const subordinates = await getAllSubordinates(pool, superiorId, new Set());
    allSubordinates = allSubordinates.concat(subordinates.map(sub => ({ ...sub, isDelegated: true })));
  }

  if (delegatedSuperiors.length > 0) {
    const placeholders = delegatedSuperiors.map(() => "?").join(",");
    const [hierarchyRows] = await pool.execute(
      `SELECT empid, superior, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE superior IN (${placeholders})`,
      [...delegatedSuperiors]
    );
    const subordinateIds = hierarchyRows.map((row) => row.empid);
    for (const subId of subordinateIds) {
      const nestedSubordinates = await getAllSubordinates(pool, subId, new Set());
      allSubordinates = allSubordinates.concat(nestedSubordinates.map(sub => ({ ...sub, isDelegated: true })));
    }
  }

  return allSubordinates.filter(
    (sub, index, self) => index === self.findIndex((s) => s.empid === sub.empid)
  );
};

const isSuperior = async (pool, userEmpId, employeeId) => {
  if (!userEmpId || !employeeId || userEmpId === employeeId) return false;
  const subordinates = await getAllSubordinates(pool, userEmpId);
  const delegatedSubordinates = await getDelegatedSubordinates(pool, userEmpId);
  return subordinates.some((sub) => sub.empid === employeeId) || delegatedSubordinates.some((sub) => sub.empid === employeeId);
};

export async function fetchSuperiorName(empId) {
  if (!empId) return { error: "Employee ID is required." };

  try {
    const pool = await DBconnection();
    const [employeeRows] = await pool.execute("SELECT superior FROM C_EMP WHERE empid = ?", [empId]);
    if (!employeeRows.length) return { error: "Employee not found." };

    const superiorId = employeeRows[0].superior;
    if (!superiorId) return { superiorName: "" };

    const [superiorRows] = await pool.execute(
      "SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?",
      [superiorId]
    );
    if (!superiorRows.length) return { superiorName: "" };

    const superiorName = `${superiorRows[0].EMP_FST_NAME} ${superiorRows[0].EMP_LAST_NAME || ""}`.trim();
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
  const weekEnd = getWeekEndDate(weekStart);
  const year = new Date(weekStart).getFullYear();

  const [projRows] = await pool.execute(
    `SELECT pe.PRJ_ID, COALESCE(p.PRJ_NAME, 'Unnamed Project') AS PRJ_NAME, pe.BILL_RATE, pe.BILL_TYPE 
     FROM C_PROJ_EMP pe 
     LEFT JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID 
     WHERE pe.EMP_ID = ? 
     AND pe.START_DT <= ? 
     AND COALESCE(pe.END_DT, '9999-12-31') >= ?`,
    [employeeId, weekEnd, weekStart]
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
      temp_key: `temp-${Date.now()}-${project.PRJ_ID}`,
    };
    timesheets.push(timesheet);

    const [attachmentRows] = await pool.execute(
      "SELECT DISTINCT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM timesheet_attachments WHERE employee_id = ? AND week_start_date = ?",
      [employeeId, weekStart]
    );
    attachments[timesheet.timesheet_id || timesheet.temp_key] = attachmentRows;
  }

  return { timesheets, projects: projRows, attachments, serverWeekStart: weekStart, currentUserEmpId: employeeId };
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
  const weekEnd = getWeekEndDate(weekStart);
  const year = new Date(weekStart).getFullYear();

  const directSubordinates = await getAllSubordinates(pool, superiorEmpId);
  const delegatedSubordinates = await getDelegatedSubordinates(pool, superiorEmpId);
  const allSubordinates = [...directSubordinates, ...delegatedSubordinates].filter(
    (sub, index, self) => index === self.findIndex((s) => s.empid === sub.empid) && sub.empid !== superiorEmpId
  );

  const timesheets = [];
  const projects = {};
  const attachments = {};
  for (const employee of allSubordinates) {
    const [projRows] = await pool.execute(
      `SELECT pe.PRJ_ID, COALESCE(p.PRJ_NAME, 'Unnamed Project') AS PRJ_NAME, pe.BILL_RATE, pe.BILL_TYPE 
       FROM C_PROJ_EMP pe 
       LEFT JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID 
       WHERE pe.EMP_ID = ? 
       AND pe.START_DT <= ? 
       AND COALESCE(pe.END_DT, '9999-12-31') >= ?`,
      [employee.empid, weekEnd, weekStart]
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
        employeeName: `${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME || ""}${employee.isDelegated ? " [del]" : ""}`.trim(),
      };
      timesheets.push(ts);

      const [attachmentRows] = await pool.execute(
        "SELECT DISTINCT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM timesheet_attachments WHERE employee_id = ? AND week_start_date = ?",
        [employee.empid, weekStart]
      );
      attachments[ts.timesheet_id || ts.temp_key] = attachmentRows;
    }
  }

  return { timesheets, employees: allSubordinates, projects, attachments, serverWeekStart: weekStart, currentUserEmpId: superiorEmpId };
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
  const timesheetsData = [];
  const updatedAttachments = {};

  const timesheetIndices = [];
  for (let key of formData.keys()) {
    const match = key.match(/^timesheets\[(\d+)\]/);
    if (match && !timesheetIndices.includes(match[1])) {
      timesheetIndices.push(match[1]);
    }
  }

  for (const index of timesheetIndices) {
    const timesheetId = formData.get(`timesheets[${index}][timesheet_id]`) || null;
    const employeeId = formData.get(`timesheets[${index}][employee_id]`);
    const projectId = formData.get(`timesheets[${index}][project_id]`);
    const weekStartDate = formData.get(`timesheets[${index}][week_start_date]`);
    const year = formData.get(`timesheets[${index}][year]`);
    if (!projectId || !weekStartDate) continue;

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

    const isSuperiorUser = await isSuperior(pool, currentUserEmpId, employeeId);

    if (existingTimesheet) {
      if (existingTimesheet.is_approved === 1 && currentUserEmpId === employeeId && !isSuperiorUser) continue; // Employee can't edit approved
      if (existingTimesheet.is_submitted === 1 && currentUserEmpId === employeeId && !isSuperiorUser) continue; // Employee can't edit submitted
    }

    const fields = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const hours = fields.map((day) => ({
      hours: formData.get(`timesheets[${index}][${day}_hours]`) !== null ? parseFloat(formData.get(`timesheets[${index}][${day}_hours]`)) || null : existingTimesheet?.[`${day}_hours`] || null,
      comment: formData.get(`timesheets[${index}][${day}_comment]`) !== null ? formData.get(`timesheets[${index}][${day}_comment]`) || "" : existingTimesheet?.[`${day}_comment`] || "",
    }));
    const isSubmitted = formData.get(`timesheets[${index}][is_submitted]`) !== null ? parseInt(formData.get(`timesheets[${index}][is_submitted]`) || "0") : existingTimesheet?.is_submitted || 0;
    const isApproved = formData.get(`timesheets[${index}][is_approved]`) !== null ? parseInt(formData.get(`timesheets[${index}][is_approved]`) || "0") : existingTimesheet?.is_approved || 0;

    let finalTimesheetId = timesheetId || existingTimesheet?.timesheet_id;

    if (finalTimesheetId) {
      await pool.execute(
        `UPDATE timesheets SET 
          sun_hours = ?, mon_hours = ?, tue_hours = ?, wed_hours = ?, thu_hours = ?, fri_hours = ?, sat_hours = ?, 
          sun_comment = ?, mon_comment = ?, tue_comment = ?, wed_comment = ?, thu_comment = ?, fri_comment = ?, sat_comment = ?, 
          is_submitted = ?, is_approved = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE timesheet_id = ? AND employee_id = ?`,
        [
          ...hours.map((h) => h.hours),
          ...hours.map((h) => h.comment),
          isSubmitted,
          isApproved,
          isApproved ? currentUserEmpId : null,
          finalTimesheetId,
          employeeId,
        ]
      );
    } else {
      const [result] = await pool.execute(
        `INSERT INTO timesheets (
          employee_id, project_id, week_start_date, year, 
          sun_hours, mon_hours, tue_hours, wed_hours, thu_hours, fri_hours, sat_hours, 
          sun_comment, mon_comment, tue_comment, wed_comment, thu_comment, fri_comment, sat_comment, 
          is_submitted, is_approved, approved_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          employeeId,
          projectId,
          weekStartDate,
          year,
          ...hours.map((h) => h.hours),
          ...hours.map((h) => h.comment),
          isSubmitted,
          isApproved,
          isApproved ? currentUserEmpId : null,
        ]
      );
      finalTimesheetId = result.insertId;
    }

    timesheetsData.push({ timesheetId: finalTimesheetId, employeeId, weekStartDate, year, isSubmitted });
  }

  // Handle attachments once for the week, using the first timesheet ID
  const attachmentFiles = formData.getAll("attachment");
  const firstTimesheetId = timesheetsData.length > 0 ? timesheetsData[0].timesheetId : null;
  const employeeId = timesheetsData.length > 0 ? timesheetsData[0].employeeId : null; // Use the employeeId from the timesheet
  if (attachmentFiles.length > 0 && attachmentFiles[0].size > 0 && employeeId) {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf", "text/plain"];
    const maxFileSize = 5 * 1024 * 1024;

    const uploadDir = path.join(process.cwd(), "public", "uploads", employeeId, timesheetsData[0].weekStartDate.replace(/-/g, ""));
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      for (const attachmentFile of attachmentFiles) {
        if (!allowedTypes.includes(attachmentFile.type)) return { error: `Invalid file type for ${attachmentFile.name}. Allowed types: ${allowedTypes.join(", ")}` };
        if (attachmentFile.size > maxFileSize) return { error: `File ${attachmentFile.name} exceeds the 5MB size limit.` };

        const fileExtension = path.extname(attachmentFile.name) || ".bin";
        const uniqueFileName = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(uploadDir, uniqueFileName);

        await fs.writeFile(filePath, Buffer.from(await attachmentFile.arrayBuffer()));
        const [insertResult] = await pool.execute(
          "INSERT INTO timesheet_attachments (employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
          [
            employeeId,
            timesheetsData[0].weekStartDate,
            timesheetsData[0].year,
            firstTimesheetId,
            `/uploads/${employeeId}/${timesheetsData[0].weekStartDate.replace(/-/g, "")}/${uniqueFileName}`,
            attachmentFile.name,
          ]
        );

        updatedAttachments[firstTimesheetId] = updatedAttachments[firstTimesheetId] || [];
        updatedAttachments[firstTimesheetId].push({
          attachment_id: insertResult.insertId,
          employee_id: employeeId,
          week_start_date: timesheetsData[0].weekStartDate,
          year: timesheetsData[0].year,
          timesheet_id: firstTimesheetId,
          file_path: `/uploads/${employeeId}/${timesheetsData[0].weekStartDate.replace(/-/g, "")}/${uniqueFileName}`,
          file_name: attachmentFile.name,
          uploaded_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      return { error: `Failed to save attachment: ${error.message}` };
    }
  } else if (timesheetsData.length > 0 && formData.get("timesheets[0][is_submitted]") === "1" && !attachmentFiles.length) {
    const [existingAttachments] = await pool.execute(
      "SELECT COUNT(*) as count FROM timesheet_attachments WHERE employee_id = ? AND week_start_date = ?",
      [employeeId || currentUserEmpId, timesheetsData[0].weekStartDate]
    );
    if (existingAttachments[0].count === 0) {
      return { error: "No attachments found. Please check 'No Attachment' or upload at least one attachment." };
    }
  }

  const attachmentRows = timesheetsData.length > 0
    ? await pool.execute(
        "SELECT DISTINCT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM timesheet_attachments WHERE employee_id = ? AND week_start_date = ?",
        [employeeId || currentUserEmpId, timesheetsData[0].weekStartDate]
      )[0]
    : [];

  return {
    success: true,
    timesheetIds: timesheetsData.map((td) => td.timesheetId),
    attachments: attachmentRows,
  };
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
    const [attachmentRows] = await pool.execute(
      "SELECT employee_id, file_path, timesheet_id FROM timesheet_attachments WHERE attachment_id = ? AND timesheet_id = ?",
      [attachmentId, timesheetId]
    );
    if (!attachmentRows.length) return { error: "Attachment not found." };

    const { employee_id: employeeId, file_path: filePath, timesheet_id } = attachmentRows[0];
    const [timesheetRows] = await pool.execute(
      "SELECT is_submitted, is_approved FROM timesheets WHERE timesheet_id = ? AND employee_id = ?",
      [timesheetId, employeeId]
    );
    if (!timesheetRows.length) return { error: "Timesheet not found." };

    const { is_submitted, is_approved } = timesheetRows[0];
    const isSuperiorUser = await isSuperior(pool, currentUserEmpId, employeeId);
    if (is_approved === 1 && currentUserEmpId === employeeId && !isSuperiorUser) return { error: "You cannot remove attachments from your own approved timesheet." };
    if (is_submitted === 1 && currentUserEmpId === employeeId && !isSuperiorUser) return { error: "You cannot remove attachments from your own submitted timesheet." };
    if (is_submitted === 1 && !isSuperiorUser && currentUserEmpId !== employeeId) return { error: "Only a superior can remove attachments from a submitted timesheet." };

    await pool.execute("DELETE FROM timesheet_attachments WHERE attachment_id = ? AND timesheet_id = ?", [attachmentId, timesheetId]);
    const absolutePath = path.join(process.cwd(), "public", filePath);
    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      console.warn(`Failed to delete file at ${absolutePath}: ${error.message}`);
    }

    return { success: true };
  } catch (error) {
    return { error: `Failed to remove attachment: ${error.message}` };
  }
}

export async function fetchPendingTimesheets() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };

  const userEmpId = userRows[0].empid;
  const directSubordinates = await getAllSubordinates(pool, userEmpId);
  const delegatedSubordinates = await getDelegatedSubordinates(pool, userEmpId);
  const allSubordinates = [...directSubordinates, ...delegatedSubordinates].filter(
    (sub, index, self) => index === self.findIndex((s) => s.empid === sub.empid) && sub.empid !== userEmpId
  );

  if (!allSubordinates.length) return { error: "You are not authorized to view pending timesheets." };

  const employeeIds = allSubordinates.map((emp) => emp.empid);
  const [timesheetRows] = await pool.execute(
    `SELECT t.*, COALESCE(p.PRJ_NAME, 'Unnamed Project') AS project_name, e.EMP_FST_NAME, e.EMP_LAST_NAME
     FROM timesheets t
     LEFT JOIN C_PROJECT p ON t.project_id = p.PRJ_ID
     LEFT JOIN C_EMP e ON t.employee_id = e.empid
     WHERE t.employee_id IN (${employeeIds.map(() => "?").join(",")}) AND t.is_submitted = 1 AND t.is_approved = 0`,
    employeeIds
  );

  const timesheets = timesheetRows.map((ts) => {
    const employee = allSubordinates.find((emp) => emp.empid === ts.employee_id);
    return {
      ...ts,
      employee_name: `${ts.EMP_FST_NAME} ${ts.EMP_LAST_NAME || ""}${employee?.isDelegated ? " [del]" : ""}`.trim(),
      total_hours: ["sun_hours", "mon_hours", "tue_hours", "wed_hours", "thu_hours", "fri_hours", "sat_hours"].reduce(
        (sum, day) => sum + (parseFloat(ts[day]) || 0),
        0
      ),
    };
  });

  return { timesheets, employees: allSubordinates };
}

export async function approveTimesheet(timesheetId, employeeId, isApproved) {
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

  const isSuperiorUser = await isSuperior(pool, currentUserEmpId, employeeId);
  if (!isSuperiorUser && currentUserEmpId !== employeeId) return { error: "You are not authorized to approve or unapprove this timesheet." };
  if (currentUserEmpId === employeeId) return { error: "You cannot approve or unapprove your own timesheet." };

  await pool.execute(
    `UPDATE timesheets SET is_approved = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE timesheet_id = ? AND employee_id = ?`,
    [isApproved ? 1 : 0, isApproved ? currentUserEmpId : null, timesheetId, employeeId]
  );

  // Verify the update
  const [updatedRows] = await pool.execute(
    "SELECT is_approved, approved_by FROM timesheets WHERE timesheet_id = ? AND employee_id = ?",
    [timesheetId, employeeId]
  );
  if (updatedRows.length && updatedRows[0].is_approved !== isApproved) {
    console.error("Approval update failed to persist:", updatedRows[0]);
    return { error: "Failed to update approval status." };
  }

  return { success: true, timesheetId, isApproved: updatedRows[0].is_approved, approvedBy: updatedRows[0].approved_by };
}
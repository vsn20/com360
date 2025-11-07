"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// --- START: CRITICAL FIX FOR TIMEZONE ISSUES ---

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
 * CRITICAL FIX: Timezone-agnostic week start calculation
 * This function MUST return Sunday regardless of server timezone
 * Input: "2025-01-13" (any day of week)
 * Output: "2025-01-12" (the Sunday of that week)
 */
const getWeekStartDate = (dateString) => {
  try {
    // Extract year, month, day from string WITHOUT creating Date object
    // This prevents ANY timezone conversion
    const [yearStr, monthStr, dayStr] = dateString.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    
    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error("Invalid date components");
    }
    
    // Create date at noon UTC to avoid any daylight saving issues
    const dateUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    
    if (isNaN(dateUTC.getTime())) {
      throw new Error("Invalid date");
    }
    
    // Get day of week in UTC (0 = Sunday, 6 = Saturday)
    const dayOfWeek = dateUTC.getUTCDay();
    
    // Calculate Sunday of this week by subtracting days
    const sundayUTC = new Date(dateUTC);
    sundayUTC.setUTCDate(dateUTC.getUTCDate() - dayOfWeek);
    
    // Format as YYYY-MM-DD using UTC components
    const weekStart = `${sundayUTC.getUTCFullYear()}-${String(sundayUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(sundayUTC.getUTCDate()).padStart(2, '0')}`;
    
    console.log(`[SERVER] getWeekStartDate: Input="${dateString}", DayOfWeek=${dayOfWeek}, WeekStart="${weekStart}"`);
    
    return weekStart;
  } catch (error) {
    console.error("[SERVER] Invalid date error:", error, "Input:", dateString);
    // Fallback to current week's Sunday
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek, 12, 0, 0));
    return `${sunday.getUTCFullYear()}-${String(sunday.getUTCMonth() + 1).padStart(2, '0')}-${String(sunday.getUTCDate()).padStart(2, '0')}`;
  }
};

/**
 * Calculate Saturday (week end) from Sunday (week start)
 */
const getWeekEndDate = (weekStartString) => {
  try {
    const [yearStr, monthStr, dayStr] = weekStartString.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    
    const sundayUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const saturdayUTC = new Date(sundayUTC);
    saturdayUTC.setUTCDate(sundayUTC.getUTCDate() + 6);
    
    return `${saturdayUTC.getUTCFullYear()}-${String(saturdayUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(saturdayUTC.getUTCDate()).padStart(2, '0')}`;
  } catch (error) {
    console.error("[SERVER] Error calculating week end:", error);
    return weekStartString; // Fallback
  }
};

// --- END: CRITICAL FIX FOR TIMEZONE ISSUES ---

const getSubordinateIds = async (pool, superiorEmpId) => {
  if (!superiorEmpId) return [];
  const query = `
      WITH RECURSIVE SubordinateHierarchy AS (
          SELECT empid FROM C_EMP WHERE superior = ?
          UNION ALL
          SELECT e.empid FROM C_EMP e
          INNER JOIN SubordinateHierarchy sh ON e.superior = sh.empid
      )
      SELECT empid FROM SubordinateHierarchy;
  `;
  const [rows] = await pool.execute(query, [superiorEmpId]);
  return rows.map(r => r.empid);
};

const getAllOrgEmpIds = async (pool, orgid) => {
  try {
    const [rows] = await pool.execute("SELECT empid FROM C_EMP WHERE orgid = ?", [orgid]);
    return rows.map(r => r.empid);
  } catch (error) {
    console.error(`Error getting all org emp IDs for org ${orgid}:`, error);
    return [];
  }
};

const getUserPermissionLevel = async (pool, empId, orgId) => {
  if (!empId || !orgId) return 'none';
  try {
    const [roles] = await pool.execute(
      `SELECT p.alldata, p.teamdata, p.individualdata
       FROM C_EMP_ROLE_ASSIGN era
       LEFT JOIN C_ROLE_MENU_PERMISSIONS p ON era.roleid = p.roleid AND p.menuid = 7
       WHERE era.empid = ? AND era.orgid = ?`,
      [empId, orgId]
    );

    let level = 'none';
    for (const role of roles) {
      if (role.alldata) return 'all';
      if (role.teamdata) level = 'team';
      else if (role.individualdata && level !== 'team') level = 'individual';
    }
    return level;
  } catch (error) {
    console.error(`Error getting permission level for user ${empId}:`, error);
    return 'none';
  }
};

export async function getTimesheetManagementScope(pool, currentEmpId, orgid) {
  let viewableEmpIds = new Set([currentEmpId]);
  let manageableEmpIds = new Set();

  let effectiveLevel = await getUserPermissionLevel(pool, currentEmpId, orgid);
  const [delegations] = await pool.execute(
    `SELECT senderempid FROM C_DELEGATE WHERE receiverempid = ? AND menuid = 7 AND isactive = 1`,
    [currentEmpId]
  );

  if (effectiveLevel !== 'all') {
    for (const delegation of delegations) {
      const delegatorLevel = await getUserPermissionLevel(pool, delegation.senderempid, orgid);
      if (delegatorLevel === 'all') {
        effectiveLevel = 'all';
        break;
      }
    }
  }

  if (effectiveLevel === 'all') {
    const allEmps = await getAllOrgEmpIds(pool, orgid);
    allEmps.forEach(id => { 
      viewableEmpIds.add(id);
      manageableEmpIds.add(id);
    });
  } else {
    const userBaseLevel = await getUserPermissionLevel(pool, currentEmpId, orgid);
    if (userBaseLevel === 'team') {
      const ownSubordinates = await getSubordinateIds(pool, currentEmpId);
      ownSubordinates.forEach(id => {
        viewableEmpIds.add(id);
        manageableEmpIds.add(id);
      });
    }

    for (const delegation of delegations) {
      const delegatorId = delegation.senderempid;
      const delegatorLevel = await getUserPermissionLevel(pool, delegatorId, orgid);
      
      viewableEmpIds.add(delegatorId);
      
      if (delegatorLevel === 'team') {
        const delegatorSubordinates = await getSubordinateIds(pool, delegatorId);
        delegatorSubordinates.forEach(id => {
          viewableEmpIds.add(id);
          manageableEmpIds.add(id);
        });
      }
    }
  }

  return { 
    viewableEmpIds: [...viewableEmpIds], 
    manageableEmpIds: [...manageableEmpIds] 
  };
}

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
  const [userRows] = await pool.execute("SELECT empid, orgid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };

  const employeeId = userRows[0].empid;
  const orgid = userRows[0].orgid;
  const weekStart = getWeekStartDate(selectedDate);
  const weekEnd = getWeekEndDate(weekStart);
  const year = new Date(weekStart + 'T12:00:00Z').getUTCFullYear();

  console.log(`[SERVER] fetchTimesheetAndProjects: selectedDate="${selectedDate}", weekStart="${weekStart}", weekEnd="${weekEnd}"`);

  const [projRows] = await pool.execute(
    `SELECT pe.PRJ_ID, COALESCE(p.PRJ_NAME, 'Unnamed Project') AS PRJ_NAME, pe.BILL_RATE, pe.BILL_TYPE 
     FROM C_PROJ_EMP pe 
     LEFT JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID 
     WHERE pe.EMP_ID = ? 
     AND pe.START_DT <= ? 
     AND COALESCE(pe.END_DT, '9999-12-31') >= ?`,
    [employeeId, weekEnd, weekStart]
  );

  const C_TIMESHEETS = [];
  const attachments = {};
  for (const project of projRows) {
    const [timesheetRows] = await pool.execute(
      "SELECT * FROM C_TIMESHEETS WHERE employee_id = ? AND week_start_date = ? AND project_id = ?",
      [employeeId, weekStart, project.PRJ_ID]
    );
    const timesheet = timesheetRows[0] || {
      employee_id: employeeId,
      project_id: project.PRJ_ID,
      week_start_date: weekStart,
      year,
      sun_hours: null, mon_hours: null, tue_hours: null, wed_hours: null, thu_hours: null, fri_hours: null, sat_hours: null,
      sun_comment: "", mon_comment: "", tue_comment: "", wed_comment: "", thu_comment: "", fri_comment: "", sat_comment: "",
      is_submitted: 0, is_approved: 0, invoice_path: null, invoice_generated_at: null,
      temp_key: `temp-${Date.now()}-${project.PRJ_ID}`,
    };
    C_TIMESHEETS.push(timesheet);

    const [attachmentRows] = await pool.execute(
      "SELECT DISTINCT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM C_TIMESHEETS_ATTACHMENTS WHERE employee_id = ? AND week_start_date = ?",
      [employeeId, weekStart]
    );
    attachments[timesheet.timesheet_id || timesheet.temp_key] = attachmentRows;
  }

  const { manageableEmpIds } = await getTimesheetManagementScope(pool, employeeId, orgid);

  return { 
    C_TIMESHEETS, 
    projects: projRows, 
    attachments, 
    serverWeekStart: weekStart, 
    currentUserEmpId: employeeId,
    manageableEmpIds
  };
}

export async function fetchTimesheetsForSuperior(selectedDate) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid, orgid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };

  const superiorEmpId = userRows[0].empid;
  const orgid = userRows[0].orgid;
  const weekStart = getWeekStartDate(selectedDate);
  const weekEnd = getWeekEndDate(weekStart);
  const year = new Date(weekStart + 'T12:00:00Z').getUTCFullYear();

  console.log(`[SERVER] fetchTimesheetsForSuperior: selectedDate="${selectedDate}", weekStart="${weekStart}", weekEnd="${weekEnd}"`);

  const { viewableEmpIds, manageableEmpIds } = await getTimesheetManagementScope(pool, superiorEmpId, orgid);
  const employeeIdsToFetch = viewableEmpIds.filter(id => id !== superiorEmpId);

  if (employeeIdsToFetch.length === 0) {
    return { C_TIMESHEETS: [], employees: [], projects: {}, attachments: {}, manageableEmpIds: [], currentUserEmpId: superiorEmpId };
  }

  const placeholders = employeeIdsToFetch.map(() => '?').join(',');
  const [allSubordinates] = await pool.execute(
    `SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid IN (${placeholders})`,
    employeeIdsToFetch
  );

  const C_TIMESHEETS = [];
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
        "SELECT * FROM C_TIMESHEETS WHERE employee_id = ? AND week_start_date = ? AND project_id = ?",
        [employee.empid, weekStart, project.PRJ_ID]
      );
      const ts = timesheetRows[0] || {
        employee_id: employee.empid,
        project_id: project.PRJ_ID,
        week_start_date: weekStart,
        year,
        sun_hours: null, mon_hours: null, tue_hours: null, wed_hours: null, thu_hours: null, fri_hours: null, sat_hours: null,
        sun_comment: "", mon_comment: "", tue_comment: "", wed_comment: "", thu_comment: "", fri_comment: "", sat_comment: "",
        is_submitted: 0, is_approved: 0, invoice_path: null, invoice_generated_at: null,
        temp_key: `temp-${Date.now()}-${project.PRJ_ID}`,
        employeeName: `${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME || ""}`.trim(),
      };
      C_TIMESHEETS.push(ts);

      const [attachmentRows] = await pool.execute(
        "SELECT DISTINCT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM C_TIMESHEETS_ATTACHMENTS WHERE employee_id = ? AND week_start_date = ?",
        [employee.empid, weekStart]
      );
      attachments[ts.timesheet_id || ts.temp_key] = attachmentRows;
    }
  }

  return { 
    C_TIMESHEETS, 
    employees: allSubordinates, 
    projects, 
    attachments, 
    serverWeekStart: weekStart, 
    currentUserEmpId: superiorEmpId,
    manageableEmpIds
  };
}

export async function saveTimesheet(formData) {
  if (!formData) return { error: "Invalid form data received." };

  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid, orgid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };

  const currentUserEmpId = userRows[0].empid;
  const orgid = userRows[0].orgid;

  const { manageableEmpIds } = await getTimesheetManagementScope(pool, currentUserEmpId, orgid);

  const timesheetsData = [];
  const updatedAttachments = {};
  const timesheetIndices = [];
  for (let key of formData.keys()) {
    const match = key.match(/^C_TIMESHEETS\[(\d+)\]/);
    if (match && !timesheetIndices.includes(match[1])) {
      timesheetIndices.push(match[1]);
    }
  }

  for (const index of timesheetIndices) {
    const timesheetId = formData.get(`C_TIMESHEETS[${index}][timesheet_id]`) || null;
    const employeeId = formData.get(`C_TIMESHEETS[${index}][employee_id]`);
    const projectId = formData.get(`C_TIMESHEETS[${index}][project_id]`);
    let weekStartDate = formData.get(`C_TIMESHEETS[${index}][week_start_date]`);
    const year = formData.get(`C_TIMESHEETS[${index}][year]`);
    
    // CRITICAL: Recalculate week start on server to ensure it's always Sunday
    if (weekStartDate) {
      weekStartDate = getWeekStartDate(weekStartDate);
    }
    
    console.log(`[SERVER] saveTimesheet: index=${index}, originalWeekStart=${formData.get(`C_TIMESHEETS[${index}][week_start_date]`)}, recalculatedWeekStart="${weekStartDate}", employeeId=${employeeId}`);
    
    if (!projectId || !weekStartDate || !employeeId) continue;

    let existingTimesheet = null;
    if (timesheetId) {
      const [rows] = await pool.execute("SELECT * FROM C_TIMESHEETS WHERE timesheet_id = ? AND employee_id = ?", [timesheetId, employeeId]);
      existingTimesheet = rows[0];
    } else {
      const [rows] = await pool.execute(
        "SELECT * FROM C_TIMESHEETS WHERE employee_id = ? AND week_start_date = ? AND project_id = ?",
        [employeeId, weekStartDate, projectId]
      );
      existingTimesheet = rows[0];
    }

    const canManageThisEmployee = manageableEmpIds.includes(employeeId);
    const isOwner = currentUserEmpId === employeeId;

    if (isOwner && !canManageThisEmployee && (existingTimesheet?.is_submitted === 1 || existingTimesheet?.is_approved === 1)) {
      continue;
    }

    const fields = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const hours = fields.map((day) => ({
      hours: formData.get(`C_TIMESHEETS[${index}][${day}_hours]`) !== null ? parseFloat(formData.get(`C_TIMESHEETS[${index}][${day}_hours]`)) || null : existingTimesheet?.[`${day}_hours`] || null,
      comment: formData.get(`C_TIMESHEETS[${index}][${day}_comment]`) !== null ? formData.get(`C_TIMESHEETS[${index}][${day}_comment]`) || "" : existingTimesheet?.[`${day}_comment`] || "",
    }));
    const isSubmitted = formData.get(`C_TIMESHEETS[${index}][is_submitted]`) !== null ? parseInt(formData.get(`C_TIMESHEETS[${index}][is_submitted]`) || "0") : existingTimesheet?.is_submitted || 0;
    
    let isApproved = existingTimesheet?.is_approved || 0;
    let approvedBy = existingTimesheet?.approved_by || null;
    
    if (canManageThisEmployee) {
        isApproved = formData.get(`C_TIMESHEETS[${index}][is_approved]`) !== null ? parseInt(formData.get(`C_TIMESHEETS[${index}][is_approved]`) || "0") : existingTimesheet?.is_approved || 0;
        if (isApproved && !approvedBy) {
            approvedBy = currentUserEmpId;
        } else if (!isApproved) {
            approvedBy = null;
        }
    }

    let finalTimesheetId = timesheetId || existingTimesheet?.timesheet_id;

    if (finalTimesheetId) {
      await pool.execute(
        `UPDATE C_TIMESHEETS SET 
          sun_hours = ?, mon_hours = ?, tue_hours = ?, wed_hours = ?, thu_hours = ?, fri_hours = ?, sat_hours = ?, 
          sun_comment = ?, mon_comment = ?, tue_comment = ?, wed_comment = ?, thu_comment = ?, fri_comment = ?, sat_comment = ?, 
          is_submitted = ?, is_approved = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE timesheet_id = ? AND employee_id = ?`,
        [
          ...hours.map((h) => h.hours), ...hours.map((h) => h.comment),
          isSubmitted, isApproved, approvedBy,
          finalTimesheetId, employeeId,
        ]
      );
    } else {
      const [result] = await pool.execute(
        `INSERT INTO C_TIMESHEETS (
          employee_id, project_id, week_start_date, year, 
          sun_hours, mon_hours, tue_hours, wed_hours, thu_hours, fri_hours, sat_hours, 
          sun_comment, mon_comment, tue_comment, wed_comment, thu_comment, fri_comment, sat_comment, 
          is_submitted, is_approved, approved_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          employeeId, projectId, weekStartDate, year,
          ...hours.map((h) => h.hours), ...hours.map((h) => h.comment),
          isSubmitted, isApproved, approvedBy,
        ]
      );
      finalTimesheetId = result.insertId;
    }
    timesheetsData.push({ timesheetId: finalTimesheetId, employeeId, weekStartDate, year, isSubmitted });
  }

  // Attachment handling
  const attachmentFiles = formData.getAll("attachment");
  const firstTimesheetId = timesheetsData.length > 0 ? timesheetsData[0].timesheetId : null;
  const employeeId = timesheetsData.length > 0 ? timesheetsData[0].employeeId : null;
  const noAttachmentFlag = formData.get("noAttachmentFlag") === "1";
  
  if (attachmentFiles.length > 0 && attachmentFiles[0].size > 0 && employeeId && !noAttachmentFlag) {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf", "text/plain"];
    const maxFileSize = 5 * 1024 * 1024;
    const uploadDir = path.join(process.cwd(), "public", "uploads", employeeId.toString(), timesheetsData[0].weekStartDate.replace(/-/g, ""));
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
          "INSERT INTO C_TIMESHEETS_ATTACHMENTS (employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
          [
            employeeId, timesheetsData[0].weekStartDate, timesheetsData[0].year, firstTimesheetId,
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
  } 
  
  if (timesheetsData.length > 0 && formData.get("C_TIMESHEETS[0][is_submitted]") === "1") {
    if (!noAttachmentFlag) {
      const [existingAttachments] = await pool.execute(
        "SELECT COUNT(*) as count FROM C_TIMESHEETS_ATTACHMENTS WHERE employee_id = ? AND week_start_date = ?",
        [employeeId || currentUserEmpId, timesheetsData[0].weekStartDate]
      );
      
      if (attachmentFiles.length === 0 && existingAttachments[0].count === 0) {
          return { error: "No attachments found. Please check 'No Attachment' or upload at least one attachment." };
      }
    }
  }

  const attachmentRows = timesheetsData.length > 0
    ? (await pool.execute(
        "SELECT DISTINCT attachment_id, employee_id, week_start_date, year, timesheet_id, file_path, file_name, uploaded_at FROM C_TIMESHEETS_ATTACHMENTS WHERE employee_id = ? AND week_start_date = ?",
        [employeeId || currentUserEmpId, timesheetsData[0].weekStartDate]
      ))[0]
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
  const [userRows] = await pool.execute("SELECT empid, orgid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };

  const currentUserEmpId = userRows[0].empid;
  const orgid = userRows[0].orgid;
  
  try {
    const [attachmentRows] = await pool.execute(
      "SELECT employee_id, file_path FROM C_TIMESHEETS_ATTACHMENTS WHERE attachment_id = ?",
      [attachmentId]
    );
    if (!attachmentRows.length) return { error: "Attachment not found." };

    const { employee_id: employeeId, file_path: filePath } = attachmentRows[0];
    
    const { manageableEmpIds } = await getTimesheetManagementScope(pool, currentUserEmpId, orgid);
    const canManageThisEmployee = manageableEmpIds.includes(employeeId);
    const isOwner = currentUserEmpId === employeeId;

    const [timesheetRows] = await pool.execute(
      "SELECT is_submitted, is_approved FROM C_TIMESHEETS WHERE employee_id = ? AND timesheet_id = (SELECT timesheet_id FROM C_TIMESHEETS_ATTACHMENTS WHERE attachment_id = ? LIMIT 1)",
      [employeeId, attachmentId]
    );
    
    if (timesheetRows.length > 0) {
        const { is_submitted, is_approved } = timesheetRows[0];
        if (isOwner && !canManageThisEmployee && (is_submitted === 1 || is_approved === 1)) {
            return { error: "You cannot remove attachments from your own submitted or approved timesheet." };
        }
    }
    
    await pool.execute("DELETE FROM C_TIMESHEETS_ATTACHMENTS WHERE attachment_id = ?", [attachmentId]);
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

export async function approveTimesheet(timesheetId, employeeId, isApproved) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid, orgid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found in C_USER table." };

  const currentUserEmpId = userRows[0].empid;
  const orgid = userRows[0].orgid;

  const [timesheetRows] = await pool.execute(
    "SELECT * FROM C_TIMESHEETS WHERE timesheet_id = ? AND employee_id = ?",
    [timesheetId, employeeId]
  );
  if (!timesheetRows.length) return { error: "Timesheet not found." };

  const { manageableEmpIds } = await getTimesheetManagementScope(pool, currentUserEmpId, orgid);
  if (!manageableEmpIds.includes(employeeId)) {
    return { error: "You are not authorized to approve or unapprove this timesheet." };
  }

  await pool.execute(
    `UPDATE C_TIMESHEETS SET is_approved = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE timesheet_id = ? AND employee_id = ?`,
    [isApproved ? 1 : 0, isApproved ? currentUserEmpId : null, timesheetId, employeeId]
  );

  const [updatedRows] = await pool.execute(
    "SELECT is_approved, approved_by FROM C_TIMESHEETS WHERE timesheet_id = ? AND employee_id = ?",
    [timesheetId, employeeId]
  );
  if (updatedRows.length && updatedRows[0].is_approved !== (isApproved ? 1 : 0)) {
    console.error("Approval update failed to persist:", updatedRows[0]);
    return { error: "Failed to update approval status." };
  }

  return { success: true, timesheetId, isApproved: updatedRows[0].is_approved, approvedBy: updatedRows[0].approved_by };
}

export async function fetchCopyableWeeks(employeeId, projectId) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid, orgid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found." };

  const currentUserEmpId = userRows[0].empid;
  const orgid = userRows[0].orgid;

  const { viewableEmpIds } = await getTimesheetManagementScope(pool, currentUserEmpId, orgid);
  if (!viewableEmpIds.includes(employeeId)) {
    return { error: "You are not authorized to view this data." };
  }

  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT week_start_date 
       FROM C_TIMESHEETS 
       WHERE employee_id = ? AND project_id = ? 
       AND (is_submitted = 1 OR is_approved = 1)
       ORDER BY week_start_date DESC LIMIT 10`,
      [employeeId, projectId]
    );
    return { weeks: rows };
  } catch (error) {
    console.error("Error fetching copyable weeks:", error);
    return { error: "Failed to fetch past weeks." };
  }
}

export async function fetchTimesheetDataForCopy(employeeId, projectId, weekStartDate) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token." };

  const pool = await DBconnection();
  const [userRows] = await pool.execute("SELECT empid, orgid FROM C_USER WHERE username = ?", [decoded.userId]);
  if (!userRows.length) return { error: "User not found." };

  const currentUserEmpId = userRows[0].empid;
  const orgid = userRows[0].orgid;

  const { viewableEmpIds } = await getTimesheetManagementScope(pool, currentUserEmpId, orgid);
  if (!viewableEmpIds.includes(employeeId)) {
    return { error: "You are not authorized to view this data." };
  }

  try {
    const [rows] = await pool.execute(
      `SELECT sun_hours, sun_comment, mon_hours, mon_comment, tue_hours, tue_comment, 
              wed_hours, wed_comment, thu_hours, thu_comment, fri_hours, fri_comment, 
              sat_hours, sat_comment 
       FROM C_TIMESHEETS 
       WHERE employee_id = ? AND project_id = ? AND week_start_date = ?`,
      [employeeId, projectId, weekStartDate]
    );
    if (!rows.length) return { error: "Source timesheet not found." };
    return { sourceTimesheet: rows[0] };
  } catch (error) {
    console.error("Error fetching timesheet data for copy:", error);
    return { error: "Failed to fetch timesheet data." };
  }
}
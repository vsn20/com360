"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch (error) {
    return null;
  }
};

const getOTThreshold = async (pool, orgId) => {
  try {
    const [rows] = await pool.execute(
      "SELECT Name FROM C_GENERIC_VALUES WHERE g_id = 28 AND orgid = ? AND isactive = 1",
      [orgId]
    );
    if (rows.length > 0 && rows[0].Name) {
      const threshold = parseInt(rows[0].Name);
      if (!isNaN(threshold) && threshold >= 1 && threshold <= 23) return threshold;
    }
    return 8;
  } catch (error) {
    return 8;
  }
};

const calculateDailyRevenue = (dailyHours, threshold, billRate, otBillRate) => {
  const effectiveOTRate = otBillRate > 0 ? otBillRate : billRate;
  
  if (dailyHours > threshold) {
    const regularHours = threshold;
    const otHours = dailyHours - threshold;
    return {
      regularHours,
      otHours,
      amount: (regularHours * billRate) + (otHours * effectiveOTRate)
    };
  }
  return {
    regularHours: dailyHours,
    otHours: 0,
    amount: dailyHours * billRate
  };
};

const getDateForDay = (weekStart, dayIndex) => {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayIndex);
  return date.toISOString().split("T")[0];
};

const isDateInRange = (date, start, end) => date >= start && date <= end;

// Fetch all employees for receivable filter
export async function fetchEmployeesForInvoice() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;

    const [employees] = await pool.execute(
      `SELECT empid, EMP_FST_NAME, EMP_LAST_NAME
       FROM C_EMP 
       WHERE orgid = ?
       ORDER BY EMP_FST_NAME, EMP_LAST_NAME`,
      [orgid]
    );

    return { 
      employees: employees.map(emp => ({
        id: emp.empid,
        name: `${emp.EMP_FST_NAME || ""} ${emp.EMP_LAST_NAME || ""}`.trim() || `Employee ${emp.empid}`
      }))
    };
  } catch (error) {
    console.error("Error fetching employees:", error);
    return { error: error.message };
  }
}

// Fetch contractors and 1099 employees for payable filter
export async function fetchContractEmployeesForInvoice() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;

    // Get contractors (type 12) and 1099 (type 13) who have vendor_id
    const [employees] = await pool.execute(
      `SELECT DISTINCT e.empid, e.EMP_FST_NAME, e.EMP_LAST_NAME, e.vendor_id
       FROM C_EMP e
       WHERE e.orgid = ?
       AND e.employment_type IN ('12', '13')
       AND e.vendor_id IS NOT NULL
       ORDER BY e.EMP_FST_NAME, e.EMP_LAST_NAME`,
      [orgid]
    );

    return { 
      employees: employees.map(emp => ({
        id: emp.empid,
        name: `${emp.EMP_FST_NAME || ""} ${emp.EMP_LAST_NAME || ""}`.trim() || `Employee ${emp.empid}`,
        vendorId: emp.vendor_id
      }))
    };
  } catch (error) {
    console.error("Error fetching payable employees:", error);
    return { error: error.message };
  }
}

// Fetch external accounts for receivable (ourorg = 0)
export async function fetchAccountsForReceivable() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;

    const [accounts] = await pool.execute(
      `SELECT DISTINCT a.ACCNT_ID, a.ALIAS_NAME
       FROM C_ACCOUNT a
       WHERE a.ORGID = ?
       AND a.ourorg = 0
       ORDER BY a.ALIAS_NAME`,
      [orgid]
    );

    return { 
      accounts: accounts.map(acc => ({
        id: acc.ACCNT_ID,
        name: acc.ALIAS_NAME || `Account ${acc.ACCNT_ID}`
      }))
    };
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return { error: error.message };
  }
}

// Fetch vendors (external accounts that are vendors for contractors)
export async function fetchVendorsForPayable() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;

    const [vendors] = await pool.execute(
      `SELECT DISTINCT a.ACCNT_ID, a.ALIAS_NAME
       FROM C_ACCOUNT a
       JOIN C_EMP e ON a.ACCNT_ID = e.vendor_id
       WHERE e.orgid = ?
       AND e.employment_type IN ('12', '13')
       AND a.ourorg = 0
       ORDER BY a.ALIAS_NAME`,
      [orgid]
    );

    return { 
      vendors: vendors.map(v => ({
        id: v.ACCNT_ID,
        name: v.ALIAS_NAME || `Vendor ${v.ACCNT_ID}`
      }))
    };
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return { error: error.message };
  }
}

// Fetch projects for filter dropdown
export async function fetchProjectsForInvoice() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;

    const [projects] = await pool.execute(
      `SELECT p.PRJ_ID, p.PRJ_NAME, a.ALIAS_NAME as account_name
       FROM C_PROJECT p
       JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
       WHERE p.ORG_ID = ?
       ORDER BY p.PRJ_NAME`,
      [orgid]
    );

    return { 
      projects: projects.map(proj => ({
        id: proj.PRJ_ID,
        name: proj.PRJ_NAME,
        accountName: proj.account_name
      }))
    };
  } catch (error) {
    console.error("Error fetching projects:", error);
    return { error: error.message };
  }
}

export async function generateInvoices({ 
  reportType, 
  actualStart, 
  actualEnd,
  selectedEmployees = [], 
  selectedProjects = [], 
  selectedAccounts = [], 
  invoiceType = "receivable",
  groupingMode = "combined"
}) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;
    
    // Get Organization Details
    const [subOrgRows] = await pool.execute(
      `SELECT * FROM C_SUB_ORG WHERE orgid = ? LIMIT 1`,
      [orgid]
    );
    const orgDetails = subOrgRows[0] || {};
    const otThreshold = await getOTThreshold(pool, orgid);

    // Calculate search range to include weeks that overlap with actual period
    const startDate = new Date(actualStart);
    const endDate = new Date(actualEnd);
    const searchStart = new Date(startDate);
    searchStart.setDate(searchStart.getDate() - startDate.getDay()); // Previous Sunday
    const searchEnd = new Date(endDate);
    searchEnd.setDate(searchEnd.getDate() + (6 - endDate.getDay())); // Next Saturday

    const searchStartStr = searchStart.toISOString().split('T')[0];
    const searchEndStr = searchEnd.toISOString().split('T')[0];

    // Build filters
    let employeeFilter = "";
    let projectFilter = "";
    let accountFilter = "";
    
    if (selectedEmployees.length > 0) {
      const empPlaceholders = selectedEmployees.map(() => '?').join(',');
      employeeFilter = ` AND t.employee_id IN (${empPlaceholders})`;
    }
    if (selectedProjects.length > 0) {
      const projPlaceholders = selectedProjects.map(() => '?').join(',');
      projectFilter = ` AND p.PRJ_ID IN (${projPlaceholders})`;
    }
    if (selectedAccounts.length > 0) {
      const accPlaceholders = selectedAccounts.map(() => '?').join(',');
      accountFilter = ` AND ${invoiceType === 'receivable' ? 'p.ACCNT_ID' : 'e.vendor_id'} IN (${accPlaceholders})`;
    }

    const invoiceMap = {};
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    if (invoiceType === "receivable") {
      // RECEIVABLE LOGIC (Same as before)
      const timesheetParams = [searchStartStr, searchEndStr, orgid, ...selectedEmployees, ...selectedProjects, ...selectedAccounts];
      
      const [timesheetRows] = await pool.execute(
        `SELECT t.*, 
                e.EMP_FST_NAME, e.EMP_LAST_NAME,
                p.PRJ_ID, p.PRJ_NAME, p.BILL_RATE, p.OT_BILL_RATE,
                p.ACCNT_ID, a.ALIAS_NAME as account_name, a.ourorg as account_ourorg,
                a.EMAIL as account_email,
                a.BUSINESS_ADDR_LINE1 as account_addr,
                a.BUSINESS_CITY as account_city,
                a.BUSINESS_POSTAL_CODE as account_zip,
                p.CLIENT_ID, 
                ac_client.ALIAS_NAME as client_name, 
                ac_client.ourorg as client_ourorg,
                ac_client.EMAIL as client_email,
                ac_client.BUSINESS_ADDR_LINE1 as client_addr,
                ac_client.BUSINESS_CITY as client_city,
                ac_client.BUSINESS_POSTAL_CODE as client_zip
         FROM C_TIMESHEETS t
         JOIN C_EMP e ON t.employee_id = e.empid
         JOIN C_PROJECT p ON t.project_id = p.PRJ_ID
         JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
         LEFT JOIN C_ACCOUNT ac_client ON p.CLIENT_ID = ac_client.ACCNT_ID
         WHERE t.week_start_date >= ? AND t.week_start_date <= ?
         AND t.is_approved = 1
         AND e.orgid = ?${employeeFilter}${projectFilter}${accountFilter}
         ORDER BY a.ALIAS_NAME, e.EMP_FST_NAME, p.PRJ_NAME`,
        timesheetParams
      );

      const assignParams = [actualEnd, actualStart, orgid, ...selectedEmployees, ...selectedProjects, ...selectedAccounts];
      
      const [assignmentRows] = await pool.execute(
        `SELECT pe.EMP_ID, pe.PRJ_ID, 
                e.EMP_FST_NAME, e.EMP_LAST_NAME,
                p.PRJ_NAME, p.BILL_RATE, p.OT_BILL_RATE,
                p.ACCNT_ID, a.ALIAS_NAME as account_name, a.ourorg as account_ourorg,
                a.EMAIL as account_email,
                a.BUSINESS_ADDR_LINE1 as account_addr,
                a.BUSINESS_CITY as account_city,
                a.BUSINESS_POSTAL_CODE as account_zip,
                p.CLIENT_ID, 
                ac_client.ALIAS_NAME as client_name,
                ac_client.ourorg as client_ourorg,
                ac_client.EMAIL as client_email,
                ac_client.BUSINESS_ADDR_LINE1 as client_addr,
                ac_client.BUSINESS_CITY as client_city,
                ac_client.BUSINESS_POSTAL_CODE as client_zip
         FROM C_PROJ_EMP pe
         JOIN C_EMP e ON pe.EMP_ID = e.empid
         JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID
         JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
         LEFT JOIN C_ACCOUNT ac_client ON p.CLIENT_ID = ac_client.ACCNT_ID
         WHERE pe.START_DT <= ? AND (pe.END_DT >= ? OR pe.END_DT IS NULL)
         AND e.orgid = ?${employeeFilter.replace('t.employee_id', 'pe.EMP_ID')}${projectFilter}${accountFilter}`,
        assignParams
      );

      const initAccount = (row) => {
        if (row.account_ourorg === 1 && row.client_ourorg === 1) return null;

        const shouldBillClient = row.account_ourorg === 1 && row.client_ourorg === 0;
        const billingId = shouldBillClient ? row.CLIENT_ID : row.ACCNT_ID;
        const billingName = shouldBillClient ? row.client_name : row.account_name;
        const billingEmail = shouldBillClient ? row.client_email : row.account_email;

        if (!invoiceMap[billingId]) {
          invoiceMap[billingId] = {
            accountId: billingId,
            accountName: billingName,
            accountEmail: billingEmail || null,
            address: shouldBillClient ? {
              line1: row.client_addr,
              city: row.client_city,
              zip: row.client_zip
            } : {
              line1: row.account_addr,
              city: row.account_city,
              zip: row.account_zip
            },
            employees: {},
            totalAmount: 0,
            dateRange: { start: actualStart, end: actualEnd }
          };
        }
        return billingId;
      };

      const initEmployee = (accountId, row) => {
        const empId = row.employee_id || row.EMP_ID;
        if (!invoiceMap[accountId].employees[empId]) {
          invoiceMap[accountId].employees[empId] = {
            empId,
            empName: `${row.EMP_FST_NAME} ${row.EMP_LAST_NAME || ""}`.trim(),
            projects: {},
            totalAmount: 0
          };
        }
      };

      const initProject = (accountId, empId, row) => {
        const employee = invoiceMap[accountId].employees[empId];
        if (!employee.projects[row.PRJ_ID]) {
          employee.projects[row.PRJ_ID] = {
            projectId: row.PRJ_ID,
            projectName: row.PRJ_NAME,
            billRate: parseFloat(row.BILL_RATE) || 0,
            otBillRate: parseFloat(row.OT_BILL_RATE) || 0,
            dailyLogs: [],
            totalRegularHours: 0,
            totalOTHours: 0,
            subTotal: 0,
            hasWorked: false
          };
        }
      };

      timesheetRows.forEach(ts => {
        const accountId = initAccount(ts);
        if (!accountId) return;

        initEmployee(accountId, ts);
        initProject(accountId, ts.employee_id, ts);
        
        const project = invoiceMap[accountId].employees[ts.employee_id].projects[ts.PRJ_ID];

        days.forEach((day, idx) => {
          const hours = parseFloat(ts[`${day}_hours`]) || 0;
          const dateStr = getDateForDay(ts.week_start_date, idx);

          if (hours > 0 && isDateInRange(dateStr, actualStart, actualEnd)) {
            project.hasWorked = true;
            const { regularHours, otHours, amount } = calculateDailyRevenue(
              hours, otThreshold, project.billRate, project.otBillRate
            );

            project.dailyLogs.push({ date: dateStr, regularHours, otHours, amount });

            project.totalRegularHours += regularHours;
            project.totalOTHours += otHours;
            project.subTotal += amount;
            invoiceMap[accountId].employees[ts.employee_id].totalAmount += amount;
            invoiceMap[accountId].totalAmount += amount;
          }
        });
      });

      assignmentRows.forEach(assign => {
        const accountId = initAccount(assign);
        if (!accountId) return;
        initEmployee(accountId, assign);
        initProject(accountId, assign.EMP_ID, assign);
      });

    } else {
      // PAYABLE LOGIC (Same as before)
      const timesheetParams = [searchStartStr, searchEndStr, orgid, ...selectedEmployees, ...selectedProjects, ...selectedAccounts];
      
      const [timesheetRows] = await pool.execute(
        `SELECT t.*, 
                e.EMP_FST_NAME, e.EMP_LAST_NAME, e.employment_type, e.vendor_id,
                p.PRJ_ID, p.PRJ_NAME, p.ACCNT_ID, a.ALIAS_NAME as account_name,
                pe.BILL_RATE, pe.OT_BILL_RATE,
                v.ALIAS_NAME as vendor_name, v.ourorg as vendor_ourorg,
                v.BUSINESS_ADDR_LINE1 as vendor_addr,
                v.BUSINESS_CITY as vendor_city,
                v.BUSINESS_POSTAL_CODE as vendor_zip
         FROM C_TIMESHEETS t
         JOIN C_EMP e ON t.employee_id = e.empid
         JOIN C_PROJECT p ON t.project_id = p.PRJ_ID
         JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
         JOIN C_PROJ_EMP pe ON pe.EMP_ID = e.empid AND pe.PRJ_ID = p.PRJ_ID
         LEFT JOIN C_ACCOUNT v ON e.vendor_id = v.ACCNT_ID
         WHERE t.week_start_date >= ? AND t.week_start_date <= ?
         AND t.is_approved = 1
         AND e.orgid = ?
         AND e.employment_type IN ('12', '13')
         AND e.vendor_id IS NOT NULL${employeeFilter}${projectFilter}${accountFilter}
         ORDER BY v.ALIAS_NAME, e.EMP_FST_NAME, p.PRJ_NAME`,
        timesheetParams
      );

      const assignParams = [actualEnd, actualStart, orgid, ...selectedEmployees, ...selectedProjects, ...selectedAccounts];
      
      const [assignmentRows] = await pool.execute(
        `SELECT pe.EMP_ID, pe.PRJ_ID, pe.BILL_RATE, pe.OT_BILL_RATE,
                e.EMP_FST_NAME, e.EMP_LAST_NAME, e.employment_type, e.vendor_id,
                p.PRJ_NAME, p.ACCNT_ID, a.ALIAS_NAME as account_name,
                v.ALIAS_NAME as vendor_name, v.ourorg as vendor_ourorg,
                v.BUSINESS_ADDR_LINE1 as vendor_addr,
                v.BUSINESS_CITY as vendor_city,
                v.BUSINESS_POSTAL_CODE as vendor_zip
         FROM C_PROJ_EMP pe
         JOIN C_EMP e ON pe.EMP_ID = e.empid
         JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID
         JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
         LEFT JOIN C_ACCOUNT v ON e.vendor_id = v.ACCNT_ID
         WHERE pe.START_DT <= ? AND (pe.END_DT >= ? OR pe.END_DT IS NULL)
         AND e.orgid = ?
         AND e.employment_type IN ('12', '13')
         AND e.vendor_id IS NOT NULL${employeeFilter.replace('t.employee_id', 'pe.EMP_ID')}${projectFilter}${accountFilter.replace('e.vendor_id', 'v.ACCNT_ID')}`,
        assignParams
      );

      const initVendor = (row) => {
        if (row.vendor_ourorg === 1) return null;
        const vendorId = row.vendor_id;
        if (!invoiceMap[vendorId]) {
          invoiceMap[vendorId] = {
            vendorId: vendorId,
            vendorName: row.vendor_name,
            address: {
              line1: row.vendor_addr,
              city: row.vendor_city,
              zip: row.vendor_zip
            },
            employees: {},
            totalAmount: 0,
            dateRange: { start: actualStart, end: actualEnd }
          };
        }
        return vendorId;
      };

      const initEmployee = (vendorId, row) => {
        const empId = row.employee_id || row.EMP_ID;
        if (!invoiceMap[vendorId].employees[empId]) {
          invoiceMap[vendorId].employees[empId] = {
            empId,
            empName: `${row.EMP_FST_NAME} ${row.EMP_LAST_NAME || ""}`.trim(),
            employmentType: row.employment_type,
            projects: {},
            totalAmount: 0
          };
        }
      };

      const initProject = (vendorId, empId, row) => {
        const employee = invoiceMap[vendorId].employees[empId];
        if (!employee.projects[row.PRJ_ID]) {
          employee.projects[row.PRJ_ID] = {
            projectId: row.PRJ_ID,
            projectName: row.PRJ_NAME,
            accountName: row.account_name,
            billRate: parseFloat(row.BILL_RATE) || 0,
            otBillRate: parseFloat(row.OT_BILL_RATE) || 0,
            dailyLogs: [],
            totalRegularHours: 0,
            totalOTHours: 0,
            subTotal: 0,
            hasWorked: false
          };
        }
      };

      timesheetRows.forEach(ts => {
        const vendorId = initVendor(ts);
        if (!vendorId) return;

        initEmployee(vendorId, ts);
        initProject(vendorId, ts.employee_id, ts);
        
        const project = invoiceMap[vendorId].employees[ts.employee_id].projects[ts.PRJ_ID];

        days.forEach((day, idx) => {
          const hours = parseFloat(ts[`${day}_hours`]) || 0;
          const dateStr = getDateForDay(ts.week_start_date, idx);

          if (hours > 0 && isDateInRange(dateStr, actualStart, actualEnd)) {
            project.hasWorked = true;
            const { regularHours, otHours, amount } = calculateDailyRevenue(
              hours, otThreshold, project.billRate, project.otBillRate
            );

            project.dailyLogs.push({ date: dateStr, regularHours, otHours, amount });

            project.totalRegularHours += regularHours;
            project.totalOTHours += otHours;
            project.subTotal += amount;
            invoiceMap[vendorId].employees[ts.employee_id].totalAmount += amount;
            invoiceMap[vendorId].totalAmount += amount;
          }
        });
      });

      assignmentRows.forEach(assign => {
        const vendorId = initVendor(assign);
        if (!vendorId) return;
        initEmployee(vendorId, assign);
        initProject(vendorId, assign.EMP_ID, assign);
      });
    }

    const invoices = [];

    const processMap = (map, type) => {
      Object.values(map).forEach(entity => {
        const employeesList = Object.values(entity.employees).map(emp => {
          Object.values(emp.projects).forEach(proj => {
            proj.dailyLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
          });
          return {
            ...emp,
            projects: Object.values(emp.projects).sort((a, b) => a.projectName.localeCompare(b.projectName))
          };
        }).sort((a, b) => a.empName.localeCompare(b.empName));

        const baseObj = {
          ...entity,
          dateRange: entity.dateRange,
          address: entity.address,
          orgDetails: {
            orgid: orgid, // <--- ADDED orgid for logo path
            name: orgDetails.suborgname || "My Organization",
            address1: orgDetails.addresslane1,
            city: orgDetails.city,
            state: orgDetails.state,
            zip: orgDetails.postalcode,
            country: orgDetails.country
          }
        };

        if (groupingMode === "projects") {
          employeesList.forEach(emp => {
            emp.projects.forEach(proj => {
              invoices.push({
                ...baseObj,
                employees: [{ ...emp, projects: [proj], totalAmount: proj.subTotal }],
                totalAmount: proj.subTotal,
                isSeparate: true,
                isProjectSeparate: true,
              });
            });
          });
        } else if (groupingMode === "separate") {
          employeesList.forEach(emp => {
            invoices.push({
              ...baseObj,
              employees: [emp],
              totalAmount: emp.totalAmount,
              isSeparate: true,
              isProjectSeparate: false,
            });
          });
        } else {
          invoices.push({
            ...baseObj,
            employees: employeesList,
            totalAmount: entity.totalAmount,
            isSeparate: false,
            isProjectSeparate: false,
          });
        }
      });
    };

    processMap(invoiceMap, invoiceType);
    return { invoices };

  } catch (error) {
    console.error("Invoice generation error:", error);
    return { error: error.message };
  }
}

// 🔹 NEW SERVER ACTION: Generate Excel with Logo using fs
export async function generateInvoiceExcel(invoice) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Invoice');
    
    const titleFont = { name: 'Arial', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
    const boldFont = { bold: true };
    const currencyFmt = '"$"#,##0.00';
    const formatMMDDYYYY = (isoDate) => {
      if (!isoDate) return "";
      const [y, m, d] = isoDate.split("-");
      return `${m}/${d}/${y}`;
    };

    // --- LOGO INSERTION START ---
    // Read the logo from the server file system
    if (invoice.orgDetails && invoice.orgDetails.orgid) {
      const logoPath = path.join(process.cwd(), 'public', 'uploads', 'orglogos', `${invoice.orgDetails.orgid}.jpg`);
      
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoId = workbook.addImage({
          buffer: logoBuffer,
          extension: 'jpeg',
        });
        
        sheet.addImage(logoId, {
          tl: { col: 0, row: 0 },
          ext: { width: 100, height: 50 }
        });
      }
    }
    // --- LOGO INSERTION END ---

    // Title
    sheet.mergeCells('A1:E2');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'INVOICE';
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.font = titleFont;
    titleCell.fill = headerFill;

    // From/To
    sheet.getCell('A4').value = 'FROM:';
    sheet.getCell('A4').font = boldFont;
    sheet.getCell('A5').value = invoice.orgDetails.name;
    sheet.getCell('A6').value = invoice.orgDetails.address1;
    sheet.getCell('A7').value = `${invoice.orgDetails.city}, ${invoice.orgDetails.state} ${invoice.orgDetails.zip}`;

    sheet.getCell('D4').value = invoice.vendorName ? 'PAY TO (VENDOR):' : 'BILL TO (ACCOUNT):';
    sheet.getCell('D4').font = boldFont;
    sheet.getCell('D5').value = invoice.vendorName || invoice.accountName;
    if (invoice.address) {
      sheet.getCell('D6').value = invoice.address.line1;
      sheet.getCell('D7').value = `${invoice.address.city || ''} ${invoice.address.zip || ''}`;
    }

    sheet.getCell('A9').value = 'Generated Date:';
    sheet.getCell('B9').value = formatMMDDYYYY(new Date().toISOString().split('T')[0]);
    sheet.getCell('A10').value = 'Period:';
    sheet.getCell('B10').value = `${formatMMDDYYYY(invoice.dateRange.start)} to ${formatMMDDYYYY(invoice.dateRange.end)}`;

    let currentRow = 13;

    const employees = invoice.employees || [];
    employees.forEach(emp => {
      sheet.mergeCells(`A${currentRow}:E${currentRow}`);
      const empHeader = sheet.getCell(`A${currentRow}`);
      empHeader.value = `Employee: ${emp.empName}`;
      empHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
      empHeader.font = { bold: true, size: 12 };
      currentRow += 2;

      const projects = emp.projects || [];
      projects.forEach(proj => {
        sheet.getCell(`A${currentRow}`).value = `Project: ${proj.projectName}`;
        sheet.getCell(`A${currentRow}`).font = { bold: true, color: { argb: 'FF10B981' } };
        currentRow++;

        sheet.getCell(`A${currentRow}`).value = `Rate: ${proj.billRate}/hr | OT: ${proj.otBillRate}/hr`;
        sheet.getCell(`A${currentRow}`).font = { size: 10, color: { argb: 'FF666666' } };
        currentRow++;

        if (!proj.hasWorked) {
          sheet.getCell(`A${currentRow}`).value = "Assigned - Not Worked (0 Hours)";
          sheet.getCell(`A${currentRow}`).font = { italic: true, color: { argb: 'FF888888' } };
          currentRow += 2;
        } else {
          sheet.getCell(`A${currentRow}`).value = "Date";
          sheet.getCell(`B${currentRow}`).value = "Reg Hrs Worked";
          sheet.getCell(`C${currentRow}`).value = "OT Hrs";
          sheet.getCell(`D${currentRow}`).value = "Amount";
          ['A','B','C','D'].forEach(c => sheet.getCell(`${c}${currentRow}`).font = { bold: true, underline: true });
          currentRow++;

          proj.dailyLogs.forEach(log => {
             sheet.getCell(`A${currentRow}`).value = formatMMDDYYYY(log.date);
             sheet.getCell(`B${currentRow}`).value = log.regularHours;
             sheet.getCell(`C${currentRow}`).value = log.otHours;
             sheet.getCell(`D${currentRow}`).value = log.amount;
             sheet.getCell(`D${currentRow}`).numFmt = currencyFmt;
             currentRow++;
          });

          sheet.getCell(`C${currentRow}`).value = "Project Subtotal:";
          sheet.getCell(`C${currentRow}`).font = boldFont;
          sheet.getCell(`D${currentRow}`).value = proj.subTotal;
          sheet.getCell(`D${currentRow}`).numFmt = currencyFmt;
          sheet.getCell(`D${currentRow}`).font = boldFont;
          currentRow += 2;
        }
      });

      if (employees.length > 1) {
        sheet.getCell(`C${currentRow}`).value = "EMPLOYEE TOTAL:";
        sheet.getCell(`C${currentRow}`).font = { bold: true, size: 11 };
        sheet.getCell(`D${currentRow}`).value = emp.totalAmount;
        sheet.getCell(`D${currentRow}`).numFmt = currencyFmt;
        sheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBDEFB' } };
        sheet.getCell(`D${currentRow}`).font = { bold: true };
        currentRow += 3;
      } else {
        currentRow += 1;
      }
    });

    sheet.mergeCells(`C${currentRow}:D${currentRow + 1}`);
    const grandTotalLabel = sheet.getCell(`B${currentRow}`);
    grandTotalLabel.value = "TOTAL DUE:";
    grandTotalLabel.font = { size: 14, bold: true };
    const grandTotalVal = sheet.getCell(`D${currentRow}`);
    grandTotalVal.value = invoice.totalAmount;
    grandTotalVal.numFmt = currencyFmt;
    grandTotalVal.font = { size: 16, bold: true, color: { argb: 'FF10B981' } };

    sheet.getColumn('A').width = 25;
    sheet.getColumn('B').width = 15;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 20;

    const buffer = await workbook.xlsx.writeBuffer();
    return { success: true, buffer: Buffer.from(buffer).toString('base64') };

  } catch (error) {
    console.error("Excel generation error:", error);
    return { error: error.message };
  }
}

// Send invoice emails with attachments
export async function sendInvoiceEmails(invoiceData, resendFromSentId = null) {
  const cookieStore = await cookies();
  const token = cookieStore.get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.empid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;
    const empid = decoded.empid;

    // Get organization details for email signature
    const [orgRows] = await pool.execute(
      `SELECT suborgname, addresslane1, state, postalcode, country 
       FROM C_SUB_ORG WHERE orgid = ? AND isstatus = 1 LIMIT 1`,
      [orgid]
    );
    const orgDetails = orgRows[0] || {};

    const transporter = nodemailer.createTransport({
      host: process.env.GMAIL_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
      },
    });

    const results = { sent: [], failed: [], skipped: [] };

    for (const invoice of invoiceData) {
      const email = invoice.email;
      const accountName = invoice.accountName;
      const accountId = invoice.accountId || null;

      if (!email) {
        results.skipped.push({ accountName, reason: 'No email address found' });
        continue;
      }

      try {
        // If buffer is missing, generate it on the server using generateInvoiceExcel
        let attachmentBuffer;
        let isZip = invoice.isZip;

        if (!invoice.buffer && !isZip) {
          // It's a single invoice object, generate Excel here
          // We assume 'invoice.invoiceObj' contains the full invoice data needed
          if (invoice.invoiceObj) {
             const result = await generateInvoiceExcel(invoice.invoiceObj);
             if (result.success) {
               attachmentBuffer = Buffer.from(result.buffer, 'base64');
             } else {
               throw new Error("Failed to generate invoice Excel");
             }
          }
        } else {
          attachmentBuffer = Buffer.from(invoice.buffer, 'base64');
        }

        const attachments = [{
          filename: invoice.filename,
          content: attachmentBuffer,
          contentType: isZip ? 'application/zip' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }];

        const emailSubject = `Invoice from ${orgDetails.suborgname || 'Our Company'} - ${invoice.period}`;
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: email,
          subject: emailSubject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Invoice</h2>
              <p>Dear ${accountName},</p>
              <p>Please find attached your invoice for the period <strong>${invoice.period}</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Account:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${accountName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Period:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${invoice.period}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Total Amount:</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #10B981;">$${invoice.totalAmount.toFixed(2)}</td>
                </tr>
              </table>
              <p>If you have any questions regarding this invoice, please don't hesitate to contact us.</p>
              <p style="margin-top: 30px;">Best regards,<br/>${orgDetails.suborgname || 'Our Company'}</p>
            </div>
          `,
          attachments
        };

        await transporter.sendMail(mailOptions);
        
        // Generate unique invoice ID
        const invoiceId = `${accountId || accountName.replace(/\s+/g, '_')}_${invoice.period.replace(/\s+/g, '_')}`;
        const status = resendFromSentId ? 'RESENT' : 'SENT';
        
        // Store email send record in C_INVOICES_SENT
        const [sendResult] = await pool.execute(
          `INSERT INTO C_INVOICES_SENT 
           (INVOICE_ID, SENT_BY, INVOICE_PERIOD, ACCOUNT_NAME, ACCOUNT_ID, TOTAL_AMOUNT, PDF_PATH, EMAIL_SUBJECT, STATUS, RESENT_FROM, ORG_ID)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            empid,
            invoice.period,
            accountName,
            accountId,
            invoice.totalAmount,
            invoice.filename,
            emailSubject,
            status,
            resendFromSentId || null,
            orgid
          ]
        );
        
        const sentId = sendResult.insertId;
        
        // Store recipient in C_INVOICES_SENT_DETAIL
        await pool.execute(
          `INSERT INTO C_INVOICES_SENT_DETAIL (SENT_ID, RECIPIENT_EMAIL, RECIPIENT_NAME, DELIVERY_STATUS)
           VALUES (?, ?, ?, ?)`,
          [sentId, email, accountName, 'SENT']
        );
        
        results.sent.push({ accountName, email, sentId, invoiceId });

      } catch (emailErr) {
        console.error(`Failed to send email to ${email}:`, emailErr.message);
        results.failed.push({ accountName, email, error: emailErr.message });
      }
    }

    return { success: true, results };

  } catch (error) {
    console.error("Send invoice emails error:", error);
    return { error: error.message };
  }
}

// Fetch saved/sent invoices with filters
export async function fetchSentInvoices({ startDate = null, endDate = null, recipientEmail = null, status = 'all' }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;

    let query = `
      SELECT 
        s.SENT_ID,
        s.INVOICE_ID,
        s.SENT_BY,
        s.SENT_DATE,
        s.INVOICE_PERIOD,
        s.ACCOUNT_NAME,
        s.ACCOUNT_ID,
        s.TOTAL_AMOUNT,
        s.PDF_PATH,
        s.EMAIL_SUBJECT,
        s.STATUS,
        s.RESENT_FROM,
        GROUP_CONCAT(d.RECIPIENT_EMAIL SEPARATOR ',') as recipients,
        MAX(d.DELIVERY_STATUS) as delivery_status
      FROM C_INVOICES_SENT s
      LEFT JOIN C_INVOICES_SENT_DETAIL d ON s.SENT_ID = d.SENT_ID
      WHERE s.ORG_ID = ?
    `;
    
    const params = [orgid];

    // Add date range filter
    if (startDate && endDate) {
      query += ` AND DATE(s.SENT_DATE) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    // Add recipient email filter
    if (recipientEmail) {
      query += ` AND d.RECIPIENT_EMAIL = ?`;
      params.push(recipientEmail);
    }

    // Add status filter
    if (status && status !== 'all') {
      query += ` AND s.STATUS = ?`;
      params.push(status);
    }

    query += ` GROUP BY s.SENT_ID ORDER BY s.SENT_DATE DESC`;

    const [rows] = await pool.execute(query, params);

    // For each resent invoice, fetch original sent record info
    for (const row of rows) {
      if (row.RESENT_FROM) {
        const [originalRows] = await pool.execute(
          `SELECT SENT_DATE, ACCOUNT_NAME FROM C_INVOICES_SENT WHERE SENT_ID = ?`,
          [row.RESENT_FROM]
        );
        if (originalRows.length > 0) {
          row.originalSentDate = originalRows[0].SENT_DATE;
        }
      }
    }

    return { success: true, invoices: rows };
  } catch (error) {
    console.error("Error fetching sent invoices:", error);
    return { error: error.message };
  }
}

// Resend invoice email
export async function resendInvoiceEmail(sentId, newRecipients = null) {
  const cookieStore = await cookies();
  const token = cookieStore.get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.empid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;
    const empid = decoded.empid;

    // Fetch original invoice send record
    const [originals] = await pool.execute(
      `SELECT * FROM C_INVOICES_SENT WHERE SENT_ID = ? AND ORG_ID = ?`,
      [sentId, orgid]
    );

    if (originals.length === 0) {
      return { error: "Invoice record not found" };
    }

    const original = originals[0];

    // Fetch PDF file
    const filePath = `./public/invoices/${original.PDF_PATH}`;
    let attachmentBuffer;
    try {
      const fileContent = fs.readFileSync(filePath);
      attachmentBuffer = fileContent;
    } catch (fileErr) {
      console.warn(`Could not read file ${filePath}, proceeding without attachment`);
      attachmentBuffer = null;
    }

    // Get organization details
    const [orgRows] = await pool.execute(
      `SELECT suborgname FROM C_SUB_ORG WHERE orgid = ? LIMIT 1`,
      [orgid]
    );
    const orgName = orgRows[0]?.suborgname || 'Our Company';

    // Setup email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.GMAIL_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
      },
    });

    // Determine recipients
    let recipientList = newRecipients || [];
    if (!newRecipients || newRecipients.length === 0) {
      // Get recipients from original send
      const [detailRows] = await pool.execute(
        `SELECT RECIPIENT_EMAIL, RECIPIENT_NAME FROM C_INVOICES_SENT_DETAIL WHERE SENT_ID = ?`,
        [sentId]
      );
      recipientList = detailRows.map(d => ({ email: d.RECIPIENT_EMAIL, name: d.RECIPIENT_NAME }));
    }

    const attachments = [];
    if (attachmentBuffer) {
      attachments.push({
        filename: original.PDF_PATH,
        content: attachmentBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    }

    // Send email
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: recipientList.map(r => r.email).join(','),
      subject: original.EMAIL_SUBJECT,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Invoice (Resent)</h2>
          <p style="color: #f97316; font-weight: bold;">This is a resend of the invoice previously sent on ${new Date(original.SENT_DATE).toLocaleDateString()}</p>
          <p>Dear Customer,</p>
          <p>Please find attached the invoice for the period <strong>${original.INVOICE_PERIOD}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Account:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${original.ACCOUNT_NAME}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Period:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${original.INVOICE_PERIOD}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Total Amount:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #10B981;">$${original.TOTAL_AMOUNT.toFixed(2)}</td>
            </tr>
          </table>
          <p>If you have any questions, please contact us.</p>
          <p style="margin-top: 30px;">Best regards,<br/>${orgName}</p>
        </div>
      `,
      attachments
    };

    await transporter.sendMail(mailOptions);

    // Create new C_INVOICES_SENT record for resend
    const [newSendResult] = await pool.execute(
      `INSERT INTO C_INVOICES_SENT 
       (INVOICE_ID, SENT_BY, INVOICE_PERIOD, ACCOUNT_NAME, ACCOUNT_ID, TOTAL_AMOUNT, PDF_PATH, EMAIL_SUBJECT, STATUS, RESENT_FROM, ORG_ID)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        original.INVOICE_ID,
        empid,
        original.INVOICE_PERIOD,
        original.ACCOUNT_NAME,
        original.ACCOUNT_ID,
        original.TOTAL_AMOUNT,
        original.PDF_PATH,
        original.EMAIL_SUBJECT,
        'RESENT',
        sentId,
        orgid
      ]
    );

    const newSentId = newSendResult.insertId;

    // Add recipients to C_INVOICES_SENT_DETAIL
    for (const recipient of recipientList) {
      await pool.execute(
        `INSERT INTO C_INVOICES_SENT_DETAIL (SENT_ID, RECIPIENT_EMAIL, RECIPIENT_NAME, DELIVERY_STATUS)
         VALUES (?, ?, ?, ?)`,
        [newSentId, recipient.email, recipient.name, 'SENT']
      );
    }

    return { 
      success: true, 
      message: 'Invoice resent successfully', 
      newSentId,
      originalSentDate: original.SENT_DATE
    };

  } catch (error) {
    console.error("Error resending invoice:", error);
    return { error: error.message };
  }
}
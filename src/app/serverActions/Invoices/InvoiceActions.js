"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

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

    console.log('=== INVOICE GENERATION ===');
    console.log('Invoice Type:', invoiceType);
    console.log('Actual Range:', actualStart, 'to', actualEnd);
    console.log('Search Range:', searchStartStr, 'to', searchEndStr);

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
      // RECEIVABLE: Group by Account, only external accounts and clients
      const timesheetParams = [searchStartStr, searchEndStr, orgid, ...selectedEmployees, ...selectedProjects, ...selectedAccounts];
      
      const [timesheetRows] = await pool.execute(
        `SELECT t.*, 
                e.EMP_FST_NAME, e.EMP_LAST_NAME,
                p.PRJ_ID, p.PRJ_NAME, p.BILL_RATE, p.OT_BILL_RATE,
                p.ACCNT_ID, a.ALIAS_NAME as account_name, a.ourorg as account_ourorg,
                a.BUSINESS_ADDR_LINE1 as account_addr,
                a.BUSINESS_CITY as account_city,
                a.BUSINESS_POSTAL_CODE as account_zip,
                p.CLIENT_ID, ac_client.ALIAS_NAME as client_name, ac_client.ourorg as client_ourorg
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
                a.BUSINESS_ADDR_LINE1 as account_addr,
                a.BUSINESS_CITY as account_city,
                a.BUSINESS_POSTAL_CODE as account_zip,
                p.CLIENT_ID, ac_client.ourorg as client_ourorg
         FROM C_PROJ_EMP pe
         JOIN C_EMP e ON pe.EMP_ID = e.empid
         JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID
         JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
         LEFT JOIN C_ACCOUNT ac_client ON p.CLIENT_ID = ac_client.ACCNT_ID
         WHERE pe.START_DT <= ? AND (pe.END_DT >= ? OR pe.END_DT IS NULL)
         AND e.orgid = ?${employeeFilter.replace('t.employee_id', 'pe.EMP_ID')}${projectFilter}${accountFilter}`,
        assignParams
      );

      console.log('Receivable - Total timesheets:', timesheetRows.length);
      console.log('Receivable - Total assignments:', assignmentRows.length);

      // Build receivable structure
      const initAccount = (row) => {
        // Skip if account or client is internal (ourorg = 1)
        if (row.account_ourorg === 1 || row.client_ourorg === 1) {
          return null;
        }

        const accountId = row.ACCNT_ID;
        if (!invoiceMap[accountId]) {
          invoiceMap[accountId] = {
            accountId: accountId,
            accountName: row.account_name,
            address: {
              line1: row.account_addr,
              city: row.account_city,
              zip: row.account_zip
            },
            employees: {},
            totalAmount: 0,
            dateRange: { start: actualStart, end: actualEnd }
          };
        }
        return accountId;
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

      // Process timesheets
      let includedCount = 0;
      let skippedCount = 0;

      timesheetRows.forEach(ts => {
        const accountId = initAccount(ts);
        if (!accountId) {
          skippedCount++;
          return; // Skip internal work
        }

        includedCount++;
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

            project.dailyLogs.push({
              date: dateStr,
              regularHours,
              otHours,
              amount
            });

            project.totalRegularHours += regularHours;
            project.totalOTHours += otHours;
            project.subTotal += amount;
            invoiceMap[accountId].employees[ts.employee_id].totalAmount += amount;
            invoiceMap[accountId].totalAmount += amount;
          }
        });
      });

      console.log('Receivable filtering:', { includedCount, skippedCount, totalAccounts: Object.keys(invoiceMap).length });

      // Process assignments
      assignmentRows.forEach(assign => {
        const accountId = initAccount(assign);
        if (!accountId) return;

        initEmployee(accountId, assign);
        initProject(accountId, assign.EMP_ID, assign);
      });

    } else {
      // PAYABLE: Group by Vendor, only contractors/1099 with external vendors
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

      console.log('Payable - Total timesheets:', timesheetRows.length);
      console.log('Payable - Total assignments:', assignmentRows.length);

      // Build payable structure: Group by Vendor
      const initVendor = (row) => {
        // Skip if vendor is internal (ourorg = 1)
        if (row.vendor_ourorg === 1) {
          return null;
        }

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

      // Process timesheets
      let includedCount = 0;
      let skippedCount = 0;

      timesheetRows.forEach(ts => {
        const vendorId = initVendor(ts);
        if (!vendorId) {
          skippedCount++;
          return; // Skip internal vendors
        }

        includedCount++;
        initEmployee(vendorId, ts);
        initProject(vendorId, ts.employee_id, ts);
        
        const project = invoiceMap[vendorId].employees[ts.employee_id].projects[ts.PRJ_ID];

        days.forEach((day, idx) => {
          const hours = parseFloat(ts[`${day}_hours`]) || 0;
          const dateStr = getDateForDay(ts.week_start_date, idx);

          if (hours > 0 && isDateInRange(dateStr, actualStart, actualEnd)) {
            project.hasWorked = true;
            
            // Use EMPLOYEE-specific rates from C_PROJ_EMP
            const { regularHours, otHours, amount } = calculateDailyRevenue(
              hours, otThreshold, project.billRate, project.otBillRate
            );

            project.dailyLogs.push({
              date: dateStr,
              regularHours,
              otHours,
              amount
            });

            project.totalRegularHours += regularHours;
            project.totalOTHours += otHours;
            project.subTotal += amount;
            invoiceMap[vendorId].employees[ts.employee_id].totalAmount += amount;
            invoiceMap[vendorId].totalAmount += amount;
          }
        });
      });

      console.log('Payable filtering:', { includedCount, skippedCount, totalVendors: Object.keys(invoiceMap).length });

      // Process assignments
      assignmentRows.forEach(assign => {
        const vendorId = initVendor(assign);
        if (!vendorId) return;

        initEmployee(vendorId, assign);
        initProject(vendorId, assign.EMP_ID, assign);
      });
    }

    // Format invoices
    const invoices = [];

    if (invoiceType === "receivable") {
      Object.values(invoiceMap).forEach(account => {
        const employeesList = Object.values(account.employees).map(emp => {
          Object.values(emp.projects).forEach(proj => {
            proj.dailyLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
          });
          
          return {
            ...emp,
            projects: Object.values(emp.projects).sort((a, b) => a.projectName.localeCompare(b.projectName))
          };
        }).sort((a, b) => a.empName.localeCompare(b.empName));

        if (groupingMode === "separate") {
          // Create separate invoice for each employee
          employeesList.forEach(emp => {
            invoices.push({
              accountId: account.accountId,
              accountName: account.accountName,
              employees: [emp],
              totalAmount: emp.totalAmount,
              dateRange: account.dateRange,
              address: account.address,
              isSeparate: true,
              orgDetails: {
                name: orgDetails.suborgname || "My Organization",
                address1: orgDetails.addresslane1,
                city: orgDetails.city,
                state: orgDetails.state,
                zip: orgDetails.postalcode,
                country: orgDetails.country
              }
            });
          });
        } else {
          // Combined invoice with all employees
          invoices.push({
            accountId: account.accountId,
            accountName: account.accountName,
            employees: employeesList,
            totalAmount: account.totalAmount,
            dateRange: account.dateRange,
            address: account.address,
            isSeparate: false,
            orgDetails: {
              name: orgDetails.suborgname || "My Organization",
              address1: orgDetails.addresslane1,
              city: orgDetails.city,
              state: orgDetails.state,
              zip: orgDetails.postalcode,
              country: orgDetails.country
            }
          });
        }
      });
    } else {
      Object.values(invoiceMap).forEach(vendor => {
        const employeesList = Object.values(vendor.employees).map(emp => {
          Object.values(emp.projects).forEach(proj => {
            proj.dailyLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
          });
          
          return {
            ...emp,
            projects: Object.values(emp.projects).sort((a, b) => a.projectName.localeCompare(b.projectName))
          };
        }).sort((a, b) => a.empName.localeCompare(b.empName));

        if (groupingMode === "separate") {
          // Create separate invoice for each employee
          employeesList.forEach(emp => {
            invoices.push({
              vendorId: vendor.vendorId,
              vendorName: vendor.vendorName,
              employees: [emp],
              totalAmount: emp.totalAmount,
              dateRange: vendor.dateRange,
              address: vendor.address,
              isSeparate: true,
              orgDetails: {
                name: orgDetails.suborgname || "My Organization",
                address1: orgDetails.addresslane1,
                city: orgDetails.city,
                state: orgDetails.state,
                zip: orgDetails.postalcode,
                country: orgDetails.country
              }
            });
          });
        } else {
          // Combined invoice with all employees
          invoices.push({
            vendorId: vendor.vendorId,
            vendorName: vendor.vendorName,
            employees: employeesList,
            totalAmount: vendor.totalAmount,
            dateRange: vendor.dateRange,
            address: vendor.address,
            isSeparate: false,
            orgDetails: {
              name: orgDetails.suborgname || "My Organization",
              address1: orgDetails.addresslane1,
              city: orgDetails.city,
              state: orgDetails.state,
              zip: orgDetails.postalcode,
              country: orgDetails.country
            }
          });
        }
      });
    }

    console.log('Generated invoices:', invoices.length);
    return { invoices };

  } catch (error) {
    console.error("Invoice generation error:", error);
    return { error: error.message };
  }
}
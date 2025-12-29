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

    return { employees: employees.map(emp => ({
      id: emp.empid,
      name: `${emp.EMP_FST_NAME || ""} ${emp.EMP_LAST_NAME || ""}`.trim() || `Employee ${emp.empid}`
    }))};
  } catch (error) {
    console.error("Error fetching employees:", error);
    return { error: error.message };
  }
}

// Fetch employees for payable filter (all employees who work on eligible projects)
export async function fetchContractEmployeesForInvoice() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;

    const NET90_PAY_TERM_ID = 13;
    const CONTRACT_TYPE_ID = 12;

    // Get all employees who either:
    // 1. Work on Net90 projects (any employment type)
    // 2. Are contract employees (on any project)
    const [employees] = await pool.execute(
      `SELECT DISTINCT e.empid, e.EMP_FST_NAME, e.EMP_LAST_NAME
       FROM C_EMP e
       JOIN C_PROJ_EMP pe ON e.empid = pe.EMP_ID
       JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID
       WHERE e.orgid = ?
       AND (p.PAY_TERM = ? OR e.employment_type = ?)
       ORDER BY e.EMP_FST_NAME, e.EMP_LAST_NAME`,
      [orgid, NET90_PAY_TERM_ID, CONTRACT_TYPE_ID]
    );

    return { employees: employees.map(emp => ({
      id: emp.empid,
      name: `${emp.EMP_FST_NAME || ""} ${emp.EMP_LAST_NAME || ""}`.trim() || `Employee ${emp.empid}`
    }))};
  } catch (error) {
    console.error("Error fetching payable employees:", error);
    return { error: error.message };
  }
}

// Fetch accounts that have payable projects (Net90 or has contract employees)
export async function fetchAccountsForPayable() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;

    // Find the actual Net90 pay term ID
    const [net90Rows] = await pool.execute(
      `SELECT id FROM C_GENERIC_VALUES 
       WHERE g_id = 27 AND (Name LIKE '%Net%90%' OR Name LIKE '%net%90%' OR Name = 'Net 90' OR id = 13)
       AND isactive = 1 AND (orgid = ? OR orgid = -1)
       ORDER BY orgid DESC LIMIT 1`,
      [orgid]
    );

    // Find the actual Contract employment type ID
    const [contractRows] = await pool.execute(
      `SELECT id FROM C_GENERIC_VALUES 
       WHERE g_id = 27 AND (Name = 'Contract' OR id = 12)
       AND isactive = 1 AND (orgid = ? OR orgid = -1)
       ORDER BY orgid DESC LIMIT 1`,
      [orgid]
    );

    const NET90_PAY_TERM_ID = net90Rows.length > 0 ? net90Rows[0].id : 13;
    const CONTRACT_TYPE_ID = contractRows.length > 0 ? contractRows[0].id : 12;

    console.log('DEBUG - Net90 ID:', NET90_PAY_TERM_ID, 'Contract ID:', CONTRACT_TYPE_ID);

    const [accounts] = await pool.execute(
      `SELECT DISTINCT a.ACCNT_ID, a.ALIAS_NAME
       FROM C_ACCOUNT a
       JOIN C_PROJECT p ON a.ACCNT_ID = p.ACCNT_ID
       LEFT JOIN C_PROJ_EMP pe ON p.PRJ_ID = pe.PRJ_ID
       LEFT JOIN C_EMP e ON pe.EMP_ID = e.empid
       WHERE a.ORGID = ?
       AND (p.PAY_TERM = ? OR e.employment_type = ?)
       ORDER BY a.ALIAS_NAME`,
      [orgid, NET90_PAY_TERM_ID, CONTRACT_TYPE_ID]
    );

    console.log('DEBUG - Found accounts:', accounts.length);

    return { accounts: accounts.map(acc => ({
      id: acc.ACCNT_ID,
      name: acc.ALIAS_NAME || `Account ${acc.ACCNT_ID}`
    }))};
  } catch (error) {
    console.error("Error fetching accounts:", error);
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

    return { projects: projects.map(proj => ({
      id: proj.PRJ_ID,
      name: proj.PRJ_NAME,
      accountName: proj.account_name
    }))};
  } catch (error) {
    console.error("Error fetching projects:", error);
    return { error: error.message };
  }
}

export async function generateInvoices({ 
  reportType, searchStart, searchEnd, actualStart, actualEnd,
  selectedEmployees = [], selectedProjects = [], selectedAccounts = [], invoiceType = "receivable"
}) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;
    
    // Dynamically find the correct IDs from C_GENERIC_VALUES
    const [net90Rows] = await pool.execute(
      `SELECT id, Name FROM C_GENERIC_VALUES 
       WHERE g_id = 27 AND (Name LIKE '%Net%90%' OR Name LIKE '%net%90%' OR Name = 'Net 90' OR id = 13)
       AND isactive = 1 AND (orgid = ? OR orgid = -1)
       ORDER BY orgid DESC LIMIT 1`,
      [orgid]
    );

    const [contractRows] = await pool.execute(
      `SELECT id, Name FROM C_GENERIC_VALUES 
       WHERE g_id = 27 AND (Name = 'Contract' OR id = 12)
       AND isactive = 1 AND (orgid = ? OR orgid = -1)
       ORDER BY orgid DESC LIMIT 1`,
      [orgid]
    );

    const NET90_PAY_TERM_ID = net90Rows.length > 0 ? net90Rows[0].id : 13;
    const CONTRACT_TYPE_ID = contractRows.length > 0 ? contractRows[0].id : 12;

    console.log('=== INVOICE DEBUG ===');
    console.log('Invoice Type:', invoiceType);
    console.log('Net90 Pay Term ID:', NET90_PAY_TERM_ID, net90Rows.length > 0 ? `(${net90Rows[0].Name})` : '(default)');
    console.log('Contract Type ID:', CONTRACT_TYPE_ID, contractRows.length > 0 ? `(${contractRows[0].Name})` : '(default)');
    console.log('Date Range:', actualStart, 'to', actualEnd);
    console.log('Search Range:', searchStart, 'to', searchEnd);
    
    // Get Organization Details
    const [subOrgRows] = await pool.execute(
      `SELECT * FROM C_SUB_ORG WHERE orgid = ? LIMIT 1`,
      [orgid]
    );
    const orgDetails = subOrgRows[0] || {};
    const otThreshold = await getOTThreshold(pool, orgid);

    // Build filters
    let employeeFilter = "";
    let projectFilter = "";
    let accountFilter = "";
    
    const baseParams = [searchStart, searchEnd, orgid];
    const assignBaseParams = [actualEnd, actualStart, orgid];
    
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
      accountFilter = ` AND p.ACCNT_ID IN (${accPlaceholders})`;
    }

    const invoiceMap = {};
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const allPayTermIds = new Set();

    if (invoiceType === "receivable") {
      // RECEIVABLE: All projects, grouped by CLIENT (not account)
      const timesheetParams = [...baseParams, ...selectedEmployees, ...selectedProjects, ...selectedAccounts];
      
      const [timesheetRows] = await pool.execute(
        `SELECT t.*, 
                e.EMP_FST_NAME, e.EMP_LAST_NAME,
                p.PRJ_ID, p.PRJ_NAME, p.BILL_RATE, p.OT_BILL_RATE, p.PAY_TERM,
                p.CLIENT_ID, 
                COALESCE(ac_client.ACCNT_ID, a.ACCNT_ID) as BILLING_CLIENT_ID,
                COALESCE(ac_client.ALIAS_NAME, a.ALIAS_NAME) as client_name,
                COALESCE(ac_client.BUSINESS_ADDR_LINE1, a.BUSINESS_ADDR_LINE1) as client_addr,
                COALESCE(ac_client.BUSINESS_CITY, a.BUSINESS_CITY) as client_city,
                COALESCE(ac_client.BUSINESS_POSTAL_CODE, a.BUSINESS_POSTAL_CODE) as client_zip,
                a.ACCNT_ID, a.ALIAS_NAME as account_name
         FROM C_TIMESHEETS t
         JOIN C_EMP e ON t.employee_id = e.empid
         JOIN C_PROJECT p ON t.project_id = p.PRJ_ID
         JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
         LEFT JOIN C_ACCOUNT ac_client ON p.CLIENT_ID = ac_client.ACCNT_ID
         WHERE t.week_start_date >= ? AND t.week_start_date <= ?
         AND t.is_approved = 1
         AND e.orgid = ?${employeeFilter}${projectFilter}${accountFilter}
         ORDER BY client_name, p.PRJ_NAME, e.EMP_FST_NAME`,
        timesheetParams
      );

      const assignParams = [...assignBaseParams, ...selectedEmployees, ...selectedProjects, ...selectedAccounts];
      
      const [assignmentRows] = await pool.execute(
        `SELECT pe.EMP_ID, pe.PRJ_ID, 
                e.EMP_FST_NAME, e.EMP_LAST_NAME,
                p.PRJ_NAME, p.ACCNT_ID, p.BILL_RATE, p.OT_BILL_RATE, p.PAY_TERM,
                COALESCE(ac_client.ACCNT_ID, a.ACCNT_ID) as BILLING_CLIENT_ID,
                COALESCE(ac_client.ALIAS_NAME, a.ALIAS_NAME) as client_name,
                COALESCE(ac_client.BUSINESS_ADDR_LINE1, a.BUSINESS_ADDR_LINE1) as client_addr,
                COALESCE(ac_client.BUSINESS_CITY, a.BUSINESS_CITY) as client_city,
                COALESCE(ac_client.BUSINESS_POSTAL_CODE, a.BUSINESS_POSTAL_CODE) as client_zip,
                a.ALIAS_NAME as account_name
         FROM C_PROJ_EMP pe
         JOIN C_EMP e ON pe.EMP_ID = e.empid
         JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID
         JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
         LEFT JOIN C_ACCOUNT ac_client ON p.CLIENT_ID = ac_client.ACCNT_ID
         WHERE pe.START_DT <= ? AND (pe.END_DT >= ? OR pe.END_DT IS NULL)
         AND e.orgid = ?${employeeFilter.replace('t.employee_id', 'pe.EMP_ID')}${projectFilter}${accountFilter}`,
        assignParams
      );

      // Build receivable structure - GROUP BY CLIENT
      const initClient = (row) => {
        const clientId = row.BILLING_CLIENT_ID;
        if (!invoiceMap[clientId]) {
          invoiceMap[clientId] = {
            clientId: clientId,
            clientName: row.client_name,
            address: {
              line1: row.client_addr,
              city: row.client_city,
              zip: row.client_zip
            },
            projects: {},
            accounts: new Set(),
            totalAmount: 0,
            dateRange: { start: actualStart, end: actualEnd }
          };
        }
      };

      const initProject = (clientId, row) => {
        if (!invoiceMap[clientId].projects[row.PRJ_ID]) {
          if (row.PAY_TERM) allPayTermIds.add(row.PAY_TERM);
          
          invoiceMap[clientId].projects[row.PRJ_ID] = {
            projectId: row.PRJ_ID,
            projectName: row.PRJ_NAME,
            accountName: row.account_name,
            billRate: parseFloat(row.BILL_RATE) || 0,
            otBillRate: parseFloat(row.OT_BILL_RATE) || 0,
            payTermId: row.PAY_TERM,
            payTermName: "Net 30",
            employees: {},
            subTotal: 0
          };
          invoiceMap[clientId].accounts.add(row.account_name);
        }
      };

      timesheetRows.forEach(ts => {
        const clientId = ts.BILLING_CLIENT_ID;
        initClient(ts);
        initProject(clientId, ts);
        
        const project = invoiceMap[clientId].projects[ts.PRJ_ID];
        const empId = ts.employee_id;
        
        if (!project.employees[empId]) {
          project.employees[empId] = {
            empId, 
            empName: `${ts.EMP_FST_NAME} ${ts.EMP_LAST_NAME || ""}`.trim(),
            dailyLogs: [],
            totalRegularHours: 0,
            totalOTHours: 0,
            totalAmount: 0,
            hasWorked: false
          };
        }

        const employee = project.employees[empId];

        days.forEach((day, idx) => {
          const hours = parseFloat(ts[`${day}_hours`]) || 0;
          const dateStr = getDateForDay(ts.week_start_date, idx);

          if (hours > 0 && isDateInRange(dateStr, actualStart, actualEnd)) {
            employee.hasWorked = true;
            const { regularHours, otHours, amount } = calculateDailyRevenue(
              hours, otThreshold, project.billRate, project.otBillRate
            );

            employee.dailyLogs.push({
              date: dateStr,
              regularHours,
              otHours,
              amount
            });

            employee.totalRegularHours += regularHours;
            employee.totalOTHours += otHours;
            employee.totalAmount += amount;
            project.subTotal += amount;
            invoiceMap[clientId].totalAmount += amount;
          }
        });
      });

      assignmentRows.forEach(assign => {
        const clientId = assign.BILLING_CLIENT_ID;
        initClient(assign);
        initProject(clientId, assign);
        
        const project = invoiceMap[clientId].projects[assign.PRJ_ID];
        if (!project.employees[assign.EMP_ID]) {
          project.employees[assign.EMP_ID] = {
            empId: assign.EMP_ID, 
            empName: `${assign.EMP_FST_NAME} ${assign.EMP_LAST_NAME || ""}`.trim(),
            dailyLogs: [],
            totalRegularHours: 0,
            totalOTHours: 0,
            totalAmount: 0,
            hasWorked: false
          };
        }
      });

    } else {
      // PAYABLE: Grouped by Account -> Employee -> Projects
      // Include if: (Net90 project with ANY employee) OR (Contract employee on any project)
      
      console.log('=== PAYABLE QUERY DEBUG ===');
      console.log('Filters:', { employeeFilter, projectFilter, accountFilter });
      
      const timesheetParams = [...baseParams, ...selectedEmployees, ...selectedProjects, ...selectedAccounts];
      
      const [timesheetRows] = await pool.execute(
        `SELECT t.*, 
                e.EMP_FST_NAME, e.EMP_LAST_NAME, e.employment_type,
                p.PRJ_ID, p.PRJ_NAME, p.BILL_RATE, p.OT_BILL_RATE, p.PAY_TERM,
                p.CLIENT_ID, ac_client.ALIAS_NAME as client_name,
                a.ACCNT_ID, a.ALIAS_NAME as account_name,
                a.BUSINESS_ADDR_LINE1, a.BUSINESS_CITY, a.BUSINESS_STATE_ID, a.BUSINESS_POSTAL_CODE
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

      console.log('Total timesheets fetched:', timesheetRows.length);
      
      // Debug: Show sample of fetched data
      if (timesheetRows.length > 0) {
        const sample = timesheetRows[0];
        console.log('Sample timesheet:', {
          employee: `${sample.EMP_FST_NAME} ${sample.EMP_LAST_NAME}`,
          employment_type: sample.employment_type,
          project: sample.PRJ_NAME,
          pay_term: sample.PAY_TERM,
          isNet90: sample.PAY_TERM === NET90_PAY_TERM_ID,
          isContract: sample.employment_type === CONTRACT_TYPE_ID
        });
      }

      const assignParams = [...assignBaseParams, ...selectedEmployees, ...selectedProjects, ...selectedAccounts];
      
      const [assignmentRows] = await pool.execute(
        `SELECT pe.EMP_ID, pe.PRJ_ID, 
                e.EMP_FST_NAME, e.EMP_LAST_NAME, e.employment_type,
                p.PRJ_NAME, p.ACCNT_ID, p.BILL_RATE, p.OT_BILL_RATE, p.PAY_TERM,
                a.ALIAS_NAME as account_name,
                ac_client.ALIAS_NAME as client_name,
                a.BUSINESS_ADDR_LINE1, a.BUSINESS_CITY, a.BUSINESS_POSTAL_CODE
         FROM C_PROJ_EMP pe
         JOIN C_EMP e ON pe.EMP_ID = e.empid
         JOIN C_PROJECT p ON pe.PRJ_ID = p.PRJ_ID
         JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
         LEFT JOIN C_ACCOUNT ac_client ON p.CLIENT_ID = ac_client.ACCNT_ID
         WHERE pe.START_DT <= ? AND (pe.END_DT >= ? OR pe.END_DT IS NULL)
         AND e.orgid = ?${employeeFilter.replace('t.employee_id', 'pe.EMP_ID')}${projectFilter}${accountFilter}`,
        assignParams
      );

      console.log('Total assignments fetched:', assignmentRows.length);

      // Build payable structure: Group by Account -> Employee
      const initAccount = (row) => {
        if (!invoiceMap[row.ACCNT_ID]) {
          invoiceMap[row.ACCNT_ID] = {
            accountId: row.ACCNT_ID,
            accountName: row.account_name,
            address: {
              line1: row.BUSINESS_ADDR_LINE1,
              city: row.BUSINESS_CITY,
              zip: row.BUSINESS_POSTAL_CODE
            },
            employees: {},
            totalAmount: 0,
            dateRange: { start: actualStart, end: actualEnd }
          };
        }
      };

      const initEmployee = (accId, row) => {
        const empId = row.employee_id || row.EMP_ID;
        if (!invoiceMap[accId].employees[empId]) {
          invoiceMap[accId].employees[empId] = {
            empId,
            empName: `${row.EMP_FST_NAME} ${row.EMP_LAST_NAME || ""}`.trim(),
            employmentType: row.employment_type,
            projects: {},
            totalAmount: 0
          };
        }
      };

      const initProject = (accId, empId, row) => {
        const employee = invoiceMap[accId].employees[empId];
        if (!employee.projects[row.PRJ_ID]) {
          if (row.PAY_TERM) allPayTermIds.add(row.PAY_TERM);
          
          employee.projects[row.PRJ_ID] = {
            projectId: row.PRJ_ID,
            projectName: row.PRJ_NAME,
            clientName: row.client_name || row.account_name,
            billRate: parseFloat(row.BILL_RATE) || 0,
            otBillRate: parseFloat(row.OT_BILL_RATE) || 0,
            payTermId: row.PAY_TERM,
            payTermName: "Net 30",
            isNet90: row.PAY_TERM === NET90_PAY_TERM_ID,
            dailyLogs: [],
            totalRegularHours: 0,
            totalOTHours: 0,
            subTotal: 0,
            hasWorked: false
          };
        }
      };

      // Process timesheets - Apply payable logic
      let includedCount = 0;
      let skippedCount = 0;
      
      timesheetRows.forEach(ts => {
        // Convert to string for comparison since DB stores as string
        const isNet90Project = String(ts.PAY_TERM) === String(NET90_PAY_TERM_ID);
        const isContractEmployee = String(ts.employment_type) === String(CONTRACT_TYPE_ID);
        
        console.log('Checking timesheet:', {
          employee: `${ts.EMP_FST_NAME} ${ts.EMP_LAST_NAME}`,
          pay_term: ts.PAY_TERM,
          employment_type: ts.employment_type,
          isNet90Project,
          isContractEmployee,
          willInclude: isNet90Project || isContractEmployee
        });
        
        // Include if: Net90 project (any employee) OR Contract employee (any project)
        if (!isNet90Project && !isContractEmployee) {
          skippedCount++;
          return; // Skip - not payable
        }

        includedCount++;
        initAccount(ts);
        initEmployee(ts.ACCNT_ID, ts);
        initProject(ts.ACCNT_ID, ts.employee_id, ts);
        
        const project = invoiceMap[ts.ACCNT_ID].employees[ts.employee_id].projects[ts.PRJ_ID];

        days.forEach((day, idx) => {
          const hours = parseFloat(ts[`${day}_hours`]) || 0;
          const dateStr = getDateForDay(ts.week_start_date, idx);

          if (hours > 0 && isDateInRange(dateStr, actualStart, actualEnd)) {
            project.hasWorked = true;
            
            // Use PROJECT bill rate (not employee individual rate)
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
            invoiceMap[ts.ACCNT_ID].employees[ts.employee_id].totalAmount += amount;
            invoiceMap[ts.ACCNT_ID].totalAmount += amount;
          }
        });
      });

      console.log('Payable filtering:', { includedCount, skippedCount, totalAccounts: Object.keys(invoiceMap).length });

      // Process assignments
      assignmentRows.forEach(assign => {
        const isNet90Project = String(assign.PAY_TERM) === String(NET90_PAY_TERM_ID);
        const isContractEmployee = String(assign.employment_type) === String(CONTRACT_TYPE_ID);
        
        if (!isNet90Project && !isContractEmployee) {
          return;
        }

        initAccount(assign);
        initEmployee(assign.ACCNT_ID, assign);
        initProject(assign.ACCNT_ID, assign.EMP_ID, assign);
      });
    }

    // Resolve Pay Terms
    if (allPayTermIds.size > 0) {
      const placeholders = [...allPayTermIds].map(() => '?').join(',');
      const [ptRows] = await pool.execute(
        `SELECT id, Name FROM C_GENERIC_VALUES WHERE id IN (${placeholders})`,
        [...allPayTermIds]
      );
      const ptMap = {};
      ptRows.forEach(r => ptMap[r.id] = r.Name);
      
      if (invoiceType === "receivable") {
        Object.values(invoiceMap).forEach(acc => {
          Object.values(acc.projects).forEach(proj => {
            if (proj.payTermId && ptMap[proj.payTermId]) {
              proj.payTermName = ptMap[proj.payTermId];
            }
          });
        });
      } else {
        Object.values(invoiceMap).forEach(acc => {
          Object.values(acc.employees).forEach(emp => {
            Object.values(emp.projects).forEach(proj => {
              if (proj.payTermId && ptMap[proj.payTermId]) {
                proj.payTermName = ptMap[proj.payTermId];
              }
            });
          });
        });
      }
    }

    // Format invoices
    const invoices = [];

    if (invoiceType === "receivable") {
      Object.values(invoiceMap).forEach(client => {
        Object.values(client.projects).forEach(proj => {
          Object.values(proj.employees).forEach(emp => {
            emp.dailyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
          });
          proj.employees = Object.values(proj.employees).sort((a,b) => a.empName.localeCompare(b.empName));
        });

        invoices.push({
          clientId: client.clientId,
          clientName: client.clientName,
          accountName: client.clientName, // For compatibility with frontend
          accountList: Array.from(client.accounts).join(", "),
          projects: Object.values(client.projects),
          totalAmount: client.totalAmount,
          dateRange: client.dateRange,
          address: client.address,
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
      // PAYABLE: One invoice per account showing employees
      Object.values(invoiceMap).forEach(acc => {
        const employeesList = Object.values(acc.employees).map(emp => {
          Object.values(emp.projects).forEach(proj => {
            proj.dailyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
          });
          
          return {
            ...emp,
            projects: Object.values(emp.projects).sort((a,b) => a.projectName.localeCompare(b.projectName))
          };
        }).sort((a,b) => a.empName.localeCompare(b.empName));

        invoices.push({
          accountId: acc.accountId,
          accountName: acc.accountName,
          employees: employeesList,
          totalAmount: acc.totalAmount,
          dateRange: acc.dateRange,
          address: acc.address,
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
    }

    return { invoices };

  } catch (error) {
    console.error("Invoice generation error:", error);
    return { error: error.message };
  }
}
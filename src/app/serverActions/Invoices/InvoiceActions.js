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

// Date Helpers
const getDateForDay = (weekStart, dayIndex) => {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayIndex);
  return date.toISOString().split("T")[0];
};

const isDateInRange = (date, start, end) => date >= start && date <= end;

// Format YYYY-MM-DD to MM/DD/YYYY for internal storage if needed, 
// but usually we keep YYYY-MM-DD for logic and format on client. 
// We will return ISO strings and let client format to MM/DD/YYYY.

// Fetch employees for filter dropdown
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

// Fetch projects for filter dropdown (COMMENTED - replaced by client filter)
// export async function fetchProjectsForInvoice() {
//   const token = cookies().get("jwt_token")?.value;
//   if (!token) return { error: "No token found." };

//   const decoded = decodeJwt(token);
//   if (!decoded || !decoded.orgid) return { error: "Invalid token." };

//   try {
//     const pool = await DBconnection();
//     const orgid = decoded.orgid;

//     const [projects] = await pool.execute(
//       `SELECT p.PRJ_ID, p.PRJ_NAME, a.ALIAS_NAME as account_name
//        FROM C_PROJECT p
//        JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
//        WHERE p.ORG_ID = ?
//        ORDER BY p.PRJ_NAME`,
//       [orgid]
//     );

//     return { projects: projects.map(proj => ({
//       id: proj.PRJ_ID,
//       name: proj.PRJ_NAME,
//       accountName: proj.account_name
//     }))};
//   } catch (error) {
//     console.error("Error fetching projects:", error);
//     return { error: error.message };
//   }
// }

// Fetch clients for filter dropdown
export async function fetchClientsForInvoice() {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;

    const [clients] = await pool.execute(
      `SELECT DISTINCT a.ACCNT_ID, a.ALIAS_NAME
       FROM C_ACCOUNT a
       JOIN C_PROJECT p ON p.CLIENT_ID = a.ACCNT_ID OR p.ACCNT_ID = a.ACCNT_ID
       WHERE p.ORG_ID = ?
       ORDER BY a.ALIAS_NAME`,
      [orgid]
    );

    return { clients: clients.map(client => ({
      id: client.ACCNT_ID,
      name: client.ALIAS_NAME || `Client ${client.ACCNT_ID}`
    }))};
  } catch (error) {
    console.error("Error fetching clients:", error);
    return { error: error.message };
  }
}

export async function generateInvoices({ 
  reportType, searchStart, searchEnd, actualStart, actualEnd,
  selectedEmployees = [], selectedClients = []
}) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: "Invalid token." };

  try {
    const pool = await DBconnection();
    const orgid = decoded.orgid;
    
    console.log("generateInvoices params:", { 
      searchStart, searchEnd, actualStart, actualEnd,
      selectedEmployees, selectedClients, orgid 
    });
    
    // Get Organization Details
    const [subOrgRows] = await pool.execute(
      `SELECT * FROM C_SUB_ORG WHERE orgid = ? LIMIT 1`,
      [orgid]
    );
    const orgDetails = subOrgRows[0] || {};
    const otThreshold = await getOTThreshold(pool, orgid);

    // Build dynamic WHERE clauses for employee and client filters
    let employeeFilter = "";
    let clientFilter = "";
    // Project filter (COMMENTED - replaced by client filter)
    // let projectFilter = "";
    const baseParams = [searchStart, searchEnd, orgid];
    const assignBaseParams = [actualEnd, actualStart, orgid];
    
    if (selectedEmployees.length > 0) {
      const empPlaceholders = selectedEmployees.map(() => '?').join(',');
      employeeFilter = ` AND t.employee_id IN (${empPlaceholders})`;
    }
    // Project filter (COMMENTED - replaced by client filter)
    // if (selectedProjects.length > 0) {
    //   const projPlaceholders = selectedProjects.map(() => '?').join(',');
    //   projectFilter = ` AND p.PRJ_ID IN (${projPlaceholders})`;
    // }
    if (selectedClients.length > 0) {
      const clientPlaceholders = selectedClients.map(() => '?').join(',');
      clientFilter = ` AND (p.CLIENT_ID IN (${clientPlaceholders}) OR p.ACCNT_ID IN (${clientPlaceholders}))`;
    }

    // Fetch Timesheet Data with filters
    const timesheetParams = [...baseParams, ...selectedEmployees, ...selectedClients, ...selectedClients];
    console.log("Timesheet query params:", timesheetParams);
    console.log("Client filter:", clientFilter);
    
    const [timesheetRows] = await pool.execute(
      `SELECT t.*, 
              e.EMP_FST_NAME, e.EMP_LAST_NAME,
              p.PRJ_ID, p.PRJ_NAME, p.BILL_RATE, p.OT_BILL_RATE, p.PAY_TERM,
              p.CLIENT_ID, ac_client.ALIAS_NAME as client_name,
              a.ACCNT_ID, a.ALIAS_NAME as account_name,
              a.BUSINESS_ADDR_LINE1, a.BUSINESS_CITY, a.BUSINESS_STATE_ID, a.BUSINESS_COUNTRY_ID, a.BUSINESS_POSTAL_CODE
       FROM C_TIMESHEETS t
       JOIN C_EMP e ON t.employee_id = e.empid
       JOIN C_PROJECT p ON t.project_id = p.PRJ_ID
       JOIN C_ACCOUNT a ON p.ACCNT_ID = a.ACCNT_ID
       LEFT JOIN C_ACCOUNT ac_client ON p.CLIENT_ID = ac_client.ACCNT_ID
       WHERE t.week_start_date >= ? AND t.week_start_date <= ?
       AND t.is_approved = 1
       AND e.orgid = ?${employeeFilter}${clientFilter}
       ORDER BY a.ALIAS_NAME, p.PRJ_NAME, e.EMP_FST_NAME`,
      timesheetParams
    );
    
    console.log("Timesheet rows found:", timesheetRows.length);
    if (timesheetRows.length > 0) {
      console.log("Timesheet projects returned:", [...new Set(timesheetRows.map(r => `${r.PRJ_ID}: ${r.PRJ_NAME}`))]);
      console.log("Timesheet employees returned:", [...new Set(timesheetRows.map(r => `${r.employee_id}: ${r.EMP_FST_NAME}`))]);
    }

    // Build filters for assignment query
    let assignEmpFilter = "";
    let assignClientFilter = "";
    // Project filter (COMMENTED - replaced by client filter)
    // let assignProjFilter = "";
    if (selectedEmployees.length > 0) {
      const empPlaceholders = selectedEmployees.map(() => '?').join(',');
      assignEmpFilter = ` AND pe.EMP_ID IN (${empPlaceholders})`;
    }
    // Project filter (COMMENTED - replaced by client filter)
    // if (selectedProjects.length > 0) {
    //   const projPlaceholders = selectedProjects.map(() => '?').join(',');
    //   assignProjFilter = ` AND p.PRJ_ID IN (${projPlaceholders})`;
    // }
    if (selectedClients.length > 0) {
      const clientPlaceholders = selectedClients.map(() => '?').join(',');
      assignClientFilter = ` AND (p.CLIENT_ID IN (${clientPlaceholders}) OR p.ACCNT_ID IN (${clientPlaceholders}))`;
    }

    const assignParams = [...assignBaseParams, ...selectedEmployees, ...selectedClients, ...selectedClients];
    console.log("Assignment query params:", assignParams);
    
    const [assignmentRows] = await pool.execute(
      `SELECT pe.EMP_ID, pe.PRJ_ID, 
              e.EMP_FST_NAME, e.EMP_LAST_NAME,
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
       AND e.orgid = ?${assignEmpFilter}${assignClientFilter}`,
      assignParams
    );
    
    console.log("Assignment rows found:", assignmentRows.length);
    if (assignmentRows.length > 0) {
      console.log("Assignment projects returned:", [...new Set(assignmentRows.map(r => `${r.PRJ_ID}: ${r.PRJ_NAME}`))]);
      console.log("Assignment employees returned:", [...new Set(assignmentRows.map(r => `${r.EMP_ID}: ${r.EMP_FST_NAME}`))]);
    }

    const accountMap = {};
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const allPayTermIds = new Set();

    const initAccount = (row) => {
      if (!accountMap[row.ACCNT_ID]) {
        accountMap[row.ACCNT_ID] = {
          accountId: row.ACCNT_ID,
          accountName: row.account_name,
          address: {
            line1: row.BUSINESS_ADDR_LINE1,
            city: row.BUSINESS_CITY,
            zip: row.BUSINESS_POSTAL_CODE
          },
          projects: {},
          clients: new Set(),
          totalAmount: 0,
          dateRange: { start: actualStart, end: actualEnd }
        };
      }
    };

    const initProject = (accId, row) => {
      if (!accountMap[accId].projects[row.PRJ_ID]) {
        if (row.PAY_TERM) allPayTermIds.add(row.PAY_TERM);
        
        accountMap[accId].projects[row.PRJ_ID] = {
          projectId: row.PRJ_ID,
          projectName: row.PRJ_NAME,
          clientName: row.client_name || row.account_name,
          billRate: parseFloat(row.BILL_RATE) || 0,
          otBillRate: parseFloat(row.OT_BILL_RATE) || 0,
          payTermId: row.PAY_TERM,
          payTermName: "Net 30", // Default
          employees: {},
          subTotal: 0
        };
        accountMap[accId].clients.add(row.client_name || row.account_name);
      }
    };

    // Process Timesheets
    timesheetRows.forEach(ts => {
      initAccount(ts);
      initProject(ts.ACCNT_ID, ts);
      
      const project = accountMap[ts.ACCNT_ID].projects[ts.PRJ_ID];
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
          accountMap[ts.ACCNT_ID].totalAmount += amount;
        }
      });
    });

    // Process Assignments (For Not Worked)
    assignmentRows.forEach(assign => {
      initAccount(assign);
      initProject(assign.ACCNT_ID, assign);
      
      const project = accountMap[assign.ACCNT_ID].projects[assign.PRJ_ID];
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

    // Resolve Pay Terms
    if (allPayTermIds.size > 0) {
      const placeholders = [...allPayTermIds].map(() => '?').join(',');
      const [ptRows] = await pool.execute(
        `SELECT id, Name FROM C_GENERIC_VALUES WHERE id IN (${placeholders})`,
        [...allPayTermIds]
      );
      const ptMap = {};
      ptRows.forEach(r => ptMap[r.id] = r.Name);
      
      Object.values(accountMap).forEach(acc => {
        Object.values(acc.projects).forEach(proj => {
          if (proj.payTermId && ptMap[proj.payTermId]) {
            proj.payTermName = ptMap[proj.payTermId];
          }
        });
      });
    }

    // Format for Frontend
    const invoices = Object.values(accountMap).map(acc => {
      Object.values(acc.projects).forEach(proj => {
        Object.values(proj.employees).forEach(emp => {
          emp.dailyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
        });
        proj.employees = Object.values(proj.employees).sort((a,b) => a.empName.localeCompare(b.empName));
      });

      return {
        ...acc,
        clientList: Array.from(acc.clients).join(", "),
        projects: Object.values(acc.projects),
        orgDetails: {
          name: orgDetails.suborgname || "My Organization",
          address1: orgDetails.addresslane1,
          city: orgDetails.city,
          state: orgDetails.state,
          zip: orgDetails.postalcode,
          country: orgDetails.country
        }
      };
    });

    return { invoices };

  } catch (error) {
    console.error("Invoice generation error:", error);
    return { error: error.message };
  }
}
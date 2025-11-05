"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

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

const getOTThreshold = async (pool, orgId) => {
  try {
    const [rows] = await pool.execute(
      "SELECT Name FROM C_GENERIC_VALUES WHERE g_id = 28 AND orgid = ? AND isactive = 1",
      [orgId]
    );

    if (rows.length > 0 && rows[0].Name) {
      const threshold = parseInt(rows[0].Name);
      if (!isNaN(threshold) && threshold >= 1 && threshold <= 23) {
        return threshold;
      }
    }
    return 8;
  } catch (error) {
    console.error("Error fetching OT threshold:", error);
    return 8;
  }
};

const calculateOvertimeForDay = (dailyHours, threshold) => {
  if (dailyHours > threshold) {
    return {
      regularHours: threshold,
      otHours: dailyHours - threshold,
    };
  }
  return {
    regularHours: dailyHours,
    otHours: 0,
  };
};

// Helper function to check if a date falls within the actual range
const isDateInRange = (date, actualStart, actualEnd) => {
  return date >= actualStart && date <= actualEnd;
};

// Helper function to get the date for a specific day of the week
const getDateForDay = (weekStart, dayIndex) => {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayIndex);
  return date.toISOString().split("T")[0];
};

export async function generateProjectReport({ 
  reportType, 
  searchStart, 
  searchEnd, 
  actualStart, 
  actualEnd 
}) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) return { error: "No token found. Please log in." };

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) return { error: "Invalid token or user ID not found." };

  try {
    const pool = await DBconnection();

    const [userRows] = await pool.execute(
      "SELECT u.empid, e.orgid FROM C_USER u JOIN C_EMP e ON u.empid = e.empid WHERE u.username = ?",
      [decoded.userId]
    );

    if (!userRows.length) return { error: "User not found." };

    const { orgid } = userRows[0];
    const otThreshold = await getOTThreshold(pool, orgid);

    // Query all timesheets between searchStart and searchEnd
    // We need to get all weeks that overlap with our date range
    const [timesheetRows] = await pool.execute(
      `SELECT t.*, 
              e.EMP_FST_NAME, 
              e.EMP_LAST_NAME,
              p.PRJ_NAME,
              p.BILL_RATE as project_bill_rate,
              p.OT_BILL_RATE as project_ot_bill_rate,
              pe.BILL_RATE as employee_bill_rate,
              pe.OT_BILL_RATE as employee_ot_bill_rate
       FROM C_TIMESHEETS t
       JOIN C_EMP e ON t.employee_id = e.empid
       JOIN C_PROJECT p ON t.project_id = p.PRJ_ID
       JOIN C_PROJ_EMP pe ON t.employee_id = pe.EMP_ID AND t.project_id = pe.PRJ_ID
       WHERE t.week_start_date >= ? 
       AND t.week_start_date <= ?
       AND t.is_approved = 1
       AND e.orgid = ?
       ORDER BY p.PRJ_NAME, e.EMP_FST_NAME`,
      [searchStart, searchEnd, orgid]
    );

    if (!timesheetRows.length) {
      return { error: "No approved timesheets found for the selected period." };
    }

    // Get ALL employee expenses for the date range
    const [expenseRows] = await pool.execute(
      `SELECT ex.EMP_ID, e.EMP_FST_NAME, e.EMP_LAST_NAME, SUM(ex.TOTAL) as total_expenses
       FROM C_EXPENSES ex
       JOIN C_EMP e ON ex.EMP_ID = e.empid
       WHERE e.orgid = ?
       AND ex.END_DATE >= ?
       AND ex.END_DATE <= ?
       GROUP BY ex.EMP_ID, e.EMP_FST_NAME, e.EMP_LAST_NAME`,
      [orgid, actualStart, actualEnd]
    );

    const expenseMap = {};
    expenseRows.forEach(row => {
      expenseMap[row.EMP_ID] = {
        amount: parseFloat(row.total_expenses) || 0,
        firstName: row.EMP_FST_NAME,
        lastName: row.EMP_LAST_NAME || ""
      };
    });

    const projectMap = {};
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    timesheetRows.forEach(ts => {
      const projectId = ts.project_id;
      const projectName = ts.PRJ_NAME || "Unnamed Project";
      const projectBillRate = parseFloat(ts.project_bill_rate) || 0;
      const projectOTBillRate = parseFloat(ts.project_ot_bill_rate) || 0;

      if (!projectMap[projectId]) {
        projectMap[projectId] = {
          projectId,
          projectName,
          projectBillRate,
          projectOTBillRate,
          employees: {},
          totalRegularHours: 0,
          totalOTHours: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
        };
      }

      const employeeId = ts.employee_id;
      const employeeName = `${ts.EMP_FST_NAME} ${ts.EMP_LAST_NAME || ""}`.trim();
      const weekStartDate = ts.week_start_date;

      // Initialize employee if not exists
      if (!projectMap[projectId].employees[employeeId]) {
        projectMap[projectId].employees[employeeId] = {
          employeeId,
          employeeName,
          billRate: parseFloat(ts.employee_bill_rate) || 0,
          otBillRate: parseFloat(ts.employee_ot_bill_rate) || 0,
          hours: { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 },
          regularHours: 0,
          otHours: 0,
          totalRevenue: 0,
          totalCost: 0,
          projectProfit: 0,
        };
      }

      const employee = projectMap[projectId].employees[employeeId];

      // Process each day, but only count hours if the date falls within actualStart to actualEnd
      days.forEach((day, dayIndex) => {
        const hours = parseFloat(ts[`${day}_hours`]) || 0;
        const currentDate = getDateForDay(weekStartDate, dayIndex);

        // Only count hours if this date is within our actual range
        if (hours > 0 && isDateInRange(currentDate, actualStart, actualEnd)) {
          employee.hours[day] += hours;

          const { regularHours, otHours } = calculateOvertimeForDay(hours, otThreshold);
          employee.regularHours += regularHours;
          employee.otHours += otHours;
        }
      });
    });

    // Calculate revenue and costs for each employee
    Object.values(projectMap).forEach(project => {
      project.employees = Object.values(project.employees);

      project.employees.forEach(emp => {
        const empBillRate = emp.billRate;
        const empOTBillRate = emp.otBillRate;

        // Check if both project and employee have OT rates defined
        const hasOTRates = project.projectOTBillRate > 0 && empOTBillRate > 0;

        // Calculate regular hours
        const regularRevenue = emp.regularHours * project.projectBillRate;
        const regularCost = emp.regularHours * empBillRate;

        // Calculate OT hours
        let otRevenue = 0;
        let otCost = 0;
        let effectiveProjectOTRate = project.projectBillRate;
        let effectiveEmployeeOTRate = empBillRate;

        if (emp.otHours > 0) {
          if (hasOTRates) {
            effectiveProjectOTRate = project.projectOTBillRate;
            effectiveEmployeeOTRate = empOTBillRate;
          }

          otRevenue = emp.otHours * effectiveProjectOTRate;
          otCost = emp.otHours * effectiveEmployeeOTRate;
        }

        emp.totalRevenue = regularRevenue + otRevenue;
        emp.totalCost = regularCost + otCost;
        emp.projectProfit = emp.totalRevenue - emp.totalCost;

        // Update project totals
        project.totalRegularHours += emp.regularHours;
        project.totalOTHours += emp.otHours;
        project.totalRevenue += emp.totalRevenue;
        project.totalCost += emp.totalCost;
        project.totalProfit += emp.projectProfit;
      });
    });

    const projects = Object.values(projectMap);

    // Calculate grand totals
    const grandTotal = {
      regularHours: 0,
      otHours: 0,
      totalRevenue: 0,
      totalCost: 0,
      projectProfit: 0,
      totalExpenses: 0,
      netProfit: 0,
    };

    projects.forEach(project => {
      grandTotal.regularHours += project.totalRegularHours;
      grandTotal.otHours += project.totalOTHours;
      grandTotal.totalRevenue += project.totalRevenue;
      grandTotal.totalCost += project.totalCost;
      grandTotal.projectProfit += project.totalProfit;
    });

    // Build employee expense summary
    const employeeExpenses = [];
    Object.keys(expenseMap).forEach(empId => {
      const expData = expenseMap[empId];
      if (expData.amount > 0) {
        employeeExpenses.push({
          employeeId: empId,
          employeeName: `${expData.firstName} ${expData.lastName}`.trim(),
          expenses: expData.amount,
        });
      }
    });

    // Calculate total expenses and net profit
    grandTotal.totalExpenses = employeeExpenses.reduce((sum, emp) => sum + emp.expenses, 0);
    grandTotal.netProfit = grandTotal.projectProfit - grandTotal.totalExpenses;

    return {
      projects,
      grandTotal,
      employeeExpenses,
      searchStart,
      searchEnd,
      actualStart,
      actualEnd,
      otThreshold,
      reportType,
    };
  } catch (error) {
    console.error("Error generating report:", error);
    return { error: `Failed to generate report: ${error.message}` };
  }
}
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

export async function generateProjectReport({ reportType, weekStart, weekEnd }) {
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
       WHERE t.week_start_date = ? 
       AND t.is_approved = 1
       AND e.orgid = ?
       ORDER BY p.PRJ_NAME, e.EMP_FST_NAME`,
      [weekStart, orgid]
    );

    if (!timesheetRows.length) {
      return { error: "No approved timesheets found for the selected week." };
    }

    // Get ALL employee expenses for the week (not just those with timesheets)
    const [expenseRows] = await pool.execute(
      `SELECT ex.EMP_ID, e.EMP_FST_NAME, e.EMP_LAST_NAME, SUM(ex.TOTAL) as total_expenses
       FROM C_EXPENSES ex
       JOIN C_EMP e ON ex.EMP_ID = e.empid
       WHERE e.orgid = ?
       AND ex.END_DATE >= ?
       AND ex.END_DATE <= ?
       GROUP BY ex.EMP_ID, e.EMP_FST_NAME, e.EMP_LAST_NAME`,
      [orgid, weekStart, weekEnd]
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
          employees: [],
          totalRegularHours: 0,
          totalOTHours: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
        };
      }

      const employeeId = ts.employee_id;
      const employeeName = `${ts.EMP_FST_NAME} ${ts.EMP_LAST_NAME || ""}`.trim();

      const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      let totalRegularHours = 0;
      let totalOTHours = 0;
      const dailyHours = {};

      days.forEach(day => {
        const hours = parseFloat(ts[`${day}_hours`]) || 0;
        dailyHours[day] = hours;

        if (hours > 0) {
          const { regularHours, otHours } = calculateOvertimeForDay(hours, otThreshold);
          totalRegularHours += regularHours;
          totalOTHours += otHours;
        }
      });

      const empBillRate = parseFloat(ts.employee_bill_rate) || 0;
      const empOTBillRate = parseFloat(ts.employee_ot_bill_rate) || 0;

      // Check if both project and employee have OT rates defined
      const hasOTRates = projectOTBillRate > 0 && empOTBillRate > 0;

      // REVENUE: Company gets money from client (project rates)
      // COST: Company pays employee (employee rates)
      
      // Calculate regular hours
      const regularRevenue = totalRegularHours * projectBillRate; // What company GETS
      const regularCost = totalRegularHours * empBillRate; // What company PAYS

      // Calculate OT hours
      let otRevenue = 0;
      let otCost = 0;
      let effectiveProjectOTRate = projectBillRate; // Default to regular rate
      let effectiveEmployeeOTRate = empBillRate; // Default to regular rate
      
      if (totalOTHours > 0) {
        if (hasOTRates) {
          // Both have OT rates, use them
          effectiveProjectOTRate = projectOTBillRate;
          effectiveEmployeeOTRate = empOTBillRate;
        }
        // If no OT rates, use regular rates (already set as default)
        
        otRevenue = totalOTHours * effectiveProjectOTRate; // What company GETS for OT
        otCost = totalOTHours * effectiveEmployeeOTRate; // What company PAYS for OT
      }

      const totalRevenue = regularRevenue + otRevenue;
      const totalCost = regularCost + otCost;
      const projectProfit = totalRevenue - totalCost; // Profit from this project only

      projectMap[projectId].employees.push({
        employeeId,
        employeeName,
        billRate: empBillRate,
        otBillRate: empOTBillRate > 0 ? empOTBillRate : empBillRate,
        hours: dailyHours,
        regularHours: totalRegularHours,
        otHours: totalOTHours,
        totalRevenue,
        totalCost,
        projectProfit, // Profit from project work only
      });

      projectMap[projectId].totalRegularHours += totalRegularHours;
      projectMap[projectId].totalOTHours += totalOTHours;
      projectMap[projectId].totalRevenue += totalRevenue;
      projectMap[projectId].totalCost += totalCost;
      projectMap[projectId].totalProfit += projectProfit;
    });

    const projects = Object.values(projectMap);

    // Calculate grand totals
    const grandTotal = {
      regularHours: 0,
      otHours: 0,
      totalRevenue: 0,
      totalCost: 0,
      projectProfit: 0, // Total profit from all projects (before expenses)
      totalExpenses: 0, // Total expenses across all employees
      netProfit: 0, // Final profit after subtracting expenses
    };

    projects.forEach(project => {
      grandTotal.regularHours += project.totalRegularHours;
      grandTotal.otHours += project.totalOTHours;
      grandTotal.totalRevenue += project.totalRevenue;
      grandTotal.totalCost += project.totalCost;
      grandTotal.projectProfit += project.totalProfit;
    });

    // Final net profit = project profit - expenses
    grandTotal.netProfit = grandTotal.projectProfit - grandTotal.totalExpenses;

    // Build employee expense summary (ALL employees with expenses, not just those in projects)
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

    // Calculate total expenses from ALL employees
    grandTotal.totalExpenses = employeeExpenses.reduce((sum, emp) => sum + emp.expenses, 0);
    grandTotal.netProfit = grandTotal.projectProfit - grandTotal.totalExpenses;

    return {
      projects,
      grandTotal,
      employeeExpenses, // Separate expense report
      weekStart,
      weekEnd,
      otThreshold,
    };
  } catch (error) {
    console.error("Error generating report:", error);
    return { error: `Failed to generate report: ${error.message}` };
  }
}
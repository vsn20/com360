"use client";

import React, { useState } from "react";
import { generateProjectReport } from "@/app/serverActions/Reports/ReportActions";
import styles from "./Report.module.css";

const ReportOverview = () => {
  const [reportType, setReportType] = useState("weekly");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [fileFormat, setFileFormat] = useState("csv");

  // Generate array of years (current year - 5 to current year + 1)
  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      years.push(i);
    }
    return years;
  };

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const getWeekStartDate = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d.toISOString().split("T")[0];
  };

  const getWeekEndDate = (weekStart) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split("T")[0];
  };

  const getMonthDateRange = (month, year) => {
    // First and last day of the actual month
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    
    // Find the Sunday before or on the 1st day
    const dayOfWeekStart = firstDayOfMonth.getDay();
    const searchStart = new Date(firstDayOfMonth);
    searchStart.setDate(searchStart.getDate() - dayOfWeekStart);
    
    // Find the Saturday after or on the last day
    const dayOfWeekEnd = lastDayOfMonth.getDay();
    const searchEnd = new Date(lastDayOfMonth);
    searchEnd.setDate(searchEnd.getDate() + (6 - dayOfWeekEnd));
    
    return {
      searchStart: searchStart.toISOString().split("T")[0],
      searchEnd: searchEnd.toISOString().split("T")[0],
      actualStart: firstDayOfMonth.toISOString().split("T")[0],
      actualEnd: lastDayOfMonth.toISOString().split("T")[0]
    };
  };

  const getYearDateRange = (year) => {
    // First and last day of the actual year
    const firstDayOfYear = new Date(year, 0, 1);
    const lastDayOfYear = new Date(year, 11, 31);
    
    // Find the Sunday before or on Jan 1st
    const dayOfWeekStart = firstDayOfYear.getDay();
    const searchStart = new Date(firstDayOfYear);
    searchStart.setDate(searchStart.getDate() - dayOfWeekStart);
    
    // Find the Saturday after or on Dec 31st
    const dayOfWeekEnd = lastDayOfYear.getDay();
    const searchEnd = new Date(lastDayOfYear);
    searchEnd.setDate(searchEnd.getDate() + (6 - dayOfWeekEnd));
    
    return {
      searchStart: searchStart.toISOString().split("T")[0],
      searchEnd: searchEnd.toISOString().split("T")[0],
      actualStart: firstDayOfYear.toISOString().split("T")[0],
      actualEnd: lastDayOfYear.toISOString().split("T")[0]
    };
  };

  const getCustomDateRange = (startDate, endDate) => {
    // Find the Sunday before or on start date
    const start = new Date(startDate);
    const dayOfWeekStart = start.getDay();
    const searchStart = new Date(start);
    searchStart.setDate(searchStart.getDate() - dayOfWeekStart);
    
    // Find the Saturday after or on end date
    const end = new Date(endDate);
    const dayOfWeekEnd = end.getDay();
    const searchEnd = new Date(end);
    searchEnd.setDate(searchEnd.getDate() + (6 - dayOfWeekEnd));
    
    return {
      searchStart: searchStart.toISOString().split("T")[0],
      searchEnd: searchEnd.toISOString().split("T")[0],
      actualStart: startDate,
      actualEnd: endDate
    };
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDateRangeDisplay = () => {
    if (reportType === "weekly" && selectedDate) {
      const weekStart = getWeekStartDate(selectedDate);
      const weekEnd = getWeekEndDate(weekStart);
      return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
    } else if (reportType === "monthly" && selectedMonth && selectedYear) {
      const monthName = months.find(m => m.value === parseInt(selectedMonth))?.label;
      return `${monthName} ${selectedYear}`;
    } else if (reportType === "yearly" && selectedYear) {
      return `Year ${selectedYear}`;
    } else if (reportType === "custom" && customStartDate && customEndDate) {
      return `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`;
    }
    return "";
  };

  const simulateProgress = (estimatedTime) => {
    setLoadingProgress(0);
    const steps = 20;
    const interval = estimatedTime / steps;
    
    let currentStep = 0;
    const progressInterval = setInterval(() => {
      currentStep++;
      const progress = Math.min((currentStep / steps) * 95, 95); // Stop at 95%
      setLoadingProgress(progress);
      
      if (currentStep >= steps) {
        clearInterval(progressInterval);
      }
    }, interval);
    
    return progressInterval;
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setReportData(null);
    setLoadingProgress(0);

    let dateRange;
    let progressInterval;

    try {
      if (reportType === "weekly") {
        const weekStart = getWeekStartDate(selectedDate);
        const weekEnd = getWeekEndDate(weekStart);
        dateRange = {
          searchStart: weekStart,
          searchEnd: weekEnd,
          actualStart: weekStart,
          actualEnd: weekEnd
        };
        progressInterval = simulateProgress(1000);
      } else if (reportType === "monthly") {
        dateRange = getMonthDateRange(selectedMonth, selectedYear);
        progressInterval = simulateProgress(3000);
      } else if (reportType === "yearly") {
        dateRange = getYearDateRange(selectedYear);
        progressInterval = simulateProgress(8000);
      } else if (reportType === "custom") {
        if (!customStartDate || !customEndDate) {
          setError("Please select both start and end dates");
          setLoading(false);
          return;
        }
        if (new Date(customStartDate) > new Date(customEndDate)) {
          setError("Start date cannot be after end date");
          setLoading(false);
          return;
        }
        dateRange = getCustomDateRange(customStartDate, customEndDate);
        
        // Calculate estimated time based on date range
        const daysDiff = Math.ceil((new Date(customEndDate) - new Date(customStartDate)) / (1000 * 60 * 60 * 24));
        const estimatedTime = Math.min(daysDiff * 30, 10000);
        progressInterval = simulateProgress(estimatedTime);
      }

      const result = await generateProjectReport({
        reportType,
        ...dateRange
      });

      if (progressInterval) clearInterval(progressInterval);
      setLoadingProgress(100);

      if (result.error) {
        setError(result.error);
      } else {
        setReportData(result);
        setSuccess(true);
      }
    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      setError(err.message || "An error occurred while generating the report");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
      }, 500);
    }
  };

  const handleDownloadCSV = () => {
    if (!reportData) return;

    let csv = "Project Name,Employee Name,Bill Rate,OT Bill Rate,Sun,Mon,Tue,Wed,Thu,Fri,Sat,Regular Hours,OT Hours,Total Revenue,Total Cost,Project Profit\n";

    reportData.projects.forEach((project) => {
      project.employees.forEach((emp) => {
        csv += `"${project.projectName}","${emp.employeeName}",`;
        csv += `${emp.billRate?.toFixed(2) || "0.00"},${emp.otBillRate?.toFixed(2) || emp.billRate?.toFixed(2) || "0.00"},`;
        csv += `${emp.hours.sun || 0},${emp.hours.mon || 0},${emp.hours.tue || 0},${emp.hours.wed || 0},${emp.hours.thu || 0},${emp.hours.fri || 0},${emp.hours.sat || 0},`;
        csv += `${emp.regularHours.toFixed(2)},${emp.otHours.toFixed(2)},`;
        csv += `${emp.totalRevenue.toFixed(2)},${emp.totalCost.toFixed(2)},${emp.projectProfit.toFixed(2)}\n`;
      });

      csv += `"${project.projectName} - TOTAL",,,,,,,,,,,`;
      csv += `${project.totalRegularHours.toFixed(2)},${project.totalOTHours.toFixed(2)},`;
      csv += `${project.totalRevenue.toFixed(2)},${project.totalCost.toFixed(2)},${project.totalProfit.toFixed(2)}\n\n`;
    });

    csv += "\n--- EMPLOYEE EXPENSES (Separate from Projects) ---\n";
    csv += "Employee Name,Expenses\n";
    if (reportData.employeeExpenses && reportData.employeeExpenses.length > 0) {
      reportData.employeeExpenses.forEach(emp => {
        csv += `"${emp.employeeName}",${emp.expenses.toFixed(2)}\n`;
      });
    } else {
      csv += "No expenses recorded\n";
    }

    csv += "\n--- GRAND TOTAL ---\n";
    csv += "Regular Hours,OT Hours,Total Revenue,Total Cost,Project Profit,Total Expenses,Net Profit\n";
    csv += `${reportData.grandTotal.regularHours.toFixed(2)},${reportData.grandTotal.otHours.toFixed(2)},`;
    csv += `${reportData.grandTotal.totalRevenue.toFixed(2)},${reportData.grandTotal.totalCost.toFixed(2)},`;
    csv += `${reportData.grandTotal.projectProfit.toFixed(2)},${reportData.grandTotal.totalExpenses.toFixed(2)},${reportData.grandTotal.netProfit.toFixed(2)}`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    let filename = "project-report";
    if (reportType === "weekly") {
      filename += `-week-${getWeekStartDate(selectedDate)}`;
    } else if (reportType === "monthly") {
      filename += `-${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    } else if (reportType === "yearly") {
      filename += `-${selectedYear}`;
    } else if (reportType === "custom") {
      filename += `-${customStartDate}-to-${customEndDate}`;
    }
    filename += ".csv";
    
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    if (!reportData) return;
    window.print();
  };

  const handleDownload = () => {
    if (fileFormat === "csv") {
      handleDownloadCSV();
    } else if (fileFormat === "pdf") {
      handleDownloadPDF();
    }
  };

  const isGenerateDisabled = () => {
    if (loading) return true;
    if (reportType === "weekly" && !selectedDate) return true;
    if (reportType === "monthly" && (!selectedMonth || !selectedYear)) return true;
    if (reportType === "yearly" && !selectedYear) return true;
    if (reportType === "custom" && (!customStartDate || !customEndDate)) return true;
    return false;
  };

  return (
    <div className={styles.report_container}>
      <div className={styles.report_header_section}>
        <h3 className={styles.report_title}>Project Report Generator</h3>
      </div>

      <div className={styles.report_info_box}>
        <div className={styles.report_info_title}>Report Criteria:</div>
        <ul className={styles.report_info_list}>
          <li>Only approved timesheets are included</li>
          <li>Overtime calculated when daily hours exceed threshold (from system settings)</li>
          <li>Project Profit = Revenue (from client) - Cost (paid to employee)</li>
          <li>Employee expenses are tracked separately and not allocated to specific projects</li>
          <li>Net Profit = Total Project Profit - Total Employee Expenses</li>
          <li>expenses are included if end date of expense is included in the selected date range</li>
        </ul>
      </div>

      <div className={styles.report_controls_section}>
        <div className={styles.report_control_group}>
          <label>Report Type:</label>
          <select
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              setError(null);
              setReportData(null);
            }}
            className={styles.report_dropdown}
          >
            <option value="weekly">Weekly Report</option>
            <option value="monthly">Monthly Report</option>
            <option value="yearly">Yearly Report</option>
            <option value="custom">Custom Date Range</option>
          </select>
        </div>

        {reportType === "weekly" && (
          <div className={styles.report_control_group}>
            <label>Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={styles.report_date_input}
            />
          </div>
        )}

        {reportType === "monthly" && (
          <>
            <div className={styles.report_control_group}>
              <label>Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className={styles.report_dropdown}
              >
                {months.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.report_control_group}>
              <label>Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className={styles.report_dropdown}
              >
                {generateYears().map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {reportType === "yearly" && (
          <div className={styles.report_control_group}>
            <label>Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={styles.report_dropdown}
            >
              {generateYears().map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}

        {reportType === "custom" && (
          <>
            <div className={styles.report_control_group}>
              <label>Start Date:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className={styles.report_date_input}
              />
            </div>
            <div className={styles.report_control_group}>
              <label>End Date:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={styles.report_date_input}
              />
            </div>
          </>
        )}
      </div>

      {getDateRangeDisplay() && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <span className={styles.report_week_display}>
            {reportType === "weekly" && "Week Range: "}
            {reportType === "monthly" && "Month: "}
            {reportType === "yearly" && "Year: "}
            {reportType === "custom" && "Custom Range: "}
            {getDateRangeDisplay()}
          </span>
        </div>
      )}

      <div className={styles.report_button_group}>
        <button
          onClick={handleGenerateReport}
          disabled={isGenerateDisabled()}
          className={styles.report_generate_button}
        >
          {loading ? "Generating..." : "Generate Report"}
        </button>

        {reportData && (
          <>
            <div className={styles.report_control_group} style={{ margin: 0 }}>
              <select
                value={fileFormat}
                onChange={(e) => setFileFormat(e.target.value)}
                className={styles.report_dropdown}
                style={{ minWidth: "150px" }}
              >
                <option value="csv">CSV Format</option>
                <option value="pdf">PDF Format</option>
              </select>
            </div>
            <button
              onClick={handleDownload}
              className={styles.report_download_button}
            >
              Download {fileFormat.toUpperCase()}
            </button>
          </>
        )}
      </div>

      {loading && (
        <div className={styles.report_loading_container}>
          <div className={styles.report_loading_text}>
            Generating {reportType} report... Please wait
          </div>
          <div className={styles.report_progress_bar}>
            <div 
              className={styles.report_progress_fill}
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <div className={styles.report_progress_text}>
            {Math.round(loadingProgress)}%
          </div>
        </div>
      )}

      {error && <div className={styles.report_error_message}>{error}</div>}
      {success && !error && (
        <div className={styles.report_success_message}>
          Report generated successfully!
        </div>
      )}

      {reportData && !loading && (
        <div>
          {/* Projects */}
          {reportData.projects.map((project, projIndex) => (
            <div key={projIndex} className={styles.report_project_section}>
              <div className={styles.report_project_header}>
                <div>{project.projectName}</div>
                <div style={{ fontSize: "14px", fontWeight: "normal", marginTop: "4px" }}>
                  Bill Rate: ${project.projectBillRate?.toFixed(2) || "0.00"}/hr
                  {project.projectOTBillRate > 0 && (
                    <span style={{ marginLeft: "16px" }}>
                      OT Bill Rate: ${project.projectOTBillRate.toFixed(2)}/hr
                    </span>
                  )}
                </div>
              </div>

              <table className={styles.report_table}>
                <thead>
                  <tr>
                    <th style={{ width: "15%" }}>Employee</th>
                    <th style={{ width: "6%" }}>Sun</th>
                    <th style={{ width: "6%" }}>Mon</th>
                    <th style={{ width: "6%" }}>Tue</th>
                    <th style={{ width: "6%" }}>Wed</th>
                    <th style={{ width: "6%" }}>Thu</th>
                    <th style={{ width: "6%" }}>Fri</th>
                    <th style={{ width: "6%" }}>Sat</th>
                    <th style={{ width: "8%" }}>Reg Hrs</th>
                    <th style={{ width: "7%" }}>OT Hrs</th>
                    <th style={{ width: "11%" }}>Revenue (Got)</th>
                    <th style={{ width: "11%" }}>Cost (Paid)</th>
                    <th style={{ width: "10%" }}>Project Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {project.employees.map((emp, empIndex) => (
                    <tr key={empIndex}>
                      <td>
                        <div>{emp.employeeName}</div>
                        <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
                          Rate: ${emp.billRate?.toFixed(2) || "0.00"}/hr
                          {emp.otBillRate && emp.otBillRate !== emp.billRate && (
                            <span style={{ marginLeft: "4px" }}>
                              | OT: ${emp.otBillRate.toFixed(2)}/hr
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{emp.hours.sun || "-"}</td>
                      <td>{emp.hours.mon || "-"}</td>
                      <td>{emp.hours.tue || "-"}</td>
                      <td>{emp.hours.wed || "-"}</td>
                      <td>{emp.hours.thu || "-"}</td>
                      <td>{emp.hours.fri || "-"}</td>
                      <td>{emp.hours.sat || "-"}</td>
                      <td>{emp.regularHours.toFixed(2)}</td>
                      <td className={styles.report_ot_cell}>
                        {emp.otHours > 0 ? emp.otHours.toFixed(2) : "-"}
                      </td>
                      <td style={{ color: "#059669", fontWeight: "600" }}>
                        ${emp.totalRevenue.toFixed(2)}
                      </td>
                      <td style={{ color: "#dc2626", fontWeight: "600" }}>
                        ${emp.totalCost.toFixed(2)}
                      </td>
                      <td
                        className={
                          emp.projectProfit >= 0
                            ? styles.report_profit_positive
                            : styles.report_profit_negative
                        }
                      >
                        {emp.projectProfit >= 0 
                          ? `$${emp.projectProfit.toFixed(2)}`
                          : `-$${Math.abs(emp.projectProfit).toFixed(2)}`
                        }
                      </td>
                    </tr>
                  ))}
                  <tr className={styles.report_table_total_row}>
                    <td>PROJECT TOTAL</td>
                    <td colSpan="7"></td>
                    <td>{project.totalRegularHours.toFixed(2)}</td>
                    <td className={styles.report_ot_cell}>
                      {project.totalOTHours > 0
                        ? project.totalOTHours.toFixed(2)
                        : "-"}
                    </td>
                    <td style={{ color: "#059669", fontWeight: "bold" }}>
                      ${project.totalRevenue.toFixed(2)}
                    </td>
                    <td style={{ color: "#dc2626", fontWeight: "bold" }}>
                      ${project.totalCost.toFixed(2)}
                    </td>
                    <td
                      className={
                        project.totalProfit >= 0
                          ? styles.report_profit_positive
                          : styles.report_profit_negative
                      }
                    >
                      {project.totalProfit >= 0 
                        ? `$${project.totalProfit.toFixed(2)}`
                        : `-$${Math.abs(project.totalProfit).toFixed(2)}`
                      }
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* Employee Expenses Section */}
          <div className={styles.report_project_section} style={{ marginTop: "30px", border: "2px solid #dc2626" }}>
            <div className={styles.report_project_header} style={{ backgroundColor: "#dc2626", color: "white" }}>
              <div>💰 Employee Expenses</div>
              <div style={{ fontSize: "14px", fontWeight: "normal", marginTop: "4px" }}>
                These expenses are subtracted from total profit
              </div>
            </div>
            <table className={styles.report_table}>
              <thead>
                <tr>
                  <th style={{ width: "60%", textAlign: "left" }}>Employee Name</th>
                  <th style={{ width: "40%", textAlign: "right" }}>Total Expenses</th>
                </tr>
              </thead>
              <tbody>
                {reportData.employeeExpenses && reportData.employeeExpenses.length > 0 ? (
                  <>
                    {reportData.employeeExpenses.map((emp, index) => (
                      <tr key={index}>
                        <td style={{ fontWeight: "500" }}>{emp.employeeName}</td>
                        <td style={{ textAlign: "right", color: "#dc2626", fontWeight: "600", fontSize: "16px" }}>
                          -${emp.expenses.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr className={styles.report_table_total_row}>
                      <td style={{ fontWeight: "bold", fontSize: "16px" }}>TOTAL EXPENSES</td>
                      <td style={{ textAlign: "right", color: "#dc2626", fontWeight: "bold", fontSize: "18px" }}>
                        -${reportData.grandTotal.totalExpenses.toFixed(2)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan="2" style={{ textAlign: "center", padding: "20px", color: "#059669" }}>
                      ✓ No expenses recorded for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Grand Total */}
          <div className={styles.report_grand_total}>
            <div className={styles.report_grand_total_title}>
              Grand Total Summary
            </div>
            <div className={styles.report_grand_total_grid}>
              <div className={styles.report_grand_total_card}>
                <div className={styles.report_grand_total_label}>Regular Hours</div>
                <div className={styles.report_grand_total_value}>
                  {reportData.grandTotal.regularHours.toFixed(2)}
                </div>
              </div>
              <div className={styles.report_grand_total_card}>
                <div className={styles.report_grand_total_label}>OT Hours</div>
                <div className={styles.report_grand_total_value}>
                  {reportData.grandTotal.otHours.toFixed(2)}
                </div>
              </div>
              <div className={styles.report_grand_total_card}>
                <div className={styles.report_grand_total_label}>Total Revenue</div>
                <div className={styles.report_grand_total_value} style={{ color: "#059669" }}>
                  ${reportData.grandTotal.totalRevenue.toFixed(2)}
                </div>
              </div>
              <div className={styles.report_grand_total_card}>
                <div className={styles.report_grand_total_label}>Total Cost</div>
                <div className={styles.report_grand_total_value} style={{ color: "#dc2626" }}>
                  ${reportData.grandTotal.totalCost.toFixed(2)}
                </div>
              </div>
              <div className={styles.report_grand_total_card}>
                <div className={styles.report_grand_total_label}>Project Profit</div>
                <div className={styles.report_grand_total_value} style={{ 
                  color: reportData.grandTotal.projectProfit >= 0 ? "#059669" : "#dc2626"
                }}>
                  {reportData.grandTotal.projectProfit >= 0 
                    ? `$${reportData.grandTotal.projectProfit.toFixed(2)}`
                    : `-$${Math.abs(reportData.grandTotal.projectProfit).toFixed(2)}`
                  }
                </div>
              </div>
              <div className={styles.report_grand_total_card}>
                <div className={styles.report_grand_total_label}>Total Expenses</div>
                <div className={styles.report_grand_total_value} style={{ color: "#dc2626" }}>
                  ${reportData.grandTotal.totalExpenses.toFixed(2)}
                </div>
              </div>
              <div className={styles.report_grand_total_card} style={{ gridColumn: "span 2" }}>
                <div className={styles.report_grand_total_label}>Final Net Profit</div>
                <div className={styles.report_grand_total_value} style={{ 
                  color: reportData.grandTotal.netProfit >= 0 ? "#059669" : "#dc2626",
                  fontSize: "2em"
                }}>
                  {reportData.grandTotal.netProfit >= 0 
                    ? `$${reportData.grandTotal.netProfit.toFixed(2)}`
                    : `-$${Math.abs(reportData.grandTotal.netProfit).toFixed(2)}`
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportOverview;
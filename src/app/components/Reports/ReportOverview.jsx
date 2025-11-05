"use client";

import React, { useState } from "react";
import { generateProjectReport } from "@/app/serverActions/Reports/ReportActions";
import styles from "./Report.module.css";

const ReportOverview = () => {
  const [reportType, setReportType] = useState("weekly");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [fileFormat, setFileFormat] = useState("csv");

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

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDateRangeDisplay = () => {
    if (!selectedDate) return "";
    const weekStart = getWeekStartDate(selectedDate);
    const weekEnd = getWeekEndDate(weekStart);
    return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setReportData(null);

    try {
      const weekStart = getWeekStartDate(selectedDate);
      const weekEnd = getWeekEndDate(weekStart);

      const result = await generateProjectReport({
        reportType,
        weekStart,
        weekEnd,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setReportData(result);
        setSuccess(true);
      }
    } catch (err) {
      setError(err.message || "An error occurred while generating the report");
    } finally {
      setLoading(false);
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
    link.download = `project-report-${getWeekStartDate(selectedDate)}.csv`;
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
        </ul>
      </div>

      <div className={styles.report_controls_section}>
        <div className={styles.report_control_group}>
          <label>Report Type:</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className={styles.report_dropdown}
          >
            <option value="weekly">Weekly Report</option>
            <option value="monthly" disabled>
              Monthly Report (Coming Soon)
            </option>
          </select>
        </div>

        <div className={styles.report_control_group}>
          <label>Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={styles.report_date_input}
          />
        </div>
      </div>

      {selectedDate && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <span className={styles.report_week_display}>
            Week Range: {getDateRangeDisplay()}
          </span>
        </div>
      )}

      <div className={styles.report_button_group}>
        <button
          onClick={handleGenerateReport}
          disabled={loading || !selectedDate}
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

      {error && <div className={styles.report_error_message}>{error}</div>}
      {success && !error && (
        <div className={styles.report_success_message}>
          Report generated successfully!
        </div>
      )}
      {loading && <div className={styles.report_loading}>Generating report...</div>}

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
                        ${emp.projectProfit.toFixed(2)}
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
                      ${project.totalProfit.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* Employee Expenses Section - ALWAYS SHOW */}
          <div className={styles.report_project_section} style={{ marginTop: "30px", border: "2px solid #dc2626" }}>
            <div className={styles.report_project_header} style={{ backgroundColor: "#dc2626", color: "white" }}>
              <div>💰 Employee Expenses (Separate from Projects)</div>
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
                      ✓ No expenses recorded for this week
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
                <div className={styles.report_grand_total_value}>
                  ${reportData.grandTotal.projectProfit.toFixed(2)}
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
                  ${reportData.grandTotal.netProfit.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && !reportData && (
        <div className={styles.report_no_data}>
          <p className={styles.report_no_data_text}>
            Select a date and click "Generate Report" to view project data
          </p>
        </div>
      )}
    </div>
  );
};

export default ReportOverview;
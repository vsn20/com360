"use client";

import React, { useState, useEffect } from "react";
import { generateInvoices, fetchEmployeesForInvoice, fetchClientsForInvoice } from "@/app/serverActions/Invoices/InvoiceActions";
import styles from "./Invoice.module.css";
import ExcelJS from 'exceljs'; 
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

const InvoiceOverview = () => {
  const [view, setView] = useState("list"); // 'list' or 'detail'
  
  // Filter Options (fetched from server)
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  // Project filter (COMMENTED - replaced by client filter)
  // const [projects, setProjects] = useState([]);
  
  // Selected Filters (single select with 'all' option)
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedClient, setSelectedClient] = useState("all");
  // Project filter (COMMENTED - replaced by client filter)
  // const [selectedProject, setSelectedProject] = useState("all");
  
  // Controls
  const [reportType, setReportType] = useState("monthly");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Data & State
  const [invoices, setInvoices] = useState([]);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Fetch employees and clients on mount
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [empRes, clientRes] = await Promise.all([
          fetchEmployeesForInvoice(),
          fetchClientsForInvoice()
        ]);
        
        console.log("Employee fetch result:", empRes);
        console.log("Client fetch result:", clientRes);
        
        if (empRes.error) {
          console.error("Error fetching employees:", empRes.error);
        } else if (empRes.employees) {
          setEmployees(empRes.employees);
        }
        
        if (clientRes.error) {
          console.error("Error fetching clients:", clientRes.error);
        } else if (clientRes.clients) {
          setClients(clientRes.clients);
        }
        
        // Project filter (COMMENTED - replaced by client filter)
        // if (projRes.error) {
        //   console.error("Error fetching projects:", projRes.error);
        // } else if (projRes.projects) {
        //   setProjects(projRes.projects);
        // }
      } catch (err) {
        console.error("Error loading filter data:", err);
      }
    };
    loadFilterData();
  }, []);

  // --- Date Logic ---
  const generateYears = () => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => current - 5 + i);
  };

  const getWeekRange = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDay(); // 0 is Sunday
    const start = new Date(date);
    start.setDate(date.getDate() - day); // Last Sunday
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Following Saturday
    return {
      searchStart: start.toISOString().split("T")[0],
      searchEnd: end.toISOString().split("T")[0],
      actualStart: start.toISOString().split("T")[0],
      actualEnd: end.toISOString().split("T")[0]
    };
  };

  const getMonthRange = (month, year) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const start = new Date(firstDay);
    start.setDate(start.getDate() - firstDay.getDay());
    const end = new Date(lastDay);
    end.setDate(end.getDate() + (6 - lastDay.getDay()));
    return {
      searchStart: start.toISOString().split("T")[0],
      searchEnd: end.toISOString().split("T")[0],
      actualStart: firstDay.toISOString().split("T")[0],
      actualEnd: lastDay.toISOString().split("T")[0]
    };
  };

  const getYearRange = (year) => {
    const firstDay = new Date(year, 0, 1);
    const lastDay = new Date(year, 11, 31);
    const start = new Date(firstDay);
    start.setDate(start.getDate() - firstDay.getDay());
    const end = new Date(lastDay);
    end.setDate(end.getDate() + (6 - lastDay.getDay()));
    return {
      searchStart: start.toISOString().split("T")[0],
      searchEnd: end.toISOString().split("T")[0],
      actualStart: firstDay.toISOString().split("T")[0],
      actualEnd: lastDay.toISOString().split("T")[0]
    };
  };

  // --- Formatters ---
  const formatMMDDYYYY = (isoDate) => {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-");
    return `${m}/${d}/${y}`;
  };

  // --- Simulate Progress ---
  const runProgress = () => {
    setProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15;
      if (p > 90) p = 90;
      setProgress(p);
    }, 300);
    return interval;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setInvoices([]);
    const progressInt = runProgress();

    try {
      // Keep IDs as-is (they may be strings like "2-1" or "2_2")
      const empId = selectedEmployee === "all" ? null : selectedEmployee;
      const clientId = selectedClient === "all" ? null : selectedClient;
      // Project filter (COMMENTED - replaced by client filter)
      // const projId = selectedProject === "all" ? null : selectedProject;
      
      console.log("Selected filters:", { selectedEmployee, selectedClient, empId, clientId });
      
      let params = { 
        reportType,
        selectedEmployees: empId ? [empId] : [],
        selectedClients: clientId ? [clientId] : []
        // Project filter (COMMENTED - replaced by client filter)
        // selectedProjects: projId ? [projId] : []
      };
      
      console.log("Params being sent:", params);
      
      if (reportType === "weekly") {
        params = { ...params, ...getWeekRange(selectedDate) };
      } else if (reportType === "monthly") {
        params = { ...params, ...getMonthRange(selectedMonth, selectedYear) };
      } else if (reportType === "yearly") {
        params = { ...params, ...getYearRange(selectedYear) };
      } else if (reportType === "custom") {
        if (!customStart || !customEnd) throw new Error("Select dates");
        const startD = new Date(customStart);
        const endD = new Date(customEnd);
        const searchS = new Date(startD); searchS.setDate(searchS.getDate() - startD.getDay());
        const searchE = new Date(endD); searchE.setDate(searchE.getDate() + (6 - endD.getDay()));
        params = {
            ...params,
            actualStart: customStart, actualEnd: customEnd,
            searchStart: searchS.toISOString().split("T")[0],
            searchEnd: searchE.toISOString().split("T")[0]
        };
      }

      const res = await generateInvoices(params);
      clearInterval(progressInt);
      setProgress(100);

      if (res.error) throw new Error(res.error);
      setInvoices(res.invoices);
      setView("list");
      
    } catch (err) {
      clearInterval(progressInt);
      setProgress(0);
      setError(err.message);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  // --- EXCEL LOGIC ---
  const generateExcelBuffer = async (invoice) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Invoice');
    
    // Formats
    const titleFont = { name: 'Arial', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
    const boldFont = { bold: true };
    const currencyFmt = '"$"#,##0.00';

    // Header
    sheet.mergeCells('A1:E2');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'INVOICE';
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.font = titleFont;
    titleCell.fill = headerFill;

    sheet.getCell('A4').value = 'FROM:';
    sheet.getCell('A4').font = boldFont;
    sheet.getCell('A5').value = invoice.orgDetails.name;
    sheet.getCell('A6').value = invoice.orgDetails.address1;
    sheet.getCell('A7').value = `${invoice.orgDetails.city}, ${invoice.orgDetails.state} ${invoice.orgDetails.zip}`;

    sheet.getCell('D4').value = 'BILL TO:';
    sheet.getCell('D4').font = boldFont;
    sheet.getCell('D5').value = invoice.accountName;
    sheet.getCell('D6').value = invoice.address.line1;
    sheet.getCell('D7').value = `${invoice.address.city || ''} ${invoice.address.zip || ''}`;

    sheet.getCell('A9').value = 'Generated Date:';
    sheet.getCell('B9').value = formatMMDDYYYY(new Date().toISOString().split('T')[0]);
    sheet.getCell('A10').value = 'Period:';
    sheet.getCell('B10').value = `${formatMMDDYYYY(invoice.dateRange.start)} to ${formatMMDDYYYY(invoice.dateRange.end)}`;

    let currentRow = 13;

    invoice.projects.forEach(proj => {
      sheet.mergeCells(`A${currentRow}:E${currentRow}`);
      const projHeader = sheet.getCell(`A${currentRow}`);
      projHeader.value = `Project: ${proj.projectName} | Pay Terms: ${proj.payTermName}`;
      projHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
      projHeader.font = { bold: true, size: 12 };
      currentRow++;

      sheet.mergeCells(`A${currentRow}:E${currentRow}`);
      sheet.getCell(`A${currentRow}`).value = `Client: ${proj.clientName} | Bill Rate: $${proj.billRate}/hr`;
      currentRow += 2;

      proj.employees.forEach(emp => {
        sheet.getCell(`A${currentRow}`).value = emp.empName;
        sheet.getCell(`A${currentRow}`).font = { bold: true, color: { argb: 'FF2E7D32' } };
        currentRow++;

        if (!emp.hasWorked) {
          sheet.getCell(`A${currentRow}`).value = "Not Worked (0 Hours)";
          sheet.getCell(`A${currentRow}`).font = { italic: true, color: { argb: 'FF888888' } };
          currentRow += 2;
        } else {
          sheet.getCell(`A${currentRow}`).value = "Date";
          sheet.getCell(`B${currentRow}`).value = "Reg Hrs";
          sheet.getCell(`C${currentRow}`).value = "OT Hrs";
          sheet.getCell(`D${currentRow}`).value = "Amount";
          ['A','B','C','D'].forEach(c => sheet.getCell(`${c}${currentRow}`).font = { bold: true, underline: true });
          currentRow++;

          emp.dailyLogs.forEach(log => {
             sheet.getCell(`A${currentRow}`).value = formatMMDDYYYY(log.date);
             sheet.getCell(`B${currentRow}`).value = log.regularHours;
             sheet.getCell(`C${currentRow}`).value = log.otHours;
             sheet.getCell(`D${currentRow}`).value = log.amount;
             sheet.getCell(`D${currentRow}`).numFmt = currencyFmt;
             currentRow++;
          });

          sheet.getCell(`C${currentRow}`).value = "Subtotal:";
          sheet.getCell(`C${currentRow}`).font = boldFont;
          sheet.getCell(`D${currentRow}`).value = emp.totalAmount;
          sheet.getCell(`D${currentRow}`).numFmt = currencyFmt;
          sheet.getCell(`D${currentRow}`).font = boldFont;
          sheet.getCell(`D${currentRow}`).border = { top: { style: 'double' } };
          currentRow += 2;
        }
      });
      
      sheet.getCell(`C${currentRow}`).value = "PROJECT TOTAL:";
      sheet.getCell(`C${currentRow}`).font = boldFont;
      sheet.getCell(`D${currentRow}`).value = proj.subTotal;
      sheet.getCell(`D${currentRow}`).numFmt = currencyFmt;
      sheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      currentRow += 3;
    });

    sheet.mergeCells(`C${currentRow}:D${currentRow + 1}`);
    const grandTotalLabel = sheet.getCell(`B${currentRow}`);
    grandTotalLabel.value = "TOTAL DUE:";
    grandTotalLabel.font = { size: 14, bold: true };
    const grandTotalVal = sheet.getCell(`D${currentRow}`);
    grandTotalVal.value = invoice.totalAmount;
    grandTotalVal.numFmt = currencyFmt;
    grandTotalVal.font = { size: 16, bold: true, color: { argb: 'FF2E7D32' } };

    sheet.getColumn('A').width = 25;
    sheet.getColumn('B').width = 15;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 20;

    return await workbook.xlsx.writeBuffer();
  };

  const handleDownloadSingle = async (invoice) => {
    const buffer = await generateExcelBuffer(invoice);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const filename = `${invoice.accountName.replace(/\s+/g, '_')}_${formatMMDDYYYY(invoice.dateRange.start).replace(/\//g,'-')}_${formatMMDDYYYY(invoice.dateRange.end).replace(/\//g,'-')}.xlsx`;
    saveAs(blob, filename);
  };

  const handleDownloadZip = async () => {
    if(!invoices.length) return;
    const zip = new JSZip();
    
    // Create folder inside zip (optional, or just files at root)
    const folderName = `Invoices_${formatMMDDYYYY(invoices[0].dateRange.start).replace(/\//g,'-')}_to_${formatMMDDYYYY(invoices[0].dateRange.end).replace(/\//g,'-')}`;
    const folder = zip.folder(folderName);

    // Generate all files
    const promises = invoices.map(async (inv) => {
      const buffer = await generateExcelBuffer(inv);
      const filename = `${inv.accountName.replace(/\s+/g, '_')}_${formatMMDDYYYY(inv.dateRange.start).replace(/\//g,'-')}_${formatMMDDYYYY(inv.dateRange.end).replace(/\//g,'-')}.xlsx`;
      folder.file(filename, buffer);
    });

    await Promise.all(promises);
    
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${folderName}.zip`);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>Invoicing Hub</h1>
        <p className={styles.subtitle}>Generate, View, and Export Client Invoices</p>
      </div>

      <div className={styles.card}>
        <div className={styles.controlsGrid}>
          {/* Employee Filter */}
          <div className={styles.controlGroup}>
            <label>Employee</label>
            <select 
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          {/* Client Filter */}
          <div className={styles.controlGroup}>
            <label>Client</label>
            <select 
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          {/* Project Filter (COMMENTED - replaced by client filter) */}
          {/* <div className={styles.controlGroup}>
            <label>Project</label>
            <select 
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Projects</option>
              {projects.map(proj => (
                <option key={proj.id} value={proj.id}>{proj.name}</option>
              ))}
            </select>
          </div> */}

          {/* Report Type */}
          <div className={styles.controlGroup}>
             <label>Report Type</label>
             <select value={reportType} onChange={e => setReportType(e.target.value)}>
               <option value="weekly">Weekly</option>
               <option value="monthly">Monthly</option>
               <option value="yearly">Yearly</option>
               <option value="custom">Custom Range</option>
             </select>
          </div>

          {reportType === "weekly" && (
            <div className={styles.controlGroup}>
              <label>Select Date in Week</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
          )}

          {reportType === "monthly" && (
            <>
              <div className={styles.controlGroup}>
                <label>Month</label>
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                  {Array.from({length: 12}, (_, i) => 
                    <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', {month:'long'})}</option>
                  )}
                </select>
              </div>
              <div className={styles.controlGroup}>
                <label>Year</label>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                  {generateYears().map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}

          {reportType === "yearly" && (
            <div className={styles.controlGroup}>
              <label>Year</label>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                {generateYears().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {reportType === "custom" && (
            <>
               <div className={styles.controlGroup}>
                 <label>Start</label>
                 <input type="date" onChange={e => setCustomStart(e.target.value)} />
               </div>
               <div className={styles.controlGroup}>
                 <label>End</label>
                 <input type="date" onChange={e => setCustomEnd(e.target.value)} />
               </div>
            </>
          )}
          
          <div className={styles.actionGroup}>
             <button className={styles.btnPrimary} onClick={handleGenerate} disabled={loading}>
                {loading ? "Processing..." : "Generate Invoices"}
             </button>
          </div>
        </div>

        {loading && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar} style={{width: `${progress}%`}}></div>
            <div className={styles.progressText}>{Math.round(progress)}%</div>
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}
      </div>

      {view === "list" && !loading && invoices.length > 0 && (
        <div className={styles.resultsArea}>
          <div className={styles.resultsHeader}>
            <h3>Generated {invoices.length} Invoices</h3>
            <button className={styles.btnZip} onClick={handleDownloadZip}>
              Download All (ZIP)
            </button>
          </div>
          
          <div className={styles.gridList}>
            {invoices.map((inv, idx) => (
              <div key={idx} className={styles.invoiceCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardAccount}>{inv.accountName}</div>
                  <div className={styles.cardAmount}>${inv.totalAmount.toFixed(2)}</div>
                </div>
                <div className={styles.cardBody}>
                   <div className={styles.cardRow}>
                     <span>Clients:</span> {inv.clientList}
                   </div>
                   <div className={styles.cardRow}>
                     <span>Period:</span> {formatMMDDYYYY(inv.dateRange.start)} - {formatMMDDYYYY(inv.dateRange.end)}
                   </div>
                   <div className={styles.cardRow}>
                     <span>Projects:</span> {inv.projects.length}
                   </div>
                </div>
                <div className={styles.cardActions}>
                   <button className={styles.btnOutline} onClick={() => { setCurrentInvoice(inv); setView("detail"); }}>Preview</button>
                   <button className={styles.btnOutline} onClick={() => handleDownloadSingle(inv)}>Excel</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "detail" && currentInvoice && (
        <div className={styles.detailOverlay}>
          <div className={styles.toolbar}>
            <button onClick={() => setView("list")}>Back</button>
            <button onClick={() => handleDownloadSingle(currentInvoice)}>Download Excel</button>
          </div>

          <div className={styles.paper}>
            <div className={styles.paperHeader}>
               <div className={styles.paperLogo}>INVOICE</div>
               <div className={styles.paperMeta}>
                 <div>Date: {formatMMDDYYYY(new Date().toISOString().split('T')[0])}</div>
                 <div>Period: {formatMMDDYYYY(currentInvoice.dateRange.start)} - {formatMMDDYYYY(currentInvoice.dateRange.end)}</div>
               </div>
            </div>

            <div className={styles.paperAddresses}>
               <div className={styles.addrBox}>
                 <strong>FROM:</strong><br/>
                 {currentInvoice.orgDetails.name}<br/>
                 {currentInvoice.orgDetails.address1}<br/>
                 {currentInvoice.orgDetails.city}, {currentInvoice.orgDetails.zip}
               </div>
               <div className={styles.addrBox}>
                 <strong>BILL TO:</strong><br/>
                 {currentInvoice.accountName}<br/>
                 {currentInvoice.address.line1}<br/>
                 {currentInvoice.address.city}, {currentInvoice.address.zip}
               </div>
            </div>

            <div className={styles.paperBody}>
              {currentInvoice.projects.map((proj, i) => (
                <div key={i} className={styles.projectSection}>
                  <div className={styles.projectTitle}>
                    {proj.projectName}
                    <span className={styles.projectPayTerm}>Terms: {proj.payTermName}</span>
                  </div>
                  <div className={styles.projectSubTitle}>
                    Client: {proj.clientName} | Rate: ${proj.billRate}/hr | OT: ${proj.otBillRate}/hr
                  </div>

                  {proj.employees.map((emp, j) => (
                    <div key={j} className={styles.empSection}>
                      <div className={styles.empName}>{emp.empName}</div>
                      
                      {!emp.hasWorked ? (
                        <div className={styles.notWorked}>Assigned - Not Worked (0 hrs)</div>
                      ) : (
                        <table className={styles.dataTable}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Reg</th>
                              <th>OT</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emp.dailyLogs.map((log, k) => (
                              <tr key={k}>
                                <td>{formatMMDDYYYY(log.date)}</td>
                                <td>{log.regularHours}</td>
                                <td>{log.otHours}</td>
                                <td>${log.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className={styles.empTotalRow}>
                               <td colSpan="3">Subtotal</td>
                               <td>${emp.totalAmount.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                  <div className={styles.projTotal}>Project Total: ${proj.subTotal.toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div className={styles.paperFooter}>
               <div className={styles.grandTotalLabel}>TOTAL DUE</div>
               <div className={styles.grandTotalAmount}>${currentInvoice.totalAmount.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceOverview;
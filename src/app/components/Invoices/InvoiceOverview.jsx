"use client";

import React, { useState, useEffect } from "react";
import { 
  generateInvoices, 
  fetchEmployeesForInvoice, 
  fetchProjectsForInvoice, 
  fetchContractEmployeesForInvoice, 
  fetchAccountsForReceivable,
  fetchVendorsForPayable,
  sendInvoiceEmails,
  generateInvoiceExcel,
  fetchSentInvoices,
  resendInvoiceEmail
} from "@/app/serverActions/Invoices/InvoiceActions";
import styles from "./Invoice.module.css";
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

const InvoiceOverview = () => {
  const [view, setView] = useState("list");
  const [invoiceType, setInvoiceType] = useState("receivable");
  
  // Loading States
  const [sendingEmailIdx, setSendingEmailIdx] = useState(null); 
  const [sendingAllEmails, setSendingAllEmails] = useState(false); 
  const [emailResult, setEmailResult] = useState(null);
  
  // Filter Options
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  
  // Selected Filters
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");
  
  // Controls
  const [reportType, setReportType] = useState("monthly");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [groupingMode, setGroupingMode] = useState("combined"); 

  const [invoices, setInvoices] = useState([]);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Saved Invoices State
  const [savedInvoices, setSavedInvoices] = useState([]);
  const [savedInvoicesLoading, setSavedInvoicesLoading] = useState(false);
  const [savedStartDate, setSavedStartDate] = useState("");
  const [savedEndDate, setSavedEndDate] = useState("");
  const [savedRecipientEmail, setSavedRecipientEmail] = useState("");
  const [savedStatus, setSavedStatus] = useState("all");

  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const fetchPromises = [fetchProjectsForInvoice()];
        if (invoiceType === "receivable") {
          fetchPromises.push(fetchEmployeesForInvoice());
          fetchPromises.push(fetchAccountsForReceivable());
        } else {
          fetchPromises.push(fetchContractEmployeesForInvoice());
          fetchPromises.push(fetchVendorsForPayable());
        }
        
        const results = await Promise.all(fetchPromises);
        const [projRes, empRes, accRes] = results;
        
        if (projRes?.projects) setProjects(projRes.projects);
        if (empRes?.employees) setEmployees(empRes.employees);
        if (accRes) {
          if (accRes.accounts) setAccounts(accRes.accounts);
          else if (accRes.vendors) setAccounts(accRes.vendors);
        }
      } catch (err) {
        console.error("Error loading filter data:", err);
      }
    };
    loadFilterData();
  }, [invoiceType]);

  const generateYears = () => {
    const current = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => current - 5 + i);
  };

  const getWeekRange = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay();
    const start = new Date(date);
    start.setDate(date.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const formatLocalDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    
    return { start: formatLocalDate(start), end: formatLocalDate(end) };
  };

  const getMonthRange = (month, year) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const formatLocalDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    return { start: formatLocalDate(firstDay), end: formatLocalDate(lastDay) };
  };

  const getYearRange = (year) => {
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  };

  const formatMMDDYYYY = (isoDate) => {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-");
    return `${m}/${d}/${y}`;
  };

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
    setHasSearched(true);
    const progressInt = runProgress();

    try {
      const empId = selectedEmployee === "all" ? null : selectedEmployee;
      const projId = selectedProject === "all" ? null : selectedProject;
      const accId = selectedAccount === "all" ? null : selectedAccount;
      
      let dateRange;
      if (reportType === "weekly") dateRange = getWeekRange(selectedDate);
      else if (reportType === "monthly") dateRange = getMonthRange(selectedMonth, selectedYear);
      else if (reportType === "yearly") dateRange = getYearRange(selectedYear);
      else if (reportType === "custom") {
        if (!customStart || !customEnd) throw new Error("Select start and end dates");
        dateRange = { start: customStart, end: customEnd };
      }
      
      let params = { 
        reportType,
        actualStart: dateRange.start,
        actualEnd: dateRange.end,
        selectedEmployees: empId ? [empId] : [],
        selectedProjects: projId ? [projId] : [],
        selectedAccounts: accId ? [accId] : [],
        invoiceType: invoiceType,
        groupingMode: groupingMode
      };

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

  // Helper to fetch Excel buffer from Server Action
  const getInvoiceExcelBuffer = async (invoice) => {
    const result = await generateInvoiceExcel(invoice);
    if (result.error) throw new Error(result.error);
    
    // Convert base64 string back to ArrayBuffer
    const binaryString = window.atob(result.buffer);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const handleDownloadSingle = async (invoice) => {
    try {
      const buffer = await getInvoiceExcelBuffer(invoice);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const dateRange = `${formatMMDDYYYY(invoice.dateRange.start).replace(/\//g,'-')}_${formatMMDDYYYY(invoice.dateRange.end).replace(/\//g,'-')}`;
      const entityName = invoiceType === 'receivable' ? invoice.accountName : invoice.vendorName;
      const empName = (invoice.isSeparate || invoice.isProjectSeparate) ? `_${invoice.employees[0].empName.replace(/\s+/g, '_')}` : '';
      const projName = invoice.isProjectSeparate ? `_${invoice.employees[0].projects[0].projectName.replace(/\s+/g, '_')}` : '';
      const filename = `${dateRange}_${entityName.replace(/\s+/g, '_')}${empName}${projName}.xlsx`;
      saveAs(blob, filename);
    } catch (err) {
      alert("Error downloading invoice: " + err.message);
    }
  };

  const handleDownloadZip = async () => {
    if(!invoices.length) return;
    try {
      const zip = new JSZip();
      const dateRange = `${formatMMDDYYYY(invoices[0].dateRange.start).replace(/\//g,'-')}_${formatMMDDYYYY(invoices[0].dateRange.end).replace(/\//g,'-')}`;
      const folderName = `${invoiceType}_Invoices_${dateRange}`;
      const folder = zip.folder(folderName);

      const promises = invoices.map(async (inv) => {
        const buffer = await getInvoiceExcelBuffer(inv);
        const entityName = invoiceType === 'receivable' ? inv.accountName : inv.vendorName;
        const empName = (inv.isSeparate || inv.isProjectSeparate) ? `_${inv.employees[0].empName.replace(/\s+/g, '_')}` : '';
        const projName = inv.isProjectSeparate ? `_${inv.employees[0].projects[0].projectName.replace(/\s+/g, '_')}` : '';
        const filename = `${dateRange}_${entityName.replace(/\s+/g, '_')}${empName}${projName}.xlsx`;
        folder.file(filename, buffer);
      });

      await Promise.all(promises);
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${folderName}.zip`);
    } catch (err) {
      alert("Error creating zip: " + err.message);
    }
  };

  const handleSendAllEmails = async () => {
    if (!invoices.length || invoiceType !== 'receivable') return;
    
    setSendingAllEmails(true); 
    setEmailResult(null);

    try {
      const dateRange = `${formatMMDDYYYY(invoices[0].dateRange.start).replace(/\//g,'-')}_${formatMMDDYYYY(invoices[0].dateRange.end).replace(/\//g,'-')}`;
      const period = `${formatMMDDYYYY(invoices[0].dateRange.start)} - ${formatMMDDYYYY(invoices[0].dateRange.end)}`;
      
      const emailGroups = {};
      
      for (const inv of invoices) {
        const email = inv.accountEmail;
        const accountName = inv.accountName;
        const key = email || `no-email-${accountName}`;
        
        if (!emailGroups[key]) {
          emailGroups[key] = {
            email,
            accountName,
            invoices: [],
            totalAmount: 0
          };
        }
        emailGroups[key].invoices.push(inv);
        emailGroups[key].totalAmount += inv.totalAmount;
      }

      const invoiceData = [];
      
      for (const key of Object.keys(emailGroups)) {
        const group = emailGroups[key];
        if(!group.email) continue; 

        if (group.invoices.length > 1) {
          const zip = new JSZip();
          for (const inv of group.invoices) {
            const buffer = await getInvoiceExcelBuffer(inv);
            const entityName = inv.accountName;
            const empName = (inv.isSeparate || inv.isProjectSeparate) ? `_${inv.employees[0].empName.replace(/\s+/g, '_')}` : '';
            const projName = inv.isProjectSeparate ? `_${inv.employees[0].projects[0].projectName.replace(/\s+/g, '_')}` : '';
            const filename = `${dateRange}_${entityName.replace(/\s+/g, '_')}${empName}${projName}.xlsx`;
            zip.file(filename, buffer);
          }
          const zipBuffer = await zip.generateAsync({ type: 'base64' });
          invoiceData.push({
            email: group.email,
            accountName: group.accountName,
            filename: `Invoices_${dateRange}_${group.accountName.replace(/\s+/g, '_')}.zip`,
            buffer: zipBuffer,
            period,
            totalAmount: group.totalAmount,
            isZip: true
          });
        } else {
          // Pass the invoice object directly; server will generate Excel if buffer is missing
          // But to be consistent with Zip logic above, let's generate buffer here or pass full object
          // We will pass full object and let server generate it to save bandwidth? 
          // Actually, we already have getInvoiceExcelBuffer, let's just use it to keep logic consistent.
          const inv = group.invoices[0];
          const buffer = await getInvoiceExcelBuffer(inv);
          
          // buffer is ArrayBuffer, convert to base64
          let binary = '';
          const bytes = new Uint8Array(buffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i]);
          }
          const base64Buffer = window.btoa(binary);

          const entityName = inv.accountName;
          const empName = (inv.isSeparate || inv.isProjectSeparate) ? `_${inv.employees[0].empName.replace(/\s+/g, '_')}` : '';
          const projName = inv.isProjectSeparate ? `_${inv.employees[0].projects[0].projectName.replace(/\s+/g, '_')}` : '';
          const filename = `${dateRange}_${entityName.replace(/\s+/g, '_')}${empName}${projName}.xlsx`;
          
          invoiceData.push({
            email: group.email,
            accountName: group.accountName,
            filename,
            buffer: base64Buffer,
            period,
            totalAmount: inv.totalAmount,
            isZip: false
          });
        }
      }

      const result = await sendInvoiceEmails(invoiceData);
      
      if (result.error) {
        setEmailResult({ type: 'error', message: result.error });
      } else {
        setEmailResult({
          type: 'success',
          sent: result.results.sent,
          failed: result.results.failed,
          skipped: result.results.skipped
        });
      }
    } catch (err) {
      setEmailResult({ type: 'error', message: err.message });
    } finally {
      setSendingAllEmails(false);
    }
  };

  const handleSendSingleEmail = async (inv, idx) => {
    setSendingEmailIdx(idx);
    setEmailResult(null);
    
    try {
      const dateRange = `${formatMMDDYYYY(inv.dateRange.start).replace(/\//g,'-')}_${formatMMDDYYYY(inv.dateRange.end).replace(/\//g,'-')}`;
      const period = `${formatMMDDYYYY(inv.dateRange.start)} - ${formatMMDDYYYY(inv.dateRange.end)}`;
      
      // Generate buffer
      const buffer = await getInvoiceExcelBuffer(inv);
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      const base64Buffer = window.btoa(binary);

      const entityName = inv.accountName;
      const empName = (inv.isSeparate || inv.isProjectSeparate) ? `_${inv.employees[0].empName.replace(/\s+/g, '_')}` : '';
      const projName = inv.isProjectSeparate ? `_${inv.employees[0].projects[0].projectName.replace(/\s+/g, '_')}` : '';
      const filename = `${dateRange}_${entityName.replace(/\s+/g, '_')}${empName}${projName}.xlsx`;
      
      const invoiceData = [{
        email: inv.accountEmail,
        accountName: inv.accountName,
        filename,
        buffer: base64Buffer,
        period,
        totalAmount: inv.totalAmount,
        isZip: false
      }];

      const result = await sendInvoiceEmails(invoiceData);
      
      if (result.error) {
        setEmailResult({ type: 'error', message: result.error });
      } else {
        setEmailResult({
          type: 'success',
          sent: result.results.sent,
          failed: result.results.failed,
          skipped: result.results.skipped
        });
      }
    } catch (err) {
      setEmailResult({ type: 'error', message: err.message });
    } finally {
      setSendingEmailIdx(null);
    }
  };

  const handleLoadSavedInvoices = async () => {
    setSavedInvoicesLoading(true);
    setError(null);
    try {
      const result = await fetchSentInvoices({
        startDate: savedStartDate || null,
        endDate: savedEndDate || null,
        recipientEmail: savedRecipientEmail || null,
        status: savedStatus
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSavedInvoices(result.invoices || []);
        setView("saved");
      }
    } catch (err) {
      setError(err.message || "Error loading saved invoices");
    } finally {
      setSavedInvoicesLoading(false);
    }
  };

  // Handler to switch to saved view and auto-load all invoices
  const handleShowSavedInvoices = async () => {
    setView("saved");
    setSavedInvoicesLoading(true);
    setError(null);
    try {
      // Load all invoices initially (no filters)
      const result = await fetchSentInvoices({
        startDate: null,
        endDate: null,
        recipientEmail: null,
        status: 'all'
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSavedInvoices(result.invoices || []);
      }
    } catch (err) {
      setError(err.message || "Error loading saved invoices");
    } finally {
      setSavedInvoicesLoading(false);
    }
  };

  const handleResendInvoice = async (sentId, originalSentDate) => {
    if (!window.confirm(`Resend invoice? This was originally sent on ${new Date(originalSentDate).toLocaleDateString()}`)) {
      return;
    }
    
    setSavedInvoicesLoading(true);
    setError(null);
    try {
      const result = await resendInvoiceEmail(sentId);
      if (result.error) {
        setError(result.error);
      } else {
        alert(result.message);
        // Reload the saved invoices
        await handleLoadSavedInvoices();
      }
    } catch (err) {
      setError(err.message || "Error resending invoice");
    } finally {
      setSavedInvoicesLoading(false);
    }
  };

  const handleInvoiceTypeChange = (type) => {
    setInvoiceType(type);
    setSelectedEmployee("all");
    setSelectedAccount("all");
    setInvoices([]);
    setHasSearched(false);
    setEmailResult(null);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>Invoicing Hub</h1>
        <p className={styles.subtitle}>Generate, View, and Export Invoices</p>
      </div>

      <div className={styles.invoiceTypeToggle}>
        <button 
          className={`${styles.toggleBtn} ${invoiceType === "receivable" ? styles.toggleBtnActive : ""}`}
          onClick={() => handleInvoiceTypeChange("receivable")}
        >
          📥 Invoice Receivable (Clients Pay Us)
        </button>
        <button 
          className={`${styles.toggleBtn} ${invoiceType === "payable" ? styles.toggleBtnActive : ""}`}
          onClick={() => handleInvoiceTypeChange("payable")}
        >
          📤 Invoice Payable (We Pay Contractors)
        </button>
      </div>

      <div className={styles.card}>
        {invoiceType === "payable" && (
          <div className={styles.payableNote}>
            <strong>Invoice Payable Mode:</strong> Includes contractors and 1099 employees with external vendors. Rates from Project Employee Association.
          </div>
        )}
        {invoiceType === "receivable" && (
          <div className={styles.payableNote}>
            <strong>Invoice Receivable Mode:</strong> Bills external clients. If account is internal but client is external,bills the client. Skips when both are internal. Rates from Project.
          </div>
        )}
        
        <div className={styles.controlsGrid}>
          <div className={styles.controlGroup}>
            <label>{invoiceType === "receivable" ? "Account (Client)" : "Vendor"}</label>
            <select 
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All {invoiceType === "receivable" ? "Accounts" : "Vendors"}</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label>{invoiceType === "payable" ? "Contractor/1099" : "Employee"}</label>
            <select 
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">
                {invoiceType === "payable" ? "All Contractors" : "All Employees"}
              </option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.controlGroup}>
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
          </div>

          <div className={styles.controlGroup}>
             <label>Report Type</label>
             <select value={reportType} onChange={e => setReportType(e.target.value)}>
               <option value="weekly">Weekly</option>
               <option value="monthly">Monthly</option>
               <option value="yearly">Yearly</option>
               <option value="custom">Custom Range</option>
             </select>
          </div>

          <div className={styles.controlGroup}>
             <label>Invoice Grouping</label>
             <select value={groupingMode} onChange={e => setGroupingMode(e.target.value)}>
               <option value="combined">All Employees Combined</option>
               <option value="separate">Separate Per Employee</option>
               <option value="projects">Separate Per Project</option>
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
                 <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
               </div>
               <div className={styles.controlGroup}>
                 <label>End</label>
                 <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
               </div>
            </>
          )}
          
          <div className={styles.actionGroup}>
             <button className={styles.btnPrimary} onClick={handleGenerate} disabled={loading}>
                {loading ? "Processing..." : "Generate Invoices"}
             </button>
             <button className={styles.btnPrimary} onClick={handleShowSavedInvoices} style={{background: '#3b82f6'}}>
                💾 Saved Invoices
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
        
        {hasSearched && !loading && !error && invoices.length === 0 && (
          <div className={styles.noResults}>
            <p>No invoices found for the selected filters and period.</p>
          </div>
        )}
      </div>

      {view === "list" && !loading && invoices.length > 0 && (
        <div className={styles.resultsArea}>
          <div className={styles.resultsHeader}>
            <h3>Generated {invoices.length} {invoiceType === "receivable" ? "Receivable" : "Payable"} Invoice{invoices.length > 1 ? 's' : ''}</h3>
            <div style={{display: 'flex', gap: '10px'}}>
              <button className={styles.btnZip} onClick={handleDownloadZip}>
                📦 Download All (ZIP)
              </button>
              {invoiceType === "receivable" && (
                <button 
                  className={styles.btnZip} 
                  onClick={handleSendAllEmails}
                  disabled={sendingAllEmails || sendingEmailIdx !== null}
                  style={{background: (sendingAllEmails) ? '#6b7280' : '#10B981'}}
                >
                  {sendingAllEmails ? '📧 Sending...' : '📧 Save all and Send All Emails'}
                </button>
              )}
            </div>
          </div>
          
          {emailResult && (
            <div style={{
              padding: '15px',
              marginBottom: '20px',
              borderRadius: '8px',
              background: emailResult.type === 'error' ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${emailResult.type === 'error' ? '#fecaca' : '#bbf7d0'}`
            }}>
              {emailResult.type === 'error' ? (
                <p style={{color: '#dc2626', margin: 0}}>❌ Error: {emailResult.message}</p>
              ) : (
                <div>
                  {emailResult.sent.length > 0 && (
                    <p style={{color: '#16a34a', margin: '0 0 10px 0'}}>
                      ✅ Successfully sent to {emailResult.sent.length} account(s): {emailResult.sent.map(s => s.accountName).join(', ')}
                    </p>
                  )}
                  {emailResult.skipped.length > 0 && (
                    <p style={{color: '#ca8a04', margin: '0 0 10px 0'}}>
                      ⚠️ Skipped {emailResult.skipped.length} account(s) (no email): {emailResult.skipped.map(s => s.accountName).join(', ')}
                    </p>
                  )}
                  {emailResult.failed.length > 0 && (
                    <p style={{color: '#dc2626', margin: 0}}>
                      ❌ Failed to send to {emailResult.failed.length} account(s): {emailResult.failed.map(f => `${f.accountName} (${f.error})`).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className={styles.gridList}>
            {invoices.map((inv, idx) => (
              <div key={idx} className={styles.invoiceCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardAccount}>
                    {invoiceType === "receivable" ? inv.accountName : inv.vendorName}
                    {invoiceType === "receivable" && inv.accountEmail && (
                      <div style={{fontSize: '12px', fontWeight: 'normal', marginTop: '2px', opacity: 0.8}}>
                        📧 {inv.accountEmail}
                      </div>
                    )}
                    {(inv.isSeparate || inv.isProjectSeparate) && (
                      <div style={{fontSize: '14px', fontWeight: 'normal', marginTop: '4px'}}>
                        {inv.employees[0].empName}
                        {inv.isProjectSeparate && (
                          <div style={{fontSize: '12px', marginTop: '2px', opacity: 0.9}}>
                            {inv.employees[0].projects[0].projectName}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={styles.cardAmount}>${inv.totalAmount.toFixed(2)}</div>
                </div>
                <div className={styles.cardBody}>
                   <div className={styles.cardRow}>
                     <span>Employees:</span> {inv.employees?.length || 0}
                   </div>
                   <div className={styles.cardRow}>
                     <span>Period:</span> {formatMMDDYYYY(inv.dateRange.start)} - {formatMMDDYYYY(inv.dateRange.end)}
                   </div>
                   <div className={styles.cardRow}>
                     <span>Projects:</span> {inv.employees?.reduce((sum, emp) => sum + (emp.projects?.length || 0), 0) || 0}
                   </div>
                </div>
                <div className={styles.cardActions}>
                   <button className={styles.btnOutline} onClick={() => { setCurrentInvoice(inv); setView("detail"); }}>👁 Preview</button>
                   <button className={styles.btnOutline} onClick={() => handleDownloadSingle(inv)}>📊 Excel</button>
                   {invoiceType === "receivable" && inv.accountEmail && (
                     <button
                       className={styles.btnOutline}
                       onClick={() => handleSendSingleEmail(inv, idx)}
                       disabled={sendingEmailIdx === idx}
                       style={{ background: sendingEmailIdx === idx ? '#6b7280' : '#10B981' }}
                     >
                       {sendingEmailIdx === idx ? '📧 Sending...' : '📧 Save and Send Email'}
                     </button>
                   )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "detail" && currentInvoice && (
        <div className={styles.detailOverlay}>
          <div className={styles.toolbar}>
            <button onClick={() => setView("list")}>← Back</button>
            <button onClick={() => handleDownloadSingle(currentInvoice)}>📥 Download Excel</button>
          </div>

          <div className={styles.paper}>
            <div className={styles.paperHeader}>
               <div className={styles.paperLogo}>
                 {invoiceType === "receivable" ? "INVOICE - RECEIVABLE" : "INVOICE - PAYABLE"}
               </div>
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
                 {currentInvoice.orgDetails.city}, {currentInvoice.orgDetails.state} {currentInvoice.orgDetails.zip}
               </div>
               <div className={styles.addrBox}>
                 <strong>{invoiceType === "receivable" ? "BILL TO (ACCOUNT):" : "PAY TO (VENDOR):"}</strong><br/>
                 {invoiceType === "receivable" ? currentInvoice.accountName : currentInvoice.vendorName}<br/>
                 {currentInvoice.address?.line1}<br/>
                 {currentInvoice.address?.city}, {currentInvoice.address?.zip}
               </div>
            </div>

            <div className={styles.paperBody}>
              {currentInvoice.employees && currentInvoice.employees.map((emp, i) => (
                <div key={i} className={styles.employeeSection}>
                  <div className={styles.employeeTitle}>
                    Employee: {emp.empName}
                  </div>

                  {emp.projects && emp.projects.map((proj, j) => (
                    <div key={j} className={styles.projectSubSection}>
                      <div className={styles.projectName}>
                        Project: {proj.projectName}
                      </div>
                      <div className={styles.projectInfo}>
                        {invoiceType === "payable" && `Account: ${proj.accountName} | `}
                        Rate: ${proj.billRate}/hr | OT: ${proj.otBillRate}/hr
                      </div>

                      {!proj.hasWorked ? (
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
                            {proj.dailyLogs.map((log, k) => (
                              <tr key={k}>
                                <td>{formatMMDDYYYY(log.date)}</td>
                                <td>{log.regularHours}</td>
                                <td>{log.otHours}</td>
                                <td>${log.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className={styles.projTotalRow}>
                               <td colSpan="3">Project Subtotal</td>
                               <td>${proj.subTotal.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                                      ))}

                    {!currentInvoice.isSeparate && !currentInvoice.isProjectSeparate && (
                      <div className={styles.empTotal}>Employee Total: ${emp.totalAmount.toFixed(2)}</div>
                    )}
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

      {view === "saved" && (
        <div className={styles.resultsArea} style={{marginTop: '30px'}}>
          <div className={styles.resultsHeader}>
            <h3>Saved Invoices</h3>
            <button className={styles.btnOutline} onClick={() => setView("list")}>← Back</button>
          </div>

          <div className={styles.card} style={{marginBottom: '20px'}}>
            <div className={styles.controlsGrid}>
              <div className={styles.controlGroup}>
                <label>Start Date</label>
                <input 
                  type="date" 
                  value={savedStartDate}
                  onChange={e => setSavedStartDate(e.target.value)}
                />
              </div>
              <div className={styles.controlGroup}>
                <label>End Date</label>
                <input 
                  type="date" 
                  value={savedEndDate}
                  onChange={e => setSavedEndDate(e.target.value)}
                />
              </div>
              <div className={styles.controlGroup}>
                <label>Recipient Email</label>
                <input 
                  type="email" 
                  value={savedRecipientEmail}
                  onChange={e => setSavedRecipientEmail(e.target.value)}
                  placeholder="Filter by email"
                />
              </div>
              <div className={styles.controlGroup}>
                <label>Status</label>
                <select 
                  value={savedStatus}
                  onChange={e => setSavedStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="SENT">Sent</option>
                  <option value="RESENT">Resent</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
              <div className={styles.actionGroup} style={{gridColumn: '1 / -1'}}>
                <button 
                  className={styles.btnPrimary}
                  onClick={handleLoadSavedInvoices}
                  disabled={savedInvoicesLoading}
                >
                  {savedInvoicesLoading ? 'Loading...' : 'Search'}
                </button>
              </div>
            </div>
          </div>

          {savedInvoices.length === 0 && !savedInvoicesLoading && (
            <div className={styles.noResults}>
              <p>No saved invoices found. Use the filters above to search.</p>
            </div>
          )}

          {savedInvoices.length > 0 && (
            <div style={{overflowX: 'auto'}}>
              <table className={styles.invoiceTable} style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                  <tr style={{background: '#f3f4f6', borderBottom: '2px solid #e5e7eb'}}>
                    <th style={{padding: '12px', textAlign: 'left'}}>Account</th>
                    <th style={{padding: '12px', textAlign: 'left'}}>Period</th>
                    <th style={{padding: '12px', textAlign: 'left'}}>Recipients</th>
                    <th style={{padding: '12px', textAlign: 'left'}}>Amount</th>
                    <th style={{padding: '12px', textAlign: 'left'}}>Sent Date</th>
                    <th style={{padding: '12px', textAlign: 'left'}}>Status</th>
                    <th style={{padding: '12px', textAlign: 'center'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedInvoices.map((invoice, idx) => (
                    <tr key={idx} style={{borderBottom: '1px solid #e5e7eb'}}>
                      <td style={{padding: '12px'}}>{invoice.ACCOUNT_NAME}</td>
                      <td style={{padding: '12px'}}>{invoice.INVOICE_PERIOD}</td>
                      <td style={{padding: '12px', fontSize: '12px'}}>
                        {invoice.recipients ? invoice.recipients.split(',').map((email, i) => (
                          <div key={i}>{email}</div>
                        )) : '-'}
                      </td>
                      <td style={{padding: '12px', fontWeight: 'bold'}}>${parseFloat(invoice.TOTAL_AMOUNT || 0).toFixed(2)}</td>
                      <td style={{padding: '12px'}}>
                        {new Date(invoice.SENT_DATE).toLocaleDateString()}
                      </td>
                      <td style={{padding: '12px'}}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: invoice.STATUS === 'SENT' ? '#dbeafe' : invoice.STATUS === 'RESENT' ? '#fef3c7' : '#fee2e2',
                          color: invoice.STATUS === 'SENT' ? '#1e40af' : invoice.STATUS === 'RESENT' ? '#b45309' : '#dc2626'
                        }}>
                          {invoice.STATUS}
                        </span>
                        {invoice.RESENT_FROM && (
                          <div style={{fontSize: '11px', color: '#f97316', marginTop: '4px'}}>
                            Original: {new Date(invoice.originalSentDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td style={{padding: '12px', textAlign: 'center'}}>
                        <a 
                          href={`/uploads/Invoices/${invoice.PDF_PATH}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            marginRight: '8px',
                            padding: '6px 12px',
                            background: '#3b82f6',
                            color: 'white',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'inline-block'
                          }}
                        >
                          📎 PDF
                        </a>
                        {invoice.STATUS !== 'RESENT' && (
                          <button
                            onClick={() => handleResendInvoice(invoice.SENT_ID, invoice.SENT_DATE)}
                            style={{
                              padding: '6px 12px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            ↩️ Resend
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoiceOverview;
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getEmployeeSummary } from '@/app/serverActions/Performance_Review/summary';
import './summary.css'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; 

// Simply return the string as the backend now handles formatting (MM/DD/YYYY)
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return dateString;
};

const Summary = ({
  employees,
  permissionLevel,
  loggedInEmpId
}) => {
  // --- STATE ---
  const [viewingEmployeeId, setViewingEmployeeId] = useState(null); 
  
  const [searchTerm, setSearchTerm] = useState('');
  // NEW: State for Job Title Filter
  const [selectedJobTitle, setSelectedJobTitle] = useState('all'); 

  const [currentPage, setCurrentPage] = useState(1);
  const [employeesPerPage, setEmployeesPerPage] = useState(10);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [employeesPerPageInput, setEmployeesPerPageInput] = useState('10');

  const [selectedYear, setSelectedYear] = useState('all');
  const [summaryData, setSummaryData] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [isLoading, setIsLoading] = useState(false); 
  const [error, setError] = useState(null);

  // --- EMPLOYEE TABLE LOGIC ---

  const sortedEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    
    const loggedInUser = employees.find(emp => String(emp.empid) === String(loggedInEmpId));
    const otherEmployees = employees
      .filter(emp => String(emp.empid) !== String(loggedInEmpId))
      .sort((a, b) => a.name.localeCompare(b.name));
      
    if (loggedInUser && permissionLevel !== 'individual') {
      const meEmployee = { ...loggedInUser, name: `${loggedInUser.name} (Me)` };
      return [meEmployee, ...otherEmployees];
    }
    return employees.sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, loggedInEmpId, permissionLevel]);

  // NEW: Extract Unique Job Titles for the Dropdown
  const uniqueJobTitles = useMemo(() => {
    if (!sortedEmployees) return [];
    // Extract roles, remove duplicates, filter out null/undefined
    const titles = new Set(sortedEmployees.map(emp => emp.role).filter(Boolean));
    return Array.from(titles).sort();
  }, [sortedEmployees]);

  // MODIFIED: Filter Logic to include Job Title
  const filteredEmployees = useMemo(() => {
    return sortedEmployees.filter(emp => {
      // 1. Check Job Title Filter
      if (selectedJobTitle !== 'all' && emp.role !== selectedJobTitle) {
        return false;
      }

      // 2. Check Search Term
      const lowerSearch = searchTerm.toLowerCase();
      return (
        emp.name.toLowerCase().includes(lowerSearch) ||
        emp.empid.toLowerCase().includes(lowerSearch) ||
        (emp.email && emp.email.toLowerCase().includes(lowerSearch)) ||
        (emp.role && emp.role.toLowerCase().includes(lowerSearch)) ||
        (emp.supervisor_name && emp.supervisor_name.toLowerCase().includes(lowerSearch))
      );
    });
  }, [sortedEmployees, searchTerm, selectedJobTitle]);

  const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * employeesPerPage;
    const end = start + employeesPerPage;
    return filteredEmployees.slice(start, end);
  }, [filteredEmployees, currentPage, employeesPerPage]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setEmployeesPerPageInput(employeesPerPage.toString());
  }, [employeesPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, employeesPerPage, selectedJobTitle]);


  // --- DATA FETCHING ---
  const fetchSummary = useCallback(async () => {
    if (!viewingEmployeeId) return; 

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getEmployeeSummary(viewingEmployeeId, selectedYear);
      if (result.success) {
        setSummaryData(result.data);
        setAvailableYears(result.data.availableYears || []);
      } else {
        throw new Error(result.error || 'Failed to fetch summary.');
      }
    } catch (err) {
      setError(err.message);
      setSummaryData(null); 
    } finally {
      setIsLoading(false);
    }
  }, [viewingEmployeeId, selectedYear]);

  useEffect(() => {
    if (viewingEmployeeId) {
      fetchSummary();
    } else {
      setSummaryData(null);
      setError(null);
    }
  }, [viewingEmployeeId, fetchSummary]); 
  
  useEffect(() => {
    setSelectedYear('all');
  }, [viewingEmployeeId]);

  // --- PDF DOWNLOAD HANDLER ---
  const handleDownloadPdf = () => {
    if (!summaryData) return;

    const { employee, goals, reviews, avgRating } = summaryData;
    const yearLabel = selectedYear === 'all' ? 'All Years' : selectedYear;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let cursorY = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Employee Performance Summary', pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 10;

    // --- Employee Details Card ---
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`Employee Details (${yearLabel})`, margin, cursorY);
    cursorY += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Name: ${employee.name || 'N/A'}`, margin, cursorY);
    doc.text(`Job Title: ${employee.job_title_name || 'N/A'}`, margin + 80, cursorY);
    cursorY += 6;
    doc.text(`Email: ${employee.email || 'N/A'}`, margin, cursorY);
    doc.text(`Supervisor: ${employee.supervisor_name || 'N/A'}`, margin + 80, cursorY);
    cursorY += 6;
    doc.text(`Average Rating: ${avgRating}`, margin, cursorY);
    cursorY += 10;

    // --- Goals Table ---
    if (goals && goals.length > 0) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(`Goals (${yearLabel})`, margin, cursorY);
      cursorY += 8;

      autoTable(doc, { 
        startY: cursorY,
        head: [['Description', 'Start', 'End', '%', 'Employee Comments', 'Supervisor Comments']],
        body: goals.map(g => [
          g.description,
          formatDate(g.start_date), 
          formatDate(g.end_date),  
          `${g.completion_percentage}%`,
          g.employee_comments || '-',
          g.supervisor_comments || '-'
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [248, 250, 252], textColor: [55, 65, 81], fontSize: 8, fontStyle: 'bold' },
        margin: { left: margin, right: margin }
      });
      cursorY = doc.lastAutoTable.finalY + 10; 
    }

    // --- Reviews Table ---
    if (reviews && reviews.length > 0) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(`Reviews (${yearLabel})`, margin, cursorY);
      cursorY += 8;

      autoTable(doc, { 
        startY: cursorY,
        head: [['Supervisor', 'Year', 'Rating', 'Review Text', 'Comments', 'Date']],
        body: reviews.map(r => [
          r.supervisor_name,
          r.review_year,
          r.rating,
          r.review_text,
          r.comments || '-',
          formatDate(r.review_date)
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [248, 250, 252], textColor: [55, 65, 81], fontSize: 8, fontStyle: 'bold' },
        margin: { left: margin, right: margin }
      });
    }
    
    doc.save(`Employee_Summary_${employee.name.replace(/ /g, '_')}_${yearLabel}.pdf`);
  };

  // --- VIEW HANDLERS ---
  const handleEmployeeClick = (empId) => {
    setViewingEmployeeId(empId);
  };

  const handleBackToList = () => {
    setViewingEmployeeId(null);
    setSearchTerm('');
    setSelectedJobTitle('all'); // Reset filter
    setCurrentPage(1);
    setPageInputValue('1');
  };

  // --- PAGINATION HANDLERS ---
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };
  const handlePageInputChange = (e) => setPageInputValue(e.target.value);
  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(pageInputValue, 10);
      if (!isNaN(value) && value >= 1 && value <= totalPages) setCurrentPage(value);
      else setPageInputValue(currentPage.toString());
    }
  };
  const handleEmployeesPerPageInputChange = (e) => setEmployeesPerPageInput(e.target.value);
  const handleEmployeesPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) setEmployeesPerPage(value);
      else setEmployeesPerPageInput(employeesPerPage.toString());
    }
  };

  // --- RENDER 1: List View ---

  if (!viewingEmployeeId) {
    return (
      <div className="employee_goals_container">
        {/* MODIFIED: Header Section with Column Layout */}
        <div className="employee_summary_list-header">
          <h2 className="employee_goals_title">Employee Summary</h2>
          
          <div className="employee_summary_controls_row">
            {permissionLevel !== 'individual' && (
              <>
                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search employees..."
                  className="employee_summary_search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                
                {/* Job Title Filter Dropdown */}
                <select
                  className="employee_summary_filter-select"
                  value={selectedJobTitle}
                  onChange={(e) => setSelectedJobTitle(e.target.value)}
                  style={{ minWidth: '180px' }} // Optional specific style
                >
                  <option value="all">All Job Titles</option>
                  {uniqueJobTitles.map((title, index) => (
                    <option key={index} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        <div className="employee_goals_table-wrapper">
          <table className="employee_goals_table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Email</th>
                <th>Job Title</th>
                <th>Supervisor</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.length > 0 ? (
                paginatedEmployees.map(emp => (
                  <tr key={emp.empid} onClick={() => handleEmployeeClick(emp.empid)} style={{ cursor: 'pointer' }}>
                    <td>{emp.name}</td>
                    <td>{emp.email}</td>
                    <td>{emp.role}</td>
                    <td>{emp.supervisor_name}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="employee_goals_empty-state">
                    No employees found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="employee_goals_pagination-container">
            <button
              className="employee_goals_button employee_goals_cancel"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              style={{ minWidth: '100px' }}
            >
              ← Previous
            </button>
            <span className="employee_goals_pagination-text">
              Page{' '}
              <input
                type="text"
                value={pageInputValue}
                onChange={handlePageInputChange}
                onKeyPress={handlePageInputKeyPress}
                className="employee_goals_pagination-input"
              />{' '}
              of {totalPages}
            </span>
            <button
              className="employee_goals_button employee_goals_save"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              style={{ minWidth: '100px' }}
            >
              Next →
            </button>
          </div>
        )}
        
        <div className="employee_goals_rows-per-page-container">
          <label className="employee_goals_rows-per-page-label">Rows per Page:</label>
          <input
            type="text"
            value={employeesPerPageInput}
            onChange={handleEmployeesPerPageInputChange}
            onKeyPress={handleEmployeesPerPageInputKeyPress}
            placeholder="Rows per page"
            className="employee_goals_rows-per-page-input"
            aria-label="Number of rows per page"
          />
        </div>
      </div>
    );
  }

  // RENDER 2: Employee Detail (Summary View) - Unchanged mostly
  return (
    <div className="employee_summary_container">
      {/* --- Header & Filters --- */}
      <div className="employee_summary_header">
        <h2 className="employee_summary_title">
          {isLoading ? 'Loading...' : (summaryData ? summaryData.employee.name : 'Employee Summary')}
        </h2>
        <div className="employee_summary_filter-container">
          <button
            className="employee_summary_back-button"
            onClick={handleBackToList}
          >
          </button>
          
          <select
            className="employee_summary_filter-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            disabled={isLoading || !summaryData}
          >
            <option value="all">All Years</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          
          <button
            className="employee_summary_pdf-button"
            onClick={handleDownloadPdf}
            disabled={isLoading || !summaryData}
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* --- Content Area --- */}
      <div className="employee_summary_content">
        {isLoading && (
          <div className="employee_summary_loading">Loading summary...</div>
        )}
        
        {error && (
          <div className="employee_summary_error">Error: {error}</div>
        )}
        
        {!isLoading && !error && summaryData && (
          <div id="summary-report-content">
            {/* --- Employee Details Card --- */}
            <div className="employee_summary_card">
              <div className="employee_summary_card-header">
                Employee Details
              </div>
              <div className="employee_summary_card-body">
                <div className="employee_summary_details-grid">
                  <div className="employee_summary_detail-item">
                    <label>Employee Name</label>
                    <p>{summaryData.employee.name || 'N/A'}</p>
                  </div>
                  <div className="employee_summary_detail-item">
                    <label>Job Title</label>
                    <p>{summaryData.employee.job_title_name || 'N/A'}</p>
                  </div>
                  <div className="employee_summary_detail-item">
                    <label>Email</label>
                    <p>{summaryData.employee.email || 'N/A'}</p>
                  </div>
                  <div className="employee_summary_detail-item">
                    <label>Supervisor</label>
                    <p>{summaryData.employee.supervisor_name || 'N/A'}</p>
                  </div>
                  <div className="employee_summary_detail-item">
                    <label>Average Rating ({selectedYear === 'all' ? 'All Years' : selectedYear})</label>
                    <p className="rating">
                      {summaryData.avgRating !== 'N/A' ? summaryData.avgRating : <span className="na">N/A</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* --- Goals Card --- */}
            <div className="employee_summary_card">
              <div className="employee_summary_card-header">
                Goals ({selectedYear === 'all' ? 'All Years' : selectedYear})
              </div>
              <div className="employee_summary_card-body">
                <div className="employee_summary_table-wrapper">
                  <table className="employee_summary_table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Completion %</th>
                        <th>Employee Comments</th>
                        <th>Supervisor Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.goals.length > 0 ? (
                        summaryData.goals.map(goal => (
                          <tr key={goal.id}>
                            <td>{goal.description}</td>
                            <td>{formatDate(goal.start_date)}</td>
                            <td>{formatDate(goal.end_date)}</td>
                            <td>{goal.completion_percentage}%</td>
                            <td>{goal.employee_comments || '-'}</td>
                            <td>{goal.supervisor_comments || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="employee_summary_empty-state">
                            No goals found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            {/* --- Reviews Card --- */}
            <div className="employee_summary_card">
              <div className="employee_summary_card-header">
                Reviews ({selectedYear === 'all' ? 'All Years' : selectedYear})
              </div>
              <div className="employee_summary_card-body">
                <div className="employee_summary_table-wrapper">
                  <table className="employee_summary_table">
                    <thead>
                      <tr>
                        <th>Supervisor</th>
                        <th>Year</th>
                        <th>Date</th>
                        <th>Rating</th>
                        <th>Review Text</th>
                        <th>Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.reviews.length > 0 ? (
                        summaryData.reviews.map(review => (
                          <tr key={review.id}>
                            <td>{review.supervisor_name}</td>
                            <td>{review.review_year}</td>
                            <td>{formatDate(review.review_date)}</td>
                            <td>{review.rating}</td>
                            <td>{review.review_text}</td>
                            <td>{review.comments || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="employee_summary_empty-state">
                            No reviews found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Summary;
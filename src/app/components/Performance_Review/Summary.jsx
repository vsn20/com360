'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getEmployeeSummary } from '@/app/serverActions/Performance_Review/summary';
import './summary.css'; // Import the new CSS file
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Corrected import

// Helper to format dates (YYYY-MM-DD)
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  // Adding timeZone: 'utc' to prevent off-by-one day errors
  return date.toLocaleDateString('en-CA', { timeZone: 'utc' });
};

const Summary = ({
  employees,
  permissionLevel,
  loggedInEmpId
}) => {
  // --- STATE ---
  // View state: null = employee table, ID = summary detail
  const [viewingEmployeeId, setViewingEmployeeId] = useState(null); 
  
  // Employee table state
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [employeesPerPage, setEmployeesPerPage] = useState(10);
  // NEW: State for pagination inputs
  const [pageInputValue, setPageInputValue] = useState('1');
  const [employeesPerPageInput, setEmployeesPerPageInput] = useState('10');

  // Summary detail state
  const [selectedYear, setSelectedYear] = useState('all');
  const [summaryData, setSummaryData] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Start false, load on select
  const [error, setError] = useState(null);

  // --- EMPLOYEE TABLE LOGIC ---

  // Create a sorted list for the employee table with "(Me)"
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

  // Filter employees based on search term
  const filteredEmployees = useMemo(() => {
    return sortedEmployees.filter(emp =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.empid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.email && emp.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.role && emp.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.supervisor_name && emp.supervisor_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [sortedEmployees, searchTerm]);

  // Paginate the filtered employees
  const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * employeesPerPage;
    const end = start + employeesPerPage;
    return filteredEmployees.slice(start, end);
  }, [filteredEmployees, currentPage, employeesPerPage]);

  // --- NEW: Sync pagination inputs ---
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setEmployeesPerPageInput(employeesPerPage.toString());
  }, [employeesPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, employeesPerPage]);


  // --- DATA FETCHING (for Detail View) ---
  
  // Use useCallback to memoize the fetch function
  const fetchSummary = useCallback(async () => {
    if (!viewingEmployeeId) return; // Don't fetch if no employee is selected

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getEmployeeSummary(viewingEmployeeId, selectedYear);
      if (result.success) {
        setSummaryData(result.data);
        // Set the available years for the *newly selected* employee
        setAvailableYears(result.data.availableYears || []);
      } else {
        throw new Error(result.error || 'Failed to fetch summary.');
      }
    } catch (err) {
      setError(err.message);
      setSummaryData(null); // Clear old data on error
    } finally {
      setIsLoading(false);
    }
  }, [viewingEmployeeId, selectedYear]);

  // Fetch data when viewingEmployeeId or selectedYear changes
  useEffect(() => {
    if (viewingEmployeeId) {
      fetchSummary();
    } else {
      // Clear old data when returning to list
      setSummaryData(null);
      setError(null);
    }
  }, [viewingEmployeeId, fetchSummary]); // fetchSummary is memoized
  
  // When the selected employee changes, reset the year filter
  useEffect(() => {
    setSelectedYear('all');
  }, [viewingEmployeeId]);

  // --- PDF DOWNLOAD HANDLER ---
  const handleDownloadPdf = () => {
    if (!summaryData) return;

    const { employee, goals, reviews, avgRating } = summaryData;
    const yearLabel = selectedYear === 'all' ? 'All Years' : selectedYear;

    const doc = new jsPDF();
    const
 
pageWidth = doc.internal.pageSize.getWidth();
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
    doc.text(`Role: ${employee.JOB_TITLE || 'N/A'}`, margin + 80, cursorY);
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

      autoTable(doc, { // Corrected call
        startY: cursorY,
        head: [['Description', 'Start', 'End', '%', 'Employee Comments', 'Supervisor Comments']],
        body: goals.map(g => [
          g.description,
          formatDate(g.start_date), // <-- FIXED
          formatDate(g.end_date),   // <-- FIXED
          `${g.completion_percentage}%`,
          g.employee_comments || '-',
          g.supervisor_comments || '-'
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [248, 250, 252], textColor: [55, 65, 81], fontSize: 8, fontStyle: 'bold' },
        margin: { left: margin, right: margin }
      });
      cursorY = doc.lastAutoTable.finalY + 10; // Corrected property
    }

    // --- Reviews Table ---
    if (reviews && reviews.length > 0) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(`Reviews (${yearLabel})`, margin, cursorY);
      cursorY += 8;

      autoTable(doc, { // Corrected call
        startY: cursorY,
        head: [['Supervisor', 'Year', 'Rating', 'Review Text', 'Comments', 'Date']],
        body: reviews.map(r => [
          r.supervisor_name,
          r.review_year,
          r.rating,
          r.review_text,
          r.comments || '-',
          formatDate(r.review_date) // <-- FIXED
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
    // Reset table state
    setSearchTerm('');
    setCurrentPage(1);
    setPageInputValue('1'); // Reset input
  };

  // --- PAGINATION HANDLERS ---
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };
  // NEW: Handlers for input fields
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

  // --- RENDER ---

  // RENDER 1: Employee List (Table View)
  // --- MODIFIED: Use Employee_Goals_... CSS classes ---
  if (!viewingEmployeeId) {
    return (
      <div className="Employee_Goals_container">
        <div className="Employee_Goals_header-section">
          <h2 className="Employee_Goals_title">Employee Summary</h2>
          <div className="Employee_Goals_search-filter-container">
            {/* Show search only if not 'individual' */}
            {permissionLevel !== 'individual' && (
              <input
                type="text"
                placeholder="Search employees..."
                className="Employee_Goals_search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="Employee_Goals_table-wrapper">
          <table className="Employee_Goals_table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Supervisor</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.length > 0 ? (
                paginatedEmployees.map(emp => (
                  <tr key={emp.empid} onClick={() => handleEmployeeClick(emp.empid)} style={{ cursor: 'pointer' }}>
                    <td>{emp.empid}</td>
                    <td>{emp.name}</td>
                    <td>{emp.email}</td>
                    <td>{emp.role}</td>
                    <td>{emp.supervisor_name}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="Employee_Goals_empty-state">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* --- MODIFIED: Pagination Controls (from Goals.jsx) --- */}
        {totalPages > 1 && (
          <div className="Employee_Goals_pagination-container">
            <button
              className="Employee_Goals_button Employee_Goals_cancel"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              style={{ minWidth: '100px' }}
            >
              ← Previous
            </button>
            <span className="Employee_Goals_pagination-text">
              Page{' '}
              <input
                type="text"
                value={pageInputValue}
                onChange={handlePageInputChange}
                onKeyPress={handlePageInputKeyPress}
                className="Employee_Goals_pagination-input"
              />{' '}
              of {totalPages}
            </span>
            <button
              className="Employee_Goals_button Employee_Goals_save"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              style={{ minWidth: '100px' }}
            >
              Next →
            </button>
          </div>
        )}
        
        {/* --- MODIFIED: Rows Per Page (from Goals.jsx) --- */}
        <div className="Employee_Goals_rows-per-page-container">
          <label className="Employee_Goals_rows-per-page-label">Rows per Page:</label>
          <input
            type="text"
            value={employeesPerPageInput}
            onChange={handleEmployeesPerPageInputChange}
            onKeyPress={handleEmployeesPerPageInputKeyPress}
            placeholder="Rows per page"
            className="Employee_Goals_rows-per-page-input"
            aria-label="Number of rows per page"
          />
        </div>
      </div>
    );
  }

  // RENDER 2: Employee Detail (Summary View)
  // --- This section remains styled by summary.css ---
  return (
    <div className="Employee_Summary_container">
      {/* --- Header & Filters --- */}
      <div className="Employee_Summary_header">
        <h2 className="Employee_Summary_title">
          {isLoading ? 'Loading...' : (summaryData ? summaryData.employee.name : 'Employee Summary')}
        </h2>
        <div className="Employee_Summary_filter-container">
          <button
            className="Employee_Summary_back-button"
            onClick={handleBackToList}
          >
            &larr; Back to List
          </button>
          
          <select
            className="Employee_Summary_filter-select"
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
            className="Employee_Summary_pdf-button"
            onClick={handleDownloadPdf}
            disabled={isLoading || !summaryData}
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* --- Content Area --- */}
      <div className="Employee_Summary_content">
        {isLoading && (
          <div className="Employee_Summary_loading">Loading summary...</div>
        )}
        
        {error && (
          <div className="Employee_Summary_error">Error: {error}</div>
        )}
        
        {!isLoading && !error && summaryData && (
          <div id="summary-report-content">
            {/* --- Employee Details Card --- */}
            <div className="Employee_Summary_card">
              <div className="Employee_Summary_card-header">
                Employee Details
              </div>
              <div className="Employee_Summary_card-body">
                <div className="Employee_Summary_details-grid">
                  <div className="Employee_Summary_detail-item">
                    <label>Name</label>
                    <p>{summaryData.employee.name || 'N/A'}</p>
                  </div>
                  <div className="Employee_Summary_detail-item">
                    <label>Role</label>
                    <p>{summaryData.employee.JOB_TITLE || 'N/A'}</p>
                  </div>
                  <div className="Employee_Summary_detail-item">
                    <label>Email</label>
                    <p>{summaryData.employee.email || 'N/A'}</p>
                  </div>
                  <div className="Employee_Summary_detail-item">
                    <label>Supervisor</label>
                    <p>{summaryData.employee.supervisor_name || 'N/A'}</p>
                  </div>
                  <div className="Employee_Summary_detail-item">
                    <label>Average Rating ({selectedYear === 'all' ? 'All Years' : selectedYear})</label>
                    <p className="rating">
                      {summaryData.avgRating !== 'N/A' ? summaryData.avgRating : <span className="na">N/A</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* --- Goals Card --- */}
            <div className="Employee_Summary_card">
              <div className="Employee_Summary_card-header">
                Goals ({selectedYear === 'all' ? 'All Years' : selectedYear})
              </div>
              <div className="Employee_Summary_card-body">
                <div className="Employee_Summary_table-wrapper">
                  <table className="Employee_Summary_table">
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
                          <td colSpan="6" className="Employee_Summary_empty-state">
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
            <div className="Employee_Summary_card">
              <div className="Employee_Summary_card-header">
                Reviews ({selectedYear === 'all' ? 'All Years' : selectedYear})
              </div>
              <div className="Employee_Summary_card-body">
                <div className="Employee_Summary_table-wrapper">
                  <table className="Employee_Summary_table">
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
                          <td colSpan="6" className="Employee_Summary_empty-state">
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
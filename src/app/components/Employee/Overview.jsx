'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './overview.css';
import Image from 'next/image'; 
import AddEmployee from './AddEmployee';
import EditEmployee from './EditEmployee';
import readXlsxFile from 'read-excel-file';
import { importEmployeesBatch } from '@/app/serverActions/addemployee';

const Overview = ({
  roles,
  currentrole,
  orgid,
  error: initialError,
  employees,
  leaveTypes,
  countries,
  states,
  departments,
  payFrequencies,
  jobTitles,
  statuses,
  workerCompClasses,
  timestamp,
  suborgs,
  document_types,
  document_purposes,
  document_subtypes,
  employmentTypes,
  loggedInEmpId,      
  permissionLevel,
  immigrationStatuses,
  immigrationDocTypes,
  immigrationDocSubtypes,
  paf_document_types,
  paf_document_subtypes,
  paf_document_statuses,
  fdns_document_types,
  fdns_document_subtypes,
  fdns_document_statuses,
  vendors,
  org_name    
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [allEmployees, setAllEmployees] = useState(employees);
  const [issadd, setisadd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [employeesPerPage, setEmployeesPerPage] = useState(10);
  const [employeesPerPageInput, setEmployeesPerPageInput] = useState('10');
  const [sortConfig, setSortConfig] = useState({ column: 'empid', direction: 'asc' });
  const [error, setError] = useState(initialError);
  const [hasMounted, setHasMounted] = useState(false);
  
  // --- NEW STATES FOR IMPORT ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatusMsg, setImportStatusMsg] = useState(null);

  const router = useRouter();
  const searchparams = useSearchParams();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const sortedEmployees = [...employees].sort((a, b) => sortEmployees(a, b, sortConfig.column, sortConfig.direction));
    setAllEmployees(sortedEmployees);
  }, [sortConfig, employees]);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);
 
  useEffect(() => {
    handleBackClick();
  }, [searchparams.get('refresh')]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setEmployeesPerPageInput(employeesPerPage.toString());
  }, [employeesPerPage]);

  const handleRowClick = (empid) => {
    setSelectedEmpId(empid);
    setisadd(false);
    setError(null);
  };

  const handleBackClick = () => {
    router.refresh();
    setSelectedEmpId(null);
    setisadd(false);
    setError(null);
    router.refresh();
  };

  const handleaddemployee = () => {
    setSelectedEmpId(null);
    setError(null);
    setisadd(true);
  };

  // --- IMPORT LOGIC START ---

  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
    setImportFile(null);
    setImportStatusMsg(null);
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setImportFile(file);
  };

  // Helper to parse MM-DD-YYYY to YYYY-MM-DD
  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    
    if (dateStr instanceof Date) {
        return dateStr.toISOString().split('T')[0];
    }

    if (typeof dateStr === 'string') {
        const parts = dateStr.split('-'); 
        if (parts.length === 3) {
            const mm = parts[0];
            const dd = parts[1];
            const yyyy = parts[2];
            return `${yyyy}-${mm}-${dd}`;
        }
    }
    return null;
  };

  const processImport = async () => {
    if (!importFile) {
        setImportStatusMsg({ type: 'error', text: 'Please select a file first.' });
        return;
    }

    setImportLoading(true);
    setImportStatusMsg(null);

    try {
        const rows = await readXlsxFile(importFile);
        
        const dataRows = rows.slice(1); // Remove header
        
        if (dataRows.length === 0) {
            setImportStatusMsg({ type: 'error', text: 'File appears to be empty.' });
            setImportLoading(false);
            return;
        }

        const formattedEmployees = [];
        const invalidRows = [];

        // Loop through rows: 
        // FirstName(0), LastName(1), Email(2), Roles(3), HireDate(4), Status(5)
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const firstName = row[0];
            const lastName = row[1];
            const email = row[2];
            const rolesStr = row[3]; 
            const hireDateRaw = row[4];
            const statusRaw = row[5];

            if (!email || !firstName) {
                invalidRows.push(i + 2);
                continue;
            }

            // 1. Map Roles
            const roleIds = [];
            if (rolesStr && roles && Array.isArray(roles)) {
                const roleNames = rolesStr.toString().split(',').map(r => r.trim().toLowerCase());
                
                roles.forEach(dbRole => {
                    if (dbRole.rolename && roleNames.includes(dbRole.rolename.toLowerCase())) {
                        roleIds.push(dbRole.roleid);
                    }
                });
            }

            // 2. Map Status (Fixed Logic)
            let finalStatus = 'Active'; 
            
            if (statusRaw && statuses && Array.isArray(statuses)) {
                const inputStatusLower = statusRaw.toString().trim().toLowerCase();
                
                // Find matching status safely (handling Strings and Objects)
                const matchedStatus = statuses.find(s => {
                    if (typeof s === 'string') {
                        return s.toLowerCase() === inputStatusLower;
                    } 
                    if (s && typeof s === 'object') {
                        const name = s.Name || s.name || s.status || '';
                        return name.toLowerCase() === inputStatusLower;
                    }
                    return false;
                });

                if (matchedStatus) {
                    if (typeof matchedStatus === 'string') {
                        finalStatus = matchedStatus;
                    } else if (typeof matchedStatus === 'object') {
                        // Extract Name if object, fallback to 'Active'
                        finalStatus = matchedStatus.Name || matchedStatus.name || 'Active';
                    }
                }
            }

            // 3. Format Date
            const formattedHireDate = parseDateString(hireDateRaw);

            formattedEmployees.push({
                firstName,
                lastName,
                email,
                roleIds,
                hireDate: formattedHireDate,
                status: finalStatus
            });
        }

        const result = await importEmployeesBatch(formattedEmployees);

        if (result.error) {
            setImportStatusMsg({ type: 'error', text: result.error });
        } else {
            let msg = `Successfully added ${result.addedCount} employees.`;
            if (result.skippedCount > 0) {
                msg += ` Skipped ${result.skippedCount} duplicates.`;
            }
            if (result.skippedEmails && result.skippedEmails.length > 0) {
                 msg += ` (Skipped: ${result.skippedEmails.join(', ')})`;
            }
            setImportStatusMsg({ type: 'success', text: msg });
            
            if (result.addedCount > 0) {
                setTimeout(() => {
                    handleCloseImportModal();
                    router.refresh();
                }, 3000);
            }
        }

    } catch (err) {
        console.error("Import parsing error:", err);
        setImportStatusMsg({ type: 'error', text: 'Failed to parse file. Ensure it is a valid Excel (.xlsx) file.' });
    } finally {
        setImportLoading(false);
    }
  };

  // --- IMPORT LOGIC END ---

  const sortEmployees = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'empid':
        aValue = parseInt(a.empid.split('_')[1] || a.empid);
        bValue = parseInt(b.empid.split('_')[1] || b.empid);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'name':
        aValue = (a.EMP_PREF_NAME || `${a.EMP_FST_NAME} ${a.EMP_MID_NAME || ''} ${a.EMP_LAST_NAME}`.trim()).toLowerCase();
        bValue = (b.EMP_PREF_NAME || `${b.EMP_FST_NAME} ${b.EMP_MID_NAME || ''} ${b.EMP_LAST_NAME}`.trim()).toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'hireDate':
        aValue = a.HIRE ? new Date(a.HIRE).getTime() : 0;
        bValue = b.HIRE ? new Date(b.HIRE).getTime() : 0;
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'gender':
        aValue = a.GENDER || '';
        bValue = b.GENDER || '';
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      default:
        return 0;
    }
  };

  const requestSort = (column) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleGenderFilterChange = (e) => {
    setGenderFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleEmployeesPerPageInputChange = (e) => {
    setEmployeesPerPageInput(e.target.value);
  };

  const handleEmployeesPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setEmployeesPerPage(value);
        setEmployeesPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setEmployeesPerPageInput(employeesPerPage.toString());
      }
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      setPageInputValue((currentPage + 1).toString());
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setPageInputValue((currentPage - 1).toString());
    }
  };

  const handlePageInputChange = (e) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(pageInputValue, 10);
      if (!isNaN(value) && value >= 1 && value <= totalPages) {
        setCurrentPage(value);
        setPageInputValue(value.toString());
      } else {
        setPageInputValue(currentPage.toString());
      }
    }
  };

  const uniqueStatus = [...new Set(allEmployees.map(emp => emp.STATUS).filter(Boolean))];

  const filteredEmployees = allEmployees.filter(emp => {
    const fullName = (emp.EMP_PREF_NAME || `${emp.EMP_FST_NAME} ${emp.EMP_MID_NAME || ''} ${emp.EMP_LAST_NAME}`.trim()).toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || emp.empid.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = genderFilter === 'all' || emp.STATUS === genderFilter;
    return matchesSearch && matchesGender;
  });

  const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage);
  const indexOfLastEmployee = currentPage * employeesPerPage;
  const indexOfFirstEmployee = indexOfLastEmployee - employeesPerPage;
  const currentEmployees = filteredEmployees.slice(indexOfFirstEmployee, indexOfLastEmployee);

  return (
    <div className="roles-overview-container">
      {error && <div className="error-message">{error}</div>}
      
      {issadd ? (
        <AddEmployee 
            roles={roles}
            statuses={statuses}
            jobTitles={jobTitles}
            payFrequencies={payFrequencies}
            departments={departments}
            workerCompClasses={workerCompClasses}
            employmentTypes={employmentTypes}
            suborgs={suborgs}
            states={states}
            countries={countries}
            leaveTypes={leaveTypes}
            employees={employees} 
            currentrole={currentrole}
            orgid={orgid}
            vendors={vendors}
            onBack={handleBackClick}
        />
      ) : selectedEmpId ? (
        <EditEmployee 
            selectedEmpId={selectedEmpId}
            roles={roles}
            orgid={orgid}
            employees={allEmployees} 
            leaveTypes={leaveTypes}
            countries={countries}
            states={states}
            departments={departments}
            payFrequencies={payFrequencies}
            jobTitles={jobTitles}
            statuses={statuses}
            workerCompClasses={workerCompClasses}
            suborgs={suborgs}
            document_types={document_types}
            document_purposes={document_purposes}
            document_subtypes={document_subtypes}
            employmentTypes={employmentTypes}
            immigrationStatuses={immigrationStatuses}
            immigrationDocTypes={immigrationDocTypes}
            immigrationDocSubtypes={immigrationDocSubtypes}
            paf_document_types={paf_document_types}
            paf_document_subtypes={paf_document_subtypes}
            paf_document_statuses={paf_document_statuses}
            fdns_document_types={fdns_document_types}
            fdns_document_subtypes={fdns_document_subtypes}
            fdns_document_statuses={fdns_document_statuses}
            loggedInEmpId={loggedInEmpId}
            permissionLevel={permissionLevel}
            onBack={handleBackClick}
            org_name={org_name}
            vendors={vendors}
        />
      ) : (
        <div className="roles-list">
          <div className="header-section">
            <h2 className="title">Employees</h2>
            <div className="header-buttons">
                {/* IMPORT BUTTON */}
                <button 
                  className="button import-btn" 
                  onClick={handleOpenImportModal}
                  style={{marginRight: '10px', backgroundColor: '#6c757d', color: 'white'}}
                >
                  Import Employee File
                </button>
                <button className="button save" onClick={handleaddemployee}>Add Employee</button>
            </div>
          </div>
          
          <div className="search-filter-container">
            <input
              type="text"
              placeholder="Search by Name or Emp ID"
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
            <select
              value={genderFilter}
              onChange={handleGenderFilterChange}
              className="filter-select"
            >
              <option value="all">Status</option>
              {uniqueStatus.map((gender) => (
                <option key={gender} value={gender}>{gender}</option>
              ))}
            </select>
          </div>
          
          {hasMounted && (
            <>
              {employees.length === 0 && !error ? (
                <div className="empty-state">
                  <p>No employees found for your permission level.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="six-column">
                    <colgroup>
                      <col />
                      <col />
                      <col />
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th 
                          className={`sortable ${sortConfig.column === 'empid' ? `sort-${sortConfig.direction}` : ''}`}
                          onClick={() => requestSort('empid')}
                        >
                          Employee Number
                        </th>
                        <th 
                          className={`sortable ${sortConfig.column === 'name' ? `sort-${sortConfig.direction}` : ''}`}
                          onClick={() => requestSort('name')}
                        >
                          Name
                        </th>
                        <th>Email</th>
                        <th 
                          className={`sortable ${sortConfig.column === 'hireDate' ? `sort-${sortConfig.direction}` : ''}`}
                          onClick={() => requestSort('hireDate')}
                        >
                          Hire Date
                        </th>
                        <th>Mobile</th>
                        <th>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentEmployees.map((employee) => (
                        <tr
                          key={employee.empid}
                          onClick={() => handleRowClick(employee.empid)}
                          className={selectedEmpId === employee.empid ? 'selected-row' : ''}
                        >
                          <td>
                            <span className={employee.STATUS.toLowerCase() === 'active' ? 'role-indicator' : 'role-indicatorinactive '}></span>
                            {employee.employee_number || 'Not Configured'}
                          </td>
                          <td>{employee.EMP_PREF_NAME || `${employee.EMP_FST_NAME} ${employee.EMP_MID_NAME || ''} ${employee.EMP_LAST_NAME}`.trim()}</td>
                          <td>{employee.email}</td>
                          <td>{employee.formattedHireDate}</td>
                          <td>{employee.MOBILE_NUMBER || '-'}</td>
                          <td>
                            {employee.STATUS && (
                              <span className={`status-badge ${employee.STATUS.toLowerCase() === 'active' ? 'active' : 'inactive'}`}>
                                {employee.STATUS}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {filteredEmployees.length > employeesPerPage && (
                <div className="pagination-container">
                  <button
                    className="button"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  <span className="pagination-text">
                    Page{' '}
                    <input
                      type="text"
                      value={pageInputValue}
                      onChange={handlePageInputChange}
                      onKeyPress={handlePageInputKeyPress}
                      className="pagination-input"
                    />{' '}
                    of {totalPages}
                  </span>
                  <button
                    className="button"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
              
              <div className="rows-per-page-container">
                <label className="rows-per-page-label">Rows per Page:</label>
                <input
                  type="text"
                  value={employeesPerPageInput}
                  onChange={handleEmployeesPerPageInputChange}
                  onKeyPress={handleEmployeesPerPageInputKeyPress}
                  placeholder="Employees per page"
                  className="rows-per-page-input"
                  aria-label="Number of rows per page"
                />
              </div>
            </>
          )}

        </div>
      )}

      {/* --- IMPORT MODAL --- */}
      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content import-modal">
             <div className="modal-header">
                <h3>Import Employees</h3>
                <button className="close-btn" onClick={handleCloseImportModal}>&times;</button>
             </div>
             
             <div className="modal-body">
                <div className="info-box">
                    <p><strong>Required Format (.xlsx):</strong></p>
                    <p>Row 1: Headers (First Name, Last Name, Email, Roles, Hire Date, Status)</p>
                    <p>Row 2+: Data</p>
                    <ul style={{fontSize:'12px', marginTop:'5px', paddingLeft:'20px'}}>
                        <li><strong>Roles:</strong> Comma separated (e.g. "Admin, User")</li>
                        <li><strong>Hire Date:</strong> Format MM-DD-YYYY</li>
                        <li><strong>Status:</strong> e.g. "Active" or "Inactive"</li>
                    </ul>
                </div>

                <div className="file-input-container">
                    <input 
                        type="file" 
                        accept=".xlsx, .xls"
                        onChange={handleFileChange} 
                        className="file-input"
                    />
                </div>

                {importStatusMsg && (
                    <div className={`status-message ${importStatusMsg.type}`}>
                        {importStatusMsg.text}
                    </div>
                )}
             </div>

             <div className="modal-footer">
                <button className="button cancel" onClick={handleCloseImportModal}>Cancel</button>
                <button 
                    className="button save" 
                    onClick={processImport}
                    disabled={importLoading || !importFile}
                >
                    {importLoading ? 'Importing...' : 'Submit Import'}
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Overview;
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './overview.css';
import Image from 'next/image'; 
import AddEmployee from './AddEmployee';
import EditEmployee from './EditEmployee';
import readXlsxFile from 'read-excel-file';

import { importEmployeesBatch } from '@/app/serverActions/addemployee';
import { notifyEmployee } from '@/app/serverActions/Employee/overview'; 

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
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatusMsg, setImportStatusMsg] = useState(null);

  const [notifyingMap, setNotifyingMap] = useState({});

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
 
  const handleRowClick = (empid, e) => {
    if (e.target.closest('.notify-btn')) return;
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

  const handleNotify = async (e, employee) => {
    e.stopPropagation();
    if (!employee.email) {
      alert("This employee does not have an email address.");
      return;
    }

    setNotifyingMap(prev => ({ ...prev, [employee.empid]: true }));

    const result = await notifyEmployee(employee.email, employee.EMP_FST_NAME);

    setNotifyingMap(prev => ({ ...prev, [employee.empid]: false }));

    if (result.success) {
      alert(result.message);
      router.refresh(); 
    } else {
      alert(result.error);
    }
  };

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
        
        if (rows.length === 0) {
            setImportStatusMsg({ type: 'error', text: 'File appears to be empty.' });
            setImportLoading(false);
            return;
        }

        // ✅ STEP 1: VALIDATE HEADERS (MUST BE IN ORDER)
        const headerRow = rows[0];
        const expectedHeaders = ['First Name', 'Last Name', 'Email', 'Roles', 'Hire Date', 'Status'];
        
        // Check if we have enough columns
        if (headerRow.length < expectedHeaders.length) {
            setImportStatusMsg({ 
                type: 'error', 
                text: `Invalid file format. Expected ${expectedHeaders.length} columns but found ${headerRow.length}.` 
            });
            setImportLoading(false);
            return;
        }

        // Check if headers match exactly (case-insensitive, trimmed)
        const headersMatch = expectedHeaders.every((expected, index) => {
            const actual = headerRow[index] ? headerRow[index].toString().trim().toLowerCase() : '';
            return actual === expected.toLowerCase();
        });

        if (!headersMatch) {
            const actualHeaders = headerRow
                .slice(0, expectedHeaders.length)
                .map(h => h ? h.toString().trim() : '(empty)')
                .join(', ');
            setImportStatusMsg({ 
                type: 'error', 
                text: `Headers are not in the correct order. Expected: ${expectedHeaders.join(', ')}. Found: ${actualHeaders}` 
            });
            setImportLoading(false);
            return;
        }

        const dataRows = rows.slice(1); // Skip header row
        
        if (dataRows.length === 0) {
            setImportStatusMsg({ type: 'error', text: 'File contains no data rows.' });
            setImportLoading(false);
            return;
        }

        const formattedEmployees = [];
        const skippedRows = [];
        
        // ✅ STEP 2: PROCESS EACH DATA ROW WITH VALIDATION
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed
            
            // Extract values from columns (matching header order)
            const firstName = row[0] ? row[0].toString().trim() : '';
            const lastName = row[1] ? row[1].toString().trim() : '';
            const email = row[2] ? row[2].toString().trim() : '';
            const rolesStr = row[3]; 
            const hireDateRaw = row[4];
            const statusRaw = row[5];

            // ✅ VALIDATION 1: Check required fields
            if (!email || !firstName || !lastName) {
                skippedRows.push({ 
                    row: rowNumber, 
                    reason: 'Missing required fields (First Name, Last Name, or Email)' 
                });
                continue;
            }

            // ✅ VALIDATION 2: Validate and match roles with database
            const roleIds = [];
            let hasInvalidRole = false;
            const processedRoleNames = new Set(); // Track unique role names to avoid duplicates
            
            if (rolesStr && roles && Array.isArray(roles)) {
                const roleNames = rolesStr.toString().split(',').map(r => r.trim().toLowerCase());
                
                for (const roleName of roleNames) {
                    if (!roleName) continue; // Skip empty role names
                    
                    // Skip if this role name was already processed (e.g., "HR, HR" -> only process once)
                    if (processedRoleNames.has(roleName)) {
                        continue;
                    }
                    
                    // Find matching role in database (case-insensitive)
                    const matchedRole = roles.find(dbRole => 
                        dbRole.rolename && dbRole.rolename.toLowerCase() === roleName
                    );
                    
                    if (matchedRole) {
                        // Add role ID only if not already added (extra safety)
                        if (!roleIds.includes(matchedRole.roleid)) {
                            roleIds.push(matchedRole.roleid);
                        }
                        processedRoleNames.add(roleName); // Mark this role name as processed
                    } else {
                        // Role doesn't exist in database - mark as invalid
                        hasInvalidRole = true;
                        skippedRows.push({ 
                            row: rowNumber, 
                            reason: `Invalid role "${roleName}" does not exist in the system` 
                        });
                        break; // Stop processing this row
                    }
                }
            }

            // Skip this row if it has any invalid roles
            if (hasInvalidRole) {
                continue;
            }

            // Skip if no valid roles were found
            if (roleIds.length === 0) {
                skippedRows.push({ 
                    row: rowNumber, 
                    reason: 'No valid roles provided' 
                });
                continue;
            }

            // ✅ VALIDATION 3: Match status with database
            let finalStatus = 'Active'; // Default status
            if (statusRaw && statuses && Array.isArray(statuses)) {
                const inputStatusLower = statusRaw.toString().trim().toLowerCase();
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
                        finalStatus = matchedStatus.Name || matchedStatus.name || 'Active';
                    }
                }
            }

            // ✅ VALIDATION 4: Parse and format hire date
            const formattedHireDate = parseDateString(hireDateRaw);

            // Add validated employee to batch
            formattedEmployees.push({
                firstName,
                lastName,
                email,
                roleIds,
                hireDate: formattedHireDate,
                status: finalStatus
            });
        }

        // ✅ STEP 3: Check if any valid employees remain after validation
        if (formattedEmployees.length === 0) {
            let errorMsg = 'No valid employees to import.';
            if (skippedRows.length > 0) {
                errorMsg += ` All ${skippedRows.length} rows were skipped due to validation errors.`;
            }
            setImportStatusMsg({ 
                type: 'error', 
                text: errorMsg
            });
            setImportLoading(false);
            return;
        }

        // ✅ STEP 4: Send validated data to server
        const result = await importEmployeesBatch(formattedEmployees);

        if (result.error) {
            setImportStatusMsg({ type: 'error', text: result.error });
        } else {
            // Build success message
            let msg = `Successfully added ${result.addedCount} employee${result.addedCount !== 1 ? 's' : ''}.`;
            
            if (result.skippedCount > 0) {
                msg += ` ${result.skippedCount} duplicate email${result.skippedCount !== 1 ? 's' : ''} skipped.`;
            }
            
            if (skippedRows.length > 0) {
                msg += ` ${skippedRows.length} row${skippedRows.length !== 1 ? 's' : ''} skipped due to validation errors.`;
            }
            
            // Log detailed skip reasons to console for debugging
            if (skippedRows.length > 0) {
                console.log('=== SKIPPED ROWS DETAILS ===');
                skippedRows.forEach(skip => {
                    console.log(`Row ${skip.row}: ${skip.reason}`);
                });
                console.log('===========================');
            }
            
            setImportStatusMsg({ type: 'success', text: msg });
            
            // Refresh page after successful import
            if (result.addedCount > 0) {
                setTimeout(() => {
                    handleCloseImportModal();
                    router.refresh();
                }, 3000);
            }
        }

    } catch (err) {
        console.error("Import parsing error:", err);
        setImportStatusMsg({ 
            type: 'error', 
            text: 'Failed to parse file. Ensure it is a valid Excel (.xlsx) file with the correct format.' 
        });
    } finally {
        setImportLoading(false);
    }
};
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
                      <col style={{width: '10%'}} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className={`sortable ${sortConfig.column === 'empid' ? `sort-${sortConfig.direction}` : ''}`} onClick={() => requestSort('empid')}>Employee Number</th>
                        <th className={`sortable ${sortConfig.column === 'name' ? `sort-${sortConfig.direction}` : ''}`} onClick={() => requestSort('name')}>Name</th>
                        <th>Email</th>
                        <th className={`sortable ${sortConfig.column === 'hireDate' ? `sort-${sortConfig.direction}` : ''}`} onClick={() => requestSort('hireDate')}>Hire Date</th>
                        <th>Mobile</th>
                        <th>Status</th>
                        <th>Action</th> 
                      </tr>
                    </thead>
                    <tbody>
                      {currentEmployees.map((employee) => (
                        <tr
                          key={employee.empid}
                          onClick={(e) => handleRowClick(employee.empid, e)}
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
                          <td>
                            {employee.isRegistered ? (
                               <span style={{fontSize: '12px', color: '#0fd46c', fontWeight:'bold'}}>Registered</span>
                            ) : (
                               <button 
                                className="button notify-btn"
                                onClick={(e) => handleNotify(e, employee)}
                                disabled={notifyingMap[employee.empid]}
                                style={{
                                  padding: '4px 10px', 
                                  fontSize: '12px', 
                                  backgroundColor: '#ff9800', 
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                {notifyingMap[employee.empid] ? 'Sending...' : 'Notify'}
                              </button>
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
                  <button className="button" onClick={handlePrevPage} disabled={currentPage === 1}>← Previous</button>
                  <span className="pagination-text">Page <input type="text" value={pageInputValue} onChange={handlePageInputChange} onKeyPress={handlePageInputKeyPress} className="pagination-input"/> of {totalPages}</span>
                  <button className="button" onClick={handleNextPage} disabled={currentPage === totalPages}>Next →</button>
                </div>
              )}
              
              <div className="rows-per-page-container">
                <label className="rows-per-page-label">Rows per Page:</label>
                <input type="text" value={employeesPerPageInput} onChange={handleEmployeesPerPageInputChange} onKeyPress={handleEmployeesPerPageInputKeyPress} placeholder="Employees per page" className="rows-per-page-input" aria-label="Number of rows per page"/>
              </div>
            </>
          )}

        </div>
      )}

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
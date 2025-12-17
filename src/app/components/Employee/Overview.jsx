'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './overview.css';
import Image from 'next/image'; 
import AddEmployee from './AddEmployee';
import EditEmployee from './EditEmployee';

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
            loggedInEmpId={loggedInEmpId}
            permissionLevel={permissionLevel}
            onBack={handleBackClick}
            org_name={org_name}
        />
      ) : (
        <div className="roles-list">
          <div className="header-section">
            <h2 className="title">Employees</h2>
            <button className="button save" onClick={handleaddemployee}>Add Employee</button>
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
                          <td className="id-cell">
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
    </div>
  );
};

export default Overview;
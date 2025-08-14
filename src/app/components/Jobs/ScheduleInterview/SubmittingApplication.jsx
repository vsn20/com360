'use client';
import React, { useState, useEffect } from 'react';
import Scheduling from './Scheduling';
import { useRouter, useSearchParams } from 'next/navigation';
import './jobtitles.css';

const SubmittingApplication = ({ applieddetails, orgid, empid, handlesback }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedid, setselectedid] = useState(null);
  const [selectedname, setselectedname] = useState(null);
  const [allAppliedDetails, setAllAppliedDetails] = useState(applieddetails);
  const [sortConfig, setSortConfig] = useState({ column: 'applicationid', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rowsPerPageInput, setRowsPerPageInput] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '';
  };

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  useEffect(() => {
    setAllAppliedDetails(applieddetails);
  }, [applieddetails]);

  useEffect(() => {
    handleback();
  }, [searchParams.get('refresh')]);

  useEffect(() => {
    const sortedDetails = [...applieddetails].sort((a, b) => sortDetails(a, b, sortConfig.column, sortConfig.direction));
    setAllAppliedDetails(sortedDetails);
  }, [sortConfig, applieddetails]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const sortDetails = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'applicationid':
        aValue = parseInt(a.applicationid.split('-')[1] || a.applicationid);
        bValue = parseInt(b.applicationid.split('-')[1] || b.applicationid);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'status':
        aValue = (a.status || '').toLowerCase();
        bValue = (b.status || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      default:
        return 0;
    }
  };

  const requestSort = (column) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleback = () => {
    router.refresh();
    setselectedid(null);
    setselectedname(null);
    setSearchQuery('');
    setStatusFilter('all');
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handlesubmit = (id, first, second) => {
    setselectedid(id);
    setselectedname(`${first} ${second}`);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
      setPageInputValue((currentPage + 1).toString());
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
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

  const handleRowsPerPageInputChange = (e) => {
    setRowsPerPageInput(e.target.value);
  };

  const handleRowsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setRowsPerPage(value);
        setRowsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setRowsPerPageInput(rowsPerPage.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      }
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const filteredDetails = allAppliedDetails.filter((detail) => {
    const candidateName = `${detail.first_name} ${detail.last_name}`.toLowerCase();
    const jobName = detail.display_job_name.toLowerCase();
    const matchesSearch = candidateName.includes(searchQuery.toLowerCase()) || jobName.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || detail.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredDetails.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentDetails = filteredDetails.slice(indexOfFirstRow, indexOfLastRow);

  const uniqueStatuses = [...new Set(applieddetails.map((detail) => detail.status))];

  return (
    <div className="employee-overview-container">
      {selectedid ? (
        <div className="employee-details-container">
          <div className="header-section">
            <h1 className="title">Schedule Interview</h1>
            <button className="back-button" onClick={handleback}>Back</button>
          </div>
          <Scheduling
            id={selectedid}
            name={selectedname}
            orgid={orgid}
            empid={empid}
            handleback={handleback}
          />
        </div>
      ) : (
        <div className="employee-list">
          <div className="header-section">
            <h1 className="title">Applications</h1>
           
          </div>
          <div className="search-filter-container">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
              placeholder="Search by Name or Job..."
            />
            <select value={statusFilter} onChange={handleStatusFilterChange} className="filter-select">
              <option value="all">All Statuses</option>
              {uniqueStatuses.map((status, index) => (
                <option key={index} value={status}>{status}</option>
              ))}
            </select>
          </div>
          {currentDetails.length === 0 ? (
            <div className="empty-state">No applications found.</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="service-requests-table">
                  <thead>
                    <tr>
                      <th className={sortConfig.column === 'applicationid' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('applicationid')}>
                        Application ID
                      </th>
                      <th>Candidate ID</th>
                      <th>Candidate Name</th>
                      <th>Job Name-Job ID</th>
                      <th>Applied Date</th>
                      <th className={sortConfig.column === 'status' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('status')}>
                        Status
                      </th>
                      <th>Resume</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDetails.map((detail) => (
                      <tr key={detail.applicationid}>
                        <td className="id-cell">
                          <span className="role-indicator"></span>
                          {getdisplayprojectid(detail.applicationid)}
                        </td>
                        <td>{detail.candidate_id}</td>
                        <td>{`${detail.first_name} ${detail.last_name}`}</td>
                        <td>{`${detail.display_job_name} - ${getdisplayprojectid(detail.jobid)}`}</td>
                        <td>{formatDate(detail.applieddate)}</td>
                        <td className={detail.status.toLowerCase() === 'applied' ? 'status-badge active' : 'status-badge inactive'}>
                          {detail.status}
                        </td>
                        <td>
                          <a
                            href={detail.resumepath}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Resume
                          </a>
                        </td>
                        <td>
                          <button
                            className="button"
                            onClick={() => handlesubmit(detail.applicationid, detail.first_name, detail.last_name)}
                          >
                            Schedule Interview
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredDetails.length > rowsPerPage && (
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
                <label className="rows-per-page-label">Rows/ Page</label>
                <input
                  type="text"
                  value={rowsPerPageInput}
                  onChange={handleRowsPerPageInputChange}
                  onKeyPress={handleRowsPerPageInputKeyPress}
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

export default SubmittingApplication;
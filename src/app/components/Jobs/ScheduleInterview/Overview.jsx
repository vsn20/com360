'use client';
import React, { useState, useEffect } from 'react';
import SubmittingApplication from './SubmittingApplication';
import { useRouter, useSearchParams } from 'next/navigation';
import Edit from './Edit';
import './jobtitles.css';

const Overview = ({ scheduledetails, applieddetails, orgid, empid, time }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [applyinterview, setapplyinterview] = useState(false);
  const [selectedid, setselectedid] = useState(null);
  const [selectedstatus, setselectedstatus] = useState(null);
  const [allScheduledDetails, setAllScheduledDetails] = useState(scheduledetails);
  const [sortConfig, setSortConfig] = useState({ column: 'applicationid', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [requestsPerPage, setRequestsPerPage] = useState(10);
  const [requestsPerPageInput, setRequestsPerPageInput] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  useEffect(() => {
    handleback();
  }, [searchParams.get('refresh')]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setRequestsPerPageInput(requestsPerPage.toString());
  }, [requestsPerPage]);

  const handleSchedule = () => {
    setselectedid(null);
    setapplyinterview(true);
  };

  const handleback = () => {
    router.refresh();
    setapplyinterview(false);
    setselectedid(null);
    setCurrentPage(1);
    setPageInputValue('1');
    setSearchQuery('');
    setStatusFilter('all');
  };

  const handlerowclick = (id, status) => {
    setapplyinterview(false);
    setselectedid(id);
    setselectedstatus(status);
  };

  const sortScheduledDetails = (a, b, column, direction) => {
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
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  useEffect(() => {
    const sortedDetails = [...scheduledetails].sort((a, b) => sortScheduledDetails(a, b, sortConfig.column, sortConfig.direction));
    setAllScheduledDetails(sortedDetails);
  }, [sortConfig, scheduledetails]);

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

  const handleRequestsPerPageInputChange = (e) => {
    setRequestsPerPageInput(e.target.value);
  };

  const handleRequestsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setRequestsPerPage(value);
        setRequestsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setRequestsPerPageInput(requestsPerPage.toString());
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

  const filteredDetails = allScheduledDetails.filter(detail => {
    const candidateName = `${detail.first_name} ${detail.last_name}`.toLowerCase();
    const jobName = detail.display_job_name.toLowerCase();
    const matchesSearch = candidateName.includes(searchQuery.toLowerCase()) || jobName.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || detail.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredDetails.length / requestsPerPage);
  const indexOfLastRequest = currentPage * requestsPerPage;
  const indexOfFirstRequest = indexOfLastRequest - requestsPerPage;
  const currentDetails = filteredDetails.slice(indexOfFirstRequest, indexOfLastRequest);

  const uniqueStatuses = [...new Set(scheduledetails.map(detail => detail.status))];

  return (
    <div className="employee-overview-container">
      {applyinterview ? (
        <div className="employee-details-container">
          <div className="header-section">
            <h1 className="title">Schedule Interview</h1>
            <button className="back-button" onClick={handleback}></button>
          </div>
          <SubmittingApplication
            applieddetails={applieddetails}
            orgid={orgid}
            empid={empid}
            handlesback={handleback}
          />
        </div>
      ) : !selectedid ? (
        <div className="employee-list">
          <div className="header-section">
            <h1 className="title">Scheduled Interviews</h1>
            <button className="button" onClick={handleSchedule}>Schedule Interview</button>
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
                      <th>Candidate Name</th>
                      <th>Job Name-Job ID</th>
                      <th>Resume</th>
                      <th className={sortConfig.column === 'status' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('status')}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDetails.map((details) => (
                      <tr key={details.applicationid} onClick={() => handlerowclick(details.applicationid, details.status)}>
                        <td className="id-cell">
                          <span className="role-indicator"></span>
                          {getdisplayprojectid(details.applicationid)}
                        </td>
                        <td>{`${details.first_name} ${details.last_name}`}</td>
                        <td>{`${details.display_job_name} - ${getdisplayprojectid(details.jobid)}`}</td>
                        <td>
                          <a
                            href={details.resumepath}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Resume
                          </a>
                        </td>
                        <td className={details.status.toLowerCase() === 'scheduled' ? 'status-badge active' : 'status-badge inactive'}>
                          {details.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredDetails.length > requestsPerPage && (
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
                  value={requestsPerPageInput}
                  onChange={handleRequestsPerPageInputChange}
                  onKeyPress={handleRequestsPerPageInputKeyPress}
                  className="rows-per-page-input"
                  aria-label="Number of rows per page"
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="employee-details-container">
          <div className="header-section">
            <h1 className="title">Edit Interview</h1>
            <button className="back-button" onClick={handleback}></button>
          </div>
          <Edit
            id={selectedid}
            orgid={orgid}
            empid={empid}
            handleback={handleback}
            time={time}
            status={selectedstatus}
          />
        </div>
      )}
    </div>
  );
};

export default Overview;
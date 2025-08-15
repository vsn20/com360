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
  // State for sorted scheduledetails
  const [allScheduledDetails, setAllScheduledDetails] = useState(scheduledetails);
  // State for sorting configuration
  const [sortConfig, setSortConfig] = useState({ column: 'applicationid', direction: 'asc' });
  
  // New states for pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [applicationsPerPage, setApplicationsPerPage] = useState(10);
  const [duplicate, setDuplicate] = useState(10);

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  // Reset state when searchParams 'refresh' changes
  useEffect(() => {
    handleback();
  }, [searchParams.get('refresh')]);

  const handleSchedule = () => {
    setselectedid(null);
    setapplyinterview(true);
  };

  const handleback = () => {
    router.refresh();
    setapplyinterview(false);
    setselectedid(null);
  };

  const handlerowclick = (id, status) => {
    setapplyinterview(false);
    setselectedid(id);
    setselectedstatus(status);
  };

  // Sorting function
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
      case 'name':
        aValue = `${a.first_name} ${a.last_name}`.toLowerCase();
        bValue = `${b.first_name} ${b.last_name}`.toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'jobname':
        aValue = (a.display_job_name || '').toLowerCase();
        bValue = (b.display_job_name || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      default:
        return 0;
    }
  };

  // Request sort handler
  const requestSort = (column) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Filter and search functionality
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

  // Filtering logic
  const filteredApplications = allScheduledDetails.filter(application => {
    const matchesSearch = 
      `${application.first_name} ${application.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      application.display_job_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getdisplayprojectid(application.applicationid).toString().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || application.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredApplications.length / applicationsPerPage);
  const indexOfLastApplication = currentPage * applicationsPerPage;
  const indexOfFirstApplication = indexOfLastApplication - applicationsPerPage;
  const currentApplications = filteredApplications.slice(indexOfFirstApplication, indexOfLastApplication);

  // Pagination handlers
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

  const handleApplicationsInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(duplicate, 10);
      if (!isNaN(value) && value >= 1) {
        setApplicationsPerPage(value);
        setDuplicate(value);
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setDuplicate(10);
        setCurrentPage(1);
        setPageInputValue('1');
      }
    }
  };

  const pageChanging = (e) => {
    setDuplicate(e.target.value);
  };

  useEffect(() => {
    const sortedDetails = [...filteredApplications].sort((a, b) => sortScheduledDetails(a, b, sortConfig.column, sortConfig.direction));
    // We don't need to set state here as filteredApplications already handles this
  }, [sortConfig]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  // Get unique statuses for filter dropdown
  const uniqueStatuses = [...new Set(scheduledetails.map(app => app.status))];

  return (
    <div className="employee-overview-container">
      {applyinterview && (
        <>
          <SubmittingApplication
            applieddetails={applieddetails}
            orgid={orgid}
            empid={empid}
            handlesback={handleback}
          />
        </>
      )}
      {!applyinterview && !selectedid ? (
        <>
          <div className="employee-list">
            <div className="header-section">
              <div className="title">Application Management</div>
              <button className="button" onClick={handleSchedule}>Schedule Interview</button>
            </div>
            
            {/* Search and Filter Section */}
            <div className="search-filter-container">
              <input
                type="text"
                placeholder="Search by Name, Job, or Application ID"
                value={searchQuery}
                onChange={handleSearchChange}
                className="search-input"
              />
              <select
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="filter-select"
              >
                <option value="all">All Status</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {filteredApplications.length === 0 ? (
              <p className="empty-state">No applications found.</p>
            ) : (
              <>
                <div className="applications-table-wrapper">
                  <table className="applications-table">
                    <thead>
                      <tr>
                        <th 
                          className={sortConfig.column === 'applicationid' ? `sortable sort-${sortConfig.direction}` : 'sortable'}
                          onClick={() => requestSort('applicationid')}
                        >
                          Application ID
                        </th>
                        <th 
                          className={sortConfig.column === 'name' ? `sortable sort-${sortConfig.direction}` : 'sortable'}
                          onClick={() => requestSort('name')}
                        >
                          Candidate Name
                        </th>
                        <th 
                          className={sortConfig.column === 'jobname' ? `sortable sort-${sortConfig.direction}` : 'sortable'}
                          onClick={() => requestSort('jobname')}
                        >
                          Job Name-Job ID
                        </th>
                        <th>Resume</th>
                        <th 
                          className={sortConfig.column === 'status' ? `sortable sort-${sortConfig.direction}` : 'sortable'}
                          onClick={() => requestSort('status')}
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentApplications.map((details) => (
                        <tr key={details.applicationid} onClick={() => handlerowclick(details.applicationid, details.status)}>
                          <td className="id-cell">
                            <span className="application-indicator"></span>
                            {getdisplayprojectid(details.applicationid)}
                          </td>
                          <td>{`${details.first_name} ${details.last_name}`}</td>
                          <td>{`${details.display_job_name} - ${getdisplayprojectid(details.jobid)}`}</td>
                          <td>
                            <a href={details.resumepath} target="_blank" rel="noopener noreferrer">
                              View Resume
                            </a>
                          </td>
                          <td>{details.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredApplications.length > applicationsPerPage && (
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

                {/* Rows per Page */}
                {filteredApplications.length > 0 && (
                  <div className="rows-per-page-container">
                    <label className="rows-per-page-label">Rows/ Page</label>
                    <input
                      type="text"
                      value={duplicate}
                      onChange={pageChanging}
                      onKeyPress={handleApplicationsInputKeyPress}
                      className="rows-per-page-input"
                      aria-label="Number of rows per page"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : selectedid && (
        <>
          <button className="back-button" onClick={handleback}>×</button>
          <Edit
            id={selectedid}
            orgid={orgid}
            empid={empid}
            handleback={handleback}
            time={time}
            status={selectedstatus}
          />
        </>
      )}
    </div>
  );
};

export default Overview;
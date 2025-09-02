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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [applicationsPerPage, setApplicationsPerPage] = useState(10);
  const [duplicate, setDuplicate] = useState(10);

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };


  useEffect(() => {
      setAllScheduledDetails(scheduledetails);
    }, [scheduledetails]);

  // Reset state when searchParams 'refresh' changes
  useEffect(() => {
    handleback();
  }, [searchParams.get('refresh')]);

  // Apply sorting when sortConfig changes
  useEffect(() => {
    if (allScheduledDetails.length > 0) {
      setAllScheduledDetails([...allScheduledDetails].sort((a, b) => sortScheduledDetails(a, b, sortConfig.column, sortConfig.direction)));
    }
  }, [sortConfig]);

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

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const filteredApplications = allScheduledDetails.filter(application => {
    const matchesSearch =
      `${application.first_name} ${application.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      application.display_job_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getdisplayprojectid(application.applicationid).toString().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || application.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredApplications.length / applicationsPerPage);
  const indexOfLastApplication = currentPage * applicationsPerPage;
  const indexOfFirstApplication = indexOfLastApplication - applicationsPerPage;
  const currentApplications = filteredApplications.slice(indexOfFirstApplication, indexOfLastApplication);

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
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const uniqueStatuses = [...new Set(scheduledetails.map(app => app.status))];

  return (
    <>
    {selectedid && (<>
    <Edit
            id={selectedid}
            orgid={orgid}
            empid={empid}
            handleback={handleback}
            time={time}
            status={selectedstatus}
          />
    </>)}
    <div className="schedule_interview_employee-overview-container">
      {applyinterview &&!selectedid && (
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
          <div className="schedule_interview_employee-list">
            <div className="schedule_interview_header-section">
              <div className="schedule_interview_title">Application Management</div>
              <button className="schedule_interview_button" onClick={handleSchedule}>Schedule Interview</button>
            </div>
            
            <div className="schedule_interview_search-filter-container">
              <input
                type="text"
                placeholder="Search by Name, Job, or Application ID"
                value={searchQuery}
                onChange={handleSearchChange}
                className="schedule_interview_search-input"
              />
              <select
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="schedule_interview_filter-select"
              >
                <option value="all">All Status</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {filteredApplications.length === 0 ? (
              <p className="schedule_interview_empty-state">No Applications found.</p>
            ) : (
              <>
                <div className="schedule_interview_C_APPLICATIONS-table-wrapper">
                  <table className="schedule_interview_C_APPLICATIONS-table">
                    <thead>
                      <tr>
                        <th 
                          className={sortConfig.column === 'applicationid' ? `schedule_interview_sortable schedule_interview_sort-${sortConfig.direction}` : 'schedule_interview_sortable'}
                          onClick={() => requestSort('applicationid')}
                        >
                          Application ID
                        </th>
                        <th 
                          className={sortConfig.column === 'name' ? `schedule_interview_sortable schedule_interview_sort-${sortConfig.direction}` : 'schedule_interview_sortable'}
                          onClick={() => requestSort('name')}
                        >
                          Candidate Name
                        </th>
                        <th 
                          className={sortConfig.column === 'jobname' ? `schedule_interview_sortable schedule_interview_sort-${sortConfig.direction}` : 'schedule_interview_sortable'}
                          onClick={() => requestSort('jobname')}
                        >
                          Job Name-Job ID
                        </th>
                        <th>Resume</th>
                        <th 
                          className={sortConfig.column === 'status' ? `schedule_interview_sortable schedule_interview_sort-${sortConfig.direction}` : 'schedule_interview_sortable'}
                          onClick={() => requestSort('status')}
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentApplications.map((details) => (
                        <tr key={details.applicationid} onClick={() => handlerowclick(details.applicationid, details.status)}>
                          <td className="schedule_interview_id-cell">
                            <span  className={
                                details.status === 'offerletter-generated'
                                  ? 'schedule_interview_roleindicatorsemiinactive'
                                  : details.status === 'scheduled'
                                  ? 'schedule_interview_role-indicator'
                                  : 'schedule_interview_role-indicatorinactiver'
                              }></span>
                            {getdisplayprojectid(details.applicationid)}
                          </td>
                          <td>{`${details.first_name} ${details.last_name}`}</td>
                          <td>{`${details.display_job_name} - ${getdisplayprojectid(details.jobid)}`}</td>
                          <td>
                            <a href={details.resumepath} target="_blank" rel="noopener noreferrer">
                              View Resume
                            </a>
                          </td>
                          <td>
                            <span
                              className={`schedule_interview_status-badge ${
                                details.status === 'offerletter-generated'
                                  ? 'schedule_interview_actives'
                                  : details.status === 'scheduled'
                                  ? 'schedule_interview_active'
                                  : 'schedule_interview_inactive'
                              }`}
                            >
                              {details.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredApplications.length > applicationsPerPage && (
                  <div className="schedule_interview_pagination-container">
                    <button
                      className="schedule_interview_button"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </button>
                    <span className="schedule_interview_pagination-text">
                      Page{' '}
                      <input
                        type="text"
                        value={pageInputValue}
                        onChange={handlePageInputChange}
                        onKeyPress={handlePageInputKeyPress}
                        className="schedule_interview_pagination-input"
                      />{' '}
                      of {totalPages}
                    </span>
                    <button
                      className="schedule_interview_button"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </div>
                )}

                {filteredApplications.length > 0 && (
                  <div className="schedule_interview_rows-per-page-container">
                    <label className="schedule_interview_rows-per-page-label">Rows/ Page</label>
                    <input
                      type="text"
                      value={duplicate}
                      onChange={pageChanging}
                      onKeyPress={handleApplicationsInputKeyPress}
                      className="schedule_interview_rows-per-page-input"
                      aria-label="Number of rows per page"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
    </>
  );
};

export default Overview;
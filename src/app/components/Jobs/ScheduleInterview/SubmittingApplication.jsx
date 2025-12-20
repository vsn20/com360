'use client';
import React, { useState, useEffect } from 'react';
import Scheduling from './Scheduling';
import { useRouter } from 'next/navigation';
import './jobtitles.css'; // Import jobtitles.css

const SubmittingApplication = ({ applieddetails, orgid, empid, handlesback }) => {
  const router = useRouter();
  const [selectedid, setselectedid] = useState(null);
  const [selectedname, setselectedname] = useState(null);
  
  // New states for pagination, sorting and filtering
  const [sortConfig, setSortConfig] = useState({ column: 'applicationid', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [applicationsPerPage, setApplicationsPerPage] = useState(10);
  const [duplicate, setDuplicate] = useState(10);

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

  const handleback = () => {
    router.refresh();
    setselectedid(null);
    setselectedname(null);
  };

  const handlesubmit = (id, first, second) => {
    setselectedid(id);
    setselectedname(`${first} ${second}`);
  };

  // Sorting function
  const sortApplications = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'applicationid':
        aValue = parseInt(getdisplayprojectid(a.applicationid));
        bValue = parseInt(getdisplayprojectid(b.applicationid));
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'C_CANDIDATEid':
        aValue = parseInt(a.candidate_id);
        bValue = parseInt(b.candidate_id);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'name':
        aValue = `${a.first_name} ${a.last_name}`.toLowerCase();
        bValue = `${b.first_name} ${b.last_name}`.toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'jobname':
        aValue = (a.display_job_name || '').toLowerCase();
        bValue = (b.display_job_name || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'applieddate':
        aValue = new Date(a.applieddate).getTime();
        bValue = new Date(b.applieddate).getTime();
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'status':
        aValue = (a.status || '').toLowerCase();
        bValue = (b.status || '').toLowerCase();
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
  const filteredApplications = applieddetails.filter(application => {
    const matchesSearch = 
      `${application.first_name} ${application.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      application.display_job_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getdisplayprojectid(application.applicationid).toString().includes(searchQuery.toLowerCase()) ||
      application.candidate_id.toString().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || application.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  // Sort the filtered C_APPLICATIONS
  const sortedApplications = [...filteredApplications].sort((a, b) => 
    sortApplications(a, b, sortConfig.column, sortConfig.direction)
  );

  // Pagination logic
  const totalPages = Math.ceil(sortedApplications.length / applicationsPerPage);
  const indexOfLastApplication = currentPage * applicationsPerPage;
  const indexOfFirstApplication = indexOfLastApplication - applicationsPerPage;
  const currentApplications = sortedApplications.slice(indexOfFirstApplication, indexOfLastApplication);

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


  const backingoption=()=>{
     router.refresh();
     handlesback();
  };

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  // Get unique statuses for filter dropdown
  const uniqueStatuses = [...new Set(applieddetails.map(app => app.status))];

  return (
    <div className="schedule_interview_employee-overview-container">
      {selectedid ? (
        <>
          {/* <button className="schedule_interview_back-button" onClick={handleback}></button> */}
          <Scheduling
            id={selectedid}
            name={selectedname}
            orgid={orgid}
            empid={empid}
            handleback={handleback}
          />
        </>
      ) : (
        <>
          <div className="schedule_interview_employee-list">
            <div className="schedule_interview_header-section">
              <div className="schedule_interview_title">Schedule Interview</div>
              <button onClick={backingoption} className="schedule_interview_back-button"></button>
            </div>
            
            {/* Search and Filter Section */}
            <div className="schedule_interview_search-filter-container">
              <input
                type="text"
                placeholder="Search by Name, Job, Application ID, or Candidate ID"
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
                        {/* <th 
                          className={sortConfig.column === 'applicationid' ? `schedule_interview_sortable schedule_interview_sort-${sortConfig.direction}` : 'schedule_interview_sortable'}
                          onClick={() => requestSort('applicationid')}
                        >
                          Application ID
                        </th> */}
                        {/* <th 
                          className={sortConfig.column === 'C_CANDIDATEid' ? `schedule_interview_sortable schedule_interview_sort-${sortConfig.direction}` : 'schedule_interview_sortable'}
                          onClick={() => requestSort('C_CANDIDATEid')}
                        >
                          Candidate ID
                        </th> */}
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
                          Job Name
                        </th>
                        <th 
                          className={sortConfig.column === 'applieddate' ? `schedule_interview_sortable schedule_interview_sort-${sortConfig.direction}` : 'schedule_interview_sortable'}
                          onClick={() => requestSort('applieddate')}
                        >
                          Applied Date
                        </th>
                        <th 
                          className={sortConfig.column === 'status' ? `schedule_interview_sortable schedule_interview_sort-${sortConfig.direction}` : 'schedule_interview_sortable'}
                          onClick={() => requestSort('status')}
                        >
                          Status
                        </th>
                        <th>Resume</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentApplications.map((detail) => (
                        <tr key={detail.applicationid}>
                          <td >
                            <span className="schedule_interview_application-indicator"></span>
                            {`${detail.first_name} ${detail.last_name}`}
                          </td>
                      
                         
                          <td>{`${detail.display_job_name}`}</td>
                          <td>{formatDate(detail.applieddate)}</td>
                          <td>
                             <span
                             className='schedule_interview_status-badge schedule_interview_applied'
                           >
                            {detail.status}
                            </span>
                          </td>
                          <td>
                            <a href={detail.resumepath} target="_blank" rel="noopener noreferrer">
                              View Resume
                            </a>
                          </td>
                          <td>
                            <button 
                              className="schedule_interview_button"
                              onClick={() => handlesubmit(detail.applicationid, detail.first_name, detail.last_name)}
                            >
                              Schedule
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {sortedApplications.length > applicationsPerPage && (
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

                {/* Rows per Page */}
                {sortedApplications.length > 0 && (
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
      )}
    </div>
  );
};

export default SubmittingApplication;
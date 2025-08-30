'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AddExternal from './AddExternal';
import Edit from './Edit';
import { fetchExternalJobsByOrgId } from '@/app/serverActions/Jobs/ExternalJobs/Overview';
import './externaljobs.css';

const Overview = ({ orgid, empid, expectedjobtitles, expectedepartment, expectedrole, countries, states, jobtype, external }) => {
  const router = useRouter();
  const searchparams = useSearchParams();
  const [isadd, setisadd] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [allJobs, setAllJobs] = useState(external);
  const [sortConfig, setSortConfig] = useState({ column: 'jobid', direction: 'asc' });
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [jobsPerPage, setJobsPerPage] = useState(10);
  const [jobsPerPageInput, setJobsPerPageInput] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // Added state for status filter

  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
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
    setAllJobs(external);
  }, [external]);

  useEffect(() => {
    const sortedJobs = [...external].sort((a, b) => sortJobs(a, b, sortConfig.column, sortConfig.direction));
    setAllJobs(sortedJobs);
  }, [sortConfig, external]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const handleBack = () => {
    router.refresh();
    setisadd(false);
    setSelectedJob(null);
    setError(null);
    setSearchQuery('');
    setStatusFilter('all'); // Reset status filter on back
  };

  const handleAdd = () => {
    setisadd(true);
    setSelectedJob(null);
    setError(null);
  };

  const handleRowClick = (job) => {
    setSelectedJob(job);
    setisadd(false);
    setError(null);
  };

  const sortJobs = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'jobid':
        aValue = parseInt(a.jobid.split('-')[1] || a.jobid);
        bValue = parseInt(b.jobid.split('-')[1] || b.jobid);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'display_job_name':
        aValue = (a.display_job_name || '').toLowerCase();
        bValue = (b.display_job_name || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'no_of_vacancies':
        aValue = a.no_of_vacancies ? parseInt(a.no_of_vacancies, 10) : 0;
        bValue = b.no_of_vacancies ? parseInt(b.no_of_vacancies, 10) : 0;
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
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

  const handleJobsPerPageInputChange = (e) => {
    setJobsPerPageInput(e.target.value);
  };

  const handleJobsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setJobsPerPage(value);
        setJobsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setJobsPerPageInput(jobsPerPage.toString());
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

  // Filter logic
  const filteredJobs = allJobs.filter((job) =>
    job.display_job_name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (statusFilter === 'all' || (statusFilter === 'active' && job.active == 1) || (statusFilter === 'inactive' && job.active != 1))
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
  const indexOfLastJob = currentPage * jobsPerPage;
  const indexOfFirstJob = indexOfLastJob - jobsPerPage;
  const currentJobs = filteredJobs.slice(indexOfFirstJob, indexOfLastJob);

  return (
    <div className="employee-overview-container">
      {error && <div className="error-message">{error}</div>}
      {isadd ? (
        <div className="employee-details-container">
          <div className="header-section">
            <h1 className="title">Add External Job</h1>
            <button className="back-button" onClick={handleBack}></button>
          </div>
          <AddExternal
            orgid={orgid}
            empid={empid}
            expectedjobtitles={expectedjobtitles}
            expectedepartment={expectedepartment}
            expectedrole={expectedrole}
            countries={countries}
            states={states}
            jobtype={jobtype}
          />
        </div>
      ) : selectedJob ? (
        <div className="employee-details-container">
          <div className="header-section">
            <h1 className="title">External Job Details</h1>
            <button className="back-button" onClick={handleBack}></button>
          </div>
          <Edit
            job={selectedJob}
            orgid={orgid}
            expectedjobtitles={expectedjobtitles}
            expectedepartment={expectedepartment}
            expectedrole={expectedrole}
            countries={countries}
            states={states}
            jobtype={jobtype}
          />
        </div>
      ) : (
        <div className="employee-list">
          <div className="header-section">
            <h1 className="title">Existing External Jobs</h1>
            <button onClick={handleAdd} className="button">Post External Job</button>
          </div>
          <div className="search-filter-container">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
              placeholder="Search by job name..."
            />
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="filter-select90"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {filteredJobs.length === 0 ? (
            <div className="empty-state">No external jobs found.</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="three-column">
                  <colgroup>
                    <col />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={sortConfig.column === 'jobid' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('jobid')}>
                        Job ID
                      </th>
                      <th className={sortConfig.column === 'display_job_name' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('display_job_name')}>
                        Job Name
                      </th>
                      <th className={sortConfig.column === 'no_of_vacancies' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('no_of_vacancies')}>
                        Vacancies
                      </th>
                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentJobs.map((job) => (
                      <tr key={job.jobid} onClick={() => handleRowClick(job)} className={selectedJob && selectedJob.jobid === job.jobid ? 'selected-row' : ''}>
                        <td className="id-cell">
                         <span className={job.active==1 ? 'role-indicator' : 'role-indicatorinactiver'}></span>
                          {getdisplayprojectid(job.jobid)}
                        </td>
                        <td>{job.display_job_name || '-'}</td>
                        <td>{job.no_of_vacancies || '-'}</td>
                        <td className={job.active==1 ? 'status-badge active' : 'status-badge inactive'}>{job.active==1?'Active':"Inactive"||'-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredJobs.length > jobsPerPage && (
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
              {filteredJobs.length > 0 && (
                <div className="rows-per-page-container">
                  <label className="rows-per-page-label">Rows/ Page</label>
                  <input
                    type="text"
                    value={jobsPerPageInput}
                    onChange={handleJobsPerPageInputChange}
                    onKeyPress={handleJobsPerPageInputKeyPress}
                    className="rows-per-page-input"
                    aria-label="Number of rows per page"
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Overview;
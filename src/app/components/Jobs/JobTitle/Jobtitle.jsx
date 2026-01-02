'use client';
import React, { useEffect, useState } from 'react';
import AddjobTitle from './AddjobTitle';
import EditJobTitle from './EditJobTitle';
import { useRouter, useSearchParams } from 'next/navigation';
import './jobtitles.css';

const Jobtitle = ({ orgid, empid, jobtitles }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedjobid, setSelectedjobid] = useState(null);
  const [add, setAdd] = useState(false);
  const [allJobTitles, setAllJobTitles] = useState(jobtitles);
  const [sortConfig, setSortConfig] = useState({ column: 'job_title_id', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [jobsPerPage, setJobsPerPage] = useState(10);
  const [jobsPerPageInput, setJobsPerPageInput] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('all');

  useEffect(() => {
    setAllJobTitles(jobtitles);
  }, [jobtitles]);

  useEffect(() => {
    handleBackClick();
  }, [searchParams.get('refresh')]);

  useEffect(() => {
    const sortedJobTitles = [...jobtitles].sort((a, b) => sortJobTitles(a, b, sortConfig.column, sortConfig.direction));
    setAllJobTitles(sortedJobTitles);
  }, [sortConfig, jobtitles]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const sortJobTitles = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'job_title_id':
        aValue = parseInt(a.job_title_id.split('-')[1] || a.job_title_id);
        bValue = parseInt(b.job_title_id.split('-')[1] || b.job_title_id);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'job_title':
        aValue = (a.job_title || '').toLowerCase();
        bValue = (b.job_title || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'is_active':
        aValue = a.is_active ? 'Yes' : 'No';
        bValue = b.is_active ? 'Yes' : 'No';
        if (direction === 'asc') {
          return aValue === 'Yes' ? -1 : bValue === 'Yes' ? 1 : aValue.localeCompare(bValue);
        } else {
          return aValue === 'No' ? -1 : bValue === 'No' ? 1 : bValue.localeCompare(aValue);
        }
      case 'created_date':
        aValue = new Date(a.CreatedDate).getTime();
        bValue = new Date(b.CreatedDate).getTime();
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'level':
        aValue = a.level ? parseInt(a.level, 10) : 0;
        bValue = b.level ? parseInt(b.level, 10) : 0;
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

  const handleRowClick = (jobid) => {
    setSelectedjobid(jobid);
    setAdd(false);
  };

  const handleAdd = () => {
    setSelectedjobid(null);
    setAdd(true);
  };

  const handleBackClick = () => {
    router.refresh();
    setSelectedjobid(null);
    setAdd(false);
    setSearchQuery('');
    setIsActiveFilter('all');
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
    setIsActiveFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  // Filter logic
  const filteredJobTitles = allJobTitles.filter((job) => {
    const matchesSearch = job.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      isActiveFilter === 'all' ||
      (isActiveFilter === 'active' && job.is_active) ||
      (isActiveFilter === 'inactive' && !job.is_active);
    return matchesSearch && matchesStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredJobTitles.length / jobsPerPage);
  const indexOfLastJob = currentPage * jobsPerPage;
  const indexOfFirstJob = indexOfLastJob - jobsPerPage;
  const currentJobTitles = filteredJobTitles.slice(indexOfFirstJob, indexOfLastJob);

  return (
    <div className="jobtitles_employee-overview-container">
      {add && (
        <div className="jobtitles_employee-details-container">
          <div className="jobtitles_header-section">
            <h1 className="jobtitles_title">Add Job Title</h1>
            <button className="jobtitles_back-button" onClick={handleBackClick}></button>
          </div>
          <AddjobTitle orgid={orgid} empid={empid} />
        </div>
      )}
      {!add && selectedjobid ? (
        <div className="jobtitles_employee-details-container">
          <div className="jobtitles_header-section">
            <h1 className="jobtitles_title">{allJobTitles.find(job => job.job_title_id === selectedjobid)?.job_title || ''} Job Title Details</h1>
            <button className="jobtitles_back-button" onClick={handleBackClick}></button>
          </div>
          <EditJobTitle selectedjobid={selectedjobid} orgid={orgid} empid={empid} />
        </div>
      ) : (
        !add && (
          <div className="jobtitles_employee-list">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h1 className="jobtitles_title">Job Titles</h1>
              <button onClick={handleAdd} className="jobtitles_button">Add Job Title</button>
            </div>
            <div className="jobtitles_search-filter-container">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                className="jobtitles_search-input"
                placeholder="Search by job title..."
              />
              <select value={isActiveFilter} onChange={handleStatusFilterChange} className="jobtitles_filter-select">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {filteredJobTitles.length === 0 ? (
              <div className="jobtitles_empty-state">No job titles found.</div>
            ) : (
              <>
                <div className="jobtitles_table-wrapper">
                  <table className="jobtitles_four-column">
                    <colgroup>
                      <col />
                      <col />
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        {/* <th className={sortConfig.column === 'job_title_id' ? `jobtitles_sortable jobtitles_sort-${sortConfig.direction}` : 'jobtitles_sortable'} onClick={() => requestSort('job_title_id')}>
                          Job ID
                        </th> */}
                        <th className={sortConfig.column === 'job_title' ? `jobtitles_sortable jobtitles_sort-${sortConfig.direction}` : 'jobtitles_sortable'} onClick={() => requestSort('job_title')}>
                          Job Title
                        </th>
                        <th className={sortConfig.column === 'level' ? `jobtitles_sortable jobtitles_sort-${sortConfig.direction}` : 'jobtitles_sortable'} onClick={() => requestSort('level')}>
                          Level
                        </th>
                        <th className={sortConfig.column === 'is_active' ? `jobtitles_sortable jobtitles_sort-${sortConfig.direction}` : 'jobtitles_sortable'} onClick={() => requestSort('is_active')}>
                          Status
                        </th>
                        <th>
                          Minimum Salary
                        </th>
                        <th>Maximum Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentJobTitles.map((job) => (
                        <tr key={job.job_title_id} onClick={() => handleRowClick(job.job_title_id)}>
                          <td className="jobtitles_id-cell">
                            <span className={job.is_active ? 'jobtitles_role-indicator' : 'jobtitles_role-indicatorinactiver'}></span>
                            {job.job_title || '-'}
                          </td>
                          <td>{job.level || '-'}</td>
                          <td className={job.is_active ? 'jobtitles_status-badge jobtitles_active' : 'jobtitles_status-badge jobtitles_inactive'}>
                            {job.is_active ? 'Active' : 'Inactive'}
                          </td>
                          <td>{job.min_salary}</td>
                          <td>{job.max_salary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredJobTitles.length > jobsPerPage && (
                  <div className="jobtitles_pagination-container">
                    <button
                      className="jobtitles_button"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </button>
                    <span className="jobtitles_pagination-text">
                      Page{' '}
                      <input
                        type="text"
                        value={pageInputValue}
                        onChange={handlePageInputChange}
                        onKeyPress={handlePageInputKeyPress}
                        className="jobtitles_pagination-input"
                      />{' '}
                      of {totalPages}
                    </span>
                    <button
                      className="jobtitles_button"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </div>
                )}
                {filteredJobTitles.length > 0 && (
                  <div className="jobtitles_rows-per-page-container">
                    <label className="jobtitles_rows-per-page-label">Rows/ Page</label>
                    <input
                      type="text"
                      value={jobsPerPageInput}
                      onChange={handleJobsPerPageInputChange}
                      onKeyPress={handleJobsPerPageInputKeyPress}
                      className="jobtitles_rows-per-page-input"
                      aria-label="Number of rows per page"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default Jobtitle;
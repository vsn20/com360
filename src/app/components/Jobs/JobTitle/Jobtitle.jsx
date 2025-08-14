'use client';
import React, { useEffect, useState } from 'react';
import AddjobTitle from './AddjobTitle';
import EditJobTitle from './EditJobTitle';
import { useRouter, useSearchParams } from 'next/navigation';
import './st.css';

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
    <div className="employee-overview-container">
      {add && (
        <div className="employee-details-container">
          <div className="header-section">
            <h1 className="title">Add Job Title</h1>
            <button className="back-button" onClick={handleBackClick}></button>
          </div>
          <AddjobTitle orgid={orgid} empid={empid} />
        </div>
      )}
      {!add && selectedjobid ? (
        <div className="employee-details-container">
          <div className="header-section">
            <h1 className="title">Edit Job Title</h1>
            <button className="back-button" onClick={handleBackClick}></button>
          </div>
          <EditJobTitle selectedjobid={selectedjobid} orgid={orgid} empid={empid} />
        </div>
      ) : (
        !add && (
          <div className="employee-list">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h1 className="title">Existing Job Titles</h1>
              <button onClick={handleAdd} className="button">Add Job Title</button>
            </div>
            <div className="search-filter-container">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                className="search-input"
                placeholder="Search by job title..."
              />
              <select value={isActiveFilter} onChange={handleStatusFilterChange} className="filter-select">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {filteredJobTitles.length === 0 ? (
              <div className="empty-state">No job titles found.</div>
            ) : (
              <>
                <div className="table-wrapper">
                  <table className="four-column">
                    <colgroup>
                      <col />
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className={sortConfig.column === 'job_title_id' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('job_title_id')}>
                          Job ID
                        </th>
                        <th className={sortConfig.column === 'job_title' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('job_title')}>
                          Job Title
                        </th>
                        <th className={sortConfig.column === 'level' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('level')}>
                          Level
                        </th>
                        <th className={sortConfig.column === 'is_active' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('is_active')}>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentJobTitles.map((job) => (
                        <tr key={job.job_title_id} onClick={() => handleRowClick(job.job_title_id)}>
                          <td className="id-cell">
                            <span className="role-indicator"></span>
                            {job.job_title_id.split('-')[1] || job.job_title_id}
                          </td>
                          <td>{job.job_title || '-'}</td>
                          <td>{job.level || '-'}</td>
                          <td className={job.is_active ? 'status-badge active' : 'status-badge inactive'}>
                            {job.is_active ? 'Active' : 'Inactive'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredJobTitles.length > jobsPerPage && (
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
                {filteredJobTitles.length > 0 && (
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
        )
      )}
    </div>
  );
};

export default Jobtitle;
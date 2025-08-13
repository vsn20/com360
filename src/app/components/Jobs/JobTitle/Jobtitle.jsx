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
        
      } else {
        setJobsPerPageInput(jobsPerPage.toString()); // Revert to current jobsPerPage
      }
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(allJobTitles.length / jobsPerPage);
  const indexOfLastJob = currentPage * jobsPerPage;
  const indexOfFirstJob = indexOfLastJob - jobsPerPage;
  const currentJobTitles = allJobTitles.slice(indexOfFirstJob, indexOfLastJob);

  return (
    <div className="employee-overview-container">
      {add && (
        <div className="employee-details-container">
          <button className="back-button" onClick={handleBackClick}>
            x
          </button>
          <AddjobTitle orgid={orgid} empid={empid} />
        </div>
      )}
      {!add && selectedjobid ? (
        <div className="employee-details-container">
          <button className="back-button" onClick={handleBackClick}>
            x
          </button>
          <EditJobTitle selectedjobid={selectedjobid} orgid={orgid} empid={empid} />
        </div>
      ) : (
        !add && (
          <div className="employee-list">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div className="title">Existing Job Titles</div>
              <button onClick={handleAdd} className="save-button">
                Add Job Title
              </button>
            </div>
            {allJobTitles.length === 0 ? (
              <p>No job titles found.</p>
            ) : (
              <>
                <div className="table-wrapper">
                  <table className="employee-table">
                    <thead>
                      <tr>
                        <th onClick={() => requestSort('job_title_id')}>
                          Job ID {sortConfig.column === 'job_title_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => requestSort('job_title')}>
                          Job Title {sortConfig.column === 'job_title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => requestSort('level')}>
                          Level {sortConfig.column === 'level' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => requestSort('is_active')}>
                          Status {sortConfig.column === 'is_active' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => requestSort('created_date')}>
                          Created Date {sortConfig.column === 'created_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentJobTitles.map((job) => (
                        <tr
                          key={job.job_title_id}
                          onClick={() => handleRowClick(job.job_title_id)}
                          className={selectedjobid === job.job_title_id ? 'selected-row' : ''}
                        >
                          <td>{job.job_title_id.split('-')[1] || job.job_title_id}</td>
                          <td>{job.job_title || '-'}</td>
                          <td>{job.level || '-'}</td>
                          <td>{job.is_active ? 'Active' : 'Inactive'}</td>
                          <td>{job.CreatedDate ? new Date(job.CreatedDate).toISOString().split('T')[0] : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {allJobTitles.length > jobsPerPage && (
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
                <label>Jobs Per Page</label>
                <input
                      type="text"
                      value={jobsPerPageInput}
                      onChange={handleJobsPerPageInputChange}
                      onKeyPress={handleJobsPerPageInputKeyPress}
                      className="jobs-per-page-input"
                      placeholder="Jobs per page"
                    />
              </>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default Jobtitle;
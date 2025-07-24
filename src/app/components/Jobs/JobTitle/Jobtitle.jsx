// app/components/Jobs/JobTitle/Jobtitle.jsx
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
            <button onClick={handleAdd} className="save-button">
              Add Job Title
            </button>
            {allJobTitles.length === 0 ? (
              <p>No job titles found.</p>
            ) : (
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
                  </tr>
                </thead>
                <tbody>
                  {allJobTitles.map((job) => (
                    <tr
                      key={job.job_title_id}
                      onClick={() => handleRowClick(job.job_title_id)}
                      className={selectedjobid === job.job_title_id ? 'selected-row' : ''}
                    >
                      <td>{job.job_title_id.split('-')[1] || job.job_title_id}</td>
                      <td>{job.job_title || '-'}</td>
                      <td>{job.level || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default Jobtitle;
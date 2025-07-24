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

  const handleBack = () => {
    router.refresh();
    setisadd(false);
    setSelectedJob(null);
    setError(null);
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

  return (
    <div className="employee-overview-container">
      {error && <div className="error-message">{error}</div>}
      {isadd && (
        <div>
          <button className="back-button" onClick={handleBack}>x</button>
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
      )}
      {!isadd && !selectedJob ? (
        <div className="employee-list">
          <button onClick={handleAdd} className="save-button">Post External Job</button>
          {allJobs.length === 0 ? (
            <p>No external jobs found.</p>
          ) : (
            <table className="employee-table">
              <thead>
                <tr>
                  <th onClick={() => requestSort('jobid')}>
                    External Job ID {sortConfig.column === 'jobid' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => requestSort('display_job_name')}>
                    Job Name {sortConfig.column === 'display_job_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => requestSort('no_of_vacancies')}>
                    Vacancies {sortConfig.column === 'no_of_vacancies' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {allJobs.map((job) => (
                  <tr key={job.jobid} onClick={() => handleRowClick(job)} className={selectedJob && selectedJob.jobid === job.jobid ? 'selected-row' : ''}>
                    <td>{getdisplayprojectid(job.jobid)}</td>
                    <td>{job.display_job_name || '-'}</td>
                    <td>{job.no_of_vacancies || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : !isadd && selectedJob && (
        <div>
          <button className="back-button" onClick={handleBack}>x</button>
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
      )}
    </div>
  );
};

export default Overview;
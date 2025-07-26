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

  useEffect(() => {
    const sortedDetails = [...scheduledetails].sort((a, b) => sortScheduledDetails(a, b, sortConfig.column, sortConfig.direction));
    setAllScheduledDetails(sortedDetails);
  }, [sortConfig, scheduledetails]);

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
          <div>
            <button className="save-button" onClick={handleSchedule}>Schedule Interview</button>
            <table className="employee-table">
              <thead>
                <tr>
                  <th onClick={() => requestSort('applicationid')}>
                    Application ID
                  </th>
                  <th>Candidate Name</th>
                  <th>Job Name-Job ID</th>
                  <th>Resume</th>
                  <th onClick={() => requestSort('status')}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {allScheduledDetails.map((details) => (
                  <tr key={details.applicationid} onClick={() => handlerowclick(details.applicationid, details.status)}>
                    <td>{getdisplayprojectid(details.applicationid)}</td>
                    <td>{`${details.first_name} ${details.last_name}`}</td>
                    <td>{`${details.job_title} - ${getdisplayprojectid(details.jobid)}`}</td>
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
        </>
      ) : selectedid && (
        <>
          <button className="back-button" onClick={handleback}>x</button>
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
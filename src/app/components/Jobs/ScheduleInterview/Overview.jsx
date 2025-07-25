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

  const handlerowclick = (id) => {
    setapplyinterview(false);
    setselectedid(id);
  };

  return (
    <div className="employee-overview-container">
      {applyinterview && (
        <>
          <button className="back-button" onClick={handleback}>x</button>
          <SubmittingApplication
            applieddetails={applieddetails}
            orgid={orgid}
            empid={empid}
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
                  <th>Application ID</th>
                  <th>Candidate Name</th>
                  <th>Job Name-Job ID</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduledetails.map((details) => (
                  <tr key={details.applicationid} onClick={() => handlerowclick(details.applicationid)}>
                    <td>{details.applicationid}</td>
                    <td>{`${details.first_name} ${details.last_name}`}</td>
                    <td>{`${details.job_title} - ${details.jobid}`}</td>
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
          />
        </>
      )}
    </div>
  );
};

export default Overview;
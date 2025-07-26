'use client';
import React, { useState } from 'react';
import Scheduling from './Scheduling';
import { useRouter } from 'next/navigation';
import './jobtitles.css'; // Import jobtitles.css

const SubmittingApplication = ({ applieddetails, orgid, empid,handlesback }) => {
  const router = useRouter();
  const [selectedid, setselectedid] = useState(null);
  const [selectedname, setselectedname] = useState(null);

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

  return (
    <div className="employee-overview-container">
      {selectedid ? (
        <>
          <button className="back-button" onClick={handleback}>x</button>
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
        <button onClick={handlesback} className='back-button'>x</button>
          <table className="employee-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Candidate ID</th>
                <th>Candidate Name</th>
                <th>Job Name-Job ID</th>
                <th>Applied Date</th>
                <th>Status</th>
                <th>Resume</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {applieddetails.map((detail) => (
                <tr key={detail.applicationid}>
                  <td>{getdisplayprojectid(detail.applicationid)}</td>
                  <td>{detail.candidate_id}</td>
                  <td>{`${detail.first_name} ${detail.last_name}`}</td>
                  <td>{`${detail.job_title} - ${detail.jobid}`}</td>
                  <td>{formatDate(detail.applieddate)}</td>
                  <td>{detail.status}</td>
                  <td>
                    <a href={detail.resumepath} target="_blank" rel="noopener noreferrer">
                      View Resume
                    </a>
                  </td>
                  <td onClick={() => handlesubmit(detail.applicationid, detail.first_name, detail.last_name)}>
                    Schedule Interview
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default SubmittingApplication;
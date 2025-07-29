'use client';
import React, { useEffect, useState } from 'react';
import { fetchdetailsbyid, fetchdetailsconfirm } from '@/app/serverActions/Jobs/Interview/Confirm';
import { useRouter } from 'next/navigation';
import ConfirmEdit from './ConfirmEdit';
import './interview.css';

const Confirm = ({ orgid, empid, interviewdetails, time, handleback }) => {
  const router = useRouter();
  const [details, setdetails] = useState([]);
  const [success, setsuccess] = useState(null);
  const [error, seterror] = useState(null);
  const [selectedid, setselectedid] = useState(null);
  const [selected, setselected] = useState(false);

  useEffect(() => {
    const fetchinterview = async () => {
      try {
        console.log('Fetching interviews with interviewdetails:', JSON.stringify(interviewdetails, null, 2));
        console.log('Time prop:', JSON.stringify(time, null, 2));
        const result = await fetchdetailsconfirm(interviewdetails, time);
        console.log('fetchdetailsconfirm result:', JSON.stringify(result, null, 2));
        if (result.success) {
          setdetails(result.interviews);
          setsuccess('Interviews fetched successfully');
        } else {
          seterror(result.error || 'Error fetching interviews');
        }
      } catch (error) {
        console.error('Error in fetchinterview:', error);
        seterror('Error fetching interviews');
      }
    };
    fetchinterview();
  }, [interviewdetails, time]);

  const formatDate = (date) => {
    if (!date || date === '0000-00-00' || date === 'null') return '';
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

  const formatTime = (time, am_pm, start_date, end_date, start_am_pm) => {
    if (!time || time === 'null') return '';
    const effectiveAmPm = (!am_pm || am_pm === 'null') && start_date === end_date && start_am_pm ? start_am_pm : (am_pm || 'AM');
    return `${time} ${effectiveAmPm}`;
  };

  const fetchid = (interviewid) => {
    console.log('Selected interview_id:', interviewid);
    setselectedid(interviewid);
    setselected(true);
  };

  const handleformback = () => {
    router.refresh();
    setselectedid(null);
    setselected(false);
  };

  return (
    <div className="employee-details-container">
      {selected ? (
        <>
          <button onClick={handleback}>x</button>
          <ConfirmEdit
            alldetails={details}
            selectedid={selectedid}
            orgid={orgid}
            empid={empid}
            handleformback={handleformback}
          />
        </>
      ) : (
        <>
          <button className="back-button" onClick={handleback}>Back to Overview</button>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          <table className="employee-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Interview ID</th>
                <th>Applicant Name</th>
                <th>Start Date</th>
                <th>Start Time</th>
                <th>Job Title</th>
              </tr>
            </thead>
            <tbody>
              {details.map((detail) => (
                <tr key={detail.interview_id} onClick={() => fetchid(detail.interview_id)} className={selectedid === detail.interview_id ? 'selected-row' : ''}>
                  <td>{detail.applicationid}</td>
                  <td>{detail.interview_id}</td>
                  <td>{`${detail.first_name} ${detail.last_name}`}</td>
                  <td>{formatDate(detail.start_date)}</td>
                  <td>{formatTime(detail.start_time, detail.start_am_pm, detail.start_date, detail.end_date, detail.start_am_pm)}</td>
                  <td>{detail.job_title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default Confirm;

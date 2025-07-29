'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Remaining from './Remaining';
import Confirm from './Confirm';
import { fetchDetailsById, update } from '@/app/serverActions/Jobs/Interview/Overview';
import './interview.css';

const Overview = ({ orgid, empid, interviewdetails, time, acceptingtime, interview_completed_details }) => {
  const router = useRouter();
  const params = useSearchParams();
  const [confirm, setisconfirm] = useState(false);
  const [remaining, setremaining] = useState(false);
  const [selectedid, setSelectedid] = useState(null);
  const [selected, setSelected] = useState(false);
  const [iddetails, setIddetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ status: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    handleback();
  }, [params.get("refresh")]);

  const handleconfirm = () => {
    router.refresh();
    setremaining(false);
    setisconfirm(true);
    setSelectedid(null);
    setSelected(false);
    setIsEditing(false);
    setError('');
  };

  const handleremianing = () => {
    router.refresh();
    setremaining(true);
    setisconfirm(false);
    setSelectedid(null);
    setSelected(false);
    setIsEditing(false);
    setError('');
  };

  const handleback = () => {
    router.refresh();
    setremaining(false);
    setisconfirm(false);
    setSelectedid(null);
    setSelected(false);
    setIsEditing(false);
    setError('');
  };

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

  const formatMeetingLink = (link) => {
    if (!link || link === 'null') return '';
    return link;
  };

  const fetchid = async (interview_id) => {
    setIsLoading(true);
    setError('');
    try {
      const acceptingTimeValue = Array.isArray(acceptingtime) && acceptingtime.length > 0 ? acceptingtime[0].Name : '48';
      console.log("valiueeeeeeeeeeeeeeee", acceptingTimeValue);
      const result = await fetchDetailsById({ orgid, interview_id, acceptingtime: acceptingTimeValue, empid });
      if (result.success && result.interview) {
        setIddetails(result.interview);
        setFormData({ status: result.interview.status || '' });
        setCanEdit(result.canEdit);
        if (!result.canEdit) {
          setError('Cannot edit the form as the time limit has exceeded');
        }
        setSelectedid(interview_id);
        setSelected(true);
      } else {
        setError(result.error || 'No interview details found');
      }
    } catch (error) {
      console.error('Error fetching details:', error);
      setError('Error fetching interview details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    console.log('handleEdit called');
    if (!canEdit) {
      setError('Cannot edit: Time window for editing has expired');
      return;
    }
    setTimeout(() => {
      setIsEditing(true);
      setError('');
      setSuccess('');
    }, 0);
  };

  const handleStatusChange = (e) => {
    setFormData({ status: e.target.value });
    setError('');
  };

  const handleViewResume = () => {
    if (iddetails?.resumepath) {
      window.open(iddetails.resumepath, '_blank');
    } else {
      setError('No resume available to view');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('handleSubmit called', { isEditing, formData });
    if (!isEditing) {
      console.warn('Form submission ignored: Not in editing mode');
      return;
    }
    if (!formData.status) {
      setError('Please select a status');
      return;
    }
    setIsLoading(true);
    try {
      const acceptingTimeValue = Array.isArray(acceptingtime) && acceptingtime.length > 0 ? acceptingtime[0].Name : '48';
      const result = await update({
        orgid,
        empid,
        interview_id: selectedid,
        status: formData.status,
        acceptingtime: acceptingTimeValue,
      });
      if (result.success) {
        setSuccess('Interview status updated successfully');
        setIsEditing(false);
        setTimeout(() => {
          setSuccess('');
        }, 2000);
      } else {
        setError(result.error || 'Failed to update interview status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Error updating interview status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="employee-details-container">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {isLoading && <div className="loading-message">Loading...</div>}
      {!remaining && confirm && (
        <Confirm
          orgid={orgid}
          empid={empid}
          interviewdetails={interviewdetails}
          time={time}
          acceptingtime={acceptingtime}
          handleback={handleback}
        />
      )}
      {remaining && !confirm && (
        <Remaining
          orgid={orgid}
          empid={empid}
          interviewdetails={interviewdetails}
          time={time}
          handleback={handleback}
        />
      )}
      {!remaining && !confirm && !selected && (
        <>
          <button  onClick={handleconfirm}>Confirm Interviews</button>
          <button  onClick={handleremianing}>Remaining Interview</button>
          <div>
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Interview ID</th>
                  <th>Applicant Name</th>
                  <th>Job Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {interview_completed_details.map((detail) => (
                  <tr key={detail.interview_id} onClick={() => fetchid(detail.interview_id)}>
                    <td>{detail.applicationid}</td>
                    <td>{detail.interview_id}</td>
                    <td>{`${detail.first_name} ${detail.last_name}`}</td>
                    <td>{detail.job_title}</td>
                    <td>{detail.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!remaining && !confirm && selected && iddetails && (
        <div className="details-block">
            <button onClick={handleback}>x</button>
          <h3>Interview Details (Interview ID: {iddetails.interview_id})</h3>
          <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isEditing) {
                e.preventDefault();
              }
            }}
          >
            <div className="form-row">
              <div className="form-group">
                <label>Application ID</label>
                <input
                  type="text"
                  value={iddetails.applicationid || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div className="form-group">
                <label>Interview ID</label>
                <input
                  type="text"
                  value={iddetails.interview_id || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Applicant Name</label>
                <input
                  type="text"
                  value={`${iddetails.first_name || ''} ${iddetails.last_name || ''}`}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div className="form-group">
                <label>Job Title</label>
                <input
                  type="text"
                  value={iddetails.job_title || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="text"
                  value={formatDate(iddetails.start_date) || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div className="form-group">
                <label>Start Time</label>
                <input
                  type="text"
                  value={formatTime(iddetails.start_time, iddetails.start_am_pm, iddetails.start_date, iddetails.end_date, iddetails.start_am_pm) || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="text"
                  value={formatDate(iddetails.end_date) || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input
                  type="text"
                  value={formatTime(iddetails.end_time, iddetails.end_am_pm, iddetails.start_date, iddetails.end_date, iddetails.start_am_pm) || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Meeting Link</label>
                <input
                  type="text"
                  value={formatMeetingLink(iddetails.meeting_link) || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="text"
                  value={iddetails.email || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Resume</label>
                {iddetails.resumepath ? (
                  <a
                    href={iddetails.resumepath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-resume-link"
                    onClick={handleViewResume}
                  >
                    View Resume
                  </a>
                ) : (
                  <span className="no-resume-text">No resume available</span>
                )}
              </div>
              <div className="form-group">
                <label>Status*</label>
                {isEditing ? (
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleStatusChange}
                    disabled={!canEdit || !isEditing}
                    required
                  >
                    <option value="">Select Status</option>
                    <option value="offerletter-processing">Offerletter Processing</option>
                    <option value="interview-rejected">Interview Rejected</option>
                    <option value="interview-hold">Interview Hold</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={iddetails.status || '-'}
                    disabled
                    readOnly
                    className="bg-gray-100"
                  />
                )}
              </div>
            </div>
            <div className="form-buttons">
              {isEditing ? (
                <>
                  <button
                    type="submit"
                    className="save-button"
                    disabled={isLoading || !canEdit || !isEditing}
                  >
                    {isLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => setIsEditing(false)}
                    disabled={isLoading || !isEditing}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="edit-button"
                    onClick={handleEdit}
                    disabled={!canEdit}
                  >
                    Edit
                  </button>
                  
                </>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Overview;
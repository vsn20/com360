'use client';
import React, { useEffect, useState } from 'react';
import { fetchdetailsbyid, updateInterviewStatus } from '@/app/serverActions/Jobs/Interview/Confirm';
import './interview.css';

const ConfirmEdit = ({ alldetails, selectedid, orgid, empid, handleformback }) => {
  const [iddetails, setiddetails] = useState(null);
  const [formData, setFormData] = useState({
    status: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    const fetchdetails = async () => {
      try {
        console.log('ConfirmEdit - Fetching details for selectedid:', selectedid);
        console.log('ConfirmEdit - alldetails:', JSON.stringify(alldetails, null, 2));
        const result = await fetchdetailsbyid(alldetails, selectedid);
        console.log('ConfirmEdit - fetchdetailsbyid result:', JSON.stringify(result, null, 2));
        if (result.success && result.interviews.length > 0) {
          setiddetails(result.interviews[0]);
          setFormData({
            status: result.interviews[0].status || '',
          });
        } else {
          setError(result.error || 'No interview details found');
        }
      } catch (error) {
        console.error('ConfirmEdit - Error fetching details:', error);
        setError('Error fetching interview details');
      }
    };
    fetchdetails();
  }, [alldetails, selectedid]);

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

  const handleMeetingLink = () => {
    if (iddetails?.meeting_link && iddetails.meeting_link !== 'null') {
      window.open(iddetails.meeting_link, '_blank');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.status) {
      setError('Please select a status');
      return;
    }
    setIsLoading(true);
    try {
      const result = await updateInterviewStatus({
        orgid,
        empid,
        interview_id: selectedid,
        status: formData.status,
      });
      if (result.success) {
        setSuccess('Interview status updated successfully');
        setTimeout(() => {
          setSuccess('');
          handleformback(); // Return to table view after successful update
        }, 2000);
      } else {
        setError(result.error || 'Failed to update interview status');
      }
    } catch (error) {
      console.error('ConfirmEdit - Error updating status:', error);
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
      {iddetails ? (
        <div className="details-block">
          <h3>{`${iddetails.first_name || ''} ${iddetails.last_name || ''}`.trim()} Interview Details</h3>
          <form onSubmit={handleSubmit}>
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
                {iddetails.meeting_link && iddetails.meeting_link !== 'null' ? (
                  <a
                    href={iddetails.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-resume-link"
                    onClick={handleMeetingLink}
                  >
                    Join Meeting
                  </a>
                ) : (
                  <input
                    type="text"
                    value="-"
                    disabled
                    readOnly
                    className="bg-gray-100"
                  />
                )}
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
                  >
                    View Resume
                  </a>
                ) : (
                  <span className="no-resume-text">No resume available</span>
                )}
              </div>
              <div className="form-group">
                <label>Status*</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleStatusChange}
                  required
                >
                  <option value="">Select Status</option>
                  <option value="offerletter-processing">Offerform Processing</option>
                  <option value="interview-hold">Interview Hold</option>
                  <option value="interview-rejected">Interview Rejected</option>
                </select>
              </div>
            </div>
            <div className="form-buttons">
              <button
                type="submit"
                className="save-button"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={handleformback}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="error-message">No interview details available</div>
      )}
    </div>
  );
};

export default ConfirmEdit;
'use client'
import React from 'react'

const Remainingedit = ({ selected_details, orgid, empid, formback }) => {
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

  const handleViewResume = () => {
    if (selected_details?.resumepath) {
      window.open(selected_details.resumepath, '_blank');
    }
  };

  return (
    <div className="details-block">
      <h3>{`${selected_details.first_name || ''} ${selected_details.last_name || ''}`.trim()} Interview Details</h3>
      <div className="form-row">
        <div className="form-group">
          <label>Application ID</label>
          <input
            type="text"
            value={selected_details.applicationid || '-'}
            disabled
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div className="form-group">
          <label>Interview ID</label>
          <input
            type="text"
            value={selected_details.interview_id || '-'}
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
            value={`${selected_details.first_name || ''} ${selected_details.last_name || ''}`}
            disabled
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div className="form-group">
          <label>Job Title</label>
          <input
            type="text"
            value={selected_details.job_title || '-'}
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
            value={formatDate(selected_details.start_date) || '-'}
            disabled
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div className="form-group">
          <label>Start Time</label>
          <input
            type="text"
            value={formatTime(selected_details.start_time, selected_details.start_am_pm, selected_details.start_date, selected_details.end_date, selected_details.start_am_pm) || '-'}
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
            value={formatDate(selected_details.end_date) || '-'}
            disabled
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div className="form-group">
          <label>End Time</label>
          <input
            type="text"
            value={formatTime(selected_details.end_time, selected_details.end_am_pm, selected_details.start_date, selected_details.end_date, selected_details.start_am_pm) || '-'}
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
            value={formatMeetingLink(selected_details.meeting_link) || '-'}
            disabled
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            type="text"
            value={selected_details.email || '-'}
            disabled
            readOnly
            className="bg-gray-100"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Resume</label>
          {selected_details.resumepath ? (
            <a
              href={selected_details.resumepath}
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
          <label>Status</label>
          <input
            type="text"
            value={selected_details.status || '-'}
            disabled
            readOnly
            className="bg-gray-100"
          />
        </div>
      </div>
    </div>
  );
};

export default Remainingedit;
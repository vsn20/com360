'use client'
import React, { useState, useEffect } from 'react';
import { addEmployeeLeave, fetchLeaveTypes } from '@/app/serverActions/Leaves/Addleave';
import './Addleaves.css';

export default function Addleaves({ onBack, availableLeaves }) {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // **NEW**: State to manage the submission process and messages
  const [submissionStatus, setSubmissionStatus] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    const getLeaveTypes = async () => {
      setLoading(true);
      const data = await fetchLeaveTypes();
      if (data.error) setError(data.error);
      else setLeaveTypes(data);
      setLoading(false);
    };
    getLeaveTypes();
  }, []);
  
  // **NEW**: Effect to handle the 2-second redirect on success
  useEffect(() => {
    if (submissionStatus.status === 'success') {
      const timer = setTimeout(() => {
        onBack();
      }, 2000);
      return () => clearTimeout(timer); // Cleanup timer if component unmounts
    }
  }, [submissionStatus.status, onBack]);

  const handleSubmit = async (formData) => {
    setSubmissionStatus({ status: 'submitting', message: '' });
    const result = await addEmployeeLeave(formData);
    
    if (result?.error) {
      // **FIX**: Show alert and stay on the page for errors
      alert(result.error); 
      setSubmissionStatus({ status: 'idle', message: '' }); 
    } else {
      // **FIX**: Show success message on the page, the useEffect will handle redirect
      setSubmissionStatus({ status: 'success', message: 'Leave request submitted successfully!' });
    }
  };

  if (loading) {
    return <div className="addleaves_loading_container"><div className="addleaves_loading_spinner">Loading...</div></div>;
  }
  
  if (error) {
    return <div className="addleaves_error_message">Error: {error}</div>
  }

  return (
    <div className="leaves_add_page_container">
      <h2 className="leaves_add_page_title">Request a Leave</h2>
      <button onClick={onBack} className="leaves_back_button"></button>
      
      {availableLeaves && Object.keys(availableLeaves).length > 0 && (
        <div className="leaves_available_section_add_page">
            <h3 className="leaves_available_title_add_page">Your Available Balance:</h3>
            <div className="leaves_available_list_add_page">
                {Object.entries(availableLeaves).map(([leaveId, leave]) => (
                    <div key={leaveId} className="leaves_available_item_add_page">
                        <span className="leaves_available_name_add_page">{leave.name}</span>
                        <span className="leaves_available_count_add_page">{leave.noofleaves}</span>
                    </div>
                ))}
            </div>
        </div>
      )}

      <div className="leaves_add_container">
        {/* **NEW**: Display success message here */}
        {submissionStatus.status === 'success' && (
          <div className="addleaves_success_message">{submissionStatus.message}</div>
        )}

        <form action={handleSubmit} className="leaves_add_form">
          <fieldset disabled={submissionStatus.status === 'submitting' || submissionStatus.status === 'success'}>
            <div className="addleaves_form_grid">
              <div className="leaves_add_form_group">
                <label htmlFor="leaveid" className="addleaves_form_label">Leave Type <span className="addleaves_required">*</span></label>
                <select id="leaveid" name="leaveid" defaultValue="" required className="addleaves_select_input">
                  <option value="" disabled>Select Leave Type</option>
                  {leaveTypes.map((type) => (<option key={type.id} value={type.id}>{type.Name}</option>))}
                </select>
              </div>
              <div className="leaves_add_form_group">
                <label htmlFor="startdate" className="addleaves_form_label">Start Date <span className="addleaves_required">*</span></label>
                <input type="date" id="startdate" name="startdate" required className="addleaves_date_input"/>
              </div>
            </div>
            <div className="addleaves_form_grid">
              <div className="leaves_add_form_group">
                <label htmlFor="enddate" className="addleaves_form_label">End Date <span className="addleaves_required">*</span></label>
                <input type="date" id="enddate" name="enddate" required className="addleaves_date_input"/>
              </div>
              <div className="leaves_add_form_group">
                <label htmlFor="am_pm" className="addleaves_form_label">Duration <span className="addleaves_required">*</span></label>
                <select id="am_pm" name="am_pm" defaultValue="both" required className="addleaves_select_input">
                  <option value="am">Morning Only</option><option value="pm">Afternoon Only</option><option value="both">Full Day</option>
                </select>
              </div>
            </div>
            <div className="leaves_add_form_group addleaves_full_width">
              <label htmlFor="description" className="addleaves_form_label">Reason for Leave</label>
              <textarea id="description" name="description" rows="4" className="addleaves_textarea_input"></textarea>
            </div>
            <div className="addleaves_form_actions">
              <button type="submit" className="leaves_add_button_submit">
                {submissionStatus.status === 'submitting' ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
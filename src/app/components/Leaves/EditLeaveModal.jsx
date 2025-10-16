'use client'
import React, { useState, useEffect } from 'react';
import { updateEmployeeLeave, fetchLeaveTypes } from '@/app/serverActions/Leaves/Addleave';
import './EditLeaveModal.css';

/**
 * **NEW**: Helper function to convert "MM/DD/YYYY" to "YYYY-MM-DD"
 * This is required for the <input type="date"> element.
 */
const convertDisplayDateToInputDate = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split('/');
  if (parts.length === 3) {
    // parts[0] = MM, parts[1] = DD, parts[2] = YYYY
    return `${parts[2]}-${parts[0]}-${parts[1]}`;
  }
  // Handle case where date might be in YYYY-MM-DD format already
  if (dateString.includes('-')) {
    return dateString.split('T')[0];
  }
  return ''; // Return empty if format is wrong
};

export default function EditLeaveModal({ leave, onClose, onSuccess, canEditAnytime }) {
  const [leaveData, setLeaveData] = useState({
    leaveid: leave.leaveid || '',
    // **FIX**: Use the helper function to set the correct input format
    startdate: convertDisplayDateToInputDate(leave.startdate),
    enddate: convertDisplayDateToInputDate(leave.enddate),
    am_pm: leave.am_pm || 'both',
    description: leave.description || '',
    status: leave.status || 'pending',
  });
  
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const getLeaveTypes = async () => {
      const data = await fetchLeaveTypes();
      if (data && !data.error) {
        setLeaveTypes(data);
      }
    };
    getLeaveTypes();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLeaveData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    Object.keys(leaveData).forEach(key => {
      formData.append(key, leaveData[key]);
    });

    try {
      const result = await updateEmployeeLeave(leave.id, formData);
      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-leave-modal-overlay">
      <div className="edit-leave-modal-content">
        <div className="edit-leave-modal-header">
          <h2>Edit Leave Request</h2>
          <button onClick={onClose} className="modal-close-button">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="edit-leave-modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="leaveid">Leave Type *</label>
              <select id="leaveid" name="leaveid" value={leaveData.leaveid} onChange={handleChange} required>
                <option value="">Select Leave Type</option>
                {leaveTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.Name}</option>
                ))}
              </select>
            </div>
            
            {canEditAnytime && (
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" value={leaveData.status} onChange={handleChange}>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="startdate">Start Date *</label>
              <input id="startdate" type="date" name="startdate" value={leaveData.startdate} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="enddate">End Date *</label>
              <input id="enddate" type="date" name="enddate" value={leaveData.enddate} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="am_pm">Duration *</label>
            <select id="am_pm" name="am_pm" value={leaveData.am_pm} onChange={handleChange} required>
              <option value="am">Morning Only</option>
              <option value="pm">Afternoon Only</option>
              <option value="both">Full Day</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="description">Reason</label>
            <textarea id="description" name="description" value={leaveData.description} onChange={handleChange} rows="3"></textarea>
          </div>
          
          {error && <p className="error-message">{error}</p>}

          <div className="form-actions">
            <button type="button" className="button-cancel" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="button-save" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
'use client'
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addEmployeeLeave, fetchLeaveTypes } from '@/app/serverActions/Leaves/Addleave';
import './Addleaves.css';

export default function Addleaves() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const empId = searchParams.get('empid');
  const [formError, setFormError] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getLeaveTypes = async () => {
      try {
        setLoading(true);
        const data = await fetchLeaveTypes();
        if (data.error) {
          alert(data.error);
          window.location.reload();
        } else {
          setLeaveTypes(data);
        }
      } catch (err) {
        alert('Failed to fetch leave types: ' + err.message);
        window.location.reload();
      } finally {
        setLoading(false);
      }
    };
    getLeaveTypes();
  }, []);

  const handleSubmit = async (formData) => {
    try {
      if (!empId) {
        alert('Employee ID is missing.');
        window.location.reload();
        return;
      }
      formData.append('empid', empId);
      const result = await addEmployeeLeave(formData);
      if (result?.error) {
        alert(result.error);
        window.location.reload();
      } else {
        router.push('/userscreens/leaves?success=Leave%20request%20submitted%20successfully');
      }
    } catch (err) {
      alert('Failed to submit leave request: ' + err.message);
      window.location.reload();
    }
  };

  if (loading) return <div className="loading">Loading leave types...</div>;
  if (formError) {
    alert(formError);
    window.location.reload();
    return null;
  }

  return (
    <div className="container">
      <h2 className="heading">Request a Leave</h2>
      {leaveTypes.length === 0 && <p className="no-leaves">No active leave types available.</p>}
      <form action={handleSubmit} className="leave-form">
        <div className="form-group">
          <label htmlFor="leaveid">Leave Type</label>
          <select id="leaveid" name="leaveid" defaultValue="" required>
            <option value="">Select Leave Type</option>
            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.Name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="startdate">Start Date</label>
          <input type="date" id="startdate" name="startdate" defaultValue="" required />
        </div>
        <div className="form-group">
          <label htmlFor="enddate">End Date</label>
          <input type="date" id="enddate" name="enddate" defaultValue="" required />
        </div>
        <div className="form-group">
          <label htmlFor="am_pm">AM/PM</label>
          <select id="am_pm" name="am_pm" defaultValue="am" required>
            <option value="am">AM</option>
            <option value="pm">PM</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="description">Reason</label>
          <textarea id="description" name="description" rows="4" placeholder="Enter reason for leave"></textarea>
        </div>
        <button type="submit" className="submit-button">Submit Leave Request</button>
      </form>
    </div>
  );
}
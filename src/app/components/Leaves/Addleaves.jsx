'use client'
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addEmployeeLeave, fetchLeaveTypes } from '@/app/serverActions/Leaves/Addleave';
import './Addleaves.css';

export default function Addleaves({ onBack }) { // Accept onBack as a prop
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

  if (loading) {
    return (
      <div className="addleaves_loading_container">
        <div className="addleaves_loading_spinner">Loading leave types...</div>
      </div>
    );
  }
  
  if (formError) {
    alert(formError);
    window.location.reload();
    return null;
  }

  return (
    <div className="leaves_add_page_container">
      <h2 className="leaves_add_page_title">Request a Leave</h2>
      <button onClick={onBack} className="leaves_back_button"></button>
      
      <div className="leaves_add_container">
        <form action={handleSubmit} className="leaves_add_form">
          <div className="addleaves_form_grid">
            <div className="leaves_add_form_group">
              <label htmlFor="leaveid" className="addleaves_form_label">
                Leave Type <span className="addleaves_required">*</span>
              </label>
              <select 
                id="leaveid" 
                name="leaveid" 
                defaultValue="" 
                required 
                className="addleaves_select_input"
              >
                <option value="">Select Leave Type</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.Name}</option>
                ))}
              </select>
            </div>

            <div className="leaves_add_form_group">
              <label htmlFor="startdate" className="addleaves_form_label">
                Start Date <span className="addleaves_required">*</span>
              </label>
              <input 
                type="date" 
                id="startdate" 
                name="startdate" 
                defaultValue="" 
                required 
                className="addleaves_date_input"
              />
            </div>
          </div>

          <div className="addleaves_form_grid">
            <div className="leaves_add_form_group">
              <label htmlFor="enddate" className="addleaves_form_label">
                End Date <span className="addleaves_required">*</span>
              </label>
              <input 
                type="date" 
                id="enddate" 
                name="enddate" 
                defaultValue="" 
                required 
                className="addleaves_date_input"
              />
            </div>

            <div className="leaves_add_form_group">
              <label htmlFor="am_pm" className="addleaves_form_label">
                Duration <span className="addleaves_required">*</span>
              </label>
              <select 
                id="am_pm" 
                name="am_pm" 
                defaultValue="both" 
                required 
                className="addleaves_select_input"
              >
                <option value="am">Morning Only</option>
                <option value="pm">Afternoon Only</option>
                <option value="both">Full Day</option>
              </select>
            </div>
          </div>

          <div className="leaves_add_form_group addleaves_full_width">
            <label htmlFor="description" className="addleaves_form_label">Reason for Leave</label>
            <textarea 
              id="description" 
              name="description" 
              rows="4" 
              placeholder="Please provide a detailed reason for your leave request..."
              className="addleaves_textarea_input"
            ></textarea>
          </div>

          <div className="addleaves_form_actions">
            <button type="submit" className="leaves_add_button_submit">
              Submit Leave Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
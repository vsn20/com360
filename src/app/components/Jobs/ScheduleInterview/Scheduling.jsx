'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { scheduleInterview, getEmployees } from '@/app/serverActions/Jobs/ScheduleInterview/Scheduling';
import './jobtitles.css';

const Scheduling = ({ id, name, orgid, empid, handleback }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [employees, setEmployees] = useState([]);
  const [interviewForm, setInterviewForm] = useState({
    start_date: '',
    start_am_pm: 'AM',
    end_date: '',
    end_am_pm: 'AM',
    start_time: '',
    end_time: '',
    meeting_link: '',
    status: 'scheduled',
  });
  const [panelMembers, setPanelMembers] = useState([]);
  const [newPanelMember, setNewPanelMember] = useState({
    is_he_employee: '1',
    empid: '',
    email: '',
  });
  const [startHours, setStartHours] = useState('');
  const [startMinutes, setStartMinutes] = useState('');
  const [endHours, setEndHours] = useState('');
  const [endMinutes, setEndMinutes] = useState('');

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const result = await getEmployees(orgid);
        if (result.success) {
          setEmployees(result.employees);
        } else {
          setError(result.error || 'Failed to fetch employees.');
        }
      } catch (err) {
        setError('Error fetching employees.');
      }
    };
    fetchEmployees();
  }, [orgid]);

  const handleInterviewChange = (e) => {
    const { name, value } = e.target;
    if (name === 'start_time' || name === 'end_time') {
      // Validate time input (HH:mm, hours 1-12, minutes 00-59)
      if (value && !/^(0?[1-9]|1[0-2]):[0-5][0-9]$/.test(value)) {
        setError('Please enter time in HH:mm format (e.g., 12:30).');
        return;
      }
      const [h, m] = value ? value.split(':').map(Number) : ['', ''];
      if (name === 'start_time') {
        setStartHours(h ? h.toString() : '');
        setStartMinutes(m ? m.toString().padStart(2, '0') : '');
      } else {
        setEndHours(h ? h.toString() : '');
        setEndMinutes(m ? m.toString().padStart(2, '0') : '');
      }
      setInterviewForm((prev) => ({
        ...prev,
        [name]: value,
      }));
      setError('');
    } else {
      setInterviewForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleTimeDropdownChange = (e) => {
    const { name, value } = e.target;
    if (name === 'startHours') {
      setStartHours(value);
      setInterviewForm((prev) => ({
        ...prev,
        start_time: value && startMinutes ? `${value}:${startMinutes}` : '',
      }));
    } else if (name === 'startMinutes') {
      setStartMinutes(value);
      setInterviewForm((prev) => ({
        ...prev,
        start_time: startHours && value ? `${startHours}:${value}` : '',
      }));
    } else if (name === 'endHours') {
      setEndHours(value);
      setInterviewForm((prev) => ({
        ...prev,
        end_time: value && endMinutes ? `${value}:${endMinutes}` : '',
      }));
    } else if (name === 'endMinutes') {
      setEndMinutes(value);
      setInterviewForm((prev) => ({
        ...prev,
        end_time: endHours && value ? `${endHours}:${value}` : '',
      }));
    }
    setError('');
  };

  const handlePanelChange = (e) => {
    const { name, value } = e.target;
    setNewPanelMember((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'empid' && prev.is_he_employee === '1') {
        const selectedEmployee = employees.find((emp) => emp.empid === value);
        updated.email = selectedEmployee ? selectedEmployee.email : '';
      } else if (name === 'is_he_employee' && value === '0') {
        updated.empid = '';
        updated.email = '';
      }
      return updated;
    });
  };

  const handleAddPanelMember = () => {
    if (interviewForm.status === 'hold' || interviewForm.status === 'rejected') return;
    if (newPanelMember.is_he_employee === '1' && !newPanelMember.empid) {
      setError('Please select an employee.');
      return;
    }
    if (newPanelMember.is_he_employee === '0' && !newPanelMember.email) {
      setError('Please enter an email.');
      return;
    }
    let emailToAdd = newPanelMember.email;
    if (newPanelMember.is_he_employee === '1') {
      const selectedEmployee = employees.find((emp) => emp.empid === newPanelMember.empid);
      if (!selectedEmployee || !selectedEmployee.email) {
        setError('Selected employee does not have an email.');
        return;
      }
      emailToAdd = selectedEmployee.email;
    }
    setPanelMembers((prev) => [
      ...prev,
      {
        empid: newPanelMember.is_he_employee === '1' ? newPanelMember.empid : null,
        email: emailToAdd,
        is_he_employee: newPanelMember.is_he_employee,
      },
    ]);
    setNewPanelMember({ is_he_employee: '1', empid: '', email: '' });
    setError('');
  };

  const handleRemovePanelMember = (index) => {
    if (interviewForm.status === 'hold' || interviewForm.status === 'rejected') return;
    setPanelMembers((prev) => prev.filter((_, i) => i !== index));
  };


  
const getdisplayprojectid = (prjid) => {
  return prjid.split('-')[1] || prjid;
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    if (interviewForm.status === 'scheduled') {
      if (!interviewForm.start_date || !interviewForm.start_time) {
        setError('Start date and time are required for scheduled status.');
        setIsLoading(false);
        return;
      }
      if (panelMembers.length === 0) {
        setError('At least one panel member is required for scheduled status.');
        setIsLoading(false);
        return;
      }
      const hasEmployee = panelMembers.some((member) => member.is_he_employee === '1');
      if (!hasEmployee) {
        setError('At least one panel member must be a company employee.');
        setIsLoading(false);
        return;
      }
    }
    const formData = new FormData();
    formData.append('orgid', orgid);
    formData.append('application_id', id);
    formData.append('status', interviewForm.status);
    formData.append('start_date', interviewForm.status === 'scheduled' ? (interviewForm.start_date || '0000-00-00') : null);
    formData.append('start_am_pm', interviewForm.status === 'scheduled' ? (interviewForm.start_am_pm || null) : null);
    formData.append('end_date', interviewForm.status === 'scheduled' ? (interviewForm.end_date || '0000-00-00') : null);
    formData.append('end_am_pm', interviewForm.status === 'scheduled' ? (interviewForm.end_am_pm || null) : null);
    formData.append('start_time', interviewForm.status === 'scheduled' ? (interviewForm.start_time || null) : null);
    formData.append('end_time', interviewForm.status === 'scheduled' ? (interviewForm.end_time || null) : null);
    formData.append('meeting_link', interviewForm.status === 'scheduled' ? (interviewForm.meeting_link || null) : null);
    formData.append('empid', empid);
    formData.append('panelMembers', interviewForm.status === 'scheduled' ? JSON.stringify(panelMembers) : JSON.stringify([]));
    const result = await scheduleInterview(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(`Interview ${interviewForm.status === 'scheduled' ? 'scheduled' : 'status updated'} successfully.`);
      setTimeout(() => {
        handleback();
      }, 2000);
    }
    setIsLoading(false);
  };

  const isNonEditable = interviewForm.status === 'hold' || interviewForm.status === 'rejected';

  // Generate options for hours (1-12) and minutes (00-59)
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className="employee-details-container">
      <h2>Scheduling Interview for {name} (Application ID: {getdisplayprojectid(id)})</h2>
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading-message">Saving...</div>}
      <form onSubmit={handleSubmit} className="details-block">
        <h3>Interview Details</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Status*</label>
            <select
              name="status"
              value={interviewForm.status}
              onChange={handleInterviewChange}
              required
            >
              <option value="scheduled">Scheduled</option>
              <option value="hold">Hold</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Start Date{interviewForm.status === 'scheduled' ? '*' : ''}</label>
            <input
              type="date"
              name="start_date"
              value={interviewForm.start_date}
              onChange={handleInterviewChange}
              required={interviewForm.status === 'scheduled'}
              disabled={isNonEditable}
            />
          </div>
          <div className="form-group time-group">
            <label>Start Time{interviewForm.status === 'scheduled' ? '*' : ''}</label>
            <div className="time-inputs">
              <input
                type="text"
                name="start_time"
                value={interviewForm.start_time}
                onChange={handleInterviewChange}
                placeholder="HH:mm"
                required={interviewForm.status === 'scheduled'}
                disabled={isNonEditable}
                className="time-text-input"
              />
              <select
                name="startHours"
                value={startHours}
                onChange={handleTimeDropdownChange}
                disabled={isNonEditable}
                className="time-select"
              >
                <option value="">HH</option>
                {hourOptions.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span>:</span>
              <select
                name="startMinutes"
                value={startMinutes}
                onChange={handleTimeDropdownChange}
                disabled={isNonEditable}
                className="time-select"
              >
                <option value="">MM</option>
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>AM/PM</label>
            <select
              name="start_am_pm"
              value={interviewForm.start_am_pm}
              onChange={handleInterviewChange}
              disabled={isNonEditable}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              name="end_date"
              value={interviewForm.end_date}
              onChange={handleInterviewChange}
              disabled={isNonEditable}
            />
          </div>
          <div className="form-group time-group">
            <label>End Time</label>
            <div className="time-inputs">
              <input
                type="text"
                name="end_time"
                value={interviewForm.end_time}
                onChange={handleInterviewChange}
                placeholder="HH:mm"
                disabled={isNonEditable}
                className="time-text-input"
              />
              <select
                name="endHours"
                value={endHours}
                onChange={handleTimeDropdownChange}
                disabled={isNonEditable}
                className="time-select"
              >
                <option value="">HH</option>
                {hourOptions.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span>:</span>
              <select
                name="endMinutes"
                value={endMinutes}
                onChange={handleTimeDropdownChange}
                disabled={isNonEditable}
                className="time-select"
              >
                <option value="">MM</option>
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>AM/PM</label>
            <select
              name="end_am_pm"
              value={interviewForm.end_am_pm}
              onChange={handleInterviewChange}
              disabled={isNonEditable}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Meeting Link</label>
            <input
              type="url"
              name="meeting_link"
              value={interviewForm.meeting_link}
              onChange={handleInterviewChange}
              placeholder="Enter meeting link"
              disabled={isNonEditable}
            />
          </div>
        </div>
        <h3>Interview Panel</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Is Panel Member an Employee?</label>
            <select
              name="is_he_employee"
              value={newPanelMember.is_he_employee}
              onChange={handlePanelChange}
              disabled={isNonEditable}
            >
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
          {newPanelMember.is_he_employee === '1' ? (
            <>
              <div className="form-group">
                <label>Select Employee</label>
                <select
                  name="empid"
                  value={newPanelMember.empid}
                  onChange={handlePanelChange}
                  disabled={isNonEditable}
                >
                  <option value="">Select an employee</option>
                  {employees.map((emp) => (
                    <option key={emp.empid} value={emp.empid}>
                      {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME} (${emp.empid})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={newPanelMember.email}
                  readOnly
                  className="bg-gray-100"
                  placeholder="Employee email"
                  disabled={isNonEditable}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={newPanelMember.email}
                onChange={handlePanelChange}
                placeholder="Enter email"
                disabled={isNonEditable}
              />
            </div>
          )}
          <div className="form-group">
            <button
              type="button"
              className="save-button"
              onClick={handleAddPanelMember}
              disabled={isNonEditable}
            >
              Add Panel Member
            </button>
          </div>
        </div>
        {panelMembers.length > 0 && (
          <div className="details-block">
            <h4>Added Panel Members</h4>
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Email</th>
                  <th>Employee Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {panelMembers.map((member, index) => {
                  const employee = member.is_he_employee === '1' ? employees.find((emp) => emp.empid === member.empid) : null;
                  return (
                    <tr key={index}>
                      <td>{member.empid || 'N/A'}</td>
                      <td>{employee ? employee.email : member.email || 'N/A'}</td>
                      <td>{member.is_he_employee === '1' ? 'Employee' : 'Non-Employee'}</td>
                      <td>
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() => handleRemovePanelMember(index)}
                          disabled={isNonEditable}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="form-buttons">
          <button type="submit" className="save-button" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            className="cancel-button"
            onClick={handleback}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default Scheduling;
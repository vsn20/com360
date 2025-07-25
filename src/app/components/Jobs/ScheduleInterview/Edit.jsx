'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchInterviewData, updateInterview, getEmployees } from '@/app/serverActions/Jobs/ScheduleInterview/EditInterview';
import './jobtitles.css';

const Edit = ({ id, orgid, empid, handleback, time }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [interviewDetails, setInterviewDetails] = useState(null);
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
  const [isTimeExceeded, setIsTimeExceeded] = useState(false);

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

  const formatTime = (time, am_pm) => {
    if (!time || time === 'null' || !am_pm || am_pm === 'null') return '';
    return `${time} ${am_pm}`;
  };

  const formatMeetingLink = (link) => {
    if (!link || link === 'null') return '';
    return link;
  };

  // Initialize form with interview data when entering edit mode
  const initializeEditForm = (details) => {
    setInterviewForm({
      start_date: formatDate(details.start_date),
      start_am_pm: details.start_am_pm || 'AM',
      end_date: formatDate(details.end_date),
      end_am_pm: details.end_am_pm || 'AM',
      start_time: details.start_time || '',
      end_time: details.end_time || '',
      meeting_link: formatMeetingLink(details.meeting_link),
      status: details.status || 'scheduled',
    });
  };

  // Check if current time exceeds start_time minus hours from time prop
  const checkTimeExceeded = () => {
    if (!interviewDetails || !interviewDetails.start_date || !interviewDetails.start_time || !interviewDetails.start_am_pm) {
      setIsTimeExceeded(false); // Default to false if data is incomplete
      return;
    }

    const hoursOffset = time && time.length > 0 ? parseInt(time[0].Name, 10) : 0;
    if (isNaN(hoursOffset)) {
      console.error('Invalid hours offset in time prop:', time);
      setIsTimeExceeded(true);
      return;
    }

    // Format and validate start_date
    const formattedStartDate = formatDate(interviewDetails.start_date);
    if (!formattedStartDate) {
      console.warn('Invalid start_date format:', interviewDetails.start_date);
      setIsTimeExceeded(false);
      return;
    }

    // Parse start_date and start_time
    const [year, month, day] = formattedStartDate.split('-').map(Number);
    let [hours, minutes] = interviewDetails.start_time.split(':').map(Number);
    if (interviewDetails.start_am_pm === 'PM' && hours !== 12) hours += 12;
    if (interviewDetails.start_am_pm === 'AM' && hours === 12) hours = 0;

    // Create Date object for start time (assuming IST, adjust if server uses another timezone)
    const startDateTime = new Date(year, month - 1, day, hours, minutes);

    // Subtract hoursOffset
    startDateTime.setHours(startDateTime.getHours() - hoursOffset);

    // Compare with current time (12:55 AM IST, July 26, 2025)
    const currentTime = new Date('2025-07-26T00:55:00+05:30');
    setIsTimeExceeded(currentTime > startDateTime);
  };

  useEffect(() => {
    checkTimeExceeded();
  }, [interviewDetails, time]);

  // Fetch interview data and employees
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const result = await fetchInterviewData(orgid, id);
        if (result.success) {
          setInterviewDetails(result.interview);
          setPanelMembers(result.panelMembers.map(member => ({
            ...member,
            is_he_employee: String(member.is_he_employee),
          })) || []);
          setEmployees(result.employees || []);
          setError('');
        } else {
          setError(result.error || 'Failed to fetch interview data.');
        }
      } catch (err) {
        setError('Error fetching interview data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [orgid, id]);

  const handleInterviewChange = (e) => {
    if (isTimeExceeded) return;
    const { name, value } = e.target;
    setInterviewForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePanelChange = (e) => {
    if (isTimeExceeded) return;
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
    if (isTimeExceeded) return;
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
    if (isTimeExceeded) return;
    setPanelMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEdit = () => {
    if (isTimeExceeded) return;
    if (interviewDetails) {
      initializeEditForm(interviewDetails);
    }
    setIsEditing(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isTimeExceeded) return;
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
    formData.append('start_date', interviewForm.start_date || '0000-00-00');
    formData.append('start_am_pm', interviewForm.start_am_pm || null);
    formData.append('end_date', interviewForm.end_date || '0000-00-00');
    formData.append('end_am_pm', interviewForm.end_am_pm || null);
    formData.append('start_time', interviewForm.start_time || null);
    formData.append('end_time', interviewForm.end_time || null);
    formData.append('meeting_link', interviewForm.meeting_link || null);
    formData.append('status', interviewForm.status);
    formData.append('empid', empid);
    formData.append('panelMembers', JSON.stringify(panelMembers));

    try {
      const result = await updateInterview(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        setSuccess('Interview updated successfully.');
        setIsEditing(false);
        const updatedDetails = await fetchInterviewData(orgid, id);
        if (updatedDetails.success) {
          setInterviewDetails(updatedDetails.interview);
          initializeEditForm(updatedDetails.interview);
          setPanelMembers(updatedDetails.panelMembers.map(member => ({
            ...member,
            is_he_employee: String(member.is_he_employee),
          })) || []);
        }
        setTimeout(() => {
          setSuccess(null);
         
        }, 2000);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isNonEditable = interviewForm.status === 'hold' || interviewForm.status === 'rejected' || isTimeExceeded;

  return (
    <div className="employee-details-container">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {isLoading && <div className="loading-message">Loading...</div>}
      {isTimeExceeded && (
        <div className="error-message">
          You cannot edit now as time exceeded.
        </div>
      )}
      {interviewDetails && (
        <div className="details-block">
          <h3>Interview Details (Application ID: {id})</h3>
          {isEditing ? (
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Status*</label>
                  <select
                    name="status"
                    value={interviewForm.status}
                    onChange={handleInterviewChange}
                    required
                    disabled={isNonEditable}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="hold">Hold</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    name="start_date"
                    value={interviewForm.start_date}
                    onChange={handleInterviewChange}
                    placeholder={formatDate(interviewDetails.start_date) || 'Enter Start Date'}
                    disabled={isNonEditable}
                    readOnly={isNonEditable}
                  />
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    name="start_time"
                    value={interviewForm.start_time}
                    onChange={handleInterviewChange}
                    placeholder={formatTime(interviewDetails.start_time, interviewDetails.start_am_pm) || 'Enter Start Time'}
                    disabled={isNonEditable}
                    readOnly={isNonEditable}
                  />
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
                    placeholder={formatDate(interviewDetails.end_date) || 'Enter End Date'}
                    disabled={isNonEditable}
                    readOnly={isNonEditable}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    name="end_time"
                    value={interviewForm.end_time}
                    onChange={handleInterviewChange}
                    placeholder={formatTime(interviewDetails.end_time, interviewDetails.end_am_pm) || 'Enter End Time'}
                    disabled={isNonEditable}
                    readOnly={isNonEditable}
                  />
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
                    placeholder={formatMeetingLink(interviewDetails.meeting_link) || 'Enter meeting link'}
                    disabled={isNonEditable}
                    readOnly={isNonEditable}
                  />
                </div>
              </div>

              {interviewForm.status === 'scheduled' && (
                <>
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
                </>
              )}

              <div className="form-buttons">
                <button type="submit" className="save-button" disabled={isLoading || isNonEditable}>
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setIsEditing(false)}
                  disabled={isLoading || isNonEditable}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="view-details">
              <div className="details-row">
                <div className="details-group">
                  <label>Status</label>
                  <p>{interviewDetails.status || '-'}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-group">
                  <label>Start Date</label>
                  <p>{(interviewDetails.status === 'hold' || interviewDetails.status === 'rejected') ? '-' : (formatDate(interviewDetails.start_date) || '-')}</p>
                </div>
                <div className="details-group">
                  <label>Start Time</label>
                  <p>{(interviewDetails.status === 'hold' || interviewDetails.status === 'rejected') ? '-' : (formatTime(interviewDetails.start_time, interviewDetails.start_am_pm) || '-')}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-group">
                  <label>End Date</label>
                  <p>{(interviewDetails.status === 'hold' || interviewDetails.status === 'rejected') ? '-' : (formatDate(interviewDetails.end_date) || '-')}</p>
                </div>
                <div className="details-group">
                  <label>End Time</label>
                  <p>{(interviewDetails.status === 'hold' || interviewDetails.status === 'rejected') ? '-' : (formatTime(interviewDetails.end_time, interviewDetails.end_am_pm) || '-')}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-group">
                  <label>Meeting Link</label>
                  <p>{(interviewDetails.status === 'hold' || interviewDetails.status === 'rejected') ? '-' : (formatMeetingLink(interviewDetails.meeting_link) || '-')}</p>
                </div>
              </div>
              {panelMembers.length > 0 && interviewDetails.status === 'scheduled' && (
                <div className="details-block">
                  <h4>Interview Panel</h4>
                  <table className="employee-table">
                    <thead>
                      <tr>
                        <th>Employee ID</th>
                        <th>Email</th>
                        <th>Employee Status</th>
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="details-buttons">
                <button className="edit-button" onClick={handleEdit} disabled={isTimeExceeded}>
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Edit;
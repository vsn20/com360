'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchInterviewData, updateInterview, getEmployees } from '@/app/serverActions/Jobs/ScheduleInterview/EditInterview';
import './jobtitles.css';

const Edit = ({ id, orgid, empid, handleback, time, status }) => {
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
    status: status,
  });
  const [panelMembers, setPanelMembers] = useState([]);
  const [newPanelMember, setNewPanelMember] = useState({
    is_he_employee: '1',
    empid: '',
    email: '',
  });
  const [isTimeExceeded, setIsTimeExceeded] = useState(false);
  // Dropdown states for hours and minutes
  const [startHours, setStartHours] = useState('');
  const [startMinutes, setStartMinutes] = useState('');
  const [endHours, setEndHours] = useState('');
  const [endMinutes, setEndMinutes] = useState('');


const getdisplayprojectid = (prjid) => {
  return prjid.split('-')[1] || prjid;
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

  const initializeEditForm = (details) => {
    const startTime = details.start_time || '';
    const endTime = details.end_time || '';
    // Parse start_time and end_time for dropdowns
    const [startH, startM] = startTime ? startTime.split(':').map(Number) : ['', ''];
    const [endH, endM] = endTime ? startTime.split(':').map(Number) : ['', ''];
    setInterviewForm({
      start_date: formatDate(details.start_date),
      start_am_pm: details.start_am_pm || 'AM',
      end_date: formatDate(details.end_date),
      end_am_pm: details.end_am_pm || 'AM',
      start_time: startTime,
      end_time: endTime,
      meeting_link: formatMeetingLink(details.meeting_link),
      status: details.status || 'scheduled',
    });
    setStartHours(startH ? startH.toString() : '');
    setStartMinutes(startM ? startM.toString().padStart(2, '0') : '');
    setEndHours(endH ? endH.toString() : '');
    setEndMinutes(endM ? endM.toString().padStart(2, '0') : '');
  };

  const checkTimeExceeded = () => {
    if (!interviewDetails || !interviewDetails.start_date || !interviewDetails.start_time || !interviewDetails.start_am_pm) {
      setIsTimeExceeded(false);
      return;
    }
    const hoursOffset = time && time.length > 0 ? parseInt(time[0].Name, 10) : 0;
    if (isNaN(hoursOffset)) {
      console.error('Invalid hours offset in time prop:', time);
      setIsTimeExceeded(true);
      return;
    }
    const formattedStartDate = formatDate(interviewDetails.start_date);
    if (!formattedStartDate) {
      console.warn('Invalid start_date format:', interviewDetails.start_date);
      setIsTimeExceeded(false);
      return;
    }
    const [year, month, day] = formattedStartDate.split('-').map(Number);
    let [hours, minutes] = interviewDetails.start_time.split(':').map(Number);
    if (interviewDetails.start_am_pm === 'PM' && hours !== 12) hours += 12;
    if (interviewDetails.start_am_pm === 'AM' && hours === 12) hours = 0;
    const startDateTime = new Date(year, month - 1, day, hours, minutes);
    startDateTime.setHours(startDateTime.getHours() - hoursOffset);
    const currentTime = new Date();
    setIsTimeExceeded(currentTime > startDateTime);
  };

  useEffect(() => {
    checkTimeExceeded();
  }, [interviewDetails, time]);

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
          setEmployees(Array.isArray(result.employees) ? result.employees : []);
          setError('');
        } else if (result.error === 'Interview not found.') {
          // Show form for new interview and fetch employees
          setInterviewDetails(null);
          setPanelMembers([]);
          const employeeData = await getEmployees(orgid);
          setEmployees(employeeData.success?employeeData.employees:[]);
          setInterviewForm({
            start_date: '',
            start_am_pm: 'AM',
            end_date: '',
            end_am_pm: 'AM',
            start_time: '',
            end_time: '',
            meeting_link: '',
            status: status,
          });
          setStartHours('');
          setStartMinutes('');
          setEndHours('');
          setEndMinutes('');
          setIsEditing(true);
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
    if (name === 'start_time' || name === 'end_time') {
      // Validate and parse time input (HH:mm)
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
    if (isTimeExceeded) return;
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
    if (isTimeExceeded || interviewForm.status === 'hold' || interviewForm.status === 'rejected') return;
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
    if (isTimeExceeded || interviewForm.status === 'hold' || interviewForm.status === 'rejected') return;
    setPanelMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEdit = () => {
    if (isTimeExceeded) {
      setError('Cannot edit: Interview time has already passed.');
      return;
    }
    if (!interviewDetails || !interviewDetails.start_date || !interviewDetails.start_time || !interviewDetails.start_am_pm) {
      setError('Cannot edit: Incomplete interview details.');
      return;
    }
    const hoursOffset = time && time.length > 0 ? parseInt(time[0].Name, 10) : 0;
    if (isNaN(hoursOffset)) {
      setError('Cannot edit: Invalid hours offset in time prop.');
      return;
    }
    const formattedStartDate = formatDate(interviewDetails.start_date);
    if (!formattedStartDate) {
      setError('Cannot edit: Invalid start date format.');
      return;
    }
    const [year, month, day] = formattedStartDate.split('-').map(Number);
    let [hours, minutes] = interviewDetails.start_time.split(':').map(Number);
    if (interviewDetails.start_am_pm === 'PM' && hours !== 12) hours += 12;
    if (interviewDetails.start_am_pm === 'AM' && hours === 12) hours = 0;
    const startDateTime = new Date(year, month - 1, day, hours, minutes);
    startDateTime.setHours(startDateTime.getHours() - hoursOffset);
    const currentTime = new Date();
    const currentDateStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
    const adjustedStartDateStr = formatDate(startDateTime);
    if (adjustedStartDateStr > currentDateStr) {
      initializeEditForm(interviewDetails);
      setIsEditing(true);
      setError('');
    } else if (adjustedStartDateStr < currentDateStr) {
      setError('Cannot edit: Interview start time is in the past.');
    } else {
      let adjustedHours = startDateTime.getHours();
      let adjustedMinutes = startDateTime.getMinutes();
      const adjustedAmPm = adjustedHours >= 12 ? 'PM' : 'AM';
      adjustedHours = adjustedHours % 12 || 12;
      const adjustedTotalMinutes = adjustedHours * 60 + adjustedMinutes;
      let currentHours = currentTime.getHours();
      let currentMinutes = currentTime.getMinutes();
      const currentAmPm = currentHours >= 12 ? 'PM' : 'AM';
      currentHours = currentHours % 12 || 12;
      const currentTotalMinutes = currentHours * 60 + currentMinutes;
      let adjustedTotalMinutes24 = adjustedTotalMinutes;
      if (adjustedAmPm === 'PM' && adjustedHours !== 12) adjustedTotalMinutes24 += 12 * 60;
      if (adjustedAmPm === 'AM' && adjustedHours === 12) adjustedTotalMinutes24 -= 12 * 60;
      let currentTotalMinutes24 = currentTotalMinutes;
      if (currentAmPm === 'PM' && currentHours !== 12) currentTotalMinutes24 += 12 * 60;
      if (currentAmPm === 'AM' && currentHours === 12) currentTotalMinutes24 -= 12 * 60;
      if (adjustedTotalMinutes24 > currentTotalMinutes24) {
        initializeEditForm(interviewDetails);
        setIsEditing(true);
        setError('');
      } else {
        setError('Cannot edit: Interview start time is in the past.');
      }
    }
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
    formData.append('start_date', interviewForm.status === 'scheduled' ? interviewForm.start_date : null);
    formData.append('start_am_pm', interviewForm.status === 'scheduled' ? interviewForm.start_am_pm : null);
    formData.append('end_date', interviewForm.status === 'scheduled' ? interviewForm.end_date : null);
    formData.append('end_am_pm', interviewForm.status === 'scheduled' ? interviewForm.end_am_pm : null);
    formData.append('start_time', interviewForm.status === 'scheduled' ? interviewForm.start_time : null);
    formData.append('end_time', interviewForm.status === 'scheduled' ? interviewForm.end_time : null);
    formData.append('meeting_link', interviewForm.status === 'scheduled' ? interviewForm.meeting_link : null);
    formData.append('status', interviewForm.status);
    formData.append('empid', empid);
    formData.append('panelMembers', interviewForm.status === 'scheduled' ? JSON.stringify(panelMembers) : JSON.stringify([]));
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
          setSuccess('');
          router.refresh();
        }, 2000);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isNonEditable = isTimeExceeded || interviewForm.status === 'hold' || interviewForm.status === 'rejected';

  // Generate options for hours (1-12) and minutes (00-59)
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

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
      {!interviewDetails && (
        <div className="details-block">
          <h3>Create New Interview (Application ID: {getdisplayprojectid(id)})</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Status*</label>
                <select
                  name="status"
                  value={interviewForm.status}
                  onChange={handleInterviewChange}
                  required
                  disabled={isTimeExceeded}
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
                  placeholder="Enter Start Date"
                  disabled={isNonEditable}
                  readOnly={isNonEditable}
                />
              </div>
              <div className="form-group time-group">
                <label>Start Time</label>
                <div className="time-inputs">
                  <input
                    type="text"
                    name="start_time"
                    value={interviewForm.start_time}
                    onChange={handleInterviewChange}
                    placeholder="HH:mm"
                    disabled={isNonEditable}
                    readOnly={isNonEditable}
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
                  placeholder="Enter End Date"
                  disabled={isNonEditable}
                  readOnly={isNonEditable}
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
                    readOnly={isNonEditable}
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
                  readOnly={isNonEditable}
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
              <button type="submit" className="save-button" disabled={isLoading || isTimeExceeded}>
                {isLoading ? 'Saving...' : 'Create'}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => setIsEditing(false)}
                disabled={isLoading || isTimeExceeded}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {interviewDetails && !isEditing && (
        <div className="details-block">
          <h3>Interview Details (Application ID: {getdisplayprojectid(id)})</h3>
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
                <p>{(interviewDetails.status === 'hold' || interviewDetails.status === 'rejected') ? '-' : (formatTime(interviewDetails.start_time, interviewDetails.start_am_pm, interviewDetails.start_date, interviewDetails.end_date, interviewDetails.start_am_pm) || '-')}</p>
              </div>
            </div>
            <div className="details-row">
              <div className="details-group">
                <label>End Date</label>
                <p>{(interviewDetails.status === 'hold' || interviewDetails.status === 'rejected') ? '-' : (formatDate(interviewDetails.end_date) || '-')}</p>
              </div>
              <div className="details-group">
                <label>End Time</label>
                <p>{(interviewDetails.status === 'hold' || interviewDetails.status === 'rejected') ? '-' : (formatTime(interviewDetails.end_time, interviewDetails.end_am_pm, interviewDetails.start_date, interviewDetails.end_date, interviewDetails.start_am_pm) || '-')}</p>
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
                          <td>{member.empid || '-'}</td>
                          <td>{employee ? employee.email || '-' : member.email || '-'}</td>
                          <td>{member.is_he_employee === '1' ? 'Employee' : 'Non-employee'}</td>
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
        </div>
      )}
      {interviewDetails && isEditing && (
        <div className="details-block">
          <h3>Edit Interview (Application ID: {id})</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Status*</label>
                <select
                  name="status"
                  value={interviewForm.status}
                  onChange={handleInterviewChange}
                  required
                  disabled={isTimeExceeded}
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
                  placeholder="Enter Start Date"
                  disabled={isNonEditable}
                  readOnly={isNonEditable}
                />
              </div>
              <div className="form-group time-group">
                <label>Start Time</label>
                <div className="time-inputs">
                  <input
                    type="text"
                    name="start_time"
                    value={interviewForm.start_time}
                    onChange={handleInterviewChange}
                    placeholder="HH:mm"
                    disabled={isNonEditable}
                    readOnly={isNonEditable}
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
                  placeholder="Enter End Date"
                  disabled={isNonEditable}
                  readOnly={isNonEditable}
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
                    readOnly={isNonEditable}
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
                  readOnly={isNonEditable}
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
              <button type="submit" className="save-button" disabled={isLoading || isTimeExceeded}>
                {isLoading ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => setIsEditing(false)}
                disabled={isLoading || isTimeExceeded}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Edit;
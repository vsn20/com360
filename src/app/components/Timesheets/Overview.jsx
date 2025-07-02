'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchTimesheetAndProjects, fetchTimesheetsForSuperior, saveTimesheet, removeAttachment } from '@/app/serverActions/Timesheets/Overview';
import './Overview.css';

const Overview = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [timesheets, setTimesheets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeTimesheets, setEmployeeTimesheets] = useState([]);
  const [employeeProjects, setEmployeeProjects] = useState({});
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [attachments, setAttachments] = useState({});
  const [noAttachmentFlags, setNoAttachmentFlags] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedComment, setSelectedComment] = useState({ timesheetId: null, day: null });
  const fileInputs = useRef({});

  const getWeekStartDate = (date) => {
    try {
      const d = new Date(date);
      if (isNaN(d)) throw new Error('Invalid date');
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      return d.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setSuccess(false);
      setNoAttachmentFlags({});
      setAttachments({});
      setSelectedComment({ timesheetId: null, day: null });
      fileInputs.current = {};
      const weekStart = getWeekStartDate(selectedDate);

      const individualResult = await fetchTimesheetAndProjects(weekStart);
      if (individualResult.error) {
        setError(individualResult.error);
        setTimesheets([]);
        setProjects([]);
      } else {
        setTimesheets(individualResult.timesheets || []);
        setProjects(individualResult.projects || []);
        setAttachments(individualResult.attachments || {});
        setNoAttachmentFlags(
          Object.fromEntries(
            (individualResult.timesheets || []).map((ts) => [
              ts.timesheet_id || ts.temp_key,
              false,
            ])
          )
        );
      }

      const superiorResult = await fetchTimesheetsForSuperior(weekStart);
      if (superiorResult.error) {
        setEmployees([]);
        setEmployeeTimesheets([]);
        setEmployeeProjects({});
      } else {
        setEmployees(superiorResult.employees || []);
        setEmployeeTimesheets(superiorResult.timesheets || []);
        setEmployeeProjects(superiorResult.projects || {});
        setAttachments((prev) => ({ ...prev, ...superiorResult.attachments }));
        setNoAttachmentFlags((prev) => ({
          ...prev,
          ...Object.fromEntries(
            (superiorResult.timesheets || []).map((ts) => [
              ts.timesheet_id || ts.temp_key,
              false,
            ])
          ),
        }));
      }
    };
    fetchData();
  }, [selectedDate]);

  const formatDate = (date) => {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
  };

  const getDateForDay = (baseDate, dayOffset) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dayOffset);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `${month}/${day} ${dayName}`;
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setSelectedEmployee('');
    setError(null);
    setSuccess(false);
    setAttachments({});
    setNoAttachmentFlags({});
    setSelectedComment({ timesheetId: null, day: null });
    fileInputs.current = {};
  };

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate.toISOString().split('T')[0]);
    setSelectedEmployee('');
    setError(null);
    setSuccess(false);
    setAttachments({});
    setNoAttachmentFlags({});
    setSelectedComment({ timesheetId: null, day: null });
    fileInputs.current = {};
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate.toISOString().split('T')[0]);
    setSelectedEmployee('');
    setError(null);
    setSuccess(false);
    setAttachments({});
    setNoAttachmentFlags({});
    setSelectedComment({ timesheetId: null, day: null });
    fileInputs.current = {};
  };

  const handleInputChange = (e, timesheetId, empId = null, day = null) => {
    const { name, value } = e.target;
    const updateTimesheets = (prev) =>
      prev.map((t) =>
        (t.timesheet_id === timesheetId || t.temp_key === timesheetId) && (!t.is_submitted || t.is_submitted === 0)
          ? { ...t, [name]: value === '' ? null : value }
          : t
      );
    if (empId) {
      setEmployeeTimesheets(updateTimesheets);
    } else {
      setTimesheets(updateTimesheets);
    }
    if (day && name.includes('_comment')) {
      setSelectedComment({ timesheetId, day });
    }
  };

  const handleCommentFocus = (timesheetId, day) => {
    setSelectedComment({ timesheetId, day });
  };

  const handleNoAttachmentChange = (timesheetId, checked) => {
    setNoAttachmentFlags((prev) => ({
      ...prev,
      [timesheetId]: checked,
    }));
    if (checked && fileInputs.current[timesheetId]) {
      fileInputs.current[timesheetId].value = '';
    }
  };

  const handleApprovedChange = (e, empId) => {
    const isApproved = e.target.checked ? 1 : 0;
    setEmployeeTimesheets((prev) =>
      prev.map((t) =>
        t.employee_id === empId && t.is_submitted === 1 ? { ...t, is_approved: isApproved } : t
      )
    );
  };

  const handleSave = async (isSubmit = false) => {
    const weekStart = getWeekStartDate(selectedDate);
    const formDataArray = [];
    const targetTimesheets = selectedEmployee ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee) : timesheets;

    for (const ts of targetTimesheets) {
      if (isSubmit && ts.is_submitted === 1) continue;
      const formData = new FormData();
      formData.append('project_id', ts.project_id);
      formData.append('week_start_date', weekStart);
      formData.append('year', ts.year);
      formData.append('timesheet_id', ts.timesheet_id || '');
      formData.append('employee_id', ts.employee_id);
      formData.append('is_approved', ts.is_approved || 0);
      ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach((day) => {
        formData.append(`${day}_hours`, ts[`${day}_hours`] ?? '');
        formData.append(`${day}_comment`, ts[`${day}_comment`] ?? '');
      });
      formData.append('is_submitted', isSubmit ? 1 : ts.is_submitted || 0);
      const attachmentKey = `attachment_${ts.timesheet_id || ts.temp_key}`;
      const fileInput = fileInputs.current[ts.timesheet_id || ts.temp_key];
      if (fileInput?.files[0]) {
        formData.append('attachment', fileInput.files[0]);
      }
      formDataArray.push({ formData, empId: ts.employee_id, timesheetId: ts.timesheet_id || ts.temp_key });
    }

    if (!formDataArray.length) {
      setError('No editable timesheets to save or submit.');
      return;
    }

    try {
      const updatedAttachments = { ...attachments };
      for (const { formData, timesheetId } of formDataArray) {
        const result = await saveTimesheet(formData);
        if (result.error) {
          setError(result.error || 'Failed to save timesheet.');
          return;
        }
        if (result.attachments && result.timesheetId) {
          updatedAttachments[result.timesheetId] = result.attachments;
          setNoAttachmentFlags((prev) => ({
            ...prev,
            [timesheetId]: false,
            [result.timesheetId]: false,
          }));
          if (fileInputs.current[timesheetId]) {
            fileInputs.current[timesheetId].value = '';
          }
          if (result.timesheetId !== timesheetId) {
            setTimesheets((prev) =>
              prev.map((t) =>
                t.temp_key === timesheetId ? { ...t, timesheet_id: result.timesheetId, temp_key: undefined } : t
              )
            );
            setEmployeeTimesheets((prev) =>
              prev.map((t) =>
                t.temp_key === timesheetId ? { ...t, timesheet_id: result.timesheetId, temp_key: undefined } : t
              )
            );
          }
        }
      }
      setAttachments(updatedAttachments);

      if (isSubmit) {
        const invalidTimesheets = targetTimesheets.filter((ts) => {
          const timesheetId = ts.timesheet_id || ts.temp_key;
          const hasAttachment = updatedAttachments[timesheetId]?.length > 0 || fileInputs.current[timesheetId]?.files[0];
          const hasNoAttachmentFlag = noAttachmentFlags[timesheetId];
          return !hasAttachment && !hasNoAttachmentFlag;
        });

        if (invalidTimesheets.length > 0) {
          setError('All timesheets must have an attachment or "No Attachment" checked to submit.');
          return;
        }

        const submitFormDataArray = formDataArray.map(({ formData, empId, timesheetId }) => {
          const newFormData = new FormData();
          for (const [key, value] of formData.entries()) {
            newFormData.append(key, key === 'is_submitted' ? '1' : value);
          }
          return { formData: newFormData, empId, timesheetId };
        });

        const updatedSubmitAttachments = { ...updatedAttachments };
        for (const { formData, timesheetId } of submitFormDataArray) {
          const result = await saveTimesheet(formData);
          if (result.error) {
            setError(result.error || 'Failed to submit timesheet.');
            return;
          }
          if (result.attachments && result.timesheetId) {
            updatedSubmitAttachments[result.timesheetId] = result.attachments;
            setNoAttachmentFlags((prev) => ({
              ...prev,
              [timesheetId]: false,
              [result.timesheetId]: false,
            }));
            if (fileInputs.current[timesheetId]) {
              fileInputs.current[timesheetId].value = '';
            }
          }
        }
        setAttachments(updatedSubmitAttachments);
      }

      const updatedResult = selectedEmployee
        ? await fetchTimesheetsForSuperior(weekStart)
        : await fetchTimesheetAndProjects(weekStart);

      if (updatedResult.error) {
        setError(updatedResult.error);
      } else {
        if (selectedEmployee) {
          setEmployeeTimesheets(updatedResult.timesheets || []);
          setEmployeeProjects(updatedResult.projects || []);
          setAttachments(updatedResult.attachments || {});
          setNoAttachmentFlags((prev) => ({
            ...prev,
            ...Object.fromEntries(
              (updatedResult.timesheets || [])
                .filter((t) => t.employee_id === selectedEmployee)
                .map((ts) => [ts.timesheet_id || ts.temp_key, false])
            ),
          }));
        } else {
          setTimesheets(updatedResult.timesheets || []);
          setProjects(updatedResult.projects || []);
          setAttachments(updatedResult.attachments || {});
          setNoAttachmentFlags(
            Object.fromEntries(
              (updatedResult.timesheets || []).map((ts) => [
                ts.timesheet_id || ts.temp_key,
                false,
              ])
            )
          );
        }
        fileInputs.current = {};
        setSuccess(true);
      }
    } catch (error) {
      setError(error.message || 'Failed to process timesheets.');
    }
  };

  const handleRemoveAttachment = async (attachmentId, timesheetId) => {
    const result = await removeAttachment(attachmentId, timesheetId);
    if (result.success) {
      setAttachments((prev) => ({
        ...prev,
        [timesheetId]: result.attachments || [],
      }));
      setNoAttachmentFlags((prev) => ({
        ...prev,
        [timesheetId]: false,
      }));
      if (fileInputs.current[timesheetId]) {
        fileInputs.current[timesheetId].value = '';
      }
      setSuccess(true);
    } else {
      setError(result.error || 'Failed to remove attachment.');
    }
  };

  return (
    <div className="timesheet-container">
      <h2 className="timesheet-title">Timesheets</h2>
      <div className="date-navigation">
        <button className="nav-button" onClick={handlePrevWeek}>Prev</button>
        <label className="date-label">Select Date: </label>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          className="date-input"
        />
        <button className="nav-button" onClick={handleNextWeek}>Next</button>
      </div>
      {selectedDate && (
        <div className="timesheet-content">
          <h3 className="week-title">Week Starting: {formatDate(getWeekStartDate(selectedDate))}</h3>
          <h4>Your Timesheets</h4>
          <div className="project-table-container">
            <table className="project-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Project Name</th>
                  <th>Bill Rate</th>
                  <th>Bill Type</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan="4">No projects assigned</td>
                  </tr>
                ) : (
                  projects.map((project) => (
                    <tr key={project.PRJ_ID}>
                      <td>{project.PRJ_ID}</td>
                      <td>{project.PRJ_NAME}</td>
                      <td>{project.BILL_RATE}</td>
                      <td>{project.BILL_TYPE}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {timesheets.length > 0 && (
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              {timesheets.map((ts) => (
                <div key={ts.timesheet_id || ts.temp_key} className="project-timesheet">
                  <div className="project-header">
                    <h4>Project: {projects.find((p) => p.PRJ_ID === ts.project_id)?.PRJ_NAME || 'Unnamed Project'}</h4>
                  </div>
                  <input type="hidden" name="project_id" value={ts.project_id} />
                  <input type="hidden" name="week_start_date" value={ts.week_start_date} />
                  <input type="hidden" name="year" value={ts.year} />
                  <input type="hidden" name="timesheet_id" value={ts.timesheet_id || ''} />
                  <input type="hidden" name="employee_id" value={ts.employee_id} />
                  <table className="timesheet-table">
                    <thead>
                      <tr>
                        <th></th>
                        {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day, index) => (
                          <th key={day}>
                            {getDateForDay(ts.week_start_date, index)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Hours</td>
                        {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => (
                          <td key={`${day}_hours`}>
                            <input
                              type="number"
                              name={`${day}_hours`}
                              value={ts[`${day}_hours`] ?? ''}
                              onChange={(e) => handleInputChange(e, ts.timesheet_id || ts.temp_key)}
                              step="0.25"
                              min="0"
                              max="24"
                              className="hours-input"
                              disabled={ts.is_submitted === 1}
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td>Comment</td>
                        {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => (
                          <td key={`${day}_comment`}>
                            <textarea
                              name={`${day}_comment`}
                              value={ts[`${day}_comment`] ?? ''}
                              onChange={(e) => handleInputChange(e, ts.timesheet_id || ts.temp_key, null, day)}
                              onFocus={() => handleCommentFocus(ts.timesheet_id || ts.temp_key, day)}
                              className="comment-textarea"
                              disabled={ts.is_submitted === 1}
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  <div className="timesheet-comment-section">
                    <label>Selected Comment:</label>
                    <textarea
                      value={
                        selectedComment.timesheetId === (ts.timesheet_id || ts.temp_key) && selectedComment.day
                          ? ts[`${selectedComment.day}_comment`] ?? ''
                          : ''
                      }
                      readOnly
                      className="comment-display-textarea"
                      placeholder="Select or edit a comment in the table to view it here..."
                      disabled={ts.is_submitted === 1}
                    />
                  </div>
                  <div className="attachment-field">
                    <label>Attachment: </label>
                    <input
                      type="file"
                      name={`attachment_${ts.timesheet_id || ts.temp_key}`}
                      className="file-input"
                      disabled={ts.is_submitted === 1 || noAttachmentFlags[ts.timesheet_id || ts.temp_key]}
                      ref={(el) => (fileInputs.current[ts.timesheet_id || ts.temp_key] = el)}
                    />
                    <label className="no-attachment-label">
                      <input
                        type="checkbox"
                        checked={noAttachmentFlags[ts.timesheet_id || ts.temp_key] || false}
                        onChange={(e) => handleNoAttachmentChange(ts.timesheet_id || ts.temp_key, e.target.checked)}
                        disabled={ts.is_submitted === 1 || attachments[ts.timesheet_id || ts.temp_key]?.length > 0}
                      />
                      No Attachment
                    </label>
                    {attachments[ts.timesheet_id || ts.temp_key]?.length > 0 && (
                      <div className="attached-files">
                        <h5>Attached Files:</h5>
                        <ul>
                          {attachments[ts.timesheet_id || ts.temp_key].map((attachment) => (
                            <li key={attachment.attachment_id}>
                              <a
                                href={attachment.file_path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="attachment-link"
                              >
                                {attachment.file_name}
                              </a>
                              <button
                                type="button"
                                className="remove-button"
                                onClick={() => handleRemoveAttachment(attachment.attachment_id, ts.timesheet_id || ts.temp_key)}
                                disabled={ts.is_submitted === 1}
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {error && <p className="error-message">{error}</p>}
              {success && <p className="success-message">Action successful!</p>}
              <div className="button-group">
                <button type="submit" className="save-button" disabled={timesheets.every((ts) => ts.is_submitted === 1)}>
                  Save All
                </button>
                <button
                  type="button"
                  className="submit-button"
                  onClick={() => {
                    if (window.confirm('Submitting will save and lock all timesheets for this week. Proceed?')) {
                      handleSave(true);
                    }
                  }}
                  disabled={timesheets.every((ts) => ts.is_submitted === 1)}
                >
                  Submit All
                </button>
              </div>
            </form>
          )}
          <hr className="separator" />
          {employees.length > 0 && (
            <div className="employee-supervision">
              <div className="employee-selection">
                <label>Select Employee: </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => {
                    setSelectedEmployee(e.target.value);
                    setError(null);
                    setSuccess(false);
                    setSelectedComment({ timesheetId: null, day: null });
                    setNoAttachmentFlags((prev) => ({
                      ...prev,
                      ...Object.fromEntries(
                        (employeeTimesheets.filter((t) => t.employee_id === e.target.value) || []).map((ts) => [
                          ts.timesheet_id || ts.temp_key,
                          false,
                        ])
                      ),
                    }));
                  }}
                  className="employee-dropdown"
                >
                  <option value="">Select an Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.empid} value={emp.empid}>
                      {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}`}
                    </option>
                  ))}
                </select>
              </div>
              {selectedEmployee && (
                <div className="employee-timesheet">
                  <h3>{employees.find((e) => e.empid === selectedEmployee)?.EMP_FST_NAME} {employees.find((e) => e.empid === selectedEmployee)?.EMP_LAST_NAME || ''}'s Timesheets</h3>
                  <div className="project-table-container">
                    <table className="project-table">
                      <thead>
                        <tr>
                          <th>Project ID</th>
                          <th>Project Name</th>
                          <th>Bill Rate</th>
                          <th>Bill Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(employeeProjects[selectedEmployee] || []).length === 0 ? (
                          <tr>
                            <td colSpan="4">No projects assigned</td>
                          </tr>
                        ) : (
                          (employeeProjects[selectedEmployee] || []).map((project) => (
                            <tr key={project.PRJ_ID}>
                              <td>{project.PRJ_ID}</td>
                              <td>{project.PRJ_NAME}</td>
                              <td>{project.BILL_RATE}</td>
                              <td>{project.BILL_TYPE}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).length > 0 && (
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                      {employeeTimesheets
                        .filter((t) => t.employee_id === selectedEmployee)
                        .map((ts) => (
                          <div key={ts.timesheet_id || ts.temp_key} className="project-timesheet">
                            <div className="project-header">
                              <h4>Project: {(employeeProjects[selectedEmployee] || []).find((p) => p.PRJ_ID === ts.project_id)?.PRJ_NAME || 'Unnamed Project'}</h4>
                            </div>
                            <input type="hidden" name="employee_id" value={ts.employee_id} />
                            <input type="hidden" name="week_start_date" value={ts.week_start_date} />
                            <input type="hidden" name="year" value={ts.year} />
                            <input type="hidden" name="project_id" value={ts.project_id} />
                            <input type="hidden" name="timesheet_id" value={ts.timesheet_id || ''} />
                            <table className="timesheet-table">
                              <thead>
                                <tr>
                                  <th></th>
                                  {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day, index) => (
                                    <th key={day}>
                                      {getDateForDay(ts.week_start_date, index)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>Hours</td>
                                  {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => (
                                    <td key={`${day}_hours`}>
                                      <input
                                        type="number"
                                        name={`${day}_hours`}
                                        value={ts[`${day}_hours`] ?? ''}
                                        onChange={(e) => handleInputChange(e, ts.timesheet_id || ts.temp_key, ts.employee_id)}
                                        step="0.25"
                                        min="0"
                                        max="24"
                                        className="hours-input"
                                        disabled={ts.is_submitted === 1}
                                      />
                                    </td>
                                  ))}
                                </tr>
                                <tr>
                                  <td>Comment</td>
                                  {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => (
                                    <td key={`${day}_comment`}>
                                      <textarea
                                        name={`${day}_comment`}
                                        value={ts[`${day}_comment`] ?? ''}
                                        onChange={(e) => handleInputChange(e, ts.timesheet_id || ts.temp_key, ts.employee_id, day)}
                                        onFocus={() => handleCommentFocus(ts.timesheet_id || ts.temp_key, day)}
                                        className="comment-textarea"
                                        disabled={ts.is_submitted === 1}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                            <div className="timesheet-comment-section">
                              <label>Selected Comment:</label>
                              <textarea
                                value={
                                  selectedComment.timesheetId === (ts.timesheet_id || ts.temp_key) && selectedComment.day
                                    ? ts[`${selectedComment.day}_comment`] ?? ''
                                    : ''
                                }
                                readOnly
                                className="comment-display-textarea"
                                placeholder="Select or edit a comment in the table to view it here..."
                                disabled={ts.is_submitted === 1}
                              />
                            </div>
                            <div className="attachment-field">
                              <label>Attachment: </label>
                              <input
                                type="file"
                                name={`attachment_${ts.timesheet_id || ts.temp_key}`}
                                className="file-input"
                                disabled={ts.is_submitted === 1 || noAttachmentFlags[ts.timesheet_id || ts.temp_key]}
                                ref={(el) => (fileInputs.current[ts.timesheet_id || ts.temp_key] = el)}
                              />
                              <label className="no-attachment-label">
                                <input
                                  type="checkbox"
                                  checked={noAttachmentFlags[ts.timesheet_id || ts.temp_key] || false}
                                  onChange={(e) => handleNoAttachmentChange(ts.timesheet_id || ts.temp_key, e.target.value)}
                                  disabled={ts.is_submitted === 1 || attachments[ts.timesheet_id || ts.temp_key]?.length > 0}
                                />
                                No Attachment
                              </label>
                              {attachments[ts.timesheet_id || ts.temp_key]?.length > 0 && (
                                <div className="attached-files">
                                  <h5>Attached Files:</h5>
                                  <ul>
                                    {attachments[ts.timesheet_id || ts.temp_key].map((attachment) => (
                                      <li key={attachment.attachment_id}>
                                        <a
                                          href={attachment.file_path}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="attachment-link"
                                        >
                                          {attachment.file_name}
                                        </a>
                                        <button
                                          type="button"
                                          className="remove-button"
                                          onClick={() => handleRemoveAttachment(attachment.attachment_id, ts.timesheet_id || ts.temp_key)}
                                          disabled={ts.is_submitted === 1}
                                        >
                                          Remove
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      <div className="approval-field">
                        <label>
                          <input
                            type="checkbox"
                            checked={employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).every((t) => t.is_approved === 1)}
                            onChange={(e) => handleApprovedChange(e, selectedEmployee)}
                            disabled={employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).every((t) => t.is_submitted !== 1)}
                          />
                          Approve All
                        </label>
                      </div>
                      {error && <p className="error-message">{error}</p>}
                      {success && <p className="success-message">Action successful!</p>}
                      <div className="button-group">
                        <button
                          type="submit"
                          className="save-button"
                          disabled={employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).every((t) => t.is_submitted !== 1)}
                        >
                          Save All
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
          {employees.length > 0 && !selectedEmployee && (
            <p className="no-employees">Please select an employee from the dropdown.</p>
          )}
          {employees.length === 0}
        </div>
      )}
    </div>
  );
};

export default Overview;
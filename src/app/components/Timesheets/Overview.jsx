'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchTimesheetAndProjects, fetchTimesheetsForSuperior, saveTimesheet, removeAttachment, fetchSuperiorName } from '@/app/serverActions/Timesheets/Overview';
import './Overview.css';

const Overview = () => {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [timesheets, setTimesheets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeTimesheets, setEmployeeTimesheets] = useState([]);
  const [employeeProjects, setEmployeeProjects] = useState({});
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [attachments, setAttachments] = useState({});
  const [noAttachmentFlag, setNoAttachmentFlag] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedComment, setSelectedComment] = useState({ timesheetId: null, day: null });
  const [superiorName, setSuperiorName] = useState('');
  const [isSuperior, setIsSuperior] = useState(false);
  const fileInputRef = useRef(null);

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
      setNoAttachmentFlag(true);
      setAttachments({});
      setSelectedComment({ timesheetId: null, day: null });
      setSuperiorName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        setNoAttachmentFlag(Object.values(individualResult.attachments || {}).every((atts) => !atts.length));
        if (!selectedEmployee && individualResult.timesheets?.length > 0 && individualResult.timesheets.some((ts) => ts.is_approved === 1)) {
          const employeeId = individualResult.timesheets[0].employee_id;
          const data = await fetchSuperiorName(employeeId);
          if (data.superiorName) {
            setSuperiorName(data.superiorName);
          }
        }
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
        setAttachments((prev) => {
          const newAttachments = { ...prev, ...superiorResult.attachments };
          setNoAttachmentFlag(Object.values(newAttachments).every((atts) => !atts.length));
          return newAttachments;
        });
        const isSuperiorResult = superiorResult.employees.length > 0;
        setIsSuperior(isSuperiorResult);
        console.log(`useEffect: selectedEmployee=${selectedEmployee}, isSuperior=${isSuperiorResult}, employees=`, superiorResult.employees.map(e => e.empid));
        if (selectedEmployee && superiorResult.timesheets?.length > 0 && superiorResult.timesheets.some((ts) => ts.is_approved === 1)) {
          const data = await fetchSuperiorName(selectedEmployee);
          if (data.superiorName) {
            setSuperiorName(data.superiorName);
          }
        }
      }
    };
    fetchData();
  }, [selectedDate, selectedEmployee]);

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
    setError(null);
    setSuccess(false);
    setAttachments({});
    setNoAttachmentFlag(true);
    setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate.toISOString().split('T')[0]);
    setError(null);
    setSuccess(false);
    setAttachments({});
    setNoAttachmentFlag(true);
    setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate.toISOString().split('T')[0]);
    setError(null);
    setSuccess(false);
    setAttachments({});
    setNoAttachmentFlag(true);
    setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInputChange = (e, timesheetId, empId = null, day = null) => {
    const { name, value } = e.target;
    const isEmployee = !empId && !selectedEmployee;
    const targetTimesheets = selectedEmployee ? employeeTimesheets : timesheets;
    const ts = targetTimesheets.find((t) => t.timesheet_id === timesheetId || t.temp_key === timesheetId);
    if (ts && (isSuperior || (isEmployee && !ts.is_submitted && !ts.is_approved))) {
      console.log(`handleInputChange: timesheetId=${timesheetId}, isSuperior=${isSuperior}, isEmployee=${isEmployee}, is_submitted=${ts.is_submitted}, is_approved=${ts.is_approved}`);
      const updateTimesheets = (prev) =>
        prev.map((t) =>
          (t.timesheet_id === timesheetId || t.temp_key === timesheetId)
            ? { ...t, [name]: value === '' ? null : value }
            : t
        );
      if (empId || selectedEmployee) {
        setEmployeeTimesheets(updateTimesheets);
      } else {
        setTimesheets(updateTimesheets);
      }
      if (day && name.includes('_comment')) {
        setSelectedComment({ timesheetId, day });
      }
    }
  };

  const handleCommentFocus = (timesheetId, day) => {
    setSelectedComment({ timesheetId, day });
  };

  const handleNoAttachmentChange = (checked) => {
    setNoAttachmentFlag(checked);
    if (checked && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApprovedChange = async (e, empId) => {
    const isApproved = e.target.checked ? 1 : 0;
    const weekStart = getWeekStartDate(selectedDate);
    const formDataArray = employeeTimesheets
      .filter((t) => t.employee_id === empId)
      .map((ts) => {
        const formData = new FormData();
        formData.append('project_id', ts.project_id);
        formData.append('week_start_date', weekStart);
        formData.append('year', ts.year);
        formData.append('timesheet_id', ts.timesheet_id || '');
        formData.append('employee_id', ts.employee_id);
        formData.append('is_approved', isApproved);
        ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach((day) => {
          formData.append(`${day}_hours`, ts[`${day}_hours`] ?? '');
          formData.append(`${day}_comment`, ts[`${day}_comment`] ?? '');
        });
        formData.append('is_submitted', ts.is_submitted || 0);
        if (fileInputRef.current?.files.length > 0 && !noAttachmentFlag) {
          Array.from(fileInputRef.current.files).forEach((file) => {
            formData.append('attachment', file);
          });
        }
        return { formData, timesheetId: ts.timesheet_id || ts.temp_key };
      });

    try {
      const updatedAttachments = { ...attachments };
      for (const { formData, timesheetId } of formDataArray) {
        const result = await saveTimesheet(formData);
        if (result.error) {
          setError(result.error || 'Failed to approve timesheet.');
          return;
        }
        if (result.attachments && result.timesheetId) {
          updatedAttachments[result.timesheetId] = result.attachments;
          if (result.timesheetId !== timesheetId) {
            setEmployeeTimesheets((prev) =>
              prev.map((t) =>
                t.temp_key === timesheetId ? { ...t, timesheet_id: result.timesheetId, temp_key: undefined } : t
              )
            );
          }
        }
      }
      setAttachments(updatedAttachments);
      setNoAttachmentFlag(Object.values(updatedAttachments).every((atts) => !atts.length));
      if (fileInputRef.current) fileInputRef.current.value = '';
      setEmployeeTimesheets((prev) =>
        prev.map((t) => (t.employee_id === empId ? { ...t, is_approved: isApproved } : t))
      );
      setSuccess(true);
      if (isApproved) {
        const data = await fetchSuperiorName(empId);
        if (data.superiorName) {
          setSuperiorName(data.superiorName);
        }
      }
    } catch (error) {
      setError(error.message || 'Failed to process approval.');
    }
  };

  const handleSave = async (isSubmit = false) => {
    const weekStart = getWeekStartDate(selectedDate);
    const targetTimesheets = selectedEmployee ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee) : timesheets;

    if (isSubmit && !noAttachmentFlag) {
      const invalidTimesheets = targetTimesheets.filter((ts) => {
        const timesheetId = ts.timesheet_id || ts.temp_key;
        return !attachments[timesheetId]?.length && !fileInputRef.current?.files.length;
      });
      if (invalidTimesheets.length > 0) {
        setError('All timesheets must have an attachment when "No Attachment" is not checked.');
        return;
      }
    }

    // Validation for comments when submitting
    if (isSubmit) {
      const invalidTimesheets = targetTimesheets.filter((ts) => {
        return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].some((day) => {
          const hours = parseFloat(ts[`${day}_hours`] || 0);
          const comment = ts[`${day}_comment`] || '';
          return hours > 0 && (!comment || comment.trim() === '');
        });
      });
      if (invalidTimesheets.length > 0) {
        setError('A comment is required for any day with hours greater than 0 before submitting.');
        return;
      }
    }

    const formDataArray = targetTimesheets.map((ts) => {
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
      if (fileInputRef.current?.files.length > 0 && !noAttachmentFlag) {
        Array.from(fileInputRef.current.files).forEach((file) => {
          formData.append('attachment', file);
        });
      }
      return { formData, timesheetId: ts.timesheet_id || ts.temp_key };
    });

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
      setNoAttachmentFlag(Object.values(updatedAttachments).every((atts) => !atts.length));
      if (fileInputRef.current) fileInputRef.current.value = '';

      const updatedResult = selectedEmployee
        ? await fetchTimesheetsForSuperior(weekStart)
        : await fetchTimesheetAndProjects(weekStart);

      if (updatedResult.error) {
        setError(updatedResult.error);
      } else {
        if (selectedEmployee) {
          setEmployeeTimesheets(updatedResult.timesheets || []);
          setEmployeeProjects(updatedResult.projects || {});
          setAttachments(updatedResult.attachments || {});
          setNoAttachmentFlag(Object.values(updatedResult.attachments || {}).every((atts) => !atts.length));
          if (updatedResult.timesheets?.some((ts) => ts.is_approved === 1)) {
            const data = await fetchSuperiorName(selectedEmployee);
            if (data.superiorName) {
              setSuperiorName(data.superiorName);
            }
          }
          setIsSuperior(updatedResult.employees.length > 0);
          console.log(`handleSave: selectedEmployee=${selectedEmployee}, isSuperior=${updatedResult.employees.length > 0}`);
        } else {
          setTimesheets(updatedResult.timesheets || []);
          setProjects(updatedResult.projects || []);
          setAttachments(updatedResult.attachments || {});
          setNoAttachmentFlag(Object.values(updatedResult.attachments || {}).every((atts) => !atts.length));
          if (!isSuperior && updatedResult.timesheets?.some((ts) => ts.is_approved === 1)) {
            const employeeId = updatedResult.timesheets[0].employee_id;
            const data = await fetchSuperiorName(employeeId);
            if (data.superiorName) {
              setSuperiorName(data.superiorName);
            }
          }
        }
        setSuccess(true);
      }
    } catch (error) {
      setError(error.message || 'Failed to process timesheets.');
    }
  };

  const handleRemoveAttachment = async (attachmentId, timesheetId) => {
    const result = await removeAttachment(attachmentId, timesheetId);
    if (result.success) {
      setAttachments((prev) => {
        const newAttachments = { ...prev };
        for (let key in newAttachments) {
          newAttachments[key] = newAttachments[key].filter((a) => a.attachment_id !== attachmentId);
        }
        setNoAttachmentFlag(Object.values(newAttachments).every((atts) => !atts.length));
        return newAttachments;
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccess(true);
    } else {
      setError(result.error || 'Failed to remove attachment.');
    }
  };

  const handlePendingApproveSheet = () => {
    router.push('/userscreens/timesheets/pendingapproval');
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
      {isSuperior && (
        <button
          type="button"
          className="pending-approve-button"
          onClick={handlePendingApproveSheet}
        >
          Pending Approve Sheet
        </button>
      )}
      {selectedDate && (
        <div className="timesheet-content">
          <h3 className="week-title">Week Starting: {formatDate(getWeekStartDate(selectedDate))}</h3>
          <div className="employee-selection">
            <label>Select Employee: </label>
            <select
              value={selectedEmployee}
              onChange={(e) => {
                setSelectedEmployee(e.target.value);
                setError(null);
                setSuccess(false);
                setSelectedComment({ timesheetId: null, day: null });
                setNoAttachmentFlag(Object.values(attachments).every((atts) => !atts.length));
              }}
              className="employee-dropdown"
            >
              <option value="">Your Timesheets</option>
              {employees.map((emp) => (
                <option key={emp.empid} value={emp.empid}>
                  {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}`}
                </option>
              ))}
            </select>
          </div>
          {!selectedEmployee && !isSuperior && timesheets.some((ts) => ts.is_approved === 1) && superiorName && (
            <p className="approval-message">Approved by {superiorName}</p>
          )}
          {((!selectedEmployee && timesheets.length > 0) || (selectedEmployee && employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).length > 0)) && (
            <div>
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <table className="timesheet-table">
                  <thead>
                    <tr>
                      <th>Project Name</th>
                      {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day, index) => (
                        <th key={day}>
                          {getDateForDay(getWeekStartDate(selectedDate), index)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedEmployee ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee) : timesheets).map((ts) => {
                      const project = selectedEmployee
                        ? (employeeProjects[selectedEmployee] || []).find((p) => p.PRJ_ID === ts.project_id)
                        : projects.find((p) => p.PRJ_ID === ts.project_id);
                      return (
                        <tr key={ts.timesheet_id || ts.temp_key}>
                          <td>{project?.PRJ_NAME || 'Unnamed Project'}</td>
                          {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => (
                            <td key={`${ts.timesheet_id || ts.temp_key}_${day}`}>
                              <input
                                type="number"
                                name={`${day}_hours`}
                                value={ts[`${day}_hours`] ?? ''}
                                onChange={(e) => handleInputChange(e, ts.timesheet_id || ts.temp_key, selectedEmployee ? ts.employee_id : null)}
                                step="0.25"
                                min="0"
                                max="24"
                                className="hours-input"
                                disabled={selectedEmployee ? !isSuperior : (ts.is_submitted === 1 || ts.is_approved === 1)}
                              />
                              <textarea
                                name={`${day}_comment`}
                                value={ts[`${day}_comment`] ?? ''}
                                onChange={(e) => handleInputChange(e, ts.timesheet_id || ts.temp_key, selectedEmployee ? ts.employee_id : null, day)}
                                onFocus={() => handleCommentFocus(ts.timesheet_id || ts.temp_key, day)}
                                className="comment-textarea"
                                disabled={selectedEmployee ? !isSuperior : (ts.is_submitted === 1 || ts.is_approved === 1)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="selected-comment-section">
                  <label>Selected Comment:</label>
                  <textarea
                    value={
                      selectedComment.timesheetId && selectedComment.day
                        ? (selectedEmployee
                            ? employeeTimesheets.find((t) => t.timesheet_id === selectedComment.timesheetId || t.temp_key === selectedComment.timesheetId)
                            : timesheets.find((t) => t.timesheet_id === selectedComment.timesheetId || t.temp_key === selectedComment.timesheetId))
                              ?.[`${selectedComment.day}_comment`] ?? ''
                        : ''
                    }
                    onChange={(e) => {
                      const newValue = e.target.value;
                      const targetTimesheets = selectedEmployee ? employeeTimesheets : timesheets;
                      const ts = targetTimesheets.find((t) => t.timesheet_id === selectedComment.timesheetId || t.temp_key === selectedComment.timesheetId);
                      if (ts && (isSuperior || (!selectedEmployee && !ts.is_submitted && !ts.is_approved))) {
                        console.log(`Comment textarea: timesheetId=${selectedComment.timesheetId}, isSuperior=${isSuperior}, is_submitted=${ts.is_submitted}, is_approved=${ts.is_approved}`);
                        const updateTimesheets = (prev) =>
                          prev.map((t) =>
                            (t.timesheet_id === selectedComment.timesheetId || t.temp_key === selectedComment.timesheetId)
                              ? { ...t, [`${selectedComment.day}_comment`]: newValue === '' ? null : newValue }
                              : t
                          );
                        if (selectedEmployee) {
                          setEmployeeTimesheets(updateTimesheets);
                        } else {
                          setTimesheets(updateTimesheets);
                        }
                      }
                    }}
                    onFocus={() => selectedComment.timesheetId && selectedComment.day && handleCommentFocus(selectedComment.timesheetId, selectedComment.day)}
                    className="comment-display-textarea"
                    placeholder="Select a comment in the table to edit it here..."
                    disabled={
                      !selectedComment.timesheetId ||
                      !selectedComment.day ||
                      (selectedEmployee ? !isSuperior : timesheets.find((t) => t.timesheet_id === selectedComment.timesheetId || t.temp_key === selectedComment.timesheetId)?.is_submitted === 1 ||
                        timesheets.find((t) => t.timesheet_id === selectedComment.timesheetId || t.temp_key === selectedComment.timesheetId)?.is_approved === 1)
                    }
                  />
                </div>
                <div className="attachment-field">
                  <label>Attachments for the Week:</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="file-input"
                    multiple
                    disabled={noAttachmentFlag || (selectedEmployee ? !isSuperior : timesheets.some((t) => t.is_submitted === 1 || t.is_approved === 1))}
                    onChange={() => setNoAttachmentFlag(false)}
                  />
                  <label className="no-attachment-label">
                    <input
                      type="checkbox"
                      checked={noAttachmentFlag}
                      onChange={(e) => handleNoAttachmentChange(e.target.checked)}
                      disabled={Object.values(attachments).some((atts) => atts.length > 0) || (selectedEmployee ? !isSuperior : timesheets.some((t) => t.is_submitted === 1 || t.is_approved === 1))}
                    />
                    No Attachment
                  </label>
                  {Object.values(attachments).some((atts) => atts.length > 0) && (
                    <div className="attached-files">
                      <h5>Attached Files:</h5>
                      <ul>
                        {Object.values(attachments)
                          .flat()
                          .map((attachment) => (
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
                                onClick={() => handleRemoveAttachment(attachment.attachment_id, attachment.timesheet_id)}
                                disabled={selectedEmployee ? !isSuperior : timesheets.some((t) => t.is_submitted === 1 || t.is_approved === 1)}
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
                {error && <p className="error-message">{error}</p>}
                {success && <p className="success-message">Action successful!</p>}
                <div className="button-group">
                  <button
                    type="submit"
                    className="save-button"
                    disabled={selectedEmployee ? !isSuperior : timesheets.some((t) => t.is_submitted === 1 || t.is_approved === 1)}
                  >
                    Save All
                  </button>
                  {!selectedEmployee && (
                    <button
                      type="button"
                      className="submit-button"
                      onClick={() => {
                        if (window.confirm('Submitting will save and lock all timesheets for this week. Proceed?')) {
                          handleSave(true);
                        }
                      }}
                      disabled={timesheets.some((ts) => ts.is_submitted === 1 || ts.is_approved === 1)}
                    >
                      Submit All
                    </button>
                  )}
                </div>
                {selectedEmployee && (
                  <div className="approval-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).every((t) => t.is_approved === 1)}
                        onChange={(e) => handleApprovedChange(e, selectedEmployee)}
                        disabled={!isSuperior}
                      />
                      Approve All
                    </label>
                  </div>
                )}
              </form>
            </div>
          )}
          {(!selectedEmployee && timesheets.length === 0) && (
            <p className="no-employees">No timesheets available.</p>
          )}
          {(selectedEmployee && employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).length === 0) && (
            <p className="no-employees">No timesheets available for selected employee.</p>
          )}
          {employees.length === 0 && !selectedEmployee && (
            <p className="no-employees">No employees found under your supervision.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Overview;
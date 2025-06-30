'use client';

import React, { useState, useEffect } from 'react';
import { fetchTimesheetAndProjects, fetchTimesheetsForSuperior, fetchTimesheetForEmployee, saveTimesheet, removeAttachment } from '@/app/serverActions/Timesheets/Overview';
import './Overview.css';

const Overview = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [timesheet, setTimesheet] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [employeeProjects, setEmployeeProjects] = useState({});
  const [selectedEmployeeProjects, setSelectedEmployeeProjects] = useState({});
  const [attachments, setAttachments] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [tempKeyCounter, setTempKeyCounter] = useState(1);

  // State to track selected day and its comment for display
  const [selectedDay, setSelectedDay] = useState(null);
  const [displayComment, setDisplayComment] = useState('');

  const getWeekStartDate = (date) => {
    try {
      const d = new Date(date);
      if (isNaN(d)) throw new Error('Invalid date');
      const day = d.getDay();
      const diff = d.getDate() - day;
      d.setDate(diff);
      const formattedDate = d.toISOString().split('T')[0];
      console.log('Client-side week start date:', formattedDate);
      return formattedDate;
    } catch (error) {
      console.error('Error in getWeekStartDate:', error);
      return new Date().toISOString().split('T')[0];
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (selectedDate) {
        const weekStart = getWeekStartDate(selectedDate);
        console.log('Fetching data for week start:', weekStart);
        const individualResult = await fetchTimesheetAndProjects(weekStart, selectedProject ? selectedProject.PRJ_ID : null);
        console.log('Individual fetch result:', individualResult);
        if (individualResult.error) {
          setError(individualResult.error);
          setTimesheet({
            employee_id: '',
            project_id: selectedProject ? selectedProject.PRJ_ID : '',
            week_start_date: weekStart,
            year: new Date(weekStart).getFullYear(),
            sun_hours: null,
            mon_hours: null,
            tue_hours: null,
            wed_hours: null,
            thu_hours: null,
            fri_hours: null,
            sat_hours: null,
            sun_comment: '',
            mon_comment: '',
            tue_comment: '',
            wed_comment: '',
            thu_comment: '',
            fri_comment: '',
            sat_comment: '',
            is_submitted: 0,
            is_approved: 0,
            invoice_path: null,
            invoice_generated_at: null,
            temp_key: `temp-${tempKeyCounter}`,
          });
          setProjects([]);
          setAttachments({});
          setTempKeyCounter((prev) => prev + 1);
        } else {
          setTimesheet(individualResult.timesheet);
          setProjects(individualResult.projects || []);
          setAttachments({
            [individualResult.timesheet?.timesheet_id || `temp-${tempKeyCounter}`]: individualResult.attachments || [],
          });
          console.log('Attachments state updated for timesheet_id:', individualResult.timesheet?.timesheet_id, 'project_id:', individualResult.timesheet?.project_id, 'attachments:', individualResult.attachments);
          if (!selectedProject && individualResult.projects?.length > 0) {
            setSelectedProject(individualResult.projects[0]);
            setTimesheet((prev) => ({ ...prev, project_id: individualResult.projects[0].PRJ_ID }));
          }
          setError(null);
          setTempKeyCounter((prev) => prev + 1);
        }

        const superiorResult = await fetchTimesheetsForSuperior(weekStart);
        console.log('Superior fetch result:', superiorResult);
        if (superiorResult.error) {
          console.warn('No superior access or error:', superiorResult.error);
        } else {
          setEmployees(superiorResult.employees || []);
          setTimesheets(superiorResult.timesheets || []);
          setEmployeeProjects(superiorResult.projects || {});
          const initialSelectedProjects = {};
          superiorResult.employees.forEach((emp) => {
            initialSelectedProjects[emp.empid] = superiorResult.projects[emp.empid]?.length > 0
              ? superiorResult.projects[emp.empid][0].PRJ_ID
              : null;
          });
          setSelectedEmployeeProjects(initialSelectedProjects);
          const newAttachments = {};
          superiorResult.timesheets.forEach((t) => {
            newAttachments[t.timesheet_id] = (superiorResult.attachments[t.employee_id] || []).filter(
              (att) => att.timesheet_id === t.timesheet_id
            );
          });
          setAttachments((prev) => ({ ...prev, ...newAttachments }));
          console.log('Superior attachments state updated:', newAttachments);
        }
      }
    };
    fetchData();
  }, [selectedDate, selectedProject]);

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
    setSelectedProject(null);
    setSelectedEmployee(null);
    setAttachments({});
    setError(null);
    setSuccess(false);
  };

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate.toISOString().split('T')[0]);
    setSelectedProject(null);
    setSelectedEmployee(null);
    setAttachments({});
    setError(null);
    setSuccess(false);
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate.toISOString().split('T')[0]);
    setSelectedProject(null);
    setSelectedEmployee(null);
    setAttachments({});
    setError(null);
    setSuccess(false);
  };

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    setAttachments({});
    const weekStart = getWeekStartDate(selectedDate);
    const result = await fetchTimesheetAndProjects(weekStart, project.PRJ_ID);
    if (result.error) {
      setError(result.error);
      setTimesheet({
        employee_id: '',
        project_id: project.PRJ_ID,
        week_start_date: weekStart,
        year: new Date(weekStart).getFullYear(),
        sun_hours: null,
        mon_hours: null,
        tue_hours: null,
        wed_hours: null,
        thu_hours: null,
        fri_hours: null,
        sat_hours: null,
        sun_comment: '',
        mon_comment: '',
        tue_comment: '',
        wed_comment: '',
        thu_comment: '',
        fri_comment: '',
        sat_comment: '',
        is_submitted: 0,
        is_approved: 0,
        invoice_path: null,
        invoice_generated_at: null,
        temp_key: `temp-${tempKeyCounter}`,
      });
      setAttachments({});
      setTempKeyCounter((prev) => prev + 1);
    } else {
      setTimesheet(result.timesheet);
      setAttachments({
        [result.timesheet?.timesheet_id || `temp-${tempKeyCounter}`]: result.attachments || [],
      });
      console.log('Attachments state updated for timesheet_id:', result.timesheet?.timesheet_id, 'project_id:', project.PRJ_ID, 'attachments:', result.attachments);
      setTempKeyCounter((prev) => prev + 1);
    }
    setError(null);
    setSuccess(false);
  };

  const handleEmployeeProjectSelect = async (empId, project) => {
    setSelectedEmployeeProjects((prev) => ({ ...prev, [empId]: project ? project.PRJ_ID : null }));
    const weekStart = getWeekStartDate(selectedDate);
    const result = await fetchTimesheetForEmployee(weekStart, empId, project ? project.PRJ_ID : null);
    setTimesheets((prev) =>
      prev.map((t) =>
        t.employee_id === empId
          ? {
              ...result.timesheet,
              employeeName: t.employeeName,
              project_id: project ? project.PRJ_ID : null,
              temp_key: result.timesheet?.timesheet_id ? undefined : `temp-${tempKeyCounter}`,
            }
          : t
      ).filter((t) => t.employee_id !== empId || t.project_id === (project ? project.PRJ_ID : null))
    );
    if (!result.timesheet?.timesheet_id) {
      const employee = employees.find((e) => e.empid === empId);
      const employeeName = employee ? `${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME || ''}` : '';
      const newTimesheet = {
        employee_id: empId,
        project_id: project ? project.PRJ_ID : null,
        week_start_date: weekStart,
        year: new Date(weekStart).getFullYear(),
        sun_hours: null,
        mon_hours: null,
        tue_hours: null,
        wed_hours: null,
        thu_hours: null,
        fri_hours: null,
        sat_hours: null,
        sun_comment: '',
        mon_comment: '',
        tue_comment: '',
        wed_comment: '',
        thu_comment: '',
        fri_comment: '',
        sat_comment: '',
        is_submitted: 0,
        is_approved: 0,
        invoice_path: null,
        invoice_generated_at: null,
        temp_key: `temp-${tempKeyCounter}`,
        employeeName: employeeName,
      };
      setTimesheets((prev) => [...prev.filter((t) => t.employee_id !== empId), newTimesheet]);
    }
    setAttachments((prev) => ({
      ...prev,
      [result.timesheet?.timesheet_id || `temp-${tempKeyCounter}`]: result.attachments || [],
    }));
    console.log('Attachments state updated for employee_id:', empId, 'timesheet_id:', result.timesheet?.timesheet_id, 'project_id:', project?.PRJ_ID, 'attachments:', result.attachments);
    setTempKeyCounter((prev) => prev + 1);
    setError(null);
    setSuccess(false);
  };

  const handleInputChange = (e, empId = null) => {
    const { name, value } = e.target;
    if (empId) {
      setTimesheets((prev) =>
        prev.map((t) =>
          t.employee_id === empId ? { ...t, [name]: value === '' ? null : value } : t
        )
      );
    } else {
      setTimesheet((prev) =>
        prev && prev.is_submitted === 0 ? { ...prev, [name]: value === '' ? null : value } : prev
      );
      // Update display comment when input changes
      const day = name.split('_')[0];
      if (name.endsWith('_comment')) {
        setDisplayComment(value);
        setSelectedDay(day);
      }
    }
  };

  const handleApprovedChange = (e, empId, timesheetId) => {
    const isApproved = e.target.checked ? 1 : 0;
    setTimesheets((prev) =>
      prev.map((t) =>
        t.timesheet_id === timesheetId ? { ...t, is_approved: isApproved } : t
      )
    );
  };

  const handleSubmit = async () => {
    if (timesheet && timesheet.is_submitted === 0) {
      if (window.confirm('If you click OK, you cannot edit this timesheet.')) {
        const formData = new FormData();
        formData.append('project_id', timesheet.project_id);
        formData.append('week_start_date', getWeekStartDate(selectedDate));
        formData.append('year', timesheet.year);
        formData.append('timesheet_id', timesheet.timesheet_id || '');
        ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach((day) => {
          formData.append(`${day}_hours`, timesheet[`${day}_hours`] ?? '');
          formData.append(`${day}_comment`, timesheet[`${day}_comment`] ?? '');
        });
        formData.append('is_submitted', 1);
        formData.append('submit', 'submit');

        console.log('Submitting form with timesheet:', timesheet, 'formData:', Object.fromEntries(formData));
        const result = await saveTimesheet(formData);
        if (result.success) {
          const updatedResult = await fetchTimesheetAndProjects(getWeekStartDate(selectedDate), selectedProject ? selectedProject.PRJ_ID : null);
          setTimesheet(updatedResult.timesheet);
          setProjects(updatedResult.projects || []);
          setAttachments({
            [updatedResult.timesheet?.timesheet_id || `temp-${tempKeyCounter}`]: updatedResult.attachments || [],
          });
          console.log('Attachments state updated after submit for timesheet_id:', updatedResult.timesheet?.timesheet_id, 'attachments:', updatedResult.attachments);
          setTempKeyCounter((prev) => prev + 1);
          setSuccess(true);
        } else {
          setError(result.error || 'Failed to submit timesheet.');
        }
      }
    }
  };

  const handleSave = async (formData, empId = null) => {
    console.log('Saving form data:', Object.fromEntries(formData));
    const result = await saveTimesheet(formData);
    if (result.success) {
      if (empId) {
        const updatedResult = await fetchTimesheetsForSuperior(getWeekStartDate(selectedDate));
        setTimesheets(updatedResult.timesheets || []);
        setEmployeeProjects(updatedResult.projects || {});
        const newSelectedProjects = {};
        updatedResult.employees.forEach((emp) => {
          newSelectedProjects[emp.empid] = updatedResult.projects[emp.empid]?.length > 0
            ? updatedResult.projects[emp.empid][0].PRJ_ID
            : null;
        });
        setSelectedEmployeeProjects(newSelectedProjects);
        const newAttachments = {};
        updatedResult.timesheets.forEach((t) => {
          newAttachments[t.timesheet_id] = (updatedResult.attachments[t.employee_id] || []).filter(
            (att) => att.timesheet_id === t.timesheet_id
          );
        });
        setAttachments(newAttachments);
        console.log('Attachments state updated after save (superior) for employee_id:', empId, 'new attachments:', newAttachments);
      } else {
        const updatedResult = await fetchTimesheetAndProjects(getWeekStartDate(selectedDate), selectedProject ? selectedProject.PRJ_ID : null);
        setTimesheet(updatedResult.timesheet);
        setProjects(updatedResult.projects || []);
        setAttachments({
          [updatedResult.timesheet?.timesheet_id || `temp-${tempKeyCounter}`]: updatedResult.attachments || [],
        });
        console.log('Attachments state updated after save for timesheet_id:', updatedResult.timesheet?.timesheet_id, 'attachments:', updatedResult.attachments);
        setTempKeyCounter((prev) => prev + 1);
      }
      setSuccess(true);
    } else {
      setError(result.error || 'Failed to save timesheet.');
    }
  };

  const handleRemoveAttachment = async (attachmentId, timesheetId) => {
    const result = await removeAttachment(attachmentId);
    if (result.success) {
      setAttachments((prev) => ({
        ...prev,
        [timesheetId]: result.attachments || [],
      }));
      console.log('Attachments state updated after remove for timesheet_id:', timesheetId, 'attachments:', result.attachments);
      setSuccess(true);
    } else {
      setError(result.error || 'Failed to remove attachment.');
    }
  };

  return (
    <div className="timesheet-container">
      <h2 className="timesheet-title">Timesheets</h2>
      <div className="date-navigation">
        <button className="nav-button" onClick={handlePrevWeek}>
          Prev
        </button>
        <label className="date-label">Select Date: </label>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          className="date-input"
        />
        <button className="nav-button" onClick={handleNextWeek}>
          Next
        </button>
      </div>
      {selectedDate && (
        <div className="timesheet-content">
          <h3 className="week-title">Week Starting: {formatDate(getWeekStartDate(selectedDate))}</h3>
          <div className="project-table-container">
            <table className="project-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Project Name</th>
                  <th>Bill Rate</th>
                  <th>Bill Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan="5">No projects assigned</td>
                  </tr>
                ) : (
                  projects.map((project) => (
                    <tr
                      key={project.PRJ_ID}
                      onClick={() => handleProjectSelect(project)}
                      className={selectedProject?.PRJ_ID === project.PRJ_ID ? 'selected-project' : ''}
                    >
                      <td>{project.PRJ_ID}</td>
                      <td>{project.PRJ_NAME}</td>
                      <td>{project.BILL_RATE}</td>
                      <td>{project.BILL_TYPE}</td>
                      <td>
                        <button
                          type="button"
                          className="select-button"
                          onClick={() => handleProjectSelect(project)}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {selectedProject && timesheet && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                console.log('Submitting form with timesheet:', timesheet);
                const formData = new FormData(e.target);
                formData.append('timesheet_id', timesheet.timesheet_id || '');
                handleSave(formData);
              }}
            >
              <div className="project-header">
                <h4>Project: {selectedProject.PRJ_NAME}</h4>
              </div>
              <input type="hidden" name="project_id" value={selectedProject.PRJ_ID} />
              <input type="hidden" name="week_start_date" value={getWeekStartDate(selectedDate)} />
              <input type="hidden" name="year" value={timesheet.year} />
              <input type="hidden" name="timesheet_id" value={timesheet.timesheet_id || ''} />
              <table className="timesheet-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Hours</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day, index) => (
                    <tr
                      key={day}
                      onClick={() => {
                        setSelectedDay(day);
                        setDisplayComment(timesheet[`${day}_comment`] || '');
                      }}
                      className={selectedDay === day ? 'selected-row' : ''}
                    >
                      <td>{getDateForDay(getWeekStartDate(selectedDate), index)}</td>
                      <td>
                        <input
                          type="number"
                          name={`${day}_hours`}
                          value={timesheet[`${day}_hours`] ?? ''}
                          onChange={handleInputChange}
                          step="0.25"
                          min="0"
                          max="24"
                          className="hours-input"
                          disabled={timesheet.is_submitted !== 0}
                        />
                      </td>
                      <td>
                        <textarea
                          name={`${day}_comment`}
                          value={timesheet[`${day}_comment`] ?? ''}
                          onChange={handleInputChange}
                          className="comment-textarea"
                          disabled={timesheet.is_submitted !== 0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Comment Display Box */}
              {selectedDay && (
                <div className="comment-display">
                  <label>Comment:</label>
                  <textarea
                    value={displayComment}
                    readOnly
                    className="comment-display-textarea"
                    placeholder="Click a row to see its comment..."
                  />
                </div>
              )}
              <div className="attachment-field">
                <label>Attachment: </label>
                <input
                  type="file"
                  name="attachment"
                  className="file-input"
                  disabled={timesheet.is_submitted !== 0}
                />
                {attachments[timesheet?.timesheet_id || `temp-${tempKeyCounter}`]?.length > 0 && (
                  <div className="attached-files">
                    <h5>Attached Files:</h5>
                    <ul>
                      {attachments[timesheet?.timesheet_id || `temp-${tempKeyCounter}`].map((attachment) => (
                        <li key={attachment.attachment_id}>
                          {attachment.file_name}
                          <button
                            type="button"
                            className="remove-button"
                            onClick={() => handleRemoveAttachment(attachment.attachment_id, timesheet?.timesheet_id || `temp-${tempKeyCounter}`)}
                            disabled={timesheet.is_submitted !== 0}
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
                <button type="submit" className="save-button" disabled={timesheet.is_submitted !== 0}>
                  Save
                </button>
                <button
                  type="button"
                  className="submit-button"
                  onClick={handleSubmit}
                  disabled={timesheet.is_submitted !== 0}
                >
                  Submit
                </button>
              </div>
            </form>
          )}
          <hr className="separator" />
          {selectedDate && employees.length > 0 && (
            <div className="employee-supervision">
              <div className="employee-selection">
                <label>Select Employee: </label>
                <select
                  value={selectedEmployee || ''}
                  onChange={(e) => {
                    const empId = e.target.value;
                    setSelectedEmployee(empId);
                    if (empId && !selectedEmployeeProjects[empId]) {
                      const projects = employeeProjects[empId] || [];
                      const defaultProject = projects.length > 0 ? projects[0] : null;
                      handleEmployeeProjectSelect(empId, defaultProject);
                    }
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
              <div className="timesheet-block">
                {employees.map((emp) => {
                  const employeeTimesheet = timesheets.find(
                    (t) => t.employee_id === emp.empid && t.project_id === selectedEmployeeProjects[emp.empid]
                  );
                  return (
                    <div key={employeeTimesheet?.timesheet_id || `temp-${tempKeyCounter}`} className="employee-timesheet">
                      <h3>{employeeTimesheet?.employeeName || `${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}`}s Timesheet</h3>
                      <div className="project-table-container">
                        <table className="project-table">
                          <thead>
                            <tr>
                              <th>Project ID</th>
                              <th>Project Name</th>
                              <th>Bill Rate</th>
                              <th>Bill Type</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(employeeProjects[emp.empid] || []).length === 0 ? (
                              <tr>
                                <td colSpan="5">No projects assigned</td>
                              </tr>
                            ) : (
                              (employeeProjects[emp.empid] || []).map((project) => (
                                <tr
                                  key={project.PRJ_ID}
                                  onClick={() => handleEmployeeProjectSelect(emp.empid, project)}
                                  className={selectedEmployeeProjects[emp.empid] === project.PRJ_ID ? 'selected-project' : ''}
                                >
                                  <td>{project.PRJ_ID}</td>
                                  <td>{project.PRJ_NAME}</td>
                                  <td>{project.BILL_RATE}</td>
                                  <td>{project.BILL_TYPE}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="select-button"
                                      onClick={() => handleEmployeeProjectSelect(emp.empid, project)}
                                    >
                                      Select
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      {selectedEmployeeProjects[emp.empid] && employeeTimesheet && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            formData.append('timesheet_id', employeeTimesheet.timesheet_id || '');
                            handleSave(formData, employeeTimesheet.employee_id);
                          }}
                        >
                          <div className="project-header">
                            <h4>
                              Project:{' '}
                              {(employeeProjects[emp.empid] || []).find(
                                (p) => p.PRJ_ID === selectedEmployeeProjects[emp.empid]
                              )?.PRJ_NAME || 'Unnamed Project'}
                            </h4>
                          </div>
                          <input type="hidden" name="employee_id" value={employeeTimesheet.employee_id} />
                          <input type="hidden" name="week_start_date" value={getWeekStartDate(selectedDate)} />
                          <input type="hidden" name="year" value={employeeTimesheet.year} />
                          <input type="hidden" name="timesheet_id" value={employeeTimesheet.timesheet_id || ''} />
                          <input type="hidden" name="project_id" value={selectedEmployeeProjects[employeeTimesheet.employee_id]} />
                          <input
                            type="hidden"
                            name="is_approved"
                            value={employeeTimesheet.is_approved || 0}
                          />
                          {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => (
                            <React.Fragment key={day}>
                              <input type="hidden" name={`${day}_hours`} value={employeeTimesheet[`${day}_hours`] ?? ''} />
                              <input type="hidden" name={`${day}_comment`} value={employeeTimesheet[`${day}_comment`] ?? ''} />
                            </React.Fragment>
                          ))}
                          <table className="timesheet-table">
                            <thead>
                              <tr>
                                <th>Day</th>
                                <th>Hours</th>
                                <th>Comment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day, index) => (
                                <tr
                                  key={day}
                                  onClick={() => {
                                    setSelectedDay(day);
                                    setDisplayComment(employeeTimesheet[`${day}_comment`] || '');
                                  }}
                                  className={selectedDay === day ? 'selected-row' : ''}
                                >
                                  <td>{getDateForDay(getWeekStartDate(selectedDate), index)}</td>
                                  <td>
                                    <input
                                      type="number"
                                      name={`${day}_hours`}
                                      value={employeeTimesheet[`${day}_hours`] ?? ''}
                                      onChange={(e) => handleInputChange(e, employeeTimesheet.employee_id)}
                                      step="0.25"
                                      min="0"
                                      max="24"
                                      className="hours-input"
                                    />
                                  </td>
                                  <td>
                                    <textarea
                                      name={`${day}_comment`}
                                      value={employeeTimesheet[`${day}_comment`] ?? ''}
                                      onChange={(e) => handleInputChange(e, employeeTimesheet.employee_id)}
                                      className="comment-textarea"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {/* Comment Display Box */}
                          {selectedDay && (
                            <div className="comment-display">
                              <label>Comment:</label>
                              <textarea
                                value={displayComment}
                                readOnly
                                className="comment-display-textarea"
                                placeholder="Click a row to see its comment..."
                              />
                            </div>
                          )}
                          <div className="attachment-field">
                            <label>Attachment: </label>
                            <input
                              type="file"
                              name="attachment"
                              className="file-input"
                            />
                            {attachments[employeeTimesheet.timesheet_id || `temp-${tempKeyCounter}`]?.length > 0 && (
                              <div className="attached-files">
                                <h5>Attached Files:</h5>
                                <ul>
                                  {attachments[employeeTimesheet.timesheet_id || `temp-${tempKeyCounter}`].map((attachment) => (
                                    <li key={attachment.attachment_id}>
                                      {attachment.file_name}
                                      <button
                                        type="button"
                                        className="remove-button"
                                        onClick={() => handleRemoveAttachment(attachment.attachment_id, employeeTimesheet.timesheet_id || `temp-${tempKeyCounter}`)}
                                      >
                                        Remove
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div className="approval-field">
                            <label>
                              <input
                                type="checkbox"
                                checked={employeeTimesheet.is_approved === 1}
                                onChange={(e) => handleApprovedChange(e, employeeTimesheet.employee_id, employeeTimesheet.timesheet_id)}
                                disabled={employeeTimesheet.is_submitted !== 1}
                              />
                              <input
                                type="hidden"
                                name="is_approved"
                                value={employeeTimesheet.is_approved || 0}
                              />
                              Approved
                            </label>
                          </div>
                          {error && <p className="error-message">{error}</p>}
                          {success && <p className="success-message">Action successful!</p>}
                          <div className="button-group">
                            <button type="submit" className="save-button">
                              Save
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
              {employees.length === 0 && <p className="no-employees">No employees found under your supervision.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Overview;
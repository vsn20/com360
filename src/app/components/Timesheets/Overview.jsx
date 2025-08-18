"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchTimesheetAndProjects,
  fetchTimesheetsForSuperior,
  saveTimesheet,
  removeAttachment,
  fetchSuperiorName,
  approveTimesheet,
} from "@/app/serverActions/Timesheets/Overview";
import "./Overview.css";
import ApprovalPending from "./ApprovalPending";

const Overview = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [C_TIMESHEETS, setTimesheets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeTimesheets, setEmployeeTimesheets] = useState([]);
  const [employeeProjects, setEmployeeProjects] = useState({});
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [attachments, setAttachments] = useState({});
  const [noAttachmentFlag, setNoAttachmentFlag] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedComment, setSelectedComment] = useState({ timesheetId: null, day: null });
  const [superiorName, setSuperiorName] = useState("");
  const [isSuperior, setIsSuperior] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [isClient, setIsClient] = useState(false);
  const [currentUserEmpId, setCurrentUserEmpId] = useState("");
  const [ispending, setispending] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const getWeekStartDate = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d.toISOString().split("T")[0];
  };

  const resetToInitialState = async () => {
    console.log("Resetting to initial state");
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setTimesheets([]);
    setProjects([]);
    setEmployees([]);
    setEmployeeTimesheets([]);
    setEmployeeProjects({});
    setSelectedEmployee("");
    setAttachments({});
    setNoAttachmentFlag(true);
    setError(null);
    setSuccess(false);
    setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName("");
    setIsSuperior(false);
    setispending(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const weekStart = getWeekStartDate(new Date().toISOString().split("T")[0]);
    const individualResult = await fetchTimesheetAndProjects(weekStart);
    if (individualResult.error) {
      setError(individualResult.error);
    } else {
      setTimesheets(individualResult.C_TIMESHEETS || []);
      setProjects(individualResult.projects || []);
      setAttachments(individualResult.attachments || {});
      setNoAttachmentFlag(Object.values(individualResult.attachments || {}).every((atts) => !atts.length));
      setCurrentUserEmpId(individualResult.currentUserEmpId || "");
    }

    const superiorResult = await fetchTimesheetsForSuperior(weekStart);
    if (superiorResult.error) {
      setEmployees([]);
      setEmployeeTimesheets([]);
      setEmployeeProjects({});
    } else {
      setEmployees(superiorResult.employees || []);
      setEmployeeTimesheets(superiorResult.C_TIMESHEETS || []);
      setEmployeeProjects(superiorResult.projects || {});
      setAttachments((prev) => {
        const newAttachments = { ...prev, ...superiorResult.attachments };
        setNoAttachmentFlag(Object.values(newAttachments).every((atts) => !atts.length));
        return newAttachments;
      });
      setIsSuperior(superiorResult.employees.length > 0);
      setCurrentUserEmpId(superiorResult.currentUserEmpId || "");
    }
  };

  useEffect(() => {
    if (searchParams.get('refresh')) {
      resetToInitialState();
    }
  }, [searchParams.get('refresh')]);

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setSuccess(false);
      setNoAttachmentFlag(true);
      setAttachments({});
      setSelectedComment({ timesheetId: null, day: null });
      setSuperiorName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      const weekStart = getWeekStartDate(selectedDate);

      const individualResult = await fetchTimesheetAndProjects(weekStart);
      if (individualResult.error) {
        setError(individualResult.error);
        setTimesheets([]);
        setProjects([]);
      } else {
        setTimesheets(individualResult.C_TIMESHEETS || []);
        setProjects(individualResult.projects || []);
        setAttachments(individualResult.attachments || {});
        setNoAttachmentFlag(Object.values(individualResult.attachments || {}).every((atts) => !atts.length));
        if (!selectedEmployee && individualResult.C_TIMESHEETS?.length > 0 && individualResult.C_TIMESHEETS.some((ts) => ts.is_approved === 1)) {
          const employeeId = individualResult.C_TIMESHEETS[0].employee_id;
          const data = await fetchSuperiorName(employeeId);
          if (data.superiorName) setSuperiorName(data.superiorName);
        }
        setCurrentUserEmpId(individualResult.currentUserEmpId || "");
      }

      const superiorResult = await fetchTimesheetsForSuperior(weekStart);
      if (superiorResult.error) {
        setEmployees([]);
        setEmployeeTimesheets([]);
        setEmployeeProjects({});
      } else {
        setEmployees(superiorResult.employees || []);
        setEmployeeTimesheets(superiorResult.C_TIMESHEETS || []);
        setEmployeeProjects(superiorResult.projects || {});
        setAttachments((prev) => {
          const newAttachments = { ...prev, ...superiorResult.attachments };
          setNoAttachmentFlag(Object.values(newAttachments).every((atts) => !atts.length));
          return newAttachments;
        });
        setIsSuperior(superiorResult.employees.length > 0);
        if (selectedEmployee && superiorResult.C_TIMESHEETS?.length > 0 && superiorResult.C_TIMESHEETS.some((ts) => ts.is_approved === 1)) {
          const data = await fetchSuperiorName(selectedEmployee);
          if (data.superiorName) setSuperiorName(data.superiorName);
        }
        setCurrentUserEmpId(superiorResult.currentUserEmpId || "");
      }
    };
    fetchData();
  }, [selectedDate, selectedEmployee]);

  const formatDate = (date) => (date && !isNaN(new Date(date)) ? new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).replace(/(\d+)\/(\d+)\/(\d+)/, "$1/$2/$3") : "");

  const getDateForDay = (baseDate, dayOffset) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dayOffset);
    return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", weekday: "short" }).replace(/(\d+)\/(\d+)\/(\d+)/, "$1/$2 $3");
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setError(null);
    setSuccess(false);
    setAttachments({});
    setNoAttachmentFlag(true);
    setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName("");
    setispending(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate.toISOString().split("T")[0]);
    setError(null);
    setSuccess(false);
    setAttachments({});
    setNoAttachmentFlag(true);
    setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName("");
    setispending(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate.toISOString().split("T")[0]);
    setError(null);
    setSuccess(false);
    setAttachments({});
    setNoAttachmentFlag(true);
    setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName("");
    setispending(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleInputChange = (e, timesheetId, empId = null, day = null) => {
    const { name, value } = e.target;
    const isEmployee = !empId && !selectedEmployee;
    const targetTimesheets = selectedEmployee ? employeeTimesheets : C_TIMESHEETS;
    const ts = targetTimesheets.find((t) => t.timesheet_id === timesheetId || t.temp_key === timesheetId);
    if (ts) {
      const isOwner = currentUserEmpId === ts.employee_id;
      const canEdit = !isOwner || (!ts.is_submitted && !ts.is_approved);
      if (canEdit) {
        const updateTimesheets = (prev) =>
          prev.map((t) => (t.timesheet_id === timesheetId || t.temp_key === timesheetId ? { ...t, [name]: value === "" ? null : value } : t));
        if (empId || selectedEmployee) setEmployeeTimesheets(updateTimesheets);
        else setTimesheets(updateTimesheets);
        if (day && name.includes("_comment")) setSelectedComment({ timesheetId, day });
      }
    }
  };

  const handleCommentFocus = (timesheetId, day) => setSelectedComment({ timesheetId, day });

  const handleNoAttachmentChange = (checked) => {
    setNoAttachmentFlag(checked);
    if (checked && fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleApprovedChange = async (e, empId) => {
    if (isSaving) return;
    setIsSaving(true);
    const isApproved = e.target.checked ? 1 : 0;
    const weekStart = getWeekStartDate(selectedDate);
    const targetTimesheets = employeeTimesheets.filter((t) => t.employee_id === empId);

    try {
      for (const ts of targetTimesheets) {
        const result = await approveTimesheet(ts.timesheet_id, empId, isApproved);
        if (result.error) {
          setError(result.error || "Failed to approve timesheet.");
        } else {
          setEmployeeTimesheets((prev) =>
            prev.map((t) => (t.timesheet_id === ts.timesheet_id ? { ...t, is_approved: result.isApproved, approved_by: result.approvedBy } : t))
          );
          setSuccess(true);
          if (isApproved) {
            const data = await fetchSuperiorName(empId);
            if (data.superiorName) setSuperiorName(data.superiorName);
          }
        }
      }
    } catch (error) {
      setError(error.message || "Failed to process approval.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (isSubmit = false) => {
    if (isSaving) return;
    setIsSaving(true);
    const weekStart = getWeekStartDate(selectedDate);
    const targetTimesheets = selectedEmployee
      ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee)
      : C_TIMESHEETS;

    if (isSubmit) {
      if (!window.confirm("Once you submit, you cannot edit this timesheet. Are you sure?")) {
        setIsSaving(false);
        return;
      }
      if (!noAttachmentFlag) {
        const hasAnyAttachment = Object.values(attachments).some((atts) => atts.length > 0);
        if (!hasAnyAttachment && !fileInputRef.current?.files.length) {
          setError("No attachments found. Please check 'No Attachment' or upload at least one attachment.");
          setIsSaving(false);
          return;
        }
      }
      const invalidTimesheets = targetTimesheets.filter((ts) =>
        ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].some(
          (day) => parseFloat(ts[`${day}_hours`] || 0) > 0 && (!ts[`${day}_comment`] || ts[`${day}_comment`].trim() === "")
        )
      );
      if (invalidTimesheets.length > 0) {
        setError("A comment is required for any day with hours greater than 0 before submitting.");
        setIsSaving(false);
        return;
      }
    }

    try {
      const formDataWithFiles = new FormData();
      targetTimesheets.forEach((ts, index) => {
        const formData = new FormData();
        formData.append("C_TIMESHEETS[project_id]", ts.project_id);
        formData.append("C_TIMESHEETS[week_start_date]", weekStart);
        formData.append("C_TIMESHEETS[year]", ts.year);
        formData.append("C_TIMESHEETS[timesheet_id]", ts.timesheet_id || "");
        formData.append("C_TIMESHEETS[employee_id]", ts.employee_id);
        formData.append("C_TIMESHEETS[is_approved]", ts.is_approved || 0);
        ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].forEach((day) => {
          formData.append(`C_TIMESHEETS[${day}_hours]`, ts[`${day}_hours`] ?? "");
          formData.append(`C_TIMESHEETS[${day}_comment]`, ts[`${day}_comment`] ?? "");
        });
        formData.append("C_TIMESHEETS[is_submitted]", isSubmit ? 1 : ts.is_submitted || 0);

        for (let [key, value] of formData.entries()) {
          formDataWithFiles.append(`C_TIMESHEETS[${index}][${key.split("C_TIMESHEETS[")[1]}`, value);
        }
      });

      const files = fileInputRef.current?.files || [];
      if (files.length > 0 && !noAttachmentFlag) {
        Array.from(files).forEach((file) => formDataWithFiles.append("attachment", file));
      }

      const result = await saveTimesheet(formDataWithFiles);
      if (result.error) {
        setError(result.error || "Failed to save C_TIMESHEETS.");
      } else {
        setAttachments((prev) => {
          const newAttachments = { ...prev };
          if (result.attachments && result.timesheetIds) {
            result.timesheetIds.forEach((timesheetId, idx) => {
              newAttachments[timesheetId] = result.attachments.filter((a) => a.timesheet_id === timesheetId) || [];
            });
          }
          setNoAttachmentFlag(Object.values(newAttachments).every((atts) => !atts.length));
          return newAttachments;
        });

        const updatedResult = selectedEmployee
          ? await fetchTimesheetsForSuperior(weekStart)
          : await fetchTimesheetAndProjects(weekStart);
        if (updatedResult.error) {
          setError(updatedResult.error);
        } else {
          if (selectedEmployee) {
            setEmployeeTimesheets(updatedResult.C_TIMESHEETS || []);
            setEmployeeProjects(updatedResult.projects || {});
            setAttachments(updatedResult.attachments || {});
            setNoAttachmentFlag(Object.values(updatedResult.attachments || {}).every((atts) => !atts.length));
            if (updatedResult.C_TIMESHEETS?.some((ts) => ts.is_approved === 1)) {
              const data = await fetchSuperiorName(selectedEmployee);
              if (data.superiorName) setSuperiorName(data.superiorName);
            }
            setIsSuperior(updatedResult.employees.length > 0);
          } else {
            setTimesheets(updatedResult.C_TIMESHEETS || []);
            setProjects(updatedResult.projects || []);
            setAttachments(updatedResult.attachments || {});
            setNoAttachmentFlag(Object.values(updatedResult.attachments || {}).every((atts) => !atts.length));
            if (!isSuperior && updatedResult.C_TIMESHEETS?.some((ts) => ts.is_approved === 1)) {
              const employeeId = updatedResult.C_TIMESHEETS[0].employee_id;
              const data = await fetchSuperiorName(employeeId);
              if (data.superiorName) setSuperiorName(data.superiorName);
            }
          }
          setSuccess(true);
        }
      }
    } catch (error) {
      setError(error.message || "Failed to process C_TIMESHEETS.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsSaving(false);
    }
  };

  const handleRemoveAttachment = async (attachmentId, timesheetId) => {
    const result = await removeAttachment(attachmentId, timesheetId);
    if (result.success) {
      setAttachments((prev) => {
        const newAttachments = { ...prev };
        for (let key in newAttachments) newAttachments[key] = newAttachments[key].filter((a) => a.attachment_id !== attachmentId);
        setNoAttachmentFlag(Object.values(newAttachments).every((atts) => !atts.length));
        return newAttachments;
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess(true);
    } else setError(result.error || "Failed to remove attachment.");
  };

  const handlePendingApproveSheet = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setTimesheets([]);
    setProjects([]);
    setEmployees([]);
    setEmployeeTimesheets([]);
    setEmployeeProjects({});
    setSelectedEmployee("");
    setAttachments({});
    setNoAttachmentFlag(true);
    setError(null);
    setSuccess(false);
    setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName("");
    setIsSuperior(false);
    setispending(true);
  };

  const isAnySubmittedOrApproved = (targetTimesheets) => targetTimesheets.some((ts) => ts.is_submitted === 1 || ts.is_approved === 1);

  const getTimesheetById = (timesheetId) =>
    (selectedEmployee ? employeeTimesheets : C_TIMESHEETS).find((t) => t.timesheet_id === timesheetId || t.temp_key === timesheetId);

  if (!isClient) return null;

  return (
    <div className="className99timesheet-container">
      {ispending ? (
        <div>
          <button onClick={resetToInitialState} className="className99nav-button">Back</button>
          <ApprovalPending />
        </div>
      ) : (
        <>
          <div className="className99header-section">
            <h3 className="className99week-title">Week Starting: {formatDate(getWeekStartDate(selectedDate))}</h3>
            <div className="className99date-navigation">
              <button className="className99nav-button" onClick={handlePrevWeek}>
                Prev
              </button>
              <label className="className99date-label">Select Date: </label>
              <input type="date" value={selectedDate} onChange={handleDateChange} className="className99date-input" />
              <button className="className99nav-button" onClick={handleNextWeek}>
                Next
              </button>
            </div>
            {isSuperior && (
              <button type="button" className="className99pending-approve-button" onClick={handlePendingApproveSheet}>
                Pending Approve TimeSheet
              </button>
            )}
          </div>

          {selectedDate && (
            <div className="className99timesheet-content">
              {/* Controls Section - Only Employee Selection */}
              <div className="className99controls-section">
                <div className="className99employee-selection">
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
                    className="className99employee-dropdown"
                  >
                    <option value="">Your TimeSheets</option>
                    {employees.map((emp) => (
                      <option key={emp.empid} value={emp.empid}>
                        {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ""}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Approval Message */}
              {!selectedEmployee && !isSuperior && C_TIMESHEETS.some((ts) => ts.is_approved === 1) && superiorName && (
                <p className="className99approval-message">Approved by {superiorName}</p>
              )}

              {/* Above Table Actions - Approve All and Submit */}
              {((!selectedEmployee && C_TIMESHEETS.length > 0) || (selectedEmployee && employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).length > 0)) && (
                <div className="className99above-table-actions">
                  {/* Approve Section for Employee Selection */}
                  {selectedEmployee && employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).length > 0 && (
                    <div className="className99approve-section">
                      <label>
                        <input
                          type="checkbox"
                          checked={employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).every((ts) => ts.is_approved)}
                          onChange={(e) => handleApprovedChange(e, selectedEmployee)}
                          disabled={isSaving}
                          style={{ cursor: isSaving ? "not-allowed" : "pointer" }}
                        />
                        Approve All
                      </label>
                    </div>
                  )}

                  {/* Submit Button for Own Timesheets */}
                  {!selectedEmployee && (
                    <div className="className99button-group">
                      <button
                        type="button"
                        className="className99submit-button"
                        onClick={() => handleSave(true)}
                        disabled={isSaving || C_TIMESHEETS.some((ts) => ts.is_submitted === 1 || ts.is_approved === 1)}
                        style={{
                          cursor:
                            isSaving || C_TIMESHEETS.some((ts) => ts.is_submitted === 1 || ts.is_approved === 1)
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {isSaving ? 'Submitting...' : 'Submit All'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Timesheet Table */}
              {((!selectedEmployee && C_TIMESHEETS.length > 0) || (selectedEmployee && employeeTimesheets.filter((t) => t.employee_id === selectedEmployee).length > 0)) && (
                <div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                  }}>
                    <table className="className99timesheet-table">
                      <thead>
                        <tr>
                          <th>Project Name</th>
                          {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day, index) => (
                            <th key={day}>{getDateForDay(getWeekStartDate(selectedDate), index)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedEmployee ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee) : C_TIMESHEETS).map((ts) => {
                          const project = selectedEmployee
                            ? (employeeProjects[selectedEmployee] || []).find((p) => p.PRJ_ID === ts.project_id)
                            : projects.find((p) => p.PRJ_ID === ts.project_id);
                          const isOwner = currentUserEmpId === ts.employee_id;
                          const isLocked = isOwner && (ts.is_submitted === 1 || ts.is_approved === 1);
                          return (
                            <tr key={ts.timesheet_id || ts.temp_key}>
                              <td>{project?.PRJ_NAME || "Unnamed Project"}</td>
                              {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day) => (
                                <td key={`${ts.timesheet_id || ts.temp_key}_${day}`}>
                                  <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    minHeight: '120px',
                                    padding: '8px 4px'
                                  }}>
                                    <input
                                      type="number"
                                      name={`${day}_hours`}
                                      value={ts[`${day}_hours`] ?? ""}
                                      onChange={(e) => handleInputChange(e, ts.timesheet_id || ts.temp_key, selectedEmployee ? ts.employee_id : null)}
                                      step="0.25"
                                      min="0"
                                      max="24"
                                      className="className99hours-input"
                                      disabled={isLocked}
                                      style={{ 
                                        cursor: isLocked ? "not-allowed" : "text",
                                        display: 'block',
                                        width: '90px',
                                        height: '36px',
                                        padding: '6px 8px',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        textAlign: 'center',
                                        backgroundColor: isLocked ? '#f3f4f6' : '#fff',
                                        color: isLocked ? '#9ca3af' : '#374151'
                                      }}
                                      placeholder="Hours"
                                    />
                                    <textarea
                                      name={`${day}_comment`}
                                      value={ts[`${day}_comment`] ?? ""}
                                      onChange={(e) => handleInputChange(e, ts.timesheet_id || ts.temp_key, selectedEmployee ? ts.employee_id : null, day)}
                                      onFocus={() => handleCommentFocus(ts.timesheet_id || ts.temp_key, day)}
                                      className="className99comment-textarea"
                                      disabled={isLocked}
                                      style={{ 
                                        cursor: isLocked ? "not-allowed" : "text",
                                        display: 'block',
                                        width: '110px',
                                        height: '60px',
                                        padding: '6px 8px',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        resize: 'none',
                                        fontFamily: 'Arial, sans-serif',
                                        backgroundColor: isLocked ? '#f3f4f6' : '#fff',
                                        color: isLocked ? '#9ca3af' : '#374151',
                                        lineHeight: '1.4'
                                      }}
                                      placeholder="Comment"
                                    />
                                  </div>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="className99timesheet-comment-section">
                      <label>Selected Comment:</label>
                      <textarea
                        value={
                          selectedComment.timesheetId && selectedComment.day
                            ? (selectedEmployee
                                ? employeeTimesheets.find((t) => t.timesheet_id === selectedComment.timesheetId || t.temp_key === selectedComment.timesheetId)
                                : C_TIMESHEETS.find((t) => t.timesheet_id === selectedComment.timesheetId || t.temp_key === selectedComment.timesheetId))?.[
                                `${selectedComment.day}_comment`
                              ] ?? ""
                            : ""
                        }
                        onChange={(e) => {
                          const newValue = e.target.value;
                          const targetTimesheets = selectedEmployee ? employeeTimesheets : C_TIMESHEETS;
                          const ts = targetTimesheets.find((t) => t.timesheet_id === selectedComment.timesheetId || t.temp_key === selectedComment.timesheetId);
                          if (ts) {
                            const isOwner = currentUserEmpId === ts.employee_id;
                            const isLocked = isOwner && (ts.is_submitted === 1 || ts.is_approved === 1);
                            if (!isLocked) {
                              const updateTimesheets = (prev) =>
                                prev.map((t) =>
                                  t.timesheet_id === selectedComment.timesheetId || t.temp_key === selectedComment.timesheetId
                                    ? { ...t, [`${selectedComment.day}_comment`]: newValue === "" ? null : newValue }
                                    : t
                                );
                              selectedEmployee ? setEmployeeTimesheets(updateTimesheets) : setTimesheets(updateTimesheets);
                            }
                          }
                        }}
                        onFocus={() => selectedComment.timesheetId && selectedComment.day && handleCommentFocus(selectedComment.timesheetId, selectedComment.day)}
                        className="className99comment-display-textarea"
                        placeholder="Select a comment in the table to edit it here..."
                        disabled={
                          !selectedComment.timesheetId ||
                          !selectedComment.day ||
                          (getTimesheetById(selectedComment.timesheetId)?.is_submitted === 1 &&
                            getTimesheetById(selectedComment.timesheetId)?.is_approved === 1 &&
                            currentUserEmpId === getTimesheetById(selectedComment.timesheetId)?.employee_id)
                        }
                        style={{
                          cursor:
                            !selectedComment.timesheetId ||
                            !selectedComment.day ||
                            (getTimesheetById(selectedComment.timesheetId)?.is_submitted === 1 &&
                              getTimesheetById(selectedComment.timesheetId)?.is_approved === 1 &&
                              currentUserEmpId === getTimesheetById(selectedComment.timesheetId)?.employee_id)
                              ? "not-allowed"
                              : "text",
                        }}
                      />
                    </div>

                    <div className="className99attachment-field">
                      <label>Attachments for the Week:</label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="className99file-input"
                        multiple
                        disabled={isAnySubmittedOrApproved(selectedEmployee ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee) : C_TIMESHEETS)}
                        style={{
                          cursor: isAnySubmittedOrApproved(selectedEmployee ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee) : C_TIMESHEETS)
                            ? "not-allowed"
                            : "pointer",
                        }}
                        onChange={() => setNoAttachmentFlag(false)}
                      />
                      <label className="className99no-attachment-label">
                        <input
                          type="checkbox"
                          checked={noAttachmentFlag}
                          onChange={(e) => handleNoAttachmentChange(e.target.checked)}
                          disabled={isAnySubmittedOrApproved(selectedEmployee ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee) : C_TIMESHEETS)}
                          style={{
                            cursor: isAnySubmittedOrApproved(selectedEmployee ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee) : C_TIMESHEETS)
                              ? "not-allowed"
                              : "pointer",
                          }}
                        />
                        No Attachment
                      </label>
                      {Object.values(attachments).some((atts) => atts.length > 0) && (
                        <div className="className99attached-files">
                          <h5>Attached Files:</h5>
                          <ul>
                            {[...new Set(Object.values(attachments).flat().map((a) => a.attachment_id))].map((attachmentId) => {
                              const attachment = Object.values(attachments)
                                .flat()
                                .find((a) => a.attachment_id === attachmentId);
                              const ts = getTimesheetById(attachment.timesheet_id);
                              return (
                                <li key={attachment.attachment_id}>
                                  <a
                                    href={attachment.file_path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="className99attachment-link"
                                    style={{ cursor: ts?.is_submitted === 1 || ts?.is_approved === 1 ? "not-allowed" : "pointer" }}
                                  >
                                    {attachment.file_name}
                                  </a>
                                  <button
                                    type="button"
                                    className="className99remove-button"
                                    onClick={() => handleRemoveAttachment(attachment.attachment_id, attachment.timesheet_id)}
                                    disabled={isAnySubmittedOrApproved(selectedEmployee ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee) : C_TIMESHEETS)}
                                    style={{
                                      cursor: isAnySubmittedOrApproved(selectedEmployee ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee) : C_TIMESHEETS)
                                        ? "not-allowed"
                                        : "pointer",
                                    }}
                                  >
                                    Remove
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Save Button Section - At the Bottom */}
                    <div className="className99save-section">
                      <button
                        type="button"
                        className="className99save-button"
                        onClick={() => handleSave()}
                        disabled={isSaving || (selectedEmployee ? employeeTimesheets.some((t) => t.employee_id === selectedEmployee && (t.is_submitted === 1 || t.is_approved === 1)) : C_TIMESHEETS.some((ts) => ts.is_submitted === 1 || ts.is_approved === 1))}
                        style={{
                          cursor:
                            isSaving ||
                            (selectedEmployee
                              ? employeeTimesheets.some((t) => t.employee_id === selectedEmployee && (t.is_submitted === 1 || t.is_approved === 1))
                              : C_TIMESHEETS.some((ts) => ts.is_submitted === 1 || ts.is_approved === 1))
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>

                    {error && <p className="className99error-message">{error}</p>}
                    {success && <p className="className99success-message">Action successful!</p>}
                  </form>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Overview;
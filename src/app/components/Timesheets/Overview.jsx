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
  fetchCopyableWeeks,
  fetchTimesheetDataForCopy,
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
  
  const [newFileCount, setNewFileCount] = useState(0);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedComment, setSelectedComment] = useState({ timesheetId: null, day: null });
  const [superiorName, setSuperiorName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [isClient, setIsClient] = useState(false);
  const [currentUserEmpId, setCurrentUserEmpId] = useState("");
  const [ispending, setispending] = useState(false);

  const [manageableEmpIds, setManageableEmpIds] = useState([]);
  const [canManage, setCanManage] = useState(false);

  const [copyDropdownOpen, setCopyDropdownOpen] = useState(null);
  const [copyableWeeks, setCopyableWeeks] = useState([]);
  const [isCopyLoading, setIsCopyLoading] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  /**
   * CRITICAL FIX: Timezone-agnostic week start calculation for FRONTEND
   * This ensures the frontend ALWAYS calculates Sunday correctly
   * Input: "2025-01-13" (Monday)
   * Output: "2025-01-12" (Sunday)
   */
  const getWeekStartDate = (dateString) => {
    try {
      // Parse date components WITHOUT timezone conversion
      const [yearStr, monthStr, dayStr] = dateString.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      
      if (!year || !month || !day) {
        throw new Error("Invalid date format");
      }
      
      // Create date at noon UTC to avoid DST issues
      const dateUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      
      if (isNaN(dateUTC.getTime())) {
        throw new Error("Invalid date");
      }
      
      // Get day of week (0 = Sunday, 6 = Saturday)
      const dayOfWeek = dateUTC.getUTCDay();
      
      // Calculate Sunday by subtracting days
      const sundayUTC = new Date(dateUTC);
      sundayUTC.setUTCDate(dateUTC.getUTCDate() - dayOfWeek);
      
      // Format as YYYY-MM-DD using UTC components
      const weekStart = `${sundayUTC.getUTCFullYear()}-${String(sundayUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(sundayUTC.getUTCDate()).padStart(2, '0')}`;
      
      console.log(`[FRONTEND] getWeekStartDate: Input="${dateString}", DayOfWeek=${dayOfWeek}, WeekStart="${weekStart}"`);
      
      return weekStart;
    } catch (error) {
      console.error("[FRONTEND] Error calculating week start:", error, "Input:", dateString);
      // Fallback to current week's Sunday
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek, 12, 0, 0));
      return `${sunday.getUTCFullYear()}-${String(sunday.getUTCMonth() + 1).padStart(2, '0')}-${String(sunday.getUTCDate()).padStart(2, '0')}`;
    }
  };

  const resetToInitialState = async () => {
    console.log("Resetting to initial state");
    router.refresh();
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
    setManageableEmpIds([]);
    setCanManage(false);
    setispending(false);
    setNewFileCount(0);
    setCopyDropdownOpen(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const weekStart = getWeekStartDate(new Date().toISOString().split("T")[0]);
    let newManageableIds = [];
    const individualResult = await fetchTimesheetAndProjects(weekStart);
    if (individualResult.error) {
      setError(individualResult.error);
    } else {
      setTimesheets(individualResult.C_TIMESHEETS || []);
      setProjects(individualResult.projects || []);
      setAttachments(individualResult.attachments || {});
      setNoAttachmentFlag(Object.values(individualResult.attachments || {}).every((atts) => !atts.length));
      setCurrentUserEmpId(individualResult.currentUserEmpId || "");
      newManageableIds = individualResult.manageableEmpIds || [];
      setManageableEmpIds(newManageableIds);
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
      const allManageableIds = [...new Set([...newManageableIds, ...(superiorResult.manageableEmpIds || [])])];
      setManageableEmpIds(allManageableIds);
      setCanManage(allManageableIds.length > 0);
      setCurrentUserEmpId(superiorResult.currentUserEmpId || individualResult.currentUserEmpId);
    }
  };

  useEffect(() => {
    if (searchParams.get('refresh')) {
      resetToInitialState();
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setSuccess(false);
      setNoAttachmentFlag(true);
      setAttachments({});
      setSelectedComment({ timesheetId: null, day: null });
      setSuperiorName("");
      setNewFileCount(0); 
      setCopyDropdownOpen(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      const weekStart = getWeekStartDate(selectedDate);
      
      console.log(`[FRONTEND] fetchData: selectedDate="${selectedDate}", weekStart="${weekStart}"`);
      
      let newManageableIds = [];

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
        newManageableIds = individualResult.manageableEmpIds || [];
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
        if (selectedEmployee && superiorResult.C_TIMESHEETS?.length > 0 && superiorResult.C_TIMESHEETS.some((ts) => ts.is_approved === 1)) {
          const data = await fetchSuperiorName(selectedEmployee);
          if (data.superiorName) setSuperiorName(data.superiorName);
        }
        setCurrentUserEmpId(individualResult.currentUserEmpId || superiorResult.currentUserEmpId);
        
        const allManageableIds = [...new Set([...newManageableIds, ...(superiorResult.manageableEmpIds || [])])];
        setManageableEmpIds(allManageableIds);
        setCanManage(allManageableIds.length > 0);
      }
    };
    fetchData();
  }, [selectedDate, selectedEmployee]);

  const formatDate = (date) => {
    if (!date) return '';

    // FIX: Handle if 'date' is already a JS Date object
    if (date instanceof Date) {
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC"
      });
    }

    // FIX: Ensure it is a string before splitting
    if (typeof date === 'string') {
      // Remove time component if present (e.g. "2025-01-01T00:00:00.000Z" -> "2025-01-01")
      const dateStr = date.includes('T') ? date.split('T')[0] : date;
      const [year, month, day] = dateStr.split('-');
      
      // Ensure we have valid parts
      if (year && month && day) {
        const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
        return d.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          timeZone: "UTC"
        });
      }
    }

    // Fallback if formatting fails but it's a valid date value
    const d = new Date(date);
    return isNaN(d) ? '' : d.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      timeZone: "UTC"
    });
  };
  const getDateForDay = (baseDate, dayOffset) => {
    // FIXED: Parse base date consistently
    const [year, month, day] = baseDate.split('-');
    const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
    d.setUTCDate(d.getUTCDate() + dayOffset);
    return d.toLocaleDateString("en-US", { 
      month: "2-digit", 
      day: "2-digit", 
      weekday: "short",
      timeZone: "UTC" 
    });
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setError(null); setSuccess(false); setAttachments({});
    setNoAttachmentFlag(true); setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName(""); setispending(false);
    setNewFileCount(0); 
    setCopyDropdownOpen(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePrevWeek = () => {
    // FIXED: Calculate previous week correctly
    const [year, month, day] = selectedDate.split('-');
    const currentDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
    currentDate.setUTCDate(currentDate.getUTCDate() - 7);
    const newDate = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
    setSelectedDate(newDate);
    setError(null); setSuccess(false); setAttachments({});
    setNoAttachmentFlag(true); setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName(""); setispending(false);
    setNewFileCount(0); 
    setCopyDropdownOpen(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNextWeek = () => {
    // FIXED: Calculate next week correctly
    const [year, month, day] = selectedDate.split('-');
    const currentDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
    currentDate.setUTCDate(currentDate.getUTCDate() + 7);
    const newDate = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
    setSelectedDate(newDate);
    setError(null); setSuccess(false); setAttachments({});
    setNoAttachmentFlag(true); setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName(""); setispending(false);
    setNewFileCount(0); 
    setCopyDropdownOpen(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleInputChange = (e, timesheetId, empId = null, day = null) => {
    const { name, value } = e.target;
    const targetTimesheets = selectedEmployee ? employeeTimesheets : C_TIMESHEETS;
    const ts = targetTimesheets.find((t) => t.timesheet_id === timesheetId || t.temp_key === timesheetId);
    if (ts) {
      const canManageThisEmployee = manageableEmpIds.includes(ts.employee_id);
      const isOwner = currentUserEmpId === ts.employee_id;
      const isLocked = isOwner && !canManageThisEmployee && (ts.is_submitted === 1 || ts.is_approved === 1);
      
      if (!isLocked) {
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
    if (checked) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNewFileCount(0);
    }
  };

  const handleApprovedChange = async (e, empId) => {
    if (isSaving) return;
    setIsSaving(true);
    const isApproved = e.target.checked ? 1 : 0;
    
    const targetEmployeeId = empId || currentUserEmpId;
    
    const targetTimesheets = selectedEmployee
      ? employeeTimesheets.filter((t) => t.employee_id === targetEmployeeId)
      : C_TIMESHEETS.filter((t) => t.employee_id === targetEmployeeId);

    try {
      for (const ts of targetTimesheets) {
        if (ts.timesheet_id) {
          const result = await approveTimesheet(ts.timesheet_id, targetEmployeeId, isApproved); 
          if (result.error) {
            setError(result.error || "Failed to approve timesheet.");
          } else {
            const updater = selectedEmployee ? setEmployeeTimesheets : setTimesheets;
            updater((prev) =>
              prev.map((t) => (t.timesheet_id === ts.timesheet_id ? { ...t, is_approved: result.isApproved, approved_by: result.approvedBy } : t))
            );
            
            setSuccess(true);
            if (isApproved) {
              const data = await fetchSuperiorName(targetEmployeeId);
              if (data.superiorName) setSuperiorName(data.superiorName);
            } else {
              setSuperiorName("");
            }
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
    setError(null);
    setSuccess(false);
    
    const weekStart = getWeekStartDate(selectedDate);
    
    console.log(`[FRONTEND] handleSave: selectedDate="${selectedDate}", calculatedWeekStart="${weekStart}", isSubmit=${isSubmit}`);
    
    const targetTimesheets = selectedEmployee
      ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee)
      : C_TIMESHEETS;

    const hasExistingAttachments = Object.values(attachments).flat().filter(att => currentViewTimesheets.some(ts => ts.timesheet_id === att.timesheet_id)).length > 0;
    const hasNewAttachments = newFileCount > 0;
    const hasAnyAttachments = hasExistingAttachments || hasNewAttachments;
    
    if (isSubmit) {
      if (!window.confirm("Once you submit, you cannot edit this timesheet. Are you sure?")) {
        setIsSaving(false);
        return;
      }
      
      if (!noAttachmentFlag && !hasAnyAttachments) {
          setError("No attachments found. Please check 'No Attachment' or upload at least one attachment.");
          setIsSaving(false);
          return;
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
        formData.append("C_TIMESHEETS[week_start_date]", weekStart); // CRITICAL: Send calculated week start
        formData.append("C_TIMESHEETS[year]", ts.year || new Date(weekStart + 'T12:00:00Z').getUTCFullYear());
        formData.append("C_TIMESHEETS[timesheet_id]", ts.timesheet_id || "");
        formData.append("C_TIMESHEETS[employee_id]", ts.employee_id);
        formData.append("C_TIMESHEETS[is_approved]", ts.is_approved || 0);
        ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].forEach((day) => {
          formData.append(`C_TIMESHEETS[${day}_hours]`, ts[`${day}_hours`] ?? "");
          formData.append(`C_TIMESHEETS[${day}_comment]`, ts[`${day}_comment`] ?? "");
        });
        formData.append("C_TIMESHEETS[is_submitted]", isSubmit ? 1 : ts.is_submitted || 0);

        for (let [key, value] of formData.entries()) {
          formDataWithFiles.append(`C_TIMESHEETS[${index}][${key.split("[")[1]}`, value);
        }
      });

      const files = fileInputRef.current?.files || [];
      if (newFileCount > 0 && !noAttachmentFlag) {
        Array.from(files).forEach((file) => formDataWithFiles.append("attachment", file));
      }

      formDataWithFiles.append("noAttachmentFlag", (noAttachmentFlag && !hasAnyAttachments) ? "1" : "0");

      const result = await saveTimesheet(formDataWithFiles);
      if (result.error) {
        setError(result.error || "Failed to save C_TIMESHEETS.");
      } else {
        let newManageableIds = [];
        const individualResult = await fetchTimesheetAndProjects(weekStart);
        if (individualResult.error) {
            setError(individualResult.error);
        } else {
            setTimesheets(individualResult.C_TIMESHEETS || []);
            setProjects(individualResult.projects || []);
            setAttachments(individualResult.attachments || {});
            setNoAttachmentFlag(Object.values(individualResult.attachments || {}).every((atts) => !atts.length));
            newManageableIds = individualResult.manageableEmpIds || [];
            if (!selectedEmployee && individualResult.C_TIMESHEETS?.some((ts) => ts.is_approved === 1)) {
                const employeeId = individualResult.C_TIMESHEETS[0].employee_id;
                const data = await fetchSuperiorName(employeeId);
                if (data.superiorName) setSuperiorName(data.superiorName);
            }
        }
        
        const superiorResult = await fetchTimesheetsForSuperior(weekStart);
        if (superiorResult.error) {
            // handle error if needed
        } else {
            setEmployeeTimesheets(superiorResult.C_TIMESHEETS || []);
            setEmployeeProjects(superiorResult.projects || {});
            setAttachments((prev) => ({ ...prev, ...superiorResult.attachments }));
            
            const currentViewAttachments = selectedEmployee 
                ? (superiorResult.attachments || {})
                : (individualResult.attachments || {});
            setNoAttachmentFlag(Object.values(currentViewAttachments).every((atts) => !atts.length));

            if (selectedEmployee && superiorResult.C_TIMESHEETS?.some((ts) => ts.is_approved === 1)) {
                const data = await fetchSuperiorName(selectedEmployee);
                if (data.superiorName) setSuperiorName(data.superiorName);
            }
            const allManageableIds = [...new Set([...newManageableIds, ...(superiorResult.manageableEmpIds || [])])];
            setManageableEmpIds(allManageableIds);
            setCanManage(allManageableIds.length > 0);
        }
        
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      setError(error.message || "Failed to process C_TIMESHEETS.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNewFileCount(0); 
      setIsSaving(false);
    }
  };

  const handleRemoveAttachment = async (attachmentId, timesheetId) => {
    const result = await removeAttachment(attachmentId, timesheetId);
    if (result.success) {
      setAttachments((prev) => {
        const newAttachments = { ...prev };
        for (let key in newAttachments) newAttachments[key] = newAttachments[key].filter((a) => a.attachment_id !== attachmentId);
        
        const hasExisting = !Object.values(newAttachments).every((atts) => !atts.length);
        if (!hasExisting && newFileCount === 0) {
          setNoAttachmentFlag(true);
        }
        
        return newAttachments;
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else setError(result.error || "Failed to remove attachment.");
  };

  const handlePendingApproveSheet = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setTimesheets([]); setProjects([]); setEmployees([]);
    setEmployeeTimesheets([]); setEmployeeProjects({});
    setSelectedEmployee(""); setAttachments({});
    setNoAttachmentFlag(true); setError(null); setSuccess(false);
    setSelectedComment({ timesheetId: null, day: null });
    setSuperiorName("");
    setManageableEmpIds([]);
    setCanManage(false);
    setispending(true);
    setNewFileCount(0);
    setCopyDropdownOpen(null);
  };

  const handleCopyClick = async (ts) => {
    const key = ts.timesheet_id || ts.temp_key;
    
    if (copyDropdownOpen?.key === key) {
      setCopyDropdownOpen(null);
      return;
    }

    setCopyDropdownOpen({ key, employeeId: ts.employee_id, projectId: ts.project_id });
    setIsCopyLoading(true);
    setError(null);

    const result = await fetchCopyableWeeks(ts.employee_id, ts.project_id); 
    if (result.error) {
      setError(result.error);
      setCopyableWeeks([]);
    } else {
      const currentWeekStart = getWeekStartDate(selectedDate);
      setCopyableWeeks(result.weeks.filter(w => w.week_start_date !== currentWeekStart));
    }
    setIsCopyLoading(false);
  };

  const handleCopyWeekSelect = async (sourceWeekStartDate) => {
    if (!copyDropdownOpen) return;

    const { key, employeeId, projectId } = copyDropdownOpen;
    setIsCopyLoading(true);
    setError(null);

    const result = await fetchTimesheetDataForCopy(employeeId, projectId, sourceWeekStartDate); 

    if (result.error) {
      setError(result.error);
    } else {
      const sourceData = result.sourceTimesheet;
      const updateTimesheets = (prev) =>
        prev.map((t) =>
          (t.timesheet_id === key || t.temp_key === key)
            ? {
              ...t,
              sun_hours: sourceData.sun_hours, sun_comment: sourceData.sun_comment,
              mon_hours: sourceData.mon_hours, mon_comment: sourceData.mon_comment,
              tue_hours: sourceData.tue_hours, tue_comment: sourceData.tue_comment,
              wed_hours: sourceData.wed_hours, wed_comment: sourceData.wed_comment,
              thu_hours: sourceData.thu_hours, thu_comment: sourceData.thu_comment,
              fri_hours: sourceData.fri_hours, fri_comment: sourceData.fri_comment,
              sat_hours: sourceData.sat_hours, sat_comment: sourceData.sat_comment,
            }
            : t
        );

      if (selectedEmployee) {
        setEmployeeTimesheets(updateTimesheets);
      } else {
        setTimesheets(updateTimesheets);
      }
      setSuccess("Week data copied successfully!");
      setTimeout(() => setSuccess(false), 3000);
    }

    setIsCopyLoading(false);
    setCopyDropdownOpen(null);
    setCopyableWeeks([]);
  };

  const isAnySubmittedOrApproved = (targetTimesheets) => targetTimesheets.some((ts) => ts.is_submitted === 1 || ts.is_approved === 1);

  const getTimesheetById = (timesheetId) =>
    (selectedEmployee ? employeeTimesheets : C_TIMESHEETS).find((t) => t.timesheet_id === timesheetId || t.temp_key === timesheetId);

  if (!isClient) return null;

  const currentViewTimesheets = selectedEmployee 
    ? employeeTimesheets.filter((t) => t.employee_id === selectedEmployee)
    : C_TIMESHEETS;
  
  const isCurrentViewLocked = isAnySubmittedOrApproved(currentViewTimesheets);

  const isManagingCurrentView = selectedEmployee 
    ? manageableEmpIds.includes(selectedEmployee)
    : manageableEmpIds.includes(currentUserEmpId);

  const currentViewAttachments = Object.values(attachments).flat()
    .filter(att => currentViewTimesheets.some(ts => ts.timesheet_id === att.timesheet_id));
  const hasExistingAttachments = currentViewAttachments.length > 0;
  const hasNewAttachments = newFileCount > 0;
  const hasAnyAttachments = hasExistingAttachments || hasNewAttachments;

  return (
    <div className="timesheets_container">
      {copyDropdownOpen && (
        <div 
          className="timesheets_copy-modal-backdrop"
          onClick={() => setCopyDropdownOpen(null)}
        >
          <div 
            className="timesheets_copy-dropdown"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="timesheets_copy-dropdown-header">
              <span>Copy from week...</span>
              <button
                type="button"
                className="timesheets_copy-close-btn"
                onClick={() => setCopyDropdownOpen(null)}
              >
                &times;
              </button>
            </div>
            <div className="timesheets_copy-dropdown-content">
              {isCopyLoading ? (
                <p>Loading...</p>
              ) : copyableWeeks.length === 0 ? (
                <p>No past weeks found.</p>
              ) : (
                <ul>
                  {copyableWeeks.map(week => (
                    <li
                      key={week.week_start_date}
                      onClick={() => handleCopyWeekSelect(week.week_start_date)}
                    >
                      {formatDate(week.week_start_date)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {ispending ? (
        <div>
          <ApprovalPending onBack={resetToInitialState} />
        </div>
      ) : (
        <>
          <div className="timesheets_header-section">
            <h3 className="timesheets_week-title">Week Starting: {formatDate(getWeekStartDate(selectedDate))}</h3>
            <div className="timesheets_date-navigation">
              <button className="timesheets_nav-button" onClick={handlePrevWeek}>Prev</button>
              <label className="timesheets_date-label">Select Date:</label>
              <input type="date" value={selectedDate} onChange={handleDateChange} className="timesheets_date-input" />
              <button className="timesheets_nav-button" onClick={handleNextWeek}>Next</button>
            </div>
            {canManage && (
              <button type="button" className="timesheets_pending-approve-button" onClick={handlePendingApproveSheet}>
                Pending Approvals
              </button>
            )}
          </div>

          {selectedDate && (
            <div className="timesheets_content">
              <div className="timesheets_controls-section">
                <div className="timesheets_employee-selection">
                  <label>Select Employee:</label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => {
                      const newEmpId = e.target.value;
                      setSelectedEmployee(newEmpId);
                      setError(null);
                      setSuccess(false);
                      setSelectedComment({ timesheetId: null, day: null });
                      setCopyDropdownOpen(null);

                      if (fileInputRef.current) fileInputRef.current.value = "";
                      setNewFileCount(0);

                      const empTimesheets = newEmpId
                        ? employeeTimesheets.filter(t => t.employee_id === newEmpId)
                        : C_TIMESHEETS;
                      const empTimesheetIds = empTimesheets.map(t => t.timesheet_id || t.temp_key);
                      
                      let hasAttachments = false;
                      if(empTimesheetIds.length > 0) {
                        hasAttachments = Object.values(attachments).flat().some(att => empTimesheetIds.includes(att.timesheet_id));
                      }
                      setNoAttachmentFlag(!hasAttachments);
                    }}
                    className="timesheets_employee-dropdown"
                  >
                    <option value="">Your Timesheets</option>
                    {employees.map((emp) => (
                      <option key={emp.empid} value={emp.empid}>{`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ""}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedEmployee && !canManage && C_TIMESHEETS.some((ts) => ts.is_approved === 1) && superiorName && (
                <p className="timesheets_approval-message">Approved by {superiorName}</p>
              )}

              {(currentViewTimesheets.length > 0) && (
                <div className="timesheets_above-table-actions">
                  
                  {( (selectedEmployee && manageableEmpIds.includes(selectedEmployee)) ||
                     (!selectedEmployee && manageableEmpIds.includes(currentUserEmpId)) 
                  ) && (
                    <div className="timesheets_approve-section">
                      <label>
                        <input
                          type="checkbox"
                          checked={currentViewTimesheets.every((ts) => ts.is_approved)}
                          onChange={(e) => handleApprovedChange(e, selectedEmployee)}
                          disabled={isSaving}
                        />
                        Approve
                      </label>
                    </div>
                  )}

                  {!selectedEmployee && (
                    <div className="timesheets_button-group">
                      <button
                        type="button"
                        className="timesheets_submit-button"
                        onClick={() => handleSave(true)}
                        disabled={isSaving || isCurrentViewLocked}
                      >
                        {isSaving ? 'Submitting...' : 'Submit'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(currentViewTimesheets.length > 0) && (
                <div>
                  <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <table className="timesheets_table">
                      <colgroup>
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '10.71%' }} />
                        <col style={{ width: '10.71%' }} />
                        <col style={{ width: '10.71%' }} />
                        <col style={{ width: '10.71%' }} />
                        <col style={{ width: '10.71%' }} />
                        <col style={{ width: '10.71%' }} />
                        <col style={{ width: '10.71%' }} />
                        <col style={{ width: '10%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Project Name</th>
                          {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day, index) => (
                            <th key={day}>{getDateForDay(getWeekStartDate(selectedDate), index)}</th>
                          ))}
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentViewTimesheets.map((ts) => {
                          const project = selectedEmployee
                            ? (employeeProjects[selectedEmployee] || []).find((p) => p.PRJ_ID === ts.project_id)
                            : projects.find((p) => p.PRJ_ID === ts.project_id);
                          
                          const canManageThisEmployee = manageableEmpIds.includes(ts.employee_id);
                          const isOwner = currentUserEmpId === ts.employee_id;
                          const isLocked = isOwner && !canManageThisEmployee && (ts.is_submitted === 1 || ts.is_approved === 1);
                          
                          return (
                            <tr key={ts.timesheet_id || ts.temp_key}>
                              <td>{project?.PRJ_NAME || "Unnamed Project"}</td>
                              {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day) => (
                                <td key={`${ts.timesheet_id || ts.temp_key}_${day}`}>
                                  <div className="timesheets_input-cell-wrapper">
                                    <input
                                      type="number"
                                      name={`${day}_hours`}
                                      value={ts[`${day}_hours`] ?? ""}
                                      onChange={(e) => handleInputChange(e, ts.timesheet_id || ts.temp_key, selectedEmployee ? ts.employee_id : null)}
                                      className="timesheets_hours-input"
                                      disabled={isLocked}
                                      placeholder="Hours"
                                    />
                                    <textarea
                                      name={`${day}_comment`}
                                      value={ts[`${day}_comment`] ?? ""}
                                      onChange={(e) => handleInputChange(e, ts.timesheet_id || ts.temp_key, selectedEmployee ? ts.employee_id : null, day)}
                                      onFocus={() => handleCommentFocus(ts.timesheet_id || ts.temp_key, day)}
                                      className="timesheets_comment-textarea"
                                      disabled={isLocked}
                                      placeholder="Comment"
                                    />
                                  </div>
                                </td>
                              ))}
                              <td className="timesheets_copy-action-cell">
                                <button
                                  type="button"
                                  className="timesheets_copy-button"
                                  onClick={() => handleCopyClick(ts)}
                                  disabled={isLocked || isSaving || isCopyLoading}
                                >
                                  Copy
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="timesheets_comment-section">
                      <label>Selected Comment:</label>
                      <textarea
                        value={
                          selectedComment.timesheetId && selectedComment.day
                            ? (getTimesheetById(selectedComment.timesheetId))?.[`${selectedComment.day}_comment`] ?? ""
                            : ""
                        }
                        onChange={(e) => {
                          const newValue = e.target.value;
                          const ts = getTimesheetById(selectedComment.timesheetId);
                          if (ts) {
                              const canManageThisEmployee = manageableEmpIds.includes(ts.employee_id);
                              const isOwner = currentUserEmpId === ts.employee_id;
                              const isLocked = isOwner && !canManageThisEmployee && (ts.is_submitted === 1 || ts.is_approved === 1);
                              
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
                        className="timesheets_comment-display-textarea"
                        placeholder="Select a comment in the table to edit it here..."
                        disabled={
                          !selectedComment.timesheetId || !selectedComment.day || 
                          (() => {
                              const ts = getTimesheetById(selectedComment.timesheetId);
                              if (!ts) return true;
                              const canManageThisEmployee = manageableEmpIds.includes(ts.employee_id);
                              const isOwner = currentUserEmpId === ts.employee_id;
                              return isOwner && !canManageThisEmployee && (ts.is_submitted === 1 || ts.is_approved === 1);
                          })()
                        }
                      />
                    </div>

                    <div className="timesheets_attachment-field">
                      <label>Attachments for the Week:</label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="timesheets_file-input"
                        multiple
                        disabled={isCurrentViewLocked}
                        onChange={(e) => {
                          setNewFileCount(e.target.files.length);
                          if (e.target.files.length > 0) {
                            setNoAttachmentFlag(false);
                          }
                        }}
                      />
                      <label className="timesheets_no-attachment-label">
                        <input
                          type="checkbox"
                          checked={noAttachmentFlag && !hasAnyAttachments}
                          disabled={isCurrentViewLocked || hasAnyAttachments}
                          onChange={(e) => handleNoAttachmentChange(e.target.checked)}
                        />
                        No Attachment
                      </label>
                      
                      {hasAnyAttachments && (
                        <div className="timesheets_attached-files">
                          <h5>Attached Files:</h5>
                          <ul>
                            {currentViewAttachments.map((attachment) => (
                                <li key={attachment.attachment_id}>
                                  <a href={attachment.file_path} target="_blank" rel="noopener noreferrer" className="timesheets_attachment-link">
                                    {attachment.file_name}
                                  </a>
                                  <button
                                    type="button"
                                    className="timesheets_remove-button"
                                    onClick={() => handleRemoveAttachment(attachment.attachment_id, attachment.timesheet_id)}
                                    disabled={(() => {
                                        const ts = getTimesheetById(attachment.timesheet_id);
                                        if (!ts) return false;
                                        const canManageThisEmployee = manageableEmpIds.includes(ts.employee_id);
                                        const isOwner = currentUserEmpId === ts.employee_id;
                                        return isOwner && !canManageThisEmployee && (ts.is_submitted === 1 || ts.is_approved === 1);
                                    })()}
                                  >
                                    Remove
                                  </button>
                                </li>
                              ))}
                            {Array.from(fileInputRef.current?.files || []).map((file, index) => (
                              <li key={`new-${index}`} style={{ backgroundColor: '#ecfdf5' }}>
                                <span className="timesheets_attachment-link">{file.name} (new)</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="timesheets_save-section">
                      <button
                        type="button"
                        className="timesheets_save-button"
                        onClick={() => handleSave()}
                        disabled={isSaving || (isCurrentViewLocked && !isManagingCurrentView)}
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>

                    {error && <p className="timesheets_error-message">{error}</p>}
                    {success && <p className="timesheets_success-message">{typeof success === 'string' ? success : 'Action successful!'}</p>}
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
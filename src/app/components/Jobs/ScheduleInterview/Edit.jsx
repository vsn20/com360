'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchInterviewData, updateInterview, getEmployees } from '@/app/serverActions/Jobs/ScheduleInterview/EditInterview';
import './jobtitles.css';
import Loading from '../../Loading/Loading';

const Edit = ({ id, orgid, empid, handleback, time, status }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [interviewDetails, setInterviewDetails] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [applicationStatus, setApplicationStatus] = useState(status || 'scheduled');
  const [rounds, setRounds] = useState([]);
  const [panelMemberForms, setPanelMemberForms] = useState({});
  const [showRoundNameForm, setShowRoundNameForm] = useState(false);
  const [newRoundName, setNewRoundName] = useState('');

  const getInitialRoundForm = () => ({
    name: '',
    start_date: '',
    start_am_pm: 'AM',
    end_date: null,
    end_am_pm: 'AM',
    start_time: '',
    end_time: '',
    meeting_link: '',
    panelMembers: [],
    startHours: '',
    startMinutes: '',
    endHours: '',
    endMinutes: '',
    marks: '',
    comments: '',
    status: 'scheduled',
  });

  const getInitialPanelMemberForm = () => ({
    is_he_employee: '1',
    empid: '',
    email: '',
  });

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

  const formatTime = (time, am_pm) => {
    if (!time || time === 'null') return '';
    return `${time} ${am_pm || 'AM'}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const employeeData = await getEmployees(orgid);
        setEmployees(employeeData.success ? employeeData.employees : []);

        const result = await fetchInterviewData(orgid, id);
        if (result.success) {
          setInterviewDetails(result.interview);
          setApplicationStatus(result.interview.status || 'scheduled');
          setRounds(result.rounds.map(round => ({
            ...round,
            name: round.name || `Round ${rounds.length + 1}`,
            start_date: formatDate(round.start_date),
            end_date: formatDate(round.end_date) || null,
            start_time: round.start_time || '',
            end_time: round.end_time || '',
            meeting_link: round.meeting_link || '',
            startHours: round.start_time ? round.start_time.split(':')[0] : '',
            startMinutes: round.start_time ? round.start_time.split(':')[1] : '',
            endHours: round.end_time ? round.end_time.split(':')[0] : '',
            endMinutes: round.end_time ? round.end_time.split(':')[1] : '',
            panelMembers: round.panelMembers || [],
            marks: round.marks !== undefined && round.marks !== null ? String(round.marks) : '',
            comments: round.comments || '',
            status: round.status || 'scheduled',
          })) || [getInitialRoundForm()]);
          setPanelMemberForms({});
        } else if (result.error === 'Interview not found.') {
          setInterviewDetails(null);
          setRounds([getInitialRoundForm()]);
          setPanelMemberForms({});
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

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setApplicationStatus(newStatus);
  };

  const handleRoundChange = (e, roundIndex) => {
    const { name, value } = e.target;
    setRounds(prevRounds => {
      const updatedRounds = [...prevRounds];
      const updatedRound = { 
        ...updatedRounds[roundIndex], 
        [name]: name === 'marks' ? (value === '' ? '' : String(value)) : (name === 'end_date' && value === '' ? null : value)
      };

      if (name === 'start_time' || name === 'end_time') {
        if (value && !/^(0?[1-9]|1[0-2]):[0-5][0-9]$/.test(value)) {
          setError('Please enter time in HH:mm format (e.g., 12:30).');
        } else {
          setError('');
          const [h, m] = value ? value.split(':').map(Number) : ['', ''];
          if (name === 'start_time') {
            updatedRound.startHours = h ? h.toString() : '';
            updatedRound.startMinutes = m ? m.toString().padStart(2, '0') : '';
          } else {
            updatedRound.endHours = h ? h.toString() : '';
            updatedRound.endMinutes = m ? m.toString().padStart(2, '0') : '';
          }
        }
      }
      updatedRounds[roundIndex] = updatedRound;
      return updatedRounds;
    });
  };

  const handleTimeDropdownChange = (e, roundIndex) => {
    const { name, value } = e.target;
    setRounds(prevRounds => {
      const updatedRounds = [...prevRounds];
      const updatedRound = { ...updatedRounds[roundIndex], [name]: value };

      if (name.includes('start')) {
        const hours = name === 'startHours' ? value : updatedRound.startHours;
        const minutes = name === 'startMinutes' ? value : updatedRound.startMinutes;
        updatedRound.start_time = hours && minutes ? `${hours}:${minutes}` : '';
      } else {
        const hours = name === 'endHours' ? value : updatedRound.endHours;
        const minutes = name === 'endMinutes' ? value : updatedRound.endMinutes;
        updatedRound.end_time = hours && minutes ? `${hours}:${minutes}` : '';
      }

      updatedRounds[roundIndex] = updatedRound;
      return updatedRounds;
    });
    setError('');
  };

  const handlePanelFormChange = (e, roundIndex) => {
    const { name, value } = e.target;
    setPanelMemberForms(prev => {
      const updatedForm = { ...(prev[roundIndex] || getInitialPanelMemberForm()), [name]: value };

      if (name === 'empid' && updatedForm.is_he_employee === '1') {
        const selectedEmployee = employees.find((emp) => emp.empid === value);
        updatedForm.email = selectedEmployee ? selectedEmployee.email : '';
      } else if (name === 'is_he_employee' && value === '0') {
        updatedForm.empid = '';
        updatedForm.email = '';
      }

      return { ...prev, [roundIndex]: updatedForm };
    });
  };

  const handleAddPanelMember = (roundIndex) => {
    const newPanelMember = panelMemberForms[roundIndex] || getInitialPanelMemberForm();

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

    const memberToAdd = {
      empid: newPanelMember.is_he_employee === '1' ? newPanelMember.empid : null,
      email: emailToAdd,
      is_he_employee: newPanelMember.is_he_employee,
    };

    setRounds(prev => {
      const updatedRounds = [...prev];
      const targetPanelMembers = updatedRounds[roundIndex].panelMembers;
      const isDuplicate = targetPanelMembers.some(
        (member) =>
          (member.is_he_employee === '1' && member.empid === memberToAdd.empid) ||
          (member.is_he_employee === '0' && member.email === memberToAdd.email)
      );

      if (isDuplicate) {
        setError('');
        return prev;
      }

      updatedRounds[roundIndex].panelMembers = [...targetPanelMembers, memberToAdd];
      return updatedRounds;
    });

    setPanelMemberForms(prev => ({ ...prev, [roundIndex]: getInitialPanelMemberForm() }));
    setError('');
  };

  const handleRemovePanelMember = (roundIndex, memberIndex) => {
    setRounds((prev) => {
      const updated = [...prev];
      updated[roundIndex].panelMembers = updated[roundIndex].panelMembers.filter((_, i) => i !== memberIndex);
      return updated;
    });
  };

  const handleAddRound = () => {
    setShowRoundNameForm(true);
  };

  const handleRoundNameSubmit = (e) => {
    e.preventDefault();
    if (!newRoundName.trim()) {
      setError('Round name is required.');
      return;
    }
    setRounds((prev) => [...prev, { ...getInitialRoundForm(), name: newRoundName.trim() }]);
    setNewRoundName('');
    setShowRoundNameForm(false);
    setError('');
  };

  const handleRoundNameCancel = () => {
    setNewRoundName('');
    setShowRoundNameForm(false);
    setError('');
  };

  const handleDeleteRound = (roundIndex) => {
    const round = rounds[roundIndex];
    const hasData = true;
    if (hasData) {
      const confirmDelete = window.confirm(
        'This round contains marks, comments, or a non-scheduled status. Deleting it will permanently remove this data. Are you sure you want to proceed?'
      );
      if (!confirmDelete) {
        return;
      }
    }
    setRounds((prev) => prev.filter((_, i) => i !== roundIndex));
    setPanelMemberForms(prev => {
      const newForms = { ...prev };
      delete newForms[roundIndex];
      return newForms;
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    const formData = new FormData();
    formData.append('orgid', orgid);
    formData.append('application_id', id);
    formData.append('empid', empid);
    formData.append('applicationStatus', applicationStatus);
    const formattedRounds = rounds.map(round => ({
      ...round,
      end_date: round.end_date === '' ? null : round.end_date,
      marks: round.marks === '' ? null : round.marks,
      comments: round.comments === '' ? null : round.comments,
    }));
    formData.append('rounds', JSON.stringify(formattedRounds));

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
          setApplicationStatus(updatedDetails.interview.status || 'scheduled');
          setRounds(updatedDetails.rounds.map(round => ({
            ...round,
            name: round.name || `Round ${rounds.length + 1}`,
            start_date: formatDate(round.start_date),
            end_date: formatDate(round.end_date) || null,
            start_time: round.start_time || '',
            end_time: round.end_time || '',
            meeting_link: round.meeting_link || '',
            startHours: round.start_time ? round.start_time.split(':')[0] : '',
            startMinutes: round.start_time ? round.start_time.split(':')[1] : '',
            endHours: round.end_time ? round.end_time.split(':')[0] : '',
            endMinutes: round.end_time ? round.end_time.split(':')[1] : '',
            panelMembers: round.panelMembers || [],
            marks: round.marks !== undefined && round.marks !== null ? String(round.marks) : '',
            comments: round.comments || '',
            status: round.status || 'scheduled',
          })) || [getInitialRoundForm()]);
          setPanelMemberForms({});
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

  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  const renderRoundForm = (round, roundIndex) => {
    const panelMemberForm = panelMemberForms[roundIndex] || getInitialPanelMemberForm();
    
    return (
      <div key={roundIndex} className="round-edit-block">
        <div className="round-edit-header">
          <div>{round.name || `Round ${roundIndex + 1}`}</div>
          <button
            type="button"
            className="cancel-button"
            onClick={() => handleDeleteRound(roundIndex)}
            disabled={isLoading}
          >
            Delete Round
          </button>
        </div>
        
        <div className="round-edit-content">
          <div className="edit-details-row">
            <div className="edit-details-g">
              <label>Round Name*</label>
              <input
                type="text"
                name="name"
                value={round.name || ''}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="form-input-edit"
                required
              />
            </div>
          </div>
          
          <div className="edit-details-row">
            <div className="edit-details-g">
              <label>Start Date*</label>
              <input
                type="date"
                name="start_date"
                value={round.start_date || ''}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="form-input-edit"
                required
              />
            </div>
            <div className="edit-details-g time-edit-group">
              <label>Start Time*</label>
              <div className="time-edit-inputs">
                <input
                  type="text"
                  name="start_time"
                  value={round.start_time || ''}
                  onChange={(e) => handleRoundChange(e, roundIndex)}
                  placeholder="HH:mm"
                  className="time-edit-text-input"
                  required
                />
                <select
                  name="startHours"
                  value={round.startHours || ''}
                  onChange={(e) => handleTimeDropdownChange(e, roundIndex)}
                  className="time-edit-select"
                >
                  <option value="">HH</option>
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span>:</span>
                <select
                  name="startMinutes"
                  value={round.startMinutes || ''}
                  onChange={(e) => handleTimeDropdownChange(e, roundIndex)}
                  className="time-edit-select"
                >
                  <option value="">MM</option>
                  {minuteOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="edit-details-g">
              <label>AM/PM</label>
              <select
                name="start_am_pm"
                value={round.start_am_pm || 'AM'}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="form-input-edit"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          
          <div className="edit-details-row">
            <div className="edit-details-g">
              <label>End Date</label>
              <input
                type="date"
                name="end_date"
                value={round.end_date || ''}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="form-input-edit"
              />
            </div>
            <div className="edit-details-g time-edit-group">
              <label>End Time</label>
              <div className="time-edit-inputs">
                <input
                  type="text"
                  name="end_time"
                  value={round.end_time || ''}
                  onChange={(e) => handleRoundChange(e, roundIndex)}
                  placeholder="HH:mm"
                  className="time-edit-text-input"
                />
                <select
                  name="endHours"
                  value={round.endHours || ''}
                  onChange={(e) => handleTimeDropdownChange(e, roundIndex)}
                  className="time-edit-select"
                >
                  <option value="">HH</option>
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span>:</span>
                <select
                  name="endMinutes"
                  value={round.endMinutes || ''}
                  onChange={(e) => handleTimeDropdownChange(e, roundIndex)}
                  className="time-edit-select"
                >
                  <option value="">MM</option>
                  {minuteOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="edit-details-g">
              <label>AM/PM</label>
              <select
                name="end_am_pm"
                value={round.end_am_pm || 'AM'}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="form-input-edit"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          
          <div className="edit-details-row">
            <div className="edit-details-g">
              <label>Meeting Link</label>
              <input
                type="url"
                name="meeting_link"
                value={round.meeting_link || ''}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="form-input-edit"
                placeholder="Enter meeting link"
              />
            </div>
          </div>
          
          <div className="edit-details-row">
            <div className="edit-details-g">
              <label>Marks</label>
              <input
                type="number"
                name="marks"
                value={round.marks || ''}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="form-input-edit"
                placeholder="Enter marks"
              />
            </div>
            <div className="edit-details-g">
              <label>Round Status</label>
              <select
                name="status"
                value={round.status || 'scheduled'}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="form-input-edit"
              >
                <option value="scheduled">Scheduled</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
          
          <div className="edit-details-row">
            <div className="edit-details-g">
              <label>Comments</label>
              <textarea
                name="comments"
                value={round.comments || ''}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="form-input-edit form-textarea-edit"
                placeholder="Enter comments"
                rows={3}
              />
            </div>
          </div>
          
          <div className="panel-members-edit-section">
            <h4>Interview Panel</h4>
            <div className="edit-details-row">
              <div className="edit-details-g">
                <label>Is Panel Member an Employee?</label>
                <select
                  name="is_he_employee"
                  value={panelMemberForm.is_he_employee || '1'}
                  onChange={(e) => handlePanelFormChange(e, roundIndex)}
                  className="form-input-edit"
                >
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
              {panelMemberForm.is_he_employee === '1' ? (
                <>
                  <div className="edit-details-g">
                    <label>Select Employee</label>
                    <select
                      name="empid"
                      value={panelMemberForm.empid || ''}
                      onChange={(e) => handlePanelFormChange(e, roundIndex)}
                      className="form-input-edit"
                    >
                      <option value="">Select an employee</option>
                      {employees.map((emp) => (
                        <option key={emp.empid} value={emp.empid}>
                          {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME} (${emp.empid})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="edit-details-g">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={panelMemberForm.email || ''}
                      readOnly
                      className="form-input-edit bg-gray-100"
                      placeholder="Employee email"
                    />
                  </div>
                </>
              ) : (
                <div className="edit-details-g">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={panelMemberForm.email || ''}
                    onChange={(e) => handlePanelFormChange(e, roundIndex)}
                    className="form-input-edit"
                    placeholder="Enter email"
                  />
                </div>
              )}
              <div className="edit-details-g">
                <button
                  type="button"
                  className="save-button"
                  onClick={() => handleAddPanelMember(roundIndex)}
                >
                  Add Panel Member
                </button>
              </div>
            </div>
            
            {round.panelMembers.length > 0 && (
              <div className="panel-members-edit-table-wrapper">
                <h5>Added Panel Members</h5>
                <table className="panel-members-edit-table">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Email</th>
                      <th>Employee Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {round.panelMembers.map((member, index) => {
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
                              onClick={() => handleRemovePanelMember(roundIndex, index)}
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
          </div>
        </div>
      </div>
    );
  };

  const renderViewMode = () => (
    <div className="interview-edit-container">
      <div className="header-edit-section">
        <h1 className="title">Interview Details</h1>
        <button className="back-button" onClick={handleback}></button>
      </div>
      
      <div className="interview-edit-details-block">
        <div className="interview-edit-details-header">
          <div>Interview Information (Application ID: {getdisplayprojectid(id)})</div>
          <button className="edit-button" onClick={handleEdit}>
            Edit
          </button>
        </div>
        
        <div className="view-edit-details">
          <div className="edit-details-row">
            <div className="edit-details-g">
              <label>Status</label>
              <p>{interviewDetails.status || '-'}</p>
            </div>
          </div>
        </div>
      </div>
      
      {rounds.length > 0 && (
        <div className="rounds-edit-container">
          {rounds.map((round, index) => (
            <div key={`${round.Roundid}-${index}`} className="round-edit-block">
              <div className="round-edit-header">
                <div>Round {round.RoundNo || index + 1}: {round.name || `Round ${index + 1}`}</div>
              </div>
              
              <div className="round-edit-content">
                <div className="view-edit-details">
                  <div className="edit-details-row">
                    <div className="edit-details-g">
                      <label>Round Name</label>
                      <p>{round.name || '-'}</p>
                    </div>
                  </div>
                  <div className="edit-details-row">
                    <div className="edit-details-g">
                      <label>Start Date</label>
                      <p>{formatDate(round.start_date) || '-'}</p>
                    </div>
                    <div className="edit-details-g">
                      <label>Start Time</label>
                      <p>{formatTime(round.start_time, round.start_am_pm) || '-'}</p>
                    </div>
                  </div>
                  <div className="edit-details-row">
                    <div className="edit-details-g">
                      <label>End Date</label>
                      <p>{formatDate(round.end_date) || '-'}</p>
                    </div>
                    <div className="edit-details-g">
                      <label>End Time</label>
                      <p>{formatTime(round.end_time, round.end_am_pm) || '-'}</p>
                    </div>
                  </div>
                  <div className="edit-details-row">
                    <div className="edit-details-g">
                      <label>Meeting Link</label>
                      <p>{round.meeting_link || '-'}</p>
                    </div>
                  </div>
                  <div className="edit-details-row">
                    <div className="edit-details-g">
                      <label>Marks</label>
                      <p>{round.marks || '-'}</p>
                    </div>
                    <div className="edit-details-g">
                      <label>Round Status</label>
                      <p>{round.status || '-'}</p>
                    </div>
                  </div>
                  <div className="edit-details-row">
                    <div className="edit-details-g">
                      <label>Comments</label>
                      <p>{round.comments || '-'}</p>
                    </div>
                  </div>
                  {round.panelMembers.length > 0 && (
                    <div className="panel-members-edit-section">
                      <h5>Panel Members</h5>
                      <table className="panel-members-edit-table">
                        <thead>
                          <tr>
                            <th>Employee ID</th>
                            <th>Email</th>
                            <th>Employee Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {round.panelMembers.map((member, idx) => {
                            const employee = member.is_he_employee === '1' ? employees.find((emp) => emp.empid === member.empid) : null;
                            return (
                              <tr key={idx}>
                                <td>{member.empid || '-'}</td>
                                <td>{employee ? employee.email : member.email || '-'}</td>
                                <td>{member.is_he_employee === '1' ? 'Employee' : 'Non-employee'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderEditMode = () => (
    <div className="interview-edit-container">
      <div className="header-edit-section">
        <h1 className="title">
          {!interviewDetails ? 'Create New Interview' : 'Edit Interview'} 
          (Application ID: {getdisplayprojectid(id)})
        </h1>
        <button className="back-button" onClick={handleback}></button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="interview-edit-details-block">
          <div className="interview-edit-details-header">
            <div>Interview Information</div>
          </div>
          
          <div className="edit-details-row">
            <div className="edit-details-g">
              <label>Status*</label>
              <select
                name="applicationStatus"
                value={applicationStatus || 'scheduled'}
                onChange={handleStatusChange}
                className="form-input-edit"
                required
              >
                <option value="scheduled">Scheduled</option>
                <option value="hold">Hold</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
        
        {rounds.length > 0 && (
          <div className="rounds-edit-container">
            {rounds.map((round, index) => renderRoundForm(round, index))}
          </div>
        )}
        
        <div className="add-round-edit-section">
          {showRoundNameForm ? (
            <div className="edit-details-row">
              <div className="edit-details-g">
                <label>Round Name*</label>
                <input
                  type="text"
                  value={newRoundName || ''}
                  onChange={(e) => setNewRoundName(e.target.value)}
                  className="form-input-edit"
                  placeholder="Enter round name"
                  required
                />
              </div>
              <div className="form-buttons-edit">
                <button
                  type="button"
                  className="save-button"
                  onClick={handleRoundNameSubmit}
                  disabled={isLoading}
                >
                  Submit
                </button>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleRoundNameCancel}
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="save-button"
              onClick={handleAddRound}
              disabled={isLoading}
            >
              Add Round
            </button>
          )}
        </div>
        
        <div className="main-form-edit-actions">
          <div className="form-buttons-edit">
            <button type="submit" className="save-button" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={() => setIsEditing(false)}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  return (
    <div className="employee-details-container">
      {isLoading ? (
        <Loading />
      ) : (
        <>
          {error && <div className="error-edit-message">{error}</div>}
          {success && <div className="success-edit-message">{success}</div>}
          
          {!interviewDetails && isEditing && renderEditMode()}
          {interviewDetails && !isEditing && renderViewMode()}
          {interviewDetails && isEditing && renderEditMode()}
        </>
      )}
    </div>
  );
};

export default Edit;
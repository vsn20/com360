'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { scheduleInterview, getEmployees, deleteInterviewRound } from '@/app/serverActions/Jobs/ScheduleInterview/Scheduling';
import './jobtitles.css';

const Scheduling = ({ id, name, orgid, empid, handleback }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [employees, setEmployees] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [applicationStatus, setApplicationStatus] = useState('scheduled');
  const [isAddingPanelMember, setIsAddingPanelMember] = useState(false);
  const [panelMemberForms, setPanelMemberForms] = useState({});
  const [showRoundNameForm, setShowRoundNameForm] = useState(false);
  const [newRoundName, setNewRoundName] = useState('');

  const getInitialRoundForm = () => ({
    name: '',
    start_date: '',
    start_am_pm: 'AM',
    end_date: '',
    end_am_pm: 'AM',
    start_time: '',
    end_time: '',
    meeting_link: '',
    panelMembers: [],
    startHours: '',
    startMinutes: '',
    endHours: '',
    endMinutes: '',
  });

  const getInitialPanelMemberForm = () => ({
    is_he_employee: '1',
    empid: '',
    email: '',
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const result = await getEmployees(orgid);
        if (result.success) {
          const uniqueEmployees = Array.from(
            new Map(result.employees.map(emp => [emp.empid, emp])).values()
          );
          setEmployees(uniqueEmployees);
        } else {
          setError(result.error || 'Failed to fetch employees.');
        }
      } catch (err) {
        setError('Error fetching employees.');
      }
    };
    fetchEmployees();
  }, [orgid]);

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  const handleStatusChange = (e) => {
    setApplicationStatus(e.target.value);
  };

  const handleRoundChange = (e, roundIndex) => {
    const { name, value } = e.target;

    setRounds(prevRounds => {
      const updatedRounds = [...prevRounds];
      const updatedRound = { ...updatedRounds[roundIndex], [name]: value };

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
    if (isAddingPanelMember) return;
    setIsAddingPanelMember(true);

    const newPanelMember = panelMemberForms[roundIndex] || getInitialPanelMemberForm();

    if (newPanelMember.is_he_employee === '1' && !newPanelMember.empid) {
      setError('Please select an employee.');
      setIsAddingPanelMember(false);
      return;
    }
    if (newPanelMember.is_he_employee === '0' && !newPanelMember.email) {
      setError('Please enter an email.');
      setIsAddingPanelMember(false);
      return;
    }
    let emailToAdd = newPanelMember.email;
    if (newPanelMember.is_he_employee === '1') {
      const selectedEmployee = employees.find((emp) => emp.empid === newPanelMember.empid);
      if (!selectedEmployee || !selectedEmployee.email) {
        setError('Selected employee does not have an email.');
        setIsAddingPanelMember(false);
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
        setIsAddingPanelMember(false);
        return prev;
      }

      updatedRounds[roundIndex].panelMembers = [...targetPanelMembers, memberToAdd];
      return updatedRounds;
    });

    setPanelMemberForms(prev => ({...prev, [roundIndex]: getInitialPanelMemberForm()}));
    setError('');
    setIsAddingPanelMember(false);
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

  const handleDeleteRound = async (roundIndex, roundId) => {
    if (roundId) {
      const result = await deleteInterviewRound(orgid, roundId);
      if (!result.success) {
        setError(result.error || 'Failed to delete round');
        return;
      }
    }
    setRounds((prev) => prev.filter((_, i) => i !== roundIndex));
    setPanelMemberForms(prev => {
        const newForms = {...prev};
        delete newForms[roundIndex];
        return newForms;
    })
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (applicationStatus === 'scheduled' && rounds.length === 0) {
      setError('At least one interview round is required when status is scheduled.');
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('orgid', orgid);
    formData.append('application_id', id);
    formData.append('empid', empid);
    formData.append('applicationStatus', applicationStatus);
    formData.append('rounds', JSON.stringify(rounds));

    const result = await scheduleInterview(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess('Interview details saved successfully.');
      setTimeout(() => {
        handleback();
      }, 2000);
    }
    setIsLoading(false);
  };

  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  const renderRoundForm = (round, roundIndex) => {
    const panelMemberForm = panelMemberForms[roundIndex] || getInitialPanelMemberForm();
    return (
      <div key={roundIndex} className="schedule_interview_round-edit-block">
        <div className="schedule_interview_round-edit-header">
          <div>{round.name || `Round ${roundIndex + 1}`}</div>
          <button
            type="button"
            className="schedule_interview_cancel-button"
            onClick={() => handleDeleteRound(roundIndex, round.Roundid)}
            disabled={isLoading}
          >
            Delete Round
          </button>
        </div>
        <div className="schedule_interview_round-edit-content">
          <div className="schedule_interview_edit-details-row">
            <div className="schedule_interview_edit-details-g">
              <label>Round Name*</label>
              <input
                type="text"
                name="name"
                value={round.name}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="schedule_interview_form-input-edit"
                required
              />
            </div>
          </div>
          <div className="schedule_interview_edit-details-row">
            <div className="schedule_interview_edit-details-g">
              <label>Start Date*</label>
              <input
                type="date"
                name="start_date"
                value={round.start_date}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="schedule_interview_form-input-edit"
                required
              />
            </div>
            <div className="schedule_interview_edit-details-g schedule_interview_time-edit-group">
              <label>Start Time*</label>
              <div className="schedule_interview_time-edit-inputs">
                <input
                  type="text"
                  name="start_time"
                  value={round.start_time}
                  onChange={(e) => handleRoundChange(e, roundIndex)}
                  placeholder="HH:mm"
                  required
                  className="schedule_interview_time-edit-text-input"
                />
                <select
                  name="startHours"
                  value={round.startHours}
                  onChange={(e) => handleTimeDropdownChange(e, roundIndex)}
                  className="schedule_interview_time-edit-select"
                >
                  <option value="">HH</option>
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span>:</span>
                <select
                  name="startMinutes"
                  value={round.startMinutes}
                  onChange={(e) => handleTimeDropdownChange(e, roundIndex)}
                  className="schedule_interview_time-edit-select"
                >
                  <option value="">MM</option>
                  {minuteOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="schedule_interview_edit-details-g">
              <label>AM/PM</label>
              <select
                name="start_am_pm"
                value={round.start_am_pm}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="schedule_interview_form-input-edit"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          <div className="schedule_interview_edit-details-row">
            <div className="schedule_interview_edit-details-g">
              <label>End Date</label>
              <input
                type="date"
                name="end_date"
                value={round.end_date}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="schedule_interview_form-input-edit"
              />
            </div>
            <div className="schedule_interview_edit-details-g schedule_interview_time-edit-group">
              <label>End Time</label>
              <div className="schedule_interview_time-edit-inputs">
                <input
                  type="text"
                  name="end_time"
                  value={round.end_time}
                  onChange={(e) => handleRoundChange(e, roundIndex)}
                  placeholder="HH:mm"
                  className="schedule_interview_time-edit-text-input"
                />
                <select
                  name="endHours"
                  value={round.endHours}
                  onChange={(e) => handleTimeDropdownChange(e, roundIndex)}
                  className="schedule_interview_time-edit-select"
                >
                  <option value="">HH</option>
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span>:</span>
                <select
                  name="endMinutes"
                  value={round.endMinutes}
                  onChange={(e) => handleTimeDropdownChange(e, roundIndex)}
                  className="schedule_interview_time-edit-select"
                >
                  <option value="">MM</option>
                  {minuteOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="schedule_interview_edit-details-g">
              <label>AM/PM</label>
              <select
                name="end_am_pm"
                value={round.end_am_pm}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                className="schedule_interview_form-input-edit"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          <div className="schedule_interview_edit-details-row">
            <div className="schedule_interview_edit-details-g">
              <label>Meeting Link</label>
              <input
                type="url"
                name="meeting_link"
                value={round.meeting_link}
                onChange={(e) => handleRoundChange(e, roundIndex)}
                placeholder="Enter meeting link"
                className="schedule_interview_form-input-edit"
              />
            </div>
          </div>
          <div className="schedule_interview_panel-members-edit-section">
            <h4>Interview Panel</h4>
            <div className="schedule_interview_edit-details-row">
              <div className="schedule_interview_edit-details-g">
                <label>Is Panel Member an Employee?</label>
                <select
                  name="is_he_employee"
                  value={panelMemberForm.is_he_employee}
                  onChange={(e) => handlePanelFormChange(e, roundIndex)}
                  className="schedule_interview_form-input-edit"
                >
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
              {panelMemberForm.is_he_employee === '1' ? (
                <>
                  <div className="schedule_interview_edit-details-g">
                    <label>Select Employee</label>
                    <select
                      name="empid"
                      value={panelMemberForm.empid}
                      onChange={(e) => handlePanelFormChange(e, roundIndex)}
                      className="schedule_interview_form-input-edit"
                    >
                      <option value="">Select an employee</option>
                      {employees.map((emp) => (
                        <option key={emp.empid} value={emp.empid}>
                          {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME} (${emp.empid})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="schedule_interview_edit-details-g">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={panelMemberForm.email}
                      readOnly
                      className="schedule_interview_form-input-edit schedule_interview_bg-gray-100"
                      placeholder="Employee email"
                    />
                  </div>
                </>
              ) : (
                <div className="schedule_interview_edit-details-g">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={panelMemberForm.email}
                    onChange={(e) => handlePanelFormChange(e, roundIndex)}
                    placeholder="Enter email"
                    className="schedule_interview_form-input-edit"
                  />
                </div>
              )}
              <div className="schedule_interview_edit-details-g">
                <button
                  type="button"
                  className="schedule_interview_save-button"
                  onClick={() => handleAddPanelMember(roundIndex)}
                  disabled={isAddingPanelMember}
                >
                  {isAddingPanelMember ? 'Adding...' : 'Add Panel Member'}
                </button>
              </div>
            </div>
            {round.panelMembers.length > 0 && (
              <div className="schedule_interview_panel-members-edit-table-wrapper">
                <h5>Added Panel Members</h5>
                <table className="schedule_interview_panel-members-edit-table">
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
                              className="schedule_interview_cancel-button"
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
    )
  };

  return (
    <div className="schedule_interview_interview-edit-container">
      <div className="schedule_interview_header-edit-section">
        <h1 className="schedule_interview_title">Scheduling Interview for {name} (Application ID: {getdisplayprojectid(id)})</h1>
        <button className="schedule_interview_back-button" onClick={handleback}></button>
      </div>

      {success && <div className="schedule_interview_success-edit-message">{success}</div>}
      {error && <div className="schedule_interview_error-edit-message">{error}</div>}
      {isLoading && <div className="schedule_interview_loading-edit-message">Saving...</div>}

      <form onSubmit={handleSubmit}>
        <div className="schedule_interview_interview-edit-details-block">
            <div className="schedule_interview_interview-edit-details-header">
                <div>Application Status</div>
            </div>
            <div className="schedule_interview_edit-details-row">
                <div className="schedule_interview_edit-details-g">
                <label>Status*</label>
                <select
                    name="applicationStatus"
                    value={applicationStatus}
                    onChange={handleStatusChange}
                    className="schedule_interview_form-input-edit"
                    required
                >
                    <option value="scheduled">Scheduled</option>
                    <option value="hold">Hold</option>
                    <option value="rejected">Rejected</option>
                </select>
                </div>
            </div>
        </div>

        {applicationStatus === 'scheduled' && (
          <>
            <div className="schedule_interview_rounds-edit-container">
              {rounds.map((round, index) => renderRoundForm(round, index))}
            </div>
            <div className="schedule_interview_add-round-edit-section">
              {showRoundNameForm ? (
                <div className="schedule_interview_edit-details-row">
                  <div className="schedule_interview_edit-details-g">
                    <label>Round Name*</label>
                    <input
                      type="text"
                      value={newRoundName}
                      onChange={(e) => setNewRoundName(e.target.value)}
                      placeholder="Enter round name"
                      className="schedule_interview_form-input-edit"
                      required
                    />
                  </div>
                  <div className="schedule_interview_form-buttons-edit">
                    <button
                      type="button"
                      className="schedule_interview_save-button"
                      onClick={handleRoundNameSubmit}
                      disabled={isLoading}
                    >
                      Submit
                    </button>
                    <button
                      type="button"
                      className="schedule_interview_cancel-button"
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
                  className="schedule_interview_save-button"
                  onClick={handleAddRound}
                  disabled={isLoading}
                >
                  Add Round
                </button>
              )}
            </div>
          </>
        )}

        <div className="schedule_interview_main-form-edit-actions">
            <div className="schedule_interview_form-buttons-edit">
                <button
                    type="submit"
                    className="schedule_interview_save-button"
                    disabled={isLoading}
                >
                    {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                    type="button"
                    className="schedule_interview_cancel-button"
                    onClick={handleback}
                    disabled={isLoading}
                >
                    Back
                </button>
            </div>
        </div>
      </form>
    </div>
  );
};

export default Scheduling;
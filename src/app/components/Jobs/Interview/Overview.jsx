'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Remaining from './Remaining';
import Confirm from './Confirm';
import { fetchDetailsById, update, fetchRoundsByInterviewId } from '@/app/serverActions/Jobs/Interview/Overview';
import './interview.css';

const Overview = ({ orgid, empid, interviewdetails, time, acceptingtime, editing }) => {
  const router = useRouter();
  const params = useSearchParams();
  const [confirm, setisconfirm] = useState(false);
  const [remaining, setremaining] = useState(false);
  const [selectedid, setSelectedid] = useState(null);
  const [selected, setSelected] = useState(false);
  const [iddetails, setIddetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [rounds, setRounds] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    handleback();
  }, [params.get("refresh")]);

  const handleconfirm = () => {
    router.refresh();
    setremaining(false);
    setisconfirm(true);
    setSelectedid(null);
    setSelected(false);
    setIsEditing(false);
    setError('');
  };

  const handleremianing = () => {
    router.refresh();
    setremaining(true);
    setisconfirm(false);
    setSelectedid(null);
    setSelected(false);
    setIsEditing(false);
    setError('');
  };

  const handleback = () => {
    router.refresh();
    setremaining(false);
    setisconfirm(false);
    setSelectedid(null);
    setSelected(false);
    setIsEditing(false);
    setError('');
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

  const fetchid = async (interview_id) => {
    setIsLoading(true);
    setError('');
    try {
      const acceptingTimeValue = Array.isArray(acceptingtime) && acceptingtime.length > 0 ? acceptingtime[0].Name : '48';
      const result = await fetchDetailsById({ orgid, interview_id, acceptingtime: acceptingTimeValue, empid });
      if (result.success && result.interview) {
        setIddetails(result.interview);
        setCanEdit(result.canEdit);
        setSelectedid(interview_id);
        setSelected(true);
        const roundsResult = await fetchRoundsByInterviewId({ orgid, interview_id, empid, editing });
        if (roundsResult.success) {
          // Ensure each round has start_date, start_time, etc., or use defaults
          const updatedRounds = roundsResult.rounds.map(round => ({
            ...round,
            start_date: round.start_date || '',
            start_time: round.start_time || '',
            end_date: round.end_date || '',
            end_time: round.end_time || '',
            meeting_link: round.meeting_link || '',
            start_am_pm: round.start_am_pm || 'AM',
            end_am_pm: round.end_am_pm || 'AM',
          }));
          setRounds(updatedRounds);
        } else {
          setError(roundsResult.error || 'Failed to fetch rounds');
        }
      } else {
        setError(result.error || 'No interview details found');
      }
    } catch (error) {
      console.error('Error fetching details:', error);
      setError('Error fetching interview details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (roundIndex) => {
    if (!canEdit) {
      setError('Cannot edit: Time window for editing has expired');
      return;
    }
    setRounds(prevRounds => {
      const updatedRounds = [...prevRounds];
      updatedRounds[roundIndex] = { ...updatedRounds[roundIndex], isEditing: true };
      return updatedRounds;
    });
    setError('');
    setSuccess('');
  };

  const handleRoundChange = (index, field, value) => {
    setRounds(prevRounds => {
      const updatedRounds = [...prevRounds];
      updatedRounds[index] = { ...updatedRounds[index], [field]: value };
      return updatedRounds;
    });
  };

  const handleSaveRound = async (roundIndex) => {
    setIsLoading(true);
    try {
      const updatedRounds = [...rounds];
      const roundToSave = updatedRounds[roundIndex];
      const result = await update({
        orgid,
        empid,
        interview_id: selectedid,
        status: iddetails.status,
        acceptingtime: Array.isArray(acceptingtime) && acceptingtime.length > 0 ? acceptingtime[0].Name : '48',
        rounds: [roundToSave], // Save only the edited round
      });
      if (result.success) {
        setSuccess('Round updated successfully');
        setRounds(prevRounds => {
          const newRounds = [...prevRounds];
          newRounds[roundIndex] = { ...newRounds[roundIndex], isEditing: false };
          return newRounds;
        });
        setTimeout(() => setSuccess(''), 2000);
        const roundsResult = await fetchRoundsByInterviewId({ orgid, interview_id: selectedid, empid, editing });
        if (roundsResult.success) {
          setRounds(roundsResult.rounds.map(round => ({
            ...round,
            start_date: round.start_date || '',
            start_time: round.start_time || '',
            end_date: round.end_date || '',
            end_time: round.end_time || '',
            meeting_link: round.meeting_link || '',
            start_am_pm: round.start_am_pm || 'AM',
            end_am_pm: round.end_am_pm || 'AM',
          })));
        }
      } else {
        setError(result.error || 'Failed to update round');
      }
    } catch (error) {
      console.error('Error updating round:', error);
      setError('Error updating round');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRound = (roundIndex) => {
    setRounds(prevRounds => {
      const newRounds = [...prevRounds];
      newRounds[roundIndex] = { ...newRounds[roundIndex], isEditing: false };
      return newRounds;
    });
    setError('');
    setSuccess('');
  };

  const handleViewResume = () => {
    if (iddetails?.resumepath) {
      window.open(iddetails.resumepath, '_blank');
    } else {
      setError('No resume available to view');
    }
  };

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  const canEditRound = (round) => {
    return editing === 1 || (editing === 0 && round.panelMembers.some(member => member.empid === empid));
  };

  const uniqueInterviewDetails = useMemo(() => {
    const seen = new Set();
    return interviewdetails.filter(detail => {
      const key = detail.interview_id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [interviewdetails]);

  return (
    <div className="employee-details-container">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {isLoading && <div className="loading-message">Loading...</div>}
      {!remaining && confirm && (
        <Confirm
          orgid={orgid}
          empid={empid}
          interviewdetails={interviewdetails}
          time={time}
          acceptingtime={acceptingtime}
          handleback={handleback}
        />
      )}
      {remaining && !confirm && (
        <Remaining
          orgid={orgid}
          empid={empid}
          interviewdetails={interviewdetails}
          time={time}
          handleback={handleback}
        />
      )}
      {!remaining && !confirm && !selected && (
        <div>
          <h1>{editing ? 'All Interviews' : 'My Interviews'}</h1>
          <table className="employee-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Interview ID</th>
                <th>Applicant Name</th>
                <th>JobID-Job Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {uniqueInterviewDetails.map((detail) => (
                <tr key={detail.interview_id} onClick={() => fetchid(detail.interview_id)}>
                  <td>{getdisplayprojectid(detail.applicationid)}</td>
                  <td>{getdisplayprojectid(detail.interview_id)}</td>
                  <td>{`${detail.first_name} ${detail.last_name}`}</td>
                  <td>{`${getdisplayprojectid(detail.jobid)}-${detail.display_job_name}`}</td>
                  <td>{detail.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!remaining && !confirm && selected && iddetails && (
        <div className="details-block">
          <button onClick={handleback}>x</button>
          <h3>Interview Details (Interview ID: {iddetails.interview_id})</h3>
          <form
            onSubmit={(e) => e.preventDefault()} // Disable global submit
          >
            <div className="form-row">
              <div className="form-group">
                <label>Application ID</label>
                <input
                  type="text"
                  value={iddetails.applicationid || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div className="form-group">
                <label>Interview ID</label>
                <input
                  type="text"
                  value={iddetails.interview_id || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Applicant Name</label>
                <input
                  type="text"
                  value={`${iddetails.first_name || ''} ${iddetails.last_name || ''}`}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
              <div className="form-group">
                <label>Job Title</label>
                <input
                  type="text"
                  value={iddetails.display_job_name || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="text"
                  value={iddetails.email || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Resume</label>
                {iddetails.resumepath ? (
                  <a
                    href={iddetails.resumepath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-resume-link"
                    onClick={handleViewResume}
                  >
                    View Resume
                  </a>
                ) : (
                  <span className="no-resume-text">No resume available</span>
                )}
              </div>
              <div className="form-group">
                <label>Application Status</label>
                <input
                  type="text"
                  value={iddetails.status || '-'}
                  disabled
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>
            {rounds.length > 0 && (
              <div>
                <h4>Rounds</h4>
                {rounds.map((round, index) => (
                  <div key={`${round.Roundid}-${index}`} className="round-block">
                    <h5>Round {round.RoundNo || index + 1}</h5>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Start Date</label>
                        <input
                          type="date"
                          value={formatDate(round.start_date)}
                          onChange={(e) => handleRoundChange(index, 'start_date', e.target.value)}
                          disabled
                          readOnly
                        />
                      </div>
                      <div className="form-group">
                        <label>Start Time</label>
                        <input
                          type="text"
                          value={formatTime(round.start_time, round.start_am_pm, round.start_date, round.end_date, round.start_am_pm) || ''}
                          onChange={(e) => handleRoundChange(index, 'start_time', e.target.value.split(' ')[0])}
                          disabled
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>End Date</label>
                        <input
                          type="date"
                          value={formatDate(round.end_date)}
                          onChange={(e) => handleRoundChange(index, 'end_date', e.target.value)}
                          disabled
                          readOnly
                        />
                      </div>
                      <div className="form-group">
                        <label>End Time</label>
                        <input
                          type="text"
                          readOnly
                          value={formatTime(round.end_time, round.end_am_pm, round.start_date, round.end_date, round.start_am_pm) || ''}
                          onChange={(e) => handleRoundChange(index, 'end_time', e.target.value.split(' ')[0])}
                          disabled
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Meeting Link</label>
                        <input
                          type="text"
                          value={formatMeetingLink(round.meeting_link) || "-"}
                          onChange={(e) => handleRoundChange(index, 'meeting_link', e.target.value)}
                          disabled={!round.isEditing || !canEditRound(round)}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Marks</label>
                        <input
                          type="number"
                          value={round.marks || ''}
                          onChange={(e) => handleRoundChange(index, 'marks', e.target.value)}
                          disabled={!round.isEditing || !canEditRound(round)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Comments</label>
                        <input
                          type="text"
                          value={round.comments || ''}
                          onChange={(e) => handleRoundChange(index, 'comments', e.target.value)}
                          disabled={!round.isEditing || !canEditRound(round)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Round Status</label>
                        <select
                          value={round.status || ''}
                          onChange={(e) => handleRoundChange(index, 'status', e.target.value)}
                          disabled={!round.isEditing || !canEditRound(round)}
                        >
                          <option value="">Select Status</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-buttons">
                      {round.isEditing ? (
                        <>
                          <button
                            type="button"
                            className="save-button"
                            onClick={() => handleSaveRound(index)}
                            disabled={isLoading || !canEditRound(round)}
                          >
                            {isLoading ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="cancel-button"
                            onClick={() => handleCancelRound(index)}
                            disabled={isLoading}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => handleEdit(index)}
                          disabled={!canEdit || !canEditRound(round)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default Overview;
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
  const [sortConfig, setSortConfig] = useState({ column: 'interview_id', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [interviewsPerPage, setInterviewsPerPage] = useState(10);
  const [duplicate, setduplicate] = useState(10);

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
    setCurrentPage(1);
    setPageInputValue('1');
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
        rounds: [roundToSave],
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
    return editing === 1 || (editing === 0 && round.panelMembers && round.panelMembers.some(member => member.empid === empid));
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

  const sortInterviews = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'interview_id':
        aValue = parseInt(a.interview_id.split('-')[1] || a.interview_id);
        bValue = parseInt(b.interview_id.split('-')[1] || b.interview_id);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'applicationid':
        aValue = parseInt(a.applicationid.split('-')[1] || a.applicationid);
        bValue = parseInt(b.applicationid.split('-')[1] || b.applicationid);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'applicant_name':
        aValue = `${a.first_name} ${a.last_name}`;
        bValue = `${b.first_name} ${b.last_name}`;
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'job_name':
        aValue = a.display_job_name || '';
        bValue = b.display_job_name || '';
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      default:
        return 0;
    }
  };

  const requestSort = (column) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const filteredInterviews = uniqueInterviewDetails.filter(interview => {
    const matchesSearch = 
      (`${interview.first_name} ${interview.last_name}`).toLowerCase().includes(searchQuery.toLowerCase()) ||
      interview.display_job_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getdisplayprojectid(interview.interview_id).includes(searchQuery) ||
      getdisplayprojectid(interview.applicationid).includes(searchQuery);
    
    return matchesSearch;
  }).sort((a, b) => sortInterviews(a, b, sortConfig.column, sortConfig.direction));

  const totalPages = Math.ceil(filteredInterviews.length / interviewsPerPage);
  const indexOfLastInterview = currentPage * interviewsPerPage;
  const indexOfFirstInterview = indexOfLastInterview - interviewsPerPage;
  const currentInterviews = filteredInterviews.slice(indexOfFirstInterview, indexOfLastInterview);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      setPageInputValue((currentPage + 1).toString());
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setPageInputValue((currentPage - 1).toString());
    }
  };

  const handlePageInputChange = (e) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(pageInputValue, 10);
      if (!isNaN(value) && value >= 1 && value <= totalPages) {
        setCurrentPage(value);
        setPageInputValue(value.toString());
      } else {
        setPageInputValue(currentPage.toString());
      }
    }
  };

  const handleInterviewsInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(duplicate, 10);
      if (!isNaN(value) && value >= 1) {
        setInterviewsPerPage(value);
        setduplicate(value);
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setduplicate(10);
        setCurrentPage(1);
        setPageInputValue('1');
      }
    }
  };

  const pagechanging = (e) => {
    setduplicate(e.target.value);
  };

  if (isLoading) {
    return (
      <div className="interview-overview-container">
        <div className="loading-message">Loading...</div>
      </div>
    );
  }

  return (
    <div className="interview-overview-container">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
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
        <div className="interviews-list">
          <div className="title">{editing ? 'All Interviews' : 'My Interviews'}</div>
          
          <div className="search-container">
            <input
              type="text"
              placeholder="Search by Name, Job, Interview ID, Application ID"
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input-interview"
            />
          </div>
          
          {filteredInterviews.length === 0 ? (
            <p className="empty-state">No interviews found.</p>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="interview-table five-column">
                  <colgroup>
                    <col />
                    <col />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={sortConfig.column === 'applicationid' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('applicationid')}>
                        Application ID
                      </th>
                      <th className={sortConfig.column === 'interview_id' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('interview_id')}>
                        Interview ID
                      </th>
                      <th className={sortConfig.column === 'applicant_name' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('applicant_name')}>
                        Applicant Name
                      </th>
                      <th className={sortConfig.column === 'job_name' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('job_name')}>
                        JobID-Job Name
                      </th>
                      <th className={sortConfig.column === 'status' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('status')}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentInterviews.map((detail) => (
                      <tr key={detail.interview_id} onClick={() => fetchid(detail.interview_id)}>
                        <td className="id-cell">
                          <span className="interview-indicator"></span>App-{getdisplayprojectid(detail.applicationid)}
                        </td>
                        <td>Interview-{getdisplayprojectid(detail.interview_id)}</td>
                        <td>{`${detail.first_name} ${detail.last_name}`}</td>
                        <td>{`${getdisplayprojectid(detail.jobid)}-${detail.display_job_name}`}</td>
                        <td className="application-status-text">
                          {detail.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredInterviews.length > interviewsPerPage && (
                <div className="pagination-container">
                  <button
                    className="button"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  <span className="pagination-text">
                    Page{' '}
                    <input
                      type="text"
                      value={pageInputValue}
                      onChange={handlePageInputChange}
                      onKeyPress={handlePageInputKeyPress}
                      className="pagination-input"
                    />{' '}
                    of {totalPages}
                  </span>
                  <button
                    className="button"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
              
              {filteredInterviews.length > 0 && (
                <div className="rows-per-page-container">
                  <label className="rows-per-page-label">Rows/ Page</label>
                  <input
                    type="text"
                    value={duplicate}
                    onChange={pagechanging}
                    onKeyPress={handleInterviewsInputKeyPress}
                    className="rows-per-page-input"
                    aria-label="Number of rows per page"
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {!remaining && !confirm && selected && iddetails && (
        <div className="interview-details-container">
          <div className="header-section">
            <h1 className="title">Interview Details</h1>
            <button className="back-button" onClick={handleback}></button>
          </div>
          
          <div className="interview-details-block">
            <div className="interview-details-header">
              <div>Interview Information</div>
            </div>
            
            <div className="view-details">
              <div className="details-row">
                <div className="details-g">
                  <label>Application ID</label>
                  <p>App-{getdisplayprojectid(iddetails.applicationid || '-')}</p>
                </div>
                <div className="details-g">
                  <label>Interview ID</label>
                  <p>Interview-{getdisplayprojectid(iddetails.interview_id || '-')}</p>
                </div>
              </div>
              
              <div className="details-row">
                <div className="details-g">
                  <label>Applicant Name</label>
                  <p>{`${iddetails.first_name || ''} ${iddetails.last_name || ''}`}</p>
                </div>
                <div className="details-g">
                  <label>Job Title</label>
                  <p>{iddetails.display_job_name || '-'}</p>
                </div>
              </div>
              
              <div className="details-row">
                <div className="details-g">
                  <label>Email</label>
                  <p>{iddetails.email || '-'}</p>
                </div>
                <div className="details-g">
                  <label>Application Status</label>
                  <p className="application-status-text">
                    {iddetails.status || '-'}
                  </p>
                </div>
              </div>
              
              <div className="details-row">
                <div className="details-g">
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
              </div>
            </div>
          </div>
          
          {rounds.length > 0 && (
            <div className="rounds-container">
              {rounds.map((round, index) => (
                <div key={`${round.Roundid}-${index}`} className="round-block">
                  <div className="round-header">
                    <div>Round {round.RoundNo || index + 1}</div>
                    {canEditRound(round) && !round.isEditing && (
                      <button
                        className="button"
                        onClick={() => handleEdit(index)}
                        disabled={!canEdit}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  
                  <div className="round-content">
                    <div className="details-row">
                      <div className="details-g">
                        <label>Start Date</label>
                        {round.isEditing ? (
                          <input
                            type="date"
                            value={formatDate(round.start_date)}
                            onChange={(e) => handleRoundChange(index, 'start_date', e.target.value)}
                            className="form-input"
                          />
                        ) : (
                          <p>{formatDate(round.start_date) || '-'}</p>
                        )}
                      </div>
                      <div className="details-g">
                        <label>Start Time</label>
                        {round.isEditing ? (
                          <input
                            type="text"
                            value={round.start_time || ''}
                            onChange={(e) => handleRoundChange(index, 'start_time', e.target.value)}
                            className="form-input"
                            placeholder="HH:MM"
                          />
                        ) : (
                          <p>{formatTime(round.start_time, round.start_am_pm, round.start_date, round.end_date, round.start_am_pm) || '-'}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="details-row">
                      <div className="details-g">
                        <label>End Date</label>
                        {round.isEditing ? (
                          <input
                            type="date"
                            value={formatDate(round.end_date)}
                            onChange={(e) => handleRoundChange(index, 'end_date', e.target.value)}
                            className="form-input"
                          />
                        ) : (
                          <p>{formatDate(round.end_date) || '-'}</p>
                        )}
                      </div>
                      <div className="details-g">
                        <label>End Time</label>
                        {round.isEditing ? (
                          <input
                            type="text"
                            value={round.end_time || ''}
                            onChange={(e) => handleRoundChange(index, 'end_time', e.target.value)}
                            className="form-input"
                            placeholder="HH:MM"
                          />
                        ) : (
                          <p>{formatTime(round.end_time, round.end_am_pm, round.start_date, round.end_date, round.start_am_pm) || '-'}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="details-row">
                      <div className="details-g">
                        <label>Meeting Link</label>
                        {round.isEditing ? (
                          <input
                            type="url"
                            value={round.meeting_link || ''}
                            onChange={(e) => handleRoundChange(index, 'meeting_link', e.target.value)}
                            className="form-input"
                            placeholder="https://..."
                          />
                        ) : (
                          <p>{formatMeetingLink(round.meeting_link) || "-"}</p>
                        )}
                      </div>
                      <div className="details-g">
                        <label>Round Status</label>
                        {round.isEditing ? (
                          <select
                            value={round.status || ''}
                            onChange={(e) => handleRoundChange(index, 'status', e.target.value)}
                            className="form-input"
                          >
                            <option value="">Select Status</option>
                            <option value="Accepted">Accepted</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        ) : (
                          <p>
                            {round.status === 'Accepted' && (
                              <span className="round-status-badge accepted">
                                {round.status}
                              </span>
                            )}
                            {round.status === 'Rejected' && (
                              <span className="round-status-badge rejected">
                                {round.status}
                              </span>
                            )}
                            {!round.status && '-'}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="details-row">
                      <div className="details-g">
                        <label>Marks</label>
                        {round.isEditing ? (
                          <input
                            type="number"
                            value={round.marks || ''}
                            onChange={(e) => handleRoundChange(index, 'marks', e.target.value)}
                            className="form-input"
                            placeholder="0-100"
                          />
                        ) : (
                          <p>{round.marks || '-'}</p>
                        )}
                      </div>
                      <div className="details-g">
                        <label>Comments</label>
                        {round.isEditing ? (
                          <textarea
                            value={round.comments || ''}
                            onChange={(e) => handleRoundChange(index, 'comments', e.target.value)}
                            className="form-input form-textarea"
                            placeholder="Add your comments..."
                            rows={3}
                          />
                        ) : (
                          <p>{round.comments || '-'}</p>
                        )}
                      </div>
                    </div>
                    
                    {round.isEditing && (
                      <div className="form-buttons">
                        <button
                          className="save"
                          onClick={() => handleSaveRound(index)}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          className="cancel"
                          onClick={() => handleCancelRound(index)}
                          disabled={isLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Overview;
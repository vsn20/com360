'use client';
import React, { useEffect, useState } from 'react';
import { fetchalldetails, updateStatus, saveOfferLetter, fetchDropdownData } from '@/app/serverActions/Jobs/OfferLetterGeneration/Fetchingandupdatingdetails';
import './details.css';

// Helper function to trigger download
const triggerDownload = (fileUrl, fileName) => {
  const anchor = document.createElement('a');
  anchor.href = fileUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const Details = ({ selectid, orgid, empid, handleback }) => {
  const [details, setDetails] = useState(null);
  const [formData, setFormData] = useState({ status: '' });
  const [offerLetterData, setOfferLetterData] = useState({
    finalised_salary: '',
    finalised_role: '', // Changed to single value
    finalised_jobtitle: '',
    finalised_department: '',
    finalised_jobtype: '',
    finalised_pay_term: '',
    reportto_empid: '',
    adress_lane_1: '',
    adress_lane_2: '',
    zipcode: '',
    stateid: '',
    countryid: '185',
    custom_state_name: '',
    expected_join_date: '',
    url: '',
  });
  const [dropdownData, setDropdownData] = useState({
    departments: [],
    payFrequencies: [],
    jobTitles: [],
    countries: [],
    states: [],
    employees: [],
    jobtype: [],
    roles: [],
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [editingStatus, setEditingStatus] = useState(false);

  const getdisplayprojectid = (prjid) => prjid.split('-')[1] || prjid;
  const getdisplayid = (prjid) => prjid.split('_')[1] || prjid;

  useEffect(() => {
    const loadDetails = async () => {
      if (!selectid || !orgid) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchalldetails(selectid);
        if (result?.success && result?.data) {
          setDetails(result.data);
          setFormData({ status: result.data?.status || '' });
          setOfferLetterData({
            finalised_salary: result.data?.offerletter?.finalised_salary || '',
            finalised_role: result.data?.offerletter?.finalised_role || '', // Single value
            finalised_jobtitle: result.data?.offerletter?.finalised_jobtitle || '',
            finalised_department: result.data?.offerletter?.finalised_department || '',
            finalised_jobtype: result.data?.offerletter?.finalised_jobtype || '',
            finalised_pay_term: result.data?.offerletter?.finalised_pay_term || '',
            reportto_empid: result.data?.offerletter?.reportto_empid || '',
            adress_lane_1: result.data?.offerletter?.adress_lane_1 || '',
            adress_lane_2: result.data?.offerletter?.adress_lane_2 || '',
            zipcode: result.data?.offerletter?.zipcode || result.data?.zipcode || '',
            stateid: result.data?.offerletter?.stateid || '',
            countryid: result.data?.offerletter?.countryid || '185',
            custom_state_name: result.data?.offerletter?.custom_state_name || '',
            expected_join_date: result.data?.offerletter?.expected_join_date
              ? new Date(result.data.offerletter.expected_join_date).toISOString().split('T')[0]
              : '',
            url: result.data?.offerletter?.offerletter_url || '',
          });

          if (result.data?.status === 'offerletter-processing' && result.data?.offerletter?.offer_letter_sent === 1) {
            setError('Cannot edit: Offer letter has already been sent.');
            setEditingStatus(false);
          } else {
            setError(null);
          }
        } else {
          setError(result?.error || 'No details found for the selected interview.');
        }

        const dropdownResult = await fetchDropdownData(orgid);
        if (dropdownResult?.success && dropdownResult?.data) {
          setDropdownData(dropdownResult.data);
        } else {
          setError(dropdownResult?.error || 'Failed to load dropdown data.');
        }
      } catch (err) {
        setError(err.message || 'Failed to load details.');
      } finally {
        setIsLoading(false);
      }
    };
    loadDetails();
  }, [selectid, orgid]);

  const handleStatusChange = (e) => {
    setFormData((prev) => ({ ...prev, status: e.target.value }));
  };

  const handleOfferLetterChange = (e) => {
    const { name, value } = e.target;
    setOfferLetterData((prev) => ({ ...prev, [name]: value }));
  };

  const salarycopy = () => {
    if (parseInt(details.salary_expected) < parseInt(details.max_salary, 10)) {
      return true;
    } else {
      return false;
    }
  };

  const handleCopy = () => {
    let salary;
    if (!salarycopy()) {
      salary = details.max_salary;
    } else {
      salary = details.salary_expected;
    }

    const countryIdStr = String(details.c1 || '');

    setOfferLetterData((prev) => ({
      ...prev,
      finalised_jobtitle: details.expected_job_title || '',
      adress_lane_1: details.a1 || '',
      adress_lane_2: details.a2 || '',
      zipcode: details.z1 || '',
      stateid: countryIdStr === '185' ? details.s1 || '' : '',
      countryid: countryIdStr,
      custom_state_name: countryIdStr !== '185' ? details.s2 || '' : '',
      finalised_department: details.d1 || '',
      finalised_jobtype: details.job1 || '',
      finalised_role: details.role1 || '', // Copying expected role
      finalised_salary: salary || '',
    }));
  };

  const handleEditStatus = () => {
    setEditingStatus(true);
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (details?.status === 'offerletter-processing' && details?.offerletter?.offer_letter_sent === 1) {
        setError('Cannot save: Offer letter has already been sent.');
        setIsLoading(false);
        return;
      }

      if (formData.status === 'offerletter-generated') {
        const adjustedOfferLetterData = {
          ...offerLetterData,
          stateid: offerLetterData.countryid === '185' ? offerLetterData.stateid : null,
          custom_state_name: offerLetterData.countryid !== '185' ? offerLetterData.custom_state_name : null,
        };

        const offerLetterResult = await saveOfferLetter(details?.application_id, adjustedOfferLetterData, orgid, details);
        if (!offerLetterResult?.success) {
          setError(offerLetterResult?.error || 'Failed to save offer letter details.');
          setIsLoading(false);
          return;
        }
        triggerDownload(offerLetterResult.offerletter_url, `Offer_Letter_${details?.application_id}.pdf`);
        setDetails((prev) => ({ ...prev, offerletter_url: offerLetterResult.offerletter_url }));
      }

      const result = await updateStatus(details?.application_id, formData.status, details?.interview_id);
      if (result?.success) {
        setSuccess(result.message);
        setDetails((prev) => ({ ...prev, status: formData.status }));
        setEditingStatus(false);
        setTimeout(() => setSuccess(null), 3000);
        handleback();
      } else {
        setError(result?.error || 'Failed to update status.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingStatus(false);
    setFormData({ status: details?.status || '' });
    setOfferLetterData({
      finalised_salary: details?.offerletter?.finalised_salary || '',
      finalised_role: details?.offerletter?.finalised_role || '',
      finalised_jobtitle: details?.offerletter?.finalised_jobtitle || '',
      finalised_department: details?.offerletter?.finalised_department || '',
      finalised_jobtype: details?.offerletter?.finalised_jobtype || '',
      finalised_pay_term: details?.offerletter?.finalised_pay_term || '',
      reportto_empid: details?.offerletter?.reportto_empid || '',
      adress_lane_1: details?.offerletter?.adress_lane_1 || '',
      adress_lane_2: details?.offerletter?.adress_lane_2 || '',
      zipcode: details?.offerletter?.zipcode || details?.zipcode || '',
      stateid: details?.offerletter?.stateid || '',
      countryid: String(details?.offerletter?.countryid || '185'),
      custom_state_name: details?.offerletter?.custom_state_name || '',
      expected_join_date: details?.offerletter?.expected_join_date
        ? new Date(details.offerletter.expected_join_date).toISOString().split('T')[0]
        : '',
      url: details?.offerletter?.offerletter_url || '',
    });
    setError(null);
  };

  const genericjobName = (superiorId) => {
    const superior = dropdownData.roles.find(role => String(role.id) ===String(superiorId));
    return superior ? `${superior.Name}`.trim() : 'No Jobtype';
  };


  const formatDate = (date) => {
    if (!date) return '-';
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '-';
  };

  return (
    <div className="employee-overview-container6">
      {isLoading && <div className="loading-message6">Loading...</div>}
      {error && <div className="error-message6">{error}</div>}
      {success && <div className="success-message6">{success}</div>}

      {details && (
        <div className="employee-details-container6">
          <div className="header-section6">
            <h1 className="title">{`${details?.first_name || ''} ${details?.last_name || ''}`.trim()} Offer Letter Details</h1>
            <button className="back-button" onClick={handleback}></button>
          </div>

          <div className="details-block6">
            <h3>Basic Details</h3>
            <div className="details-row6">
              <div className="details-group6">
                <label>First Name</label>
                <p>{details?.first_name || '-'}</p>
              </div>
              <div className="details-group6">
                <label>Last Name</label>
                <p>{details?.last_name || '-'}</p>
              </div>
            </div>
            <div className="details-row6">
              <div className="details-group6">
                <label>Email</label>
                <p>{details?.email || '-'}</p>
              </div>
              <div className="details-group6">
                <label>Mobile Number</label>
                <p>{details?.mobilenumber || '-'}</p>
              </div>
            </div>
            <div className="details-row6">
              <div className="details-group6">
                <label>Date of Birth</label>
                <p>{formatDate(details?.dateofbirth)}</p>
              </div>
              <div className="details-group6">
                <label>Gender</label>
                <p>{details?.gender || '-'}</p>
              </div>
            </div>
            <div className="details-row6">
              <div className="details-group6">
                <label>Job Name</label>
                <p>{details.display_job_name || '-'}</p>
              </div>
              <div className="details-group6">
                <label>Applied Date</label>
                <p>{formatDate(details?.applieddate)}</p>
              </div>
            </div>
          </div>

          <div className="details-block6">
            <h3>Application Details</h3>
            <div className="details-row6">
              {/* <div className="details-group6">
                <label>Interview ID</label>
                <p>{getdisplayprojectid(details?.interview_id) || '-'}</p>
              </div> */}
              {/* <div className="details-group6">
                <label>Application ID</label>
                <p>{getdisplayprojectid(details?.application_id) || '-'}</p>
              </div> */}
            </div>
            <div className="details-row6">
              {/* <div className="details-group6">
                <label>Organization ID</label>
                <p>{details?.orgid || '-'}</p>
              </div> */}
              <div className="details-group6">
                <label>Job Title</label>
                <p>
                  {details?.job_title
                    ? `${details.job_title} minsalary-${details?.min_salary || '-'} maxsalary-${details?.max_salary || '-'} level-${details?.level || '-'}`
                    : '-'}
                </p>
              </div>
            </div>
            <div className="details-row6">
              <div className="details-group6">
                <label>Resume Path</label>
                {details?.resumepath ? (
                  <a href={details.resumepath} className="view-resume-link6" target="_blank" rel="noopener noreferrer">
                    View Resume
                  </a>
                ) : (
                  <span className="no-resume-text6">No Resume</span>
                )}
              </div>
              <div className="details-group6">
                <label>Salary Expected</label>
                <p>{details?.salary_expected || '-'}</p>
              </div>
            </div>
            <div className="details-row6">
              <div className="details-group6">
                <label>Status</label>
                <p>{details?.status || '-'}</p>
              </div>
              <div className="details-group6">
                <label>Offer Letter</label>
                {details?.offerletter_url ? (
                  <a href={details.offerletter_url} className="view-resume-link6" target="_blank" rel="noopener noreferrer">
                    View Offer Letter
                  </a>
                ) : (
                  <span className="no-resume-text6">-</span>
                )}
              </div>
            </div>
          </div>

          <div className="details-block6">
            <h3>Interview Status Management</h3>
            {editingStatus ? (
              <form onSubmit={handleSave}>
                <div className="form-row6">
                  <div className="form-group6">
                    <label>Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleStatusChange}
                      required
                    >
                      <option>Select Status Option</option>
                      <option value="offerletter-generated">Offer Letter Generated</option>
                      <option value="offerletter-rejected">Offer Letter Rejected</option>
                      <option value="offerletter-hold">Offer Letter Hold</option>
                    </select>
                  </div>
                </div>
                
                {formData.status === 'offerletter-generated' && (
                  <div className="offer-letter-form6">
                    <div className="offer-letter-column6">
                      <h4>Expected Details</h4>
                      <div className="form-group6">
                        <label>Expected Job Title</label>
                        <input type="text" value={details?.job_title || ''} disabled />
                      </div>
                      <div className="form-group6">
                        <label>Expected Salary</label>
                        <input type="text" value={details?.salary_expected || ''} disabled />
                      </div>
                       <div className="form-group1">
                          <label>Expected Role</label>
                          <input type="text" value={genericjobName(details?.role1) || ''} disabled />
                        </div>
                      <div className="form-group6">
                        <label>Min Salary</label>
                        <input type="text" value={details?.min_salary || ''} disabled />
                      </div>
                      <div className="form-group6">
                        <label>Max Salary</label>
                        <input type="text" value={details?.max_salary || ''} disabled />
                      </div>
                      <div className="form-group6">
                        <label>Level</label>
                        <input type="text" value={details?.level || ''} disabled />
                      </div>  
                      <div className="form-group6">
                       <label>Expected Department</label>
                        <input
                          type="text"
                          value={details.departmentname || ''}
                          disabled
                        />
                      </div>
                      <div className="form-group6">
                        <label>Expected jobtype</label>
                        <input
                          type="text"
                          value={details.jobtypename || ''}
                          disabled
                        />
                      </div>
                      <div className="form-group6">
                        <label>Address Lane-1</label>
                        <input
                          type="text"
                          value={details.a1 || ''}
                          disabled
                        />
                      </div>
                        <div className="form-group6">
                        <label>Address Lane-2</label>
                        <input
                          type="text"
                          value={details.a2 || ''}
                          disabled
                        />
                      </div>
                        <div className="form-group6">
                        <label>Zipcode</label>
                        <input
                          type="text"
                          value={details.z1 || ''}
                          disabled
                        />
                      </div>
                        <div className="form-group6">
                        <label>State</label>
                        <input
                          type="text"
                          value={details.statename || ''}
                          disabled
                        />
                      </div>
                        <div className="form-group6">
                        <label>Custom State Name</label>
                        <input
                          type="text"
                          value={details.s2 || ''}
                          disabled
                        />
                      </div>
                        <div className="form-group6">
                        <label>Country</label>
                        <input
                          type="text"
                          value={details.countryname || ''}
                          disabled
                        />
                      </div>                    
                    </div>                    
                    <div className="offer-letter-column6">
                      <h4>Finalized Details</h4>
                      <div className="form-group6">
                        <label>Finalized Job Title</label>
                        <select
                          name="finalised_jobtitle"
                          value={offerLetterData.finalised_jobtitle}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Job Title</option>
                          {dropdownData.jobTitles?.map((job) => (
                            <option key={job.job_title_id} value={job.job_title_id}>
                              {job.job_title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group6">
                        <label>Finalized Salary</label>
                        <input
                          type="text"
                          name="finalised_salary"
                          value={offerLetterData.finalised_salary}
                          onChange={handleOfferLetterChange}
                          required
                        />
                      </div>
                      <div className="form-group6">
                        <label>Finalized Role</label>
                        <select
                          name="finalised_role"
                          value={offerLetterData.finalised_role}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Role</option>
                          {dropdownData.roles?.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.Name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group6">
                        <label>Finalized Department</label>
                        <select
                          name="finalised_department"
                          value={offerLetterData.finalised_department}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Department</option>
                          {dropdownData.departments?.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group6">
                        <label>Finalized Job Type</label>
                        <select
                          name="finalised_jobtype"
                          value={offerLetterData.finalised_jobtype}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Job Type</option>
                          {dropdownData.jobtype?.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.Name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group6">
                        <label>Pay Term</label>
                        <select
                          name="finalised_pay_term"
                          value={offerLetterData.finalised_pay_term}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Pay Term</option>
                          {dropdownData.payFrequencies?.map((freq) => (
                            <option key={freq.id} value={freq.Name}>
                              {freq.Name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group6">
                        <label>Report To Employee ID</label>
                        <select
                          name="reportto_empid"
                          value={offerLetterData.reportto_empid}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Employee</option>
                          {dropdownData.employees?.map((emp) => (
                            <option key={emp.empid} value={emp.empid}>
                              {emp.name} ({emp.empid})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group6">
                        <label>Address Line 1</label>
                        <input
                          type="text"
                          name="adress_lane_1"
                          value={offerLetterData.adress_lane_1}
                          onChange={handleOfferLetterChange}
                          required
                        />
                      </div>
                      <div className="form-group6">
                        <label>Address Line 2</label>
                        <input
                          type="text"
                          name="adress_lane_2"
                          value={offerLetterData.adress_lane_2}
                          onChange={handleOfferLetterChange}
                        />
                      </div>
                      <div className="form-group6">
                        <label>Zip Code</label>
                        <input
                          type="text"
                          name="zipcode"
                          value={offerLetterData.zipcode}
                          onChange={handleOfferLetterChange}
                          required
                        />
                      </div>
                      <div className="form-group6">
                        <label>State</label>
                        <select
                          name="stateid"
                          value={offerLetterData.stateid}
                          onChange={handleOfferLetterChange}
                          disabled={offerLetterData.countryid !== '185'}
                        >
                          <option value="">Select State</option>
                          {dropdownData.states?.map((state) => (
                            <option key={state.ID} value={state.ID}>
                              {state.VALUE}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group6">
                        <label>Country</label>
                        <select
                          name="countryid"
                          value={offerLetterData.countryid}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Country</option>
                          {dropdownData.countries?.map((country) => (
                            <option key={country.ID} value={country.ID}>
                              {country.VALUE}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group6">
                        <label>Custom State Name</label>
                        <input
                          type="text"
                          name="custom_state_name"
                          value={offerLetterData.custom_state_name}
                          onChange={handleOfferLetterChange}
                          disabled={offerLetterData.countryid === '185'}
                        />
                      </div>
                      <div className="form-group6">
                        <label>Expected Join Date</label>
                        <input
                          type="date"
                          name="expected_join_date"
                          value={offerLetterData.expected_join_date}
                          onChange={handleOfferLetterChange}
                          required
                        />
                      </div>
                      <div className="form-row6">
                        <button type="button" className="button" onClick={handleCopy}>
                          Copy Expected Details
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="form-buttons6">
                  <button type="submit" className="save" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Status'}
                  </button>
                  <button type="button" className="cancel" onClick={handleCancel} disabled={isLoading}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="view-details">
                <div className="details-buttons6">
                  <button className="button" onClick={handleEditStatus}>Edit Status</button>
                </div>
              </div>
            )}
          </div>

          {details?.rounds && details.rounds.length > 0 && (
            <>
              {details.rounds.map((round, index) => (
                <div key={`${round.Roundid}-${index}`} className="details-block6">
                  <h3>Round {round.RoundNo || index + 1}</h3>
                  <div className="details-row6">
                    <div className="details-group6">
                      <label>Start Date</label>
                      <p>{formatDate(round.start_date)}</p>
                    </div>
                    <div className="details-group6">
                      <label>Start Time</label>
                      <p>{round.start_time && round.start_am_pm ? `${round.start_time} ${round.start_am_pm}` : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row6">
                    <div className="details-group6">
                      <label>End Date</label>
                      <p>{formatDate(round.end_date)}</p>
                    </div>
                    <div className="details-group6">
                      <label>End Time</label>
                      <p>{round.end_time && round.end_am_pm ? `${round.end_time} ${round.end_am_pm}` : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row6">
                    <div className="details-group6">
                      <label>Meeting Link</label>
                      <p>{round.meeting_link || '-'}</p>
                    </div>
                    <div className="details-group6">
                      <label>Status</label>
                      <p>{round.status || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row6">
                    <div className="details-group6">
                      <label>Marks</label>
                      <p>{round.marks || '-'}</p>
                    </div>
                    <div className="details-group6">
                      <label>Comments</label>
                      <p>{round.comments || '-'}</p>
                    </div>
                  </div>
                  {round.panelMembers && round.panelMembers.length > 0 && (
                    <div className="panel-members-section6">
                      <h4>Panel Members</h4>
                      {round.panelMembers.map((member, memberIndex) => (
                        <div key={`${round.Roundid}-member-${memberIndex}`} className="details-row6">
                          <div className="details-group6">
                            <label>Employee ID</label>
                            <p>{member.empid ? getdisplayid(member.empid) : '-'}</p>
                          </div>
                          <div className="details-group6">
                            <label>Email</label>
                            <p>{member.email || '-'}</p>
                          </div>
                          <div className="details-group6">
                            <label>Is Employee</label>
                            <p>{member.is_he_employee === 1 ? 'Yes' : 'No'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          <div className="details-block6">
            <h3>Address Details</h3>
            <div className="details-row6">
              <div className="details-group6">
                <label>Address Line 1</label>
                <p>{details?.addresslane1 || '-'}</p>
              </div>
              <div className="details-group6">
                <label>Address Line 2</label>
                <p>{details?.addresslane2 || '-'}</p>
              </div>
            </div>
            <div className="details-row6">
              <div className="details-group6">
                <label>Zip Code</label>
                <p>{details?.zipcode || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Details;
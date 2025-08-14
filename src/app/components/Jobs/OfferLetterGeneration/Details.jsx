'use client';
import React, { useEffect, useState } from 'react';
import { fetchalldetails, updateStatus, saveOfferLetter, fetchDropdownData } from '@/app/serverActions/Jobs/OfferLetterGeneration/Fetchingandupdatingdetails';
import './Offerletter.css';

// Helper function to trigger download
const triggerDownload = (fileUrl, fileName) => {
  const anchor = document.createElement('a');
  anchor.href = fileUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

// Custom Multi-Select Dropdown Component
const MultiSelectDropdown = ({ options, selectedValues, onChange, name, required }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleSelect = (value) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange({ target: { name, value: newValues } });
  };

  return (
    <div className="multi-select-container">
      <div className="multi-select-input" onClick={handleToggle}>
        {selectedValues.length > 0 ? (
          <div className="selected-tags">
            {selectedValues.map((value) => {
              const option = options.find((opt) => opt.roleid === value);
              return (
                <span key={value} className="selected-tag">
                  {option?.rolename || value}
                  <button
                    type="button"
                    className="remove-tag"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(value);
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="placeholder">Select Roles</span>
        )}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div className="multi-select-options">
          {options.length > 0 ? (
            options.map((option) => (
              <label key={option.roleid} className="multi-select-option">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.roleid)}
                  onChange={() => handleSelect(option.roleid)}
                />
                {option.rolename}
              </label>
            ))
          ) : (
            <div className="no-options">No roles available</div>
          )}
        </div>
      )}
      {required && selectedValues.length === 0 && (
        <input type="hidden" name={name} value="" required />
      )}
    </div>
  );
};

const Details = ({ selectid, orgid, empid, handleback }) => {
  const [details, setDetails] = useState(null);
  const [formData, setFormData] = useState({ status: '' });
  const [offerLetterData, setOfferLetterData] = useState({
    finalised_salary: '',
    finalised_roleids: [],
    finalised_jobtitle: '',
    finalised_department: '',
    finalised_jobtype: '',
    finalised_pay_term: '',
    reportto_empid: '',
    adress_lane_1: '',
    adress_lane_2: '',
    zipcode: '',
    stateid: '',
    countryid: '',
    custom_state_name: '',
    expected_join_date: '',
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

  useEffect(() => {
    const loadDetails = async () => {
      if (!selectid || !orgid) return;
      setIsLoading(true);
      try {
        const result = await fetchalldetails(selectid);
        if (result.success && result.data) {
          setDetails(result.data);
          setFormData({ status: result.data.status || '' });
          setOfferLetterData({
            finalised_salary: result.data.offerletter?.finalised_salary || '',
            finalised_roleids: result.data.offerletter?.finalised_roleids || [],
            finalised_jobtitle: result.data.offerletter?.finalised_jobtitle || '',
            finalised_department: result.data.offerletter?.finalised_department || '',
            finalised_jobtype: result.data.offerletter?.finalised_jobtype || '',
            finalised_pay_term: result.data.offerletter?.finalised_pay_term || '',
            reportto_empid: result.data.offerletter?.reportto_empid || '',
            adress_lane_1: result.data.offerletter?.adress_lane_1 || '',
            adress_lane_2: result.data.offerletter?.adress_lane_2 || '',
            zipcode: result.data.offerletter?.zipcode || '',
            stateid: result.data.offerletter?.stateid || '',
            countryid: result.data.offerletter?.countryid || '',
            custom_state_name: result.data.offerletter?.custom_state_name || '',
            expected_join_date: result.data.offerletter?.expected_join_date
              ? new Date(result.data.offerletter.expected_join_date).toISOString().split('T')[0]
              : '',
          });
          setError(null);
        } else {
          setError(result.error || 'No details found for the selected interview.');
        }

        const dropdownResult = await fetchDropdownData(orgid);
        if (dropdownResult.success && dropdownResult.data) {
          setDropdownData(dropdownResult.data);
        } else {
          setError(dropdownResult.error || 'Failed to load dropdown data.');
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
    setOfferLetterData((prev) => ({
      ...prev,
      finalised_jobtitle: details.expected_job_title || '',
      adress_lane_1: details.a1 || '',
      adress_lane_2: details.a2 || '',
      zipcode: details.z1 || '',
      stateid: details.s1 || '',
      countryid: details.c1 || '',
      custom_state_name: details.s2 || '',
      finalised_department: details.d1 || '',
      finalised_jobtype: details.job1 || '',
      finalised_salary: salary || '',
    }));
  };

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  const getdisplayid = (prjid) => {
    return prjid.split('_')[1] || prjid;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (formData.status === 'offerletter-generated') {
        const offerLetterResult = await saveOfferLetter(details.application_id, offerLetterData, orgid, details);
        if (!offerLetterResult.success) {
          setError(offerLetterResult.error || 'Failed to save offer letter details.');
          setIsLoading(false);
          return;
        }
        triggerDownload(offerLetterResult.offerletter_url, `Offer_Letter_${details.application_id}.pdf`);
        setDetails((prev) => ({ ...prev, offerletter_url: offerLetterResult.offerletter_url }));
      }

      const result = await updateStatus(details.application_id, formData.status, details.interview_id);
      if (result.success) {
        setSuccess(result.message);
        setDetails((prev) => ({ ...prev, status: formData.status }));
        setEditingStatus(false);
        setTimeout(() => {
          setSuccess(null);
          handleback();
        }, 3000);
      } else {
        setError(result.error || 'Failed to update status.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditStatus = () => {
    setEditingStatus(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditingStatus(false);
    setFormData({ status: details.status || '' });
    setOfferLetterData({
      finalised_salary: details.offerletter?.finalised_salary || '',
      finalised_roleids: details.offerletter?.finalised_roleids || [],
      finalised_jobtitle: details.offerletter?.finalised_jobtitle || '',
      finalised_department: details.offerletter?.finalised_department || '',
      finalised_jobtype: details.offerletter?.finalised_jobtype || '',
      finalised_pay_term: details.offerletter?.finalised_pay_term || '',
      reportto_empid: details.offerletter?.reportto_empid || '',
      adress_lane_1: details.offerletter?.adress_lane_1 || details.addresslane1 || '',
      adress_lane_2: details.offerletter?.adress_lane_2 || details.addresslane2 || '',
      zipcode: details.offerletter?.zipcode || details.zipcode || '',
      stateid: details.offerletter?.stateid || '',
      countryid: details.offerletter?.countryid || '',
      custom_state_name: details.offerletter?.custom_state_name || '',
      expected_join_date: details.offerletter?.expected_join_date
        ? new Date(details.offerletter.expected_join_date).toISOString().split('T')[0]
        : '',
    });
    setError(null);
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
    <div className="employee-overview-container">
      {isLoading && <div className="loading-message">Loading...</div>}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {details && (
        <div className="employee-details-container">
          <div className="header-section">
            <h1 className="title">Candidate Details (Application ID: {getdisplayprojectid(details.application_id)})</h1>
            <button className="back-button" onClick={handleback}>
              Back
            </button>
          </div>
          <div className="details-block">
            <h3>Basic Details</h3>
            <div className="form-row">
              <div className="details-g">
                <label>First Name</label>
                <p>{details.first_name || '-'}</p>
              </div>
              <div className="details-g">
                <label>Last Name</label>
                <p>{details.last_name || '-'}</p>
              </div>
            </div>
            <div className="form-row">
              <div className="details-g">
                <label>Email</label>
                <p>{details.email || '-'}</p>
              </div>
              <div className="details-g">
                <label>Mobile Number</label>
                <p>{details.mobilenumber || '-'}</p>
              </div>
            </div>
            <div className="form-row">
              <div className="details-g">
                <label>Date of Birth</label>
                <p>{formatDate(details.dateofbirth)}</p>
              </div>
              <div className="details-g">
                <label>Gender</label>
                <p>{details.gender || '-'}</p>
              </div>
            </div>
            <div className="form-row">
              <div className="details-g">
                <label>Job Name</label>
                <p>{details.display_job_name || '-'}</p>
              </div>
            </div>
          </div>

          <div className="details-block">
            <h3>Interview Details</h3>
            {editingStatus ? (
              <form className="add-role-form" onSubmit={handleSave}>
                <div className="form-section">
                  <div className="form-row">
                    <div className="form-group">
                      <label data-required="true">Status</label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleStatusChange}
                        required
                      >
                        <option value="">Select Status Option</option>
                        <option value="offerletter-generated">Offer Letter Generated</option>
                        <option value="offerletter-rejected">Offer Letter Rejected</option>
                        <option value="offerletter-hold">Offer Letter Hold</option>
                      </select>
                    </div>
                  </div>
                  {formData.status === 'offerletter-generated' && (
                    <div className="offer-letter-form">
                      <div className="offer-letter-column">
                        <h4>Expected Details</h4>
                        <div className="form-group">
                          <label>Expected Job Title</label>
                          <input
                            type="text"
                            value={details.job_title || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Expected Salary</label>
                          <input
                            type="text"
                            value={details.salary_expected || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Min Salary</label>
                          <input
                            type="text"
                            value={details.min_salary || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Max Salary</label>
                          <input
                            type="text"
                            value={details.max_salary || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Level</label>
                          <input
                            type="text"
                            value={details.level || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Expected Department</label>
                          <input
                            type="text"
                            value={details.departmentname || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Expected Job Type</label>
                          <input
                            type="text"
                            value={details.jobtypename || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Address Line 1</label>
                          <input
                            type="text"
                            value={details.a1 || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Address Line 2</label>
                          <input
                            type="text"
                            value={details.a2 || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Zip Code</label>
                          <input
                            type="text"
                            value={details.z1 || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>State</label>
                          <input
                            type="text"
                            value={details.statename || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Custom State Name</label>
                          <input
                            type="text"
                            value={details.s2 || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div className="form-group">
                          <label>Country</label>
                          <input
                            type="text"
                            value={details.countryname || ''}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                      </div>
                      <div className="offer-letter-column">
                        <h4>Finalized Details</h4>
                        <div className="form-group">
                          <label data-required="true">Finalized Job Title</label>
                          <select
                            name="finalised_jobtitle"
                            value={offerLetterData.finalised_jobtitle}
                            onChange={handleOfferLetterChange}
                            required
                          >
                            <option value="">Select Job Title</option>
                            {dropdownData.jobTitles.map((job) => (
                              <option key={job.job_title_id} value={job.job_title_id}>
                                {job.job_title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label data-required="true">Finalized Salary</label>
                          <input
                            type="text"
                            name="finalised_salary"
                            value={offerLetterData.finalised_salary}
                            onChange={handleOfferLetterChange}
                            className="role-name-input"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label data-required="true">Finalized Roles</label>
                          <MultiSelectDropdown
                            options={dropdownData.roles}
                            selectedValues={offerLetterData.finalised_roleids}
                            onChange={handleOfferLetterChange}
                            name="finalised_roleids"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label data-required="true">Finalized Department</label>
                          <select
                            name="finalised_department"
                            value={offerLetterData.finalised_department}
                            onChange={handleOfferLetterChange}
                            required
                          >
                            <option value="">Select Department</option>
                            {dropdownData.departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label data-required="true">Finalized Job Type</label>
                          <select
                            name="finalised_jobtype"
                            value={offerLetterData.finalised_jobtype}
                            onChange={handleOfferLetterChange}
                            required
                          >
                            <option value="">Select Job Type</option>
                            {dropdownData.jobtype.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.Name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label data-required="true">Pay Term</label>
                          <select
                            name="finalised_pay_term"
                            value={offerLetterData.finalised_pay_term}
                            onChange={handleOfferLetterChange}
                            required
                          >
                            <option value="">Select Pay Term</option>
                            {dropdownData.payFrequencies.map((freq) => (
                              <option key={freq.id} value={freq.Name}>
                                {freq.Name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label data-required="true">Report To Employee ID</label>
                          <select
                            name="reportto_empid"
                            value={offerLetterData.reportto_empid}
                            onChange={handleOfferLetterChange}
                            required
                          >
                            <option value="">Select Employee</option>
                            {dropdownData.employees.map((emp) => (
                              <option key={emp.empid} value={emp.empid}>
                                {emp.name} ({emp.empid})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label data-required="true">Address Line 1</label>
                          <input
                            type="text"
                            name="adress_lane_1"
                            value={offerLetterData.adress_lane_1}
                            onChange={handleOfferLetterChange}
                            className="role-name-input"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Address Line 2</label>
                          <input
                            type="text"
                            name="adress_lane_2"
                            value={offerLetterData.adress_lane_2}
                            onChange={handleOfferLetterChange}
                            className="role-name-input"
                          />
                        </div>
                        <div className="form-group">
                          <label data-required="true">Zip Code</label>
                          <input
                            type="text"
                            name="zipcode"
                            value={offerLetterData.zipcode}
                            onChange={handleOfferLetterChange}
                            className="role-name-input"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label data-required="true">State</label>
                          <select
                            name="stateid"
                            value={offerLetterData.stateid}
                            onChange={handleOfferLetterChange}
                            required
                          >
                            <option value="">Select State</option>
                            {dropdownData.states.map((state) => (
                              <option key={state.ID} value={state.ID}>
                                {state.VALUE}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label data-required="true">Country</label>
                          <select
                            name="countryid"
                            value={offerLetterData.countryid}
                            onChange={handleOfferLetterChange}
                            required
                          >
                            <option value="">Select Country</option>
                            {dropdownData.countries.map((country) => (
                              <option key={country.ID} value={country.ID}>
                                {country.VALUE}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Custom State Name</label>
                          <input
                            type="text"
                            name="custom_state_name"
                            value={offerLetterData.custom_state_name}
                            onChange={handleOfferLetterChange}
                            className="role-name-input"
                          />
                        </div>
                        <div className="form-group">
                          <label data-required="true">Expected Join Date</label>
                          <input
                            type="date"
                            name="expected_join_date"
                            value={offerLetterData.expected_join_date}
                            onChange={handleOfferLetterChange}
                            className="role-name-input"
                            required
                          />
                        </div>
                        <div className="form-row">
                          <button type="button" className="copy-button" onClick={handleCopy}>
                            Copy Expected Details
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="submit-section">
                  <div className="form-buttons">
                    <button type="submit" className="save" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save Status'}
                    </button>
                    <button type="button" className="cancel" onClick={handleCancel} disabled={isLoading}>
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="details-block">
                <div className="form-row">
                  <div className="details-g">
                    <label>Interview ID</label>
                    <p>{getdisplayprojectid(details.interview_id) || '-'}</p>
                  </div>
                  <div className="details-g">
                    <label>Application ID</label>
                    <p>{getdisplayprojectid(details.application_id) || '-'}</p>
                  </div>
                </div>
                <div className="form-row">
                  <div className="details-g">
                    <label>Organization ID</label>
                    <p>{details.orgid || '-'}</p>
                  </div>
                  <div className="details-g">
                    <label>Job Title</label>
                    <p>{`${details.job_title} minsalary-${details.min_salary} maxsalary-${details.max_salary} level-${details.level}` || '-'}</p>
                  </div>
                </div>
                <div className="form-row">
                  <div className="details-g">
                    <label>Applied Date</label>
                    <p>{formatDate(details.applieddate)}</p>
                  </div>
                </div>
                <div className="form-row">
                  <div className="details-g">
                    <label>Resume Path</label>
                    {details.resumepath ? (
                      <a href={details.resumepath} className="view-resume-link" target="_blank" rel="noopener noreferrer">
                        View Resume
                      </a>
                    ) : (
                      <span className="no-resume-text">No Resume</span>
                    )}
                  </div>
                </div>
                <div className="form-row">
                  <div className="details-g">
                    <label>Salary Expected</label>
                    <p>{details.salary_expected || '-'}</p>
                  </div>
                  <div className="details-g">
                    <label>Status</label>
                    <p>{details.status || '-'}</p>
                  </div>
                </div>
                {details.offerletter_url && (
                  <div className="form-row">
                    <div className="details-g">
                      <label>Offer Letter</label>
                      <a href={details.offerletter_url} className="view-resume-link" target="_blank" rel="noopener noreferrer">
                        View Offer Letter
                      </a>
                    </div>
                  </div>
                )}
                <div className="details-buttons">
                  <button className="edit-button" onClick={handleEditStatus}>
                    Edit Status
                  </button>
                </div>
              </div>
            )}
            {details.rounds && details.rounds.length > 0 && (
              <div className="details-block">
                <h3>Rounds</h3>
                {details.rounds.map((round, index) => (
                  <div key={`${round.Roundid}-${index}`} className="details-block">
                    <h5>Round {round.RoundNo || index + 1}</h5>
                    <div className="form-row">
                      <div className="details-g">
                        <label>Start Date</label>
                        <p>{formatDate(round.start_date)}</p>
                      </div>
                      <div className="details-g">
                        <label>Start Time</label>
                        <p>{round.start_time && round.start_am_pm ? `${round.start_time} ${round.start_am_pm}` : '-'}</p>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="details-g">
                        <label>End Date</label>
                        <p>{formatDate(round.end_date)}</p>
                      </div>
                      <div className="details-g">
                        <label>End Time</label>
                        <p>{round.end_time && round.end_am_pm ? `${round.end_time} ${round.end_am_pm}` : '-'}</p>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="details-g">
                        <label>Meeting Link</label>
                        <p>{round.meeting_link || '-'}</p>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="details-g">
                        <label>Marks</label>
                        <p>{round.marks || '-'}</p>
                      </div>
                      <div className="details-g">
                        <label>Comments</label>
                        <p>{round.comments || '-'}</p>
                      </div>
                      <div className="details-g">
                        <label>Status</label>
                        <p>{round.status || '-'}</p>
                      </div>
                    </div>
                    {round.panelMembers && round.panelMembers.length > 0 && (
                      <div>
                        <h6>Panel Members</h6>
                        <div className="table-wrapper">
                          <table className="service-requests-table">
                            <thead>
                              <tr>
                                <th>Employee ID</th>
                                <th>Email</th>
                                <th>Is Employee</th>
                              </tr>
                            </thead>
                            <tbody>
                              {round.panelMembers.map((member, memberIndex) => (
                                <tr key={`${round.Roundid}-member-${memberIndex}`}>
                                  <td className="id-cell">
                                    <span className="role-indicator"></span>
                                    {member.empid ? getdisplayid(member.empid) : '-'}
                                  </td>
                                  <td>{member.email || '-'}</td>
                                  <td className={member.is_he_employee === 1 ? 'status-badge active' : 'status-badge inactive'}>
                                    {member.is_he_employee === 1 ? 'Yes' : 'No'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="details-block">
            <h3>Address Details</h3>
            <div className="form-row">
              <div className="details-g">
                <label>Address Line 1</label>
                <p>{details.addresslane1 || '-'}</p>
              </div>
              <div className="details-g">
                <label>Address Line 2</label>
                <p>{details.addresslane2 || '-'}</p>
              </div>
            </div>
            <div className="form-row">
              <div className="details-g">
                <label>Zip Code</label>
                <p>{details.zipcode || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Details;
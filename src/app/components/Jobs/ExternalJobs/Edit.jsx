'use client';

import React, { useState, useEffect } from 'react';
import { updateExternalJob, fetchExternalJobById } from '@/app/serverActions/Jobs/ExternalJobs/Overview';
import './externaljobs.css';

const Edit = ({ job, orgid, expectedjobtitles, expectedepartment, expectedrole, countries, states, jobtype }) => {
  const [jobDetails, setJobDetails] = useState(null);
  const [formData, setFormData] = useState({
    jobid: '',
    displayJobName: '',
    expectedJobTitle: '',
    expectedRole: '',
    expectedDepartment: '',
    jobType: '',
    description: '',
    noOfVacancies: '',
    addressLane1: '',
    addressLane2: '',
    zipcode: '',
    stateId: '',
    countryId: '',
    customStateName: 'N/A',
    lastDateForApplication: '',
    active: '1',
    createdBy: '',
    lastUpdatedBy: '',
    postedDate: '',
  });
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingAdditional, setEditingAdditional] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);


  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  useEffect(() => {
    const loadJobDetails = async () => {
      if (!job.jobid) {
        setJobDetails(null);
        setFormData({
          jobid: '',
          displayJobName: '',
          expectedJobTitle: '',
          expectedRole: '',
          expectedDepartment: '',
          jobType: '',
          description: '',
          noOfVacancies: '',
          addressLane1: '',
          addressLane2: '',
          zipcode: '',
          stateId: '',
          countryId: '',
          customStateName: 'N/A',
          lastDateForApplication: '',
          active: '1',
          createdBy: '',
          lastUpdatedBy: '',
          postedDate: '',
        });
        return;
      }
      try {
        setIsLoading(true);
        const details = await fetchExternalJobById(job.jobid);
        setJobDetails(details);
        setFormData({
          jobid: details.jobid || '',
          displayJobName: details.display_job_name || '',
          expectedJobTitle: details.expected_job_title ? String(details.expected_job_title) : '',
          expectedRole: details.expected_role ? String(details.expected_role) : '',
          expectedDepartment: details.expected_department ? String(details.expected_department) : '',
          jobType: details.job_type ? String(details.job_type) : '',
          description: details.description || '',
          noOfVacancies: details.no_of_vacancies ? String(details.no_of_vacancies) : '',
          addressLane1: details.addresslane1 || '',
          addressLane2: details.addresslane2 || '',
          zipcode: details.zipcode || '',
          stateId: details.stateid ? String(details.stateid) : '',
          countryId: details.countryid ? String(details.countryid) : '',
          customStateName: details.custom_state_name || 'N/A',
          lastDateForApplication: details.lastdate_for_application ? new Date(details.lastdate_for_application).toISOString().split('T')[0] : '',
          active: details.active ? '1' : '0',
          createdBy: details.created_by || '',
          lastUpdatedBy: details.last_updated_by || '',
          postedDate: details.posteddate ? new Date(details.posteddate).toISOString().split('T')[0] : '',
        });
        setError(null);
      } catch (error) {
        setError(error.message);
        setJobDetails(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadJobDetails();
  }, [job.jobid]);

  const formatDate = (date) => {
    if (!date) return '';
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEdit = (section) => {
    if (section === 'basic') setEditingBasic(true);
    if (section === 'additional') setEditingAdditional(true);
  };

  const handleSave = async (section) => {
    if (section === 'basic') {
      if (!formData.displayJobName) {
        setError('Display Job Name is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.expectedJobTitle) {
        setError('Expected Job Title is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.expectedRole) {
        setError('Expected Role is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.expectedDepartment) {
        setError('Expected Department is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.jobType) {
        setError('Job Type is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.noOfVacancies || isNaN(parseInt(formData.noOfVacancies))) {
        setError('Number of Vacancies is required and must be a valid number.');
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    const formDataToSubmit = new FormData();
    formDataToSubmit.append('jobid', formData.jobid);
    formDataToSubmit.append('section', section);

    if (section === 'basic') {
      formDataToSubmit.append('displayJobName', formData.displayJobName);
      formDataToSubmit.append('expectedJobTitle', formData.expectedJobTitle);
      formDataToSubmit.append('expectedRole', formData.expectedRole);
      formDataToSubmit.append('expectedDepartment', formData.expectedDepartment);
      formDataToSubmit.append('jobType', formData.jobType);
      formDataToSubmit.append('description', formData.description);
      formDataToSubmit.append('noOfVacancies', formData.noOfVacancies);
    } else if (section === 'additional') {
      formDataToSubmit.append('addressLane1', formData.addressLane1);
      formDataToSubmit.append('addressLane2', formData.addressLane2);
      formDataToSubmit.append('zipcode', formData.zipcode);
      formDataToSubmit.append('stateId', formData.stateId);
      formDataToSubmit.append('countryId', formData.countryId);
      formDataToSubmit.append('customStateName', formData.customStateName);
      formDataToSubmit.append('lastDateForApplication', formData.lastDateForApplication);
      formDataToSubmit.append('active', formData.active);
    }

    try {
      const result = await updateExternalJob(formDataToSubmit);
      if (result?.success) {
        const updatedJob = await fetchExternalJobById(formData.jobid);
        setJobDetails(updatedJob);
        setFormData({
          jobid: updatedJob.jobid || '',
          displayJobName: updatedJob.display_job_name || '',
          expectedJobTitle: updatedJob.expected_job_title ? String(updatedJob.expected_job_title) : '',
          expectedRole: updatedJob.expected_role ? String(updatedJob.expected_role) : '',
          expectedDepartment: updatedJob.expected_department ? String(updatedJob.expected_department) : '',
          jobType: updatedJob.job_type ? String(updatedJob.job_type) : '',
          description: updatedJob.description || '',
          noOfVacancies: updatedJob.no_of_vacancies ? String(updatedJob.no_of_vacancies) : '',
          addressLane1: updatedJob.addresslane1 || '',
          addressLane2: updatedJob.addresslane2 || '',
          zipcode: updatedJob.zipcode || '',
          stateId: updatedJob.stateid ? String(updatedJob.stateid) : '',
          countryId: updatedJob.countryid ? String(updatedJob.countryid) : '',
          customStateName: updatedJob.custom_state_name || 'N/A',
          lastDateForApplication: updatedJob.lastdate_for_application ? new Date(updatedJob.lastdate_for_application).toISOString().split('T')[0] : '',
          active: updatedJob.active ? '1' : '0',
          createdBy: updatedJob.created_by || '',
          lastUpdatedBy: updatedJob.last_updated_by || '',
          postedDate: updatedJob.posteddate ? new Date(updatedJob.posteddate).toISOString().split('T')[0] : '',
        });
        if (section === 'basic') setEditingBasic(false);
        if (section === 'additional') setEditingAdditional(false);
        setError(null);
        setSuccessMessage('External job updated successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result?.error || 'Failed to update external job.');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayValue = (value, options, key) => {
    if (!value || !options) return '-';
    const option = options.find((opt) => String(opt[key]) === String(value));
    if (!option) return '-';
    if (key === 'job_title_id') {
      return `${option.job_title} (Level: ${option.level || 'N/A'}, Salary Range: $${option.min_salary || 'N/A'} - $${option.max_salary || 'N/A'})`;
    }
    if (key === 'roleid') return option.rolename || '-';
    if (key === 'id' && options === expectedepartment) return option.name || '-';
    if (key === 'id' && options === jobtype) return option.Name || '-';
    return '-';
  };

  const getCountryName = (countryId) => {
    if (!countryId) return 'No Country';
    const country = countries.find((c) => String(c.ID) === String(countryId));
    return country ? country.VALUE : 'No Country';
  };

  const getStateName = (stateId) => {
    if (!stateId) return 'No State';
    const state = states.find((s) => String(s.ID) === String(stateId));
    return state ? state.VALUE : 'No State';
  };

  return (
    <div className="employee-details-container">
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      {isLoading && <div className="loading-message">Loading...</div>}
      {jobDetails && (
        <>
          <div className="details-block">
            <h3>Basic Details</h3>
            {editingBasic ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave('basic'); }} className="external-jobs-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Display Job Name*:</label>
                    <input
                      type="text"
                      name="displayJobName"
                      value={formData.displayJobName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Expected Job Title*:</label>
                    <select
                      name="expectedJobTitle"
                      value={formData.expectedJobTitle}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Job Title</option>
                      {expectedjobtitles.map((title) => (
                        <option key={title.job_title_id} value={title.job_title_id}>
                          {`${title.job_title} (Level: ${title.level || 'N/A'}, Salary Range: $${title.min_salary || 'N/A'} - $${title.max_salary || 'N/A'})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Expected Role*:</label>
                    <select
                      name="expectedRole"
                      value={formData.expectedRole}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Role</option>
                      {expectedrole.map((role) => (
                        <option key={role.roleid} value={role.roleid}>
                          {role.rolename}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Expected Department*:</label>
                    <select
                      name="expectedDepartment"
                      value={formData.expectedDepartment}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Department</option>
                      {expectedepartment.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Job Type*:</label>
                    <select
                      name="jobType"
                      value={formData.jobType}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Job Type</option>
                      {jobtype.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.Name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Number of Vacancies*:</label>
                    <input
                      type="number"
                      name="noOfVacancies"
                      value={formData.noOfVacancies}
                      onChange={handleChange}
                      required
                     
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Description*:</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      required
                      maxLength="300"
                    />
                  </div>
                </div>
                <div className="form-buttons">
                  <button type="submit" className="save-button" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="cancel-button" onClick={() => setEditingBasic(false)} disabled={isLoading}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="view-details">
                <div className="details-row">
                  <div className="details-group">
                    <label>Job ID:</label>
                    <p>{getdisplayprojectid(jobDetails.jobid) || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>Display Job Name:</label>
                    <p>{jobDetails.display_job_name || '-'}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Expected Job Title:</label>
                    <p>{getDisplayValue(jobDetails.expected_job_title, expectedjobtitles, 'job_title_id')}</p>
                  </div>
                  <div className="details-group">
                    <label>Expected Role:</label>
                    <p>{getDisplayValue(jobDetails.expected_role, expectedrole, 'roleid')}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Expected Department:</label>
                    <p>{getDisplayValue(jobDetails.expected_department, expectedepartment, 'id')}</p>
                  </div>
                  <div className="details-group">
                    <label>Job Type:</label>
                    <p>{getDisplayValue(jobDetails.job_type, jobtype, 'id')}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Number of Vacancies:</label>
                    <p>{jobDetails.no_of_vacancies || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>Description:</label>
                    <p>{jobDetails.description || '-'}</p>
                  </div>
                </div>
                <div className="details-buttons">
                  <button className="edit-button" onClick={() => handleEdit('basic')}>Edit</button>
                </div>
              </div>
            )}
          </div>

          <div className="details-block">
            <h3>Additional Details</h3>
            {editingAdditional ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave('additional'); }} className="external-jobs-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Address Lane 1:</label>
                    <input
                      type="text"
                      name="addressLane1"
                      value={formData.addressLane1}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Address Lane 2:</label>
                    <input
                      type="text"
                      name="addressLane2"
                      value={formData.addressLane2}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Zipcode:</label>
                    <input
                      type="text"
                      name="zipcode"
                      value={formData.zipcode}
                      onChange={handleChange}
                      maxLength="20"
                    />
                  </div>
                  <div className="form-group">
                    <label>Country:</label>
                    <select
                      name="countryId"
                      value={formData.countryId}
                      onChange={handleChange}
                    >
                      <option value="">Select Country</option>
                      {countries.map((country) => (
                        <option key={country.ID} value={country.ID}>
                          {country.VALUE}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>State:</label>
                    <select
                      name="stateId"
                      value={formData.stateId}
                      onChange={handleChange}
                    >
                      <option value="">Select State</option>
                      {states.map((state) => (
                        <option key={state.ID} value={state.ID}>
                          {state.VALUE}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Custom State Name:</label>
                    <input
                      type="text"
                      name="customStateName"
                      value={formData.customStateName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Last Date for Application:</label>
                    <input
                      type="date"
                      name="lastDateForApplication"
                      value={formData.lastDateForApplication}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Active:</label>
                    <select
                      name="active"
                      value={formData.active}
                      onChange={handleChange}
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Created By:</label>
                    <input
                      type="text"
                      name="createdBy"
                      value={formData.createdBy}
                      readOnly
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="form-group">
                    <label>Posted Date:</label>
                    <input
                      type="text"
                      name="postedDate"
                      value={formatDate(formData.postedDate)}
                      readOnly
                      className="bg-gray-100"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Last Updated By:</label>
                    <input
                      type="text"
                      name="lastUpdatedBy"
                      value={formData.lastUpdatedBy}
                      readOnly
                      className="bg-gray-100"
                    />
                  </div>
                </div>
                <div className="form-buttons">
                  <button type="submit" className="save-button" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="cancel-button" onClick={() => setEditingAdditional(false)} disabled={isLoading}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="view-details">
                <div className="details-row">
                  <div className="details-group">
                    <label>Address Lane 1:</label>
                    <p>{jobDetails.addresslane1 || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>Address Lane 2:</label>
                    <p>{jobDetails.addresslane2 || '-'}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Zipcode:</label>
                    <p>{jobDetails.zipcode || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>Country:</label>
                    <p>{getCountryName(jobDetails.countryid)}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>State:</label>
                    <p>{getStateName(jobDetails.stateid)}</p>
                  </div>
                  <div className="details-group">
                    <label>Custom State Name:</label>
                    <p>{jobDetails.custom_state_name || '-'}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Posted Date:</label>
                    <p>{formatDate(jobDetails.posteddate) || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>Last Date for Application:</label>
                    <p>{formatDate(jobDetails.lastdate_for_application) || '-'}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Active:</label>
                    <p>{jobDetails.active ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div className="details-group">
                    <label>Created By:</label>
                    <p>{jobDetails.created_by || '-'}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Last Updated By:</label>
                    <p>{jobDetails.last_updated_by || '-'}</p>
                  </div>
                </div>
                <div className="details-buttons">
                  <button className="edit-button" onClick={() => handleEdit('additional')}>Edit</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Edit;
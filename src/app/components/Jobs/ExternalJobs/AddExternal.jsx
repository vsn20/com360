'use client';

import React, { useState, useEffect } from 'react';
import { useActionState } from 'react';
import { addExternalJob } from '@/app/serverActions/Jobs/ExternalJobs/AddExternaljobs';
import './externaljobs.css';

const addFormInitialState = { error: null, success: false };

const AddExternal = ({ orgid, empid, expectedjobtitles, expectedepartment, expectedrole, countries, states, jobtype }) => {
  const [formData, setFormData] = useState({
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
    countryId: '185', // Default to USA, consistent with Overview.jsx
    customStateName: '',
    lastDateForApplication: '',
    active: '1',
  });
  const [successMessage, setSuccessMessage] = useState(null);
  const [state, formAction] = useActionState(addExternalJob, addFormInitialState);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  useEffect(() => {
    if (state.success) {
      setFormData({
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
        countryId: '185', // Reset to USA
        customStateName: '',
        lastDateForApplication: '',
        active: '1',
      });
      setSuccessMessage('External job added successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  }, [state.success]);

  return (
    <div className="employee-overview-container">
      <h2>Add External Job</h2>
      {state.error && <div className="error-message">{state.error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      <form action={formAction} className="external-jobs-form">
        <div className="details-block">
          <h3>Basic Details</h3>
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
        </div>

        <div className="details-block">
          <h3>Additional Details</h3>
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
                disabled={formData.countryId !== '185'}
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
                disabled={formData.countryId === '185'}
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
        </div>

        <div className="form-buttons">
          <button type="submit" className="save-button" disabled={!orgid}>
            Add External Job
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddExternal;
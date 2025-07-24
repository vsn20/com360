// app/components/Jobs/JobTitle/EditJobTitle.jsx
'use client';
import React, { useEffect, useState } from 'react';
import { getjobdetailsbyid, updatejobtitle } from '@/app/serverActions/Jobs/Overview';
import './jobtitles.css';

const EditJobTitle = ({ selectedjobid, orgid, empid }) => {
  const [jobDetails, setJobDetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    jobtitle: '',
    status: 'Active',
    minsalary: '',
    maxsalary: '',
    level: '',
    jobid: '',
    org_id: '',
    createdby: '',
    createddate: '',
    updatedby: '',
    updateddate: '',
  });


  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };
  

  useEffect(() => {
    const loadJobDetails = async () => {
      if (!selectedjobid) {
        setJobDetails(null);
        setForm({
          jobtitle: '',
          status: 'Active',
          minsalary: '',
          maxsalary: '',
          level: '',
          jobid: '',
          org_id: '',
          createdby: '',
          createddate: '',
          updatedby: '',
          updateddate: '',
        });
        return;
      }
      try {
        setIsLoading(true);
        const details = await getjobdetailsbyid(selectedjobid);
        setJobDetails(details);
        setForm({
          jobtitle: details.job_title || '',
          status: details.is_active ? 'Active' : 'Inactive',
          minsalary: details.min_salary || '',
          maxsalary: details.max_salary || '',
          level: details.level || '',
          jobid: details.job_title_id || '',
          org_id: details.orgid || '',
          createdby: details.Createdby || '',
          createddate: details.CreatedDate ? new Date(details.CreatedDate).toISOString().split('T')[0] : '',
          updatedby: details.Updatedby || '',
          updateddate: details.UpdatedDate ? new Date(details.UpdatedDate).toISOString().split('T')[0] : '',
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
  }, [selectedjobid]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (!form.jobtitle) {
      setError('Job Title is required.');
      setIsLoading(false);
      return;
    }

    if (form.minsalary && form.maxsalary && parseFloat(form.maxsalary) < parseFloat(form.minsalary)) {
      setError('Maximum salary cannot be less than minimum salary.');
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value);
    });

    try {
      const result = await updatejobtitle(formData);
      if (result?.success) {
        setSuccess('Job Title updated successfully.');
        setIsEditing(false);
        const updatedDetails = await getjobdetailsbyid(selectedjobid);
        setJobDetails(updatedDetails);
        setForm({
          jobtitle: updatedDetails.job_title || '',
          status: updatedDetails.is_active ? 'Active' : 'Inactive',
          minsalary: updatedDetails.min_salary || '',
          maxsalary: updatedDetails.max_salary || '',
          level: updatedDetails.level || '',
          jobid: updatedDetails.job_title_id || '',
          org_id: updatedDetails.orgid || '',
          createdby: updatedDetails.Createdby || '',
          createddate: updatedDetails.CreatedDate ? new Date(updatedDetails.CreatedDate).toISOString().split('T')[0] : '',
          updatedby: updatedDetails.Updatedby || '',
          updateddate: updatedDetails.UpdatedDate ? new Date(updatedDetails.UpdatedDate).toISOString().split('T')[0] : '',
        });
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result?.error || 'Failed to update job title.');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      // Use local date components to preserve YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      // If it's already a date string (YYYY-MM-DD), return it as is
      return date.split('T')[0];
    }
    return ''; // Fallback for invalid dates
  };

  return (
    <div className="employee-details-container">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {isLoading && <div className="loading-message">Loading...</div>}
      {jobDetails && (
        <div className="details-block">
          <h3>Job Title Details</h3>
          {isEditing ? (
            <form onSubmit={handleSave}>
              <div className="form-row">
                {/* <div className="form-group">
                  <label>Job ID</label>
                  <input type="text" value={form.jobid} readOnly className="bg-gray-100" />
                </div>
                <div className="form-group">
                  <label>Organization ID</label>
                  <input type="text" value={form.org_id} readOnly className="bg-gray-100" />
                </div> */}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Job Title*</label>
                  <input
                    type="text"
                    name="jobtitle"
                    value={form.jobtitle}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={form.status} onChange={handleFormChange}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Minimum Salary</label>
                  <input
                    type="number"
                    name="minsalary"
                    value={form.minsalary}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="form-group">
                  <label>Maximum Salary</label>
                  <input
                    type="number"
                    name="maxsalary"
                    value={form.maxsalary}
                    onChange={handleFormChange}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Level</label>
                  <input
                    type="text"
                    name="level"
                    value={form.level}
                    onChange={handleFormChange}
                  />
                </div>
              </div>
              <div className="form-row">
                {/* <div className="form-group">
                  <label>Created By</label>
                  <input type="text" value={form.createdby} readOnly className="bg-gray-100" />
                </div>
                <div className="form-group">
                  <label>Created Date</label>
                  <input type="text" value={formatDate(form.createddate)} readOnly className="bg-gray-100" />
                </div> */}
              </div>
              <div className="form-buttons">
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
            </form>
          ) : (
            <div className="view-details">
              <div className="details-row">
                <div className="details-group">
                  <label>Job ID</label>
                  <p>{jobDetails.job_title_id.split('-')[1] || jobDetails.job_title_id}</p>
                </div>
                <div className="details-group">
                  <label>Organization ID</label>
                  <p>{jobDetails.orgid}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-group">
                  <label>Job Title</label>
                  <p>{jobDetails.job_title || '-'}</p>
                </div>
                <div className="details-group">
                  <label>Status</label>
                  <p>{jobDetails.is_active ? 'Active' : 'Inactive'}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-group">
                  <label>Minimum Salary</label>
                  <p>{jobDetails.min_salary || '-'}</p>
                </div>
                <div className="details-group">
                  <label>Maximum Salary</label>
                  <p>{jobDetails.max_salary || '-'}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-group">
                  <label>Level</label>
                  <p>{jobDetails.level || '-'}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-group">
                  <label>Created By</label>
                  <p>{jobDetails.Createdby || '-'}</p>
                </div>
                <div className="details-group">
                  <label>Created Date</label>
                  <p>{formatDate(jobDetails.CreatedDate)}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-group">
                  <label>Updated By</label>
                  <p>{jobDetails.Updatedby || '-'}</p>
                </div>
                <div className="details-group">
                  <label>Updated Date</label>
                  <p>{formatDate(jobDetails.UpdatedDate)}</p>
                </div>
              </div>
              <div className="details-buttons">
                <button className="edit-button" onClick={handleEdit}>
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditJobTitle;
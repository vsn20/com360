'use client';
import React, { useEffect, useState } from 'react';
import { getjobdetailsbyid, updatejobtitle } from '@/app/serverActions/Jobs/Overview';
import './jobtitles.css';
import { useRouter } from 'next/navigation';

const EditJobTitle = ({ selectedjobid, orgid, empid }) => {
  const router = useRouter();
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
        setTimeout(() => {
          setSuccess(null);
          router.refresh();
        }, 3000);
      } else {
        setError(result?.error || 'Failed to update job title.');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setForm({
      jobtitle: jobDetails?.job_title || '',
      status: jobDetails?.is_active ? 'Active' : 'Inactive',
      minsalary: jobDetails?.min_salary || '',
      maxsalary: jobDetails?.max_salary || '',
      level: jobDetails?.level || '',
      jobid: jobDetails?.job_title_id || '',
      org_id: jobDetails?.orgid || '',
      createdby: jobDetails?.Createdby || '',
      createddate: jobDetails?.CreatedDate ? new Date(jobDetails.CreatedDate).toISOString().split('T')[0] : '',
      updatedby: jobDetails?.Updatedby || '',
      updateddate: jobDetails?.UpdatedDate ? new Date(jobDetails.UpdatedDate).toISOString().split('T')[0] : '',
    });
    setError(null);
  };

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

  return (
    <div className="employee-details-container">
      {isLoading && <div className="loading-message">Loading...</div>}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {jobDetails && (
        <div className="details-block">
          <div className="roledetails-header">
            <div>Job Title Details</div>
            {!isEditing && (
              <button className="button" onClick={handleEdit}>
                Edit
              </button>
            )}
          </div>
          {isEditing ? (
            <form onSubmit={handleSave}>
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
                    <option value="Active">Yes</option>
                    <option value="Inactive">No</option>
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
              <div className="form-buttons">
                <button type="submit" className="save" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="cancel" onClick={handleCancel} disabled={isLoading}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="view-details">
              <div className="details-row">
                <div className="details-g">
                  <label>Job ID</label>
                  <p>{getdisplayprojectid(form.jobid)}</p>
                </div>
                <div className="details-g">
                  <label>Job Title</label>
                  <p>{form.jobtitle || '-'}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-g">
                  <label>Status</label>
                  <p>{form.status}</p>
                </div>
                <div className="details-g">
                  <label>Minimum Salary</label>
                  <p>{form.minsalary || '-'}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-g">
                  <label>Maximum Salary</label>
                  <p>{form.maxsalary || '-'}</p>
                </div>
                <div className="details-g">
                  <label>Level</label>
                  <p>{form.level || '-'}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-g">
                  <label>Created By</label>
                  <p>{form.createdby || '-'}</p>
                </div>
                <div className="details-g">
                  <label>Created Date</label>
                  <p>{formatDate(form.createddate) || '-'}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-g">
                  <label>Updated By</label>
                  <p>{form.updatedby || '-'}</p>
                </div>
                <div className="details-g">
                  <label>Updated Date</label>
                  <p>{formatDate(form.updateddate) || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditJobTitle;
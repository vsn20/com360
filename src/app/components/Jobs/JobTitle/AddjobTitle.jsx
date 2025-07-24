// app/components/Jobs/JobTitle/AddjobTitle.jsx
'use client';
import React, { useState } from 'react';
import { addjobtitle } from '@/app/serverActions/Jobs/AddJobs';
import { useRouter } from 'next/navigation';
import './jobtitles.css';

const AddjobTitle = ({ orgid, empid }) => {
  const router = useRouter();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    jobtitle: '',
    status: 'Active',
    minsalary: '',
    maxsalary: '',
    level: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!form.jobtitle) {
      setError('Job Title is required.');
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const result = await addjobtitle(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setForm({
        jobtitle: '',
        status: 'Active',
        minsalary: '',
        maxsalary: '',
        level: '',
      });
      setSuccess('Job Title added successfully.');
      setTimeout(() => {
        setSuccess('');
        router.refresh();
      }, 3000);
    }
    setIsLoading(false);
  };

  return (
    <div className="employee-details-container">
      <h2>Add Job Title</h2>
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading-message">Saving...</div>}
      <form onSubmit={handleSubmit} className="details-block">
        <h3>Job Title Details</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Organization ID</label>
            <input type="text" value={orgid || ''} readOnly className="bg-gray-100" />
          </div>
          <div className="form-group">
            <label>Job Title*</label>
            <input
              type="text"
              name="jobtitle"
              value={form.jobtitle}
              onChange={handleChange}
              placeholder="Enter Job Title"
              required
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Minimum Salary</label>
            <input
              type="number"
              name="minsalary"
              value={form.minsalary}
              onChange={handleChange}
              placeholder="Enter Minimum Salary"
            />
          </div>
          <div className="form-group">
            <label>Maximum Salary</label>
            <input
              type="number"
              name="maxsalary"
              value={form.maxsalary}
              onChange={handleChange}
              placeholder="Enter Maximum Salary"
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
              onChange={handleChange}
              placeholder="Enter Level"
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-buttons">
          <button type="submit" className="save-button" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Add Job Title'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddjobTitle;
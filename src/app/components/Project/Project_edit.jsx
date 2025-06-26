'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchprojectbyid, fetchaccountsbyorgid, updateproject } from '@/app/serverActions/Projects/overview';
import './projectedit.css';

const Project_edit = () => {
  const router = useRouter();
  const params = useParams();
  const { PRJ_ID } = params;

  const [formData, setFormData] = useState({
    prjId: '',
    prjName: '',
    prsDesc: '',
    accntId: '',
    billRate: '',
    billType: '',
    otBillRate: '',
    otBillType: '',
    billableFlag: 'No',
    startDt: '',
    endDt: '',
    clientId: '',
    payTerm: '',
    invoiceEmail: '',
    invoiceFax: '',
    invoicePhone: '',
  });

  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!PRJ_ID) throw new Error('Project ID is missing');
        const projectData = await fetchprojectbyid(PRJ_ID);
        console.log('Raw project data from fetch:', projectData); // Debug raw data

        // Enhanced date handling with timezone correction
        const formatDate = (date) => {
          if (!date || date === '0000-00-00' || date === null) {
            return ''; // Empty string for invalid/null dates
          }
          if (date instanceof Date && !isNaN(date)) {
            // Adjust for timezone offset (IST is UTC+5:30)
            const offset = date.getTimezoneOffset() * 60000; // Convert to milliseconds
            const localDate = new Date(date.getTime() - offset);
            return localDate.toISOString().split('T')[0]; // YYYY-MM-DD
          }
          // Handle if date is already a string (e.g., from database)
          const dateObj = new Date(date);
          if (!isNaN(dateObj)) {
            return dateObj.toISOString().split('T')[0];
          }
          return ''; // Fallback for unexpected formats
        };

        console.log('Formatted START_DT:', formatDate(projectData.START_DT)); // Debug formatted date
        console.log('Formatted END_DT:', formatDate(projectData.END_DT)); // Debug formatted date

        setFormData({
          prjId: projectData.PRJ_ID || '',
          prjName: projectData.PRJ_NAME || '',
          prsDesc: projectData.PRS_DESC || '', // Using PRS_DESC
          accntId: projectData.ACCNT_ID || '',
          billRate: projectData.BILL_RATE || '',
          billType: projectData.BILL_TYPE || '',
          otBillRate: projectData.OT_BILL_RATE || '',
          otBillType: projectData.OT_BILL_TYPE || '',
          billableFlag: projectData.BILLABLE_FLAG ? 'Yes' : 'No',
          startDt: formatDate(projectData.START_DT),
          endDt: formatDate(projectData.END_DT),
          clientId: projectData.CLIENT_ID || '',
          payTerm: projectData.PAY_TERM || '',
          invoiceEmail: projectData.INVOICE_EMAIL || '',
          invoiceFax: projectData.INVOICE_FAX || '',
          invoicePhone: projectData.INVOICE_PHONE || '',
        });

        const accountsData = await fetchaccountsbyorgid();
        setAccounts(accountsData);
        setError(null);
      } catch (err) {
        console.error('Error loading project data:', err);
        setError(err.message);
      }
    };
    loadData();
  }, [PRJ_ID]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formDataToSubmit = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSubmit.append(key, value || ''); // Ensure empty values are sent
    });

    try {
      const result = await updateproject(null, formDataToSubmit);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => router.push('/userscreens/project/overview'), 2000);
      } else {
        setError(result.error || 'Update failed');
      }
    } catch (err) {
      console.error('Error updating project:', err);
      setError(err.message);
    }
  };

  return (
    <div className="project-edit-container">
      <h2>Edit Project</h2>
      {success && <div className="success-message">Project updated successfully! Redirecting...</div>}
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Project ID*:</label>
          <input
            type="text"
            name="prjId"
            value={formData.prjId}
            onChange={handleChange}
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div>
          <label>Project Name*:</label>
          <input
            type="text"
            name="prjName"
            value={formData.prjName}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Description:</label>
          <input
            type="text"
            name="prsDesc"
            value={formData.prsDesc}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Account*:</label>
          <select
            name="accntId"
            value={formData.accntId}
            onChange={handleChange}
            required
          >
            <option value="">Select Account</option>
            {accounts.map((account) => (
              <option key={account.ACCNT_ID} value={account.ACCNT_ID}>
                {account.ALIAS_NAME || account.ACCNT_ID}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Bill Rate:</label>
          <input
            type="number"
            step="0.01"
            name="billRate"
            value={formData.billRate}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Bill Type:</label>
          <select
            name="billType"
            value={formData.billType}
            onChange={handleChange}
          >
            <option value="">Select Type</option>
            <option value="hourly">Hourly</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
        <div>
          <label>OT Bill Rate:</label>
          <input
            type="number"
            step="0.01"
            name="otBillRate"
            value={formData.otBillRate}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>OT Bill Type:</label>
          <select
            name="otBillType"
            value={formData.otBillType}
            onChange={handleChange}
          >
            <option value="">Select Type</option>
            <option value="hourly">Hourly</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
        <div>
          <label>Billable:</label>
          <select
            name="billableFlag"
            value={formData.billableFlag}
            onChange={handleChange}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
        <div>
          <label>Start Date:</label>
          <input
            type="date"
            name="startDt"
            value={formData.startDt}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>End Date:</label>
          <input
            type="date"
            name="endDt"
            value={formData.endDt}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Client*:</label>
          <select
            name="clientId"
            value={formData.clientId}
            onChange={handleChange}
            required
          >
            <option value="">Select Client</option>
            {accounts.map((account) => (
              <option key={account.ACCNT_ID} value={account.ACCNT_ID}>
                {account.ALIAS_NAME || account.ACCNT_ID}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Payment Term:</label>
          <select
            name="payTerm"
            value={formData.payTerm}
            onChange={handleChange}
          >
            <option value="">Select Term</option>
            <option value="net30">Net 30</option>
            <option value="net60">Net 60</option>
          </select>
        </div>
        <div>
          <label>Invoice Email:</label>
          <input
            type="email"
            name="invoiceEmail"
            value={formData.invoiceEmail}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Invoice Fax:</label>
          <input
            type="text"
            name="invoiceFax"
            value={formData.invoiceFax}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Invoice Phone:</label>
          <input
            type="text"
            name="invoicePhone"
            value={formData.invoicePhone}
            onChange={handleChange}
          />
        </div>
        <button type="submit">Update Project</button>
      </form>
    </div>
  );
};

export default Project_edit;
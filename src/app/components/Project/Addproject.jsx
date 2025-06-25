'use client';
import React, { useState, useEffect, useTransition } from 'react';
import { addProject, fetchAccountsByOrgId } from '@/app/serverActions/Projects/AddprojectAction';
import { useActionState } from 'react';
import './addproject.css'
// Ensure this is the correct CSS path

const initialState = { error: null, success: false };

const Addproject = ({ orgId }) => {
  const [formData, setFormData] = useState({
    prjName: '',
    prsDesc: '',
    accntId: '',
    orgId: orgId || '', // Set from props, defaults to empty string if null
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
  const [state, formAction] = useActionState(addProject, initialState);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (orgId) {
          const accountsData = await fetchAccountsByOrgId(parseInt(orgId, 10)); // Parse to INT
          setAccounts(accountsData);
        } else {
          setAccounts([]); // Clear accounts if orgId is null
          console.warn('No valid orgId provided, accounts not fetched');
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, [orgId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Reset form and show success message on successful submission
  useEffect(() => {
    if (state.success) {
      setFormData({
        prjName: '',
        prsDesc: '',
        accntId: '',
        orgId: orgId || '',
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
    }
  }, [state.success, orgId]);

  return (
    <div className="add-account-container">
      <h2>Project Details</h2>
      {state.success && <div className="success-message">Form added successfully!</div>}
      {state.error && <div className="error-message">{state.error}</div>}
      <form action={formAction}>
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
            disabled={!orgId}
          >
            <option value="">Select Account</option>
            {accounts.map((account) => (
              <option key={account.ACCNT_ID} value={account.ACCNT_ID}>
                {account.ALIAS_NAME}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Organization*:</label>
          <input
            type="number"
            name="orgId"
            value={orgId || ''} // Use prop directly, read-only
            readOnly
            className="bg-gray-100"
          />
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
            placeholder="mm/dd/yyyy"
          />
        </div>
        <div>
          <label>End Date:</label>
          <input
            type="date"
            name="endDt"
            value={formData.endDt}
            onChange={handleChange}
            placeholder="mm/dd/yyyy"
          />
        </div>
        <div>
          <label>Client*:</label>
          <select
            name="clientId"
            value={formData.clientId}
            onChange={handleChange}
            required
            disabled={!orgId}
          >
            <option value="">Select Client</option>
            {accounts.map((account) => (
              <option key={account.ACCNT_ID} value={account.ACCNT_ID}>
                {account.ALIAS_NAME}
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

        <button type="submit" disabled={!orgId}>Add Project</button>
      </form>
    </div>
  );
};

export default Addproject;
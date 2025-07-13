'use client';

import React, { useState, useEffect } from 'react';
import { addProject, fetchAccountsByOrgId } from '@/app/serverActions/Projects/AddprojectAction';
import { useActionState } from 'react';
import './addproject.css';

const initialState = { error: null, success: false };

const Addproject = ({ orgId, billTypes, otBillTypes, payTerms }) => {
  const [formData, setFormData] = useState({
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

  const [accounts, setAccounts] = useState([]);
  const [state, formAction] = useActionState(addProject, initialState);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (orgId) {
          const accountsData = await fetchAccountsByOrgId(parseInt(orgId, 10));
          setAccounts(accountsData);
        } else {
          setAccounts([]);
          console.warn('No valid orgId provided, accounts not fetched');
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
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

  // Custom form action to include generic values in FormData
  const enhancedFormAction = async (formData) => {
    formData.append('billTypes', JSON.stringify(billTypes));
    formData.append('otBillTypes', JSON.stringify(otBillTypes));
    formData.append('payTerms', JSON.stringify(payTerms));
    return formAction(formData);
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
    <div className="project-overview-container">
      <h2>Add Project</h2>
      {state.success && <div className="success-message">Project added successfully!</div>}
      {state.error && <div className="error-message">{state.error}</div>}
      <form action={enhancedFormAction} className="project-details-container">
        {/* Basic Details Block */}
        <div className="details-block">
          <h3>Basic Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Project Name*:</label>
              <input
                type="text"
                name="prjName"
                value={formData.prjName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Description:</label>
              <input
                type="text"
                name="prsDesc"
                value={formData.prsDesc}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
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
            <div className="form-group">
              <label>Organization*:</label>
              <input
                type="number"
                name="orgId"
                value={orgId || ''}
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Additional Details Block */}
        <div className="details-block">
          <h3>Additional Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Bill Rate:</label>
              <input
                type="number"
                step="0.01"
                name="billRate"
                value={formData.billRate}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Bill Type:</label>
              <select
                name="billType"
                value={formData.billType}
                onChange={handleChange}
              >
                <option value="">Select Type</option>
                {billTypes.map((type) => (
                  <option key={type.id} value={type.Name}>
                    {type.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>OT Bill Rate:</label>
              <input
                type="number"
                step="0.01"
                name="otBillRate"
                value={formData.otBillRate}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>OT Bill Type:</label>
              <select
                name="otBillType"
                value={formData.otBillType}
                onChange={handleChange}
              >
                <option value="">Select Type</option>
                {otBillTypes.map((type) => (
                  <option key={type.id} value={type.Name}>
                    {type.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
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
            <div className="form-group">
              <label>Start Date:</label>
              <input
                type="date"
                name="startDt"
                value={formData.startDt}
                onChange={handleChange}
                placeholder="mm/dd/yyyy"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>End Date:</label>
              <input
                type="date"
                name="endDt"
                value={formData.endDt}
                onChange={handleChange}
                placeholder="mm/dd/yyyy"
              />
            </div>
            <div className="form-group">
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
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Payment Term:</label>
              <select
                name="payTerm"
                value={formData.payTerm}
                onChange={handleChange}
              >
                <option value="">Select Term</option>
                {payTerms.map((term) => (
                  <option key={term.id} value={term.Name}>
                    {term.Name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Invoice Email:</label>
              <input
                type="email"
                name="invoiceEmail"
                value={formData.invoiceEmail}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Invoice Fax:</label>
              <input
                type="text"
                name="invoiceFax"
                value={formData.invoiceFax}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Invoice Phone:</label>
              <input
                type="text"
                name="invoicePhone"
                value={formData.invoicePhone}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-buttons">
          <button type="submit" className="submit-button" disabled={!orgId}>
            Add Project
          </button>
        </div>
      </form>
    </div>
  );
};

export default Addproject;
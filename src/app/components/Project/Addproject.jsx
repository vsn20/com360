'use client';

import React, { useState, useEffect } from 'react';
import { addProject, fetchAccountsByOrgId } from '@/app/serverActions/Projects/AddprojectAction';
import { useActionState } from 'react';
import './addproject.css';

const addform_intialstate = { error: null, success: false };

const Addproject = ({ orgId, billTypes, otBillTypes, payTerms }) => {
  const [addformData, setaddFormData] = useState({
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

  const [addform_accounts, addform_setAccounts] = useState([]);
  const [state, formAction] = useActionState(addProject, addform_intialstate);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (orgId) {
          const accountsData = await fetchAccountsByOrgId(parseInt(orgId, 10));
          addform_setAccounts(accountsData);
        } else {
          addform_setAccounts([]);
          console.warn('No valid orgId provided, accounts not fetched');
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
      }
    };
    loadData();
  }, [orgId]);

  const addform_handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setaddFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Custom form action to include generic values in FormData
  const addform_enhancedFormAction = async (formData) => {
    formData.append('billTypes', JSON.stringify(billTypes));
    formData.append('otBillTypes', JSON.stringify(otBillTypes));
    formData.append('payTerms', JSON.stringify(payTerms));
    return formAction(formData);
  };

  // Reset form and show success message on successful submission
  useEffect(() => {
    if (state.success) {
      setaddFormData({
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
      <form action={addform_enhancedFormAction} className="project-details-container">
        {/* Basic Details Block */}
        <div className="details-block">
          <h3>Basic Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Project Name*:</label>
              <input
                type="text"
                name="prjName"
                value={addformData.prjName}
                onChange={addform_handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Description:</label>
              <input
                type="text"
                name="prsDesc"
                value={addformData.prsDesc}
                onChange={addform_handleChange}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Account*:</label>
              <select
                name="accntId"
                value={addformData.accntId}
                onChange={addform_handleChange}
                required
                disabled={!orgId}
              >
                <option value="">Select Account</option>
                {addform_accounts.map((account) => (
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
                value={addformData.billRate}
                onChange={addform_handleChange}
              />
            </div>
            <div className="form-group">
              <label>Bill Type:</label>
              <select
                name="billType"
                value={addformData.billType}
                onChange={addform_handleChange}
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
                value={addformData.otBillRate}
                onChange={addform_handleChange}
              />
            </div>
            <div className="form-group">
              <label>OT Bill Type:</label>
              <select
                name="otBillType"
                value={addformData.otBillType}
                onChange={addform_handleChange}
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
                value={addformData.billableFlag}
                onChange={addform_handleChange}
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
                value={addformData.startDt}
                onChange={addform_handleChange}
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
                value={addformData.endDt}
                onChange={addform_handleChange}
                placeholder="mm/dd/yyyy"
              />
            </div>
            <div className="form-group">
              <label>Client*:</label>
              <select
                name="clientId"
                value={addformData.clientId}
                onChange={addform_handleChange}
                required
                disabled={!orgId}
              >
                <option value="">Select Client</option>
                {addform_accounts.map((account) => (
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
                value={addformData.payTerm}
                onChange={addform_handleChange}
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
                value={addformData.invoiceEmail}
                onChange={addform_handleChange}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Invoice Fax:</label>
              <input
                type="text"
                name="invoiceFax"
                value={addformData.invoiceFax}
                onChange={addform_handleChange}
              />
            </div>
            <div className="form-group">
              <label>Invoice Phone:</label>
              <input
                type="text"
                name="invoicePhone"
                value={addformData.invoicePhone}
                onChange={addform_handleChange}
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
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addAccount } from '@/app/serverActions/Account/AddAccountServerAction';
import './addaccount.css';

export default function Addaccount({ orgid, error, accountTypes, branchTypes, countries, states }) {
  const router = useRouter();
  const [addFormError, addsetFormError] = useState(null);
  const [addFormSuccess, addsetFormSuccess] = useState(null);

  const [addformData, setaddFormData] = useState({
    accountName: '',
    acctTypeCd: '',
    branchType: '',
    email: '',
    aliasName: '',
    businessAddrLine1: '',
    businessAddrLine2: '',
    businessAddrLine3: '',
    businessCity: '',
    businessStateId: '',
    businessCountryId: '',
    businessPostalCode: '',
    mailingAddrLine1: '',
    mailingAddrLine2: '',
    mailingAddrLine3: '',
    mailingCity: '',
    mailingStateId: '',
    mailingCountryId: '',
    mailingPostalCode: '',
  });

  const addhandleChange = (e) => {
    const { name, value } = e.target;
    setaddFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addhandleSubmit = async (e) => {
    e.preventDefault();
    addsetFormError(null);
    addsetFormSuccess(null);

    if (!addformData.accountName) {
      addsetFormError('Account name is required.');
      return;
    }
    if (!addformData.acctTypeCd) {
      addsetFormError('Please select an account type.');
      return;
    }
    if (!addformData.branchType) {
      addsetFormError('Please select a branch type.');
      return;
    }
    if (!addformData.email) {
      addsetFormError('Email is required.');
      return;
    }

    const addformDataToSend = new FormData();
    Object.entries(addformData).forEach(([key, value]) => {
      addformDataToSend.append(key, value);
    });

    const addresult = await addAccount(addformDataToSend);
    if (addresult?.error) {
      addsetFormError(addresult.error);
    } else if (addresult?.success) {
      setaddFormData({
        accountName: '',
        acctTypeCd: '',
        branchType: '',
        email: '',
        aliasName: '',
        businessAddrLine1: '',
        businessAddrLine2: '',
        businessAddrLine3: '',
        businessCity: '',
        businessStateId: '',
        businessCountryId: '',
        businessPostalCode: '',
        mailingAddrLine1: '',
        mailingAddrLine2: '',
        mailingAddrLine3: '',
        mailingCity: '',
        mailingStateId: '',
        mailingCountryId: '',
        mailingPostalCode: '',
      });
      addsetFormSuccess('Account added successfully.');
      setTimeout(() => router.push('/userscreens/account/overview'), 2000); // Redirect after success
    }
  };

  return (
    <div className="employee-overview-container">
      <h2>Add Account</h2>
      {error && <div className="error-message">{error}</div>}
      {addFormError && <div className="error-message">{addFormError}</div>}
      {addFormSuccess && <div className="success-message">{addFormSuccess}</div>}
      <form onSubmit={addhandleSubmit} className="employee-details-container">
        {/* Basic Details Block */}
        <div className="details-block">
          <h3>Basic Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Organization ID</label>
              <input
                type="text"
                name="orgid"
                value={orgid || ''}
                readOnly
                className="bg-gray-100"
              />
            </div>
            <div className="form-group">
              <label>Account Name*</label>
              <input
                type="text"
                name="accountName"
                value={addformData.accountName}
                onChange={addhandleChange}
                placeholder="Enter Account Name"
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Account Type*</label>
              <select
                name="acctTypeCd"
                value={addformData.acctTypeCd}
                onChange={addhandleChange}
                required
              >
                <option value="">Select Account Type</option>
                {accountTypes.map((type) => (
                  <option key={type.id} value={type.Name}>
                    {type.Name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Branch Type*</label>
              <select
                name="branchType"
                value={addformData.branchType}
                onChange={addhandleChange}
                required
              >
                <option value="">Select Branch Type</option>
                {branchTypes.map((type) => (
                  <option key={type.id} value={type.Name}>
                    {type.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email*</label>
              <input
                type="email"
                name="email"
                value={addformData.email}
                onChange={addhandleChange}
                placeholder="Enter Email"
                required
              />
            </div>
            <div className="form-group">
              <label>Alias Name</label>
              <input
                type="text"
                name="aliasName"
                value={addformData.aliasName}
                onChange={addhandleChange}
                placeholder="Enter Alias Name"
              />
            </div>
          </div>
        </div>

        {/* Business Address Block */}
        <div className="details-block">
          <h3>Business Address</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Address Line 1</label>
              <input
                type="text"
                name="businessAddrLine1"
                value={addformData.businessAddrLine1}
                onChange={addhandleChange}
                placeholder="Enter Address Line 1"
              />
            </div>
            <div className="form-group">
              <label>Address Line 2</label>
              <input
                type="text"
                name="businessAddrLine2"
                value={addformData.businessAddrLine2}
                onChange={addhandleChange}
                placeholder="Enter Address Line 2"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Address Line 3</label>
              <input
                type="text"
                name="businessAddrLine3"
                value={addformData.businessAddrLine3}
                onChange={addhandleChange}
                placeholder="Enter Address Line 3"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="businessCity"
                value={addformData.businessCity}
                onChange={addhandleChange}
                placeholder="Enter City"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Country</label>
              <select
                name="businessCountryId"
                value={addformData.businessCountryId}
                onChange={addhandleChange}
              >
                <option value="">Select Country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>State</label>
              <select
                name="businessStateId"
                value={addformData.businessStateId}
                onChange={addhandleChange}
              >
                <option value="">Select State</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Postal Code</label>
              <input
                type="text"
                name="businessPostalCode"
                value={addformData.businessPostalCode}
                onChange={addhandleChange}
                placeholder="Enter Postal Code"
              />
            </div>
          </div>
        </div>

        {/* Mailing Address Block */}
        <div className="details-block">
          <h3>Mailing Address</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Address Line 1</label>
              <input
                type="text"
                name="mailingAddrLine1"
                value={addformData.mailingAddrLine1}
                onChange={addhandleChange}
                placeholder="Enter Address Line 1"
              />
            </div>
            <div className="form-group">
              <label>Address Line 2</label>
              <input
                type="text"
                name="mailingAddrLine2"
                value={addformData.mailingAddrLine2}
                onChange={addhandleChange}
                placeholder="Enter Address Line 2"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Address Line 3</label>
              <input
                type="text"
                name="mailingAddrLine3"
                value={addformData.mailingAddrLine3}
                onChange={addhandleChange}
                placeholder="Enter Address Line 3"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="mailingCity"
                value={addformData.mailingCity}
                onChange={addhandleChange}
                placeholder="Enter City"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Country</label>
              <select
                name="mailingCountryId"
                value={addformData.mailingCountryId}
                onChange={addhandleChange}
              >
                <option value="">Select Country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>State</label>
              <select
                name="mailingStateId"
                value={addformData.mailingStateId}
                onChange={addhandleChange}
              >
                <option value="">Select State</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Postal Code</label>
              <input
                type="text"
                name="mailingPostalCode"
                value={addformData.mailingPostalCode}
                onChange={addhandleChange}
                placeholder="Enter Postal Code"
              />
            </div>
          </div>
        </div>

        <div className="form-buttons">
          <button type="submit" className="submit-button">
            Add Account
          </button>
        </div>
      </form>
    </div>
  );
}
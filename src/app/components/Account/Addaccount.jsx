'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addAccount } from '@/app/serverActions/Account/AddAccountServerAction';
import './addaccount.css';

export default function Addaccount({ orgid, error, accountTypes, branchTypes, countries, states }) {
  const router = useRouter();
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  const [formData, setFormData] = useState({
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formData.accountName) {
      setFormError('Account name is required.');
      return;
    }
    if (!formData.acctTypeCd) {
      setFormError('Please select an account type.');
      return;
    }
    if (!formData.branchType) {
      setFormError('Please select a branch type.');
      return;
    }
    if (!formData.email) {
      setFormError('Email is required.');
      return;
    }

    const formDataToSend = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSend.append(key, value);
    });

    const result = await addAccount(formDataToSend);
    if (result?.error) {
      setFormError(result.error);
    } else if (result?.success) {
      setFormData({
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
      setFormSuccess('Account added successfully.');
      setTimeout(() => router.push('/userscreens/account/overview'), 2000); // Redirect after success
    }
  };

  return (
    <div className="employee-overview-container">
      <h2>Add Account</h2>
      {error && <div className="error-message">{error}</div>}
      {formError && <div className="error-message">{formError}</div>}
      {formSuccess && <div className="success-message">{formSuccess}</div>}
      <form onSubmit={handleSubmit} className="employee-details-container">
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
                value={formData.accountName}
                onChange={handleChange}
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
                value={formData.acctTypeCd}
                onChange={handleChange}
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
                value={formData.branchType}
                onChange={handleChange}
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
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter Email"
                required
              />
            </div>
            <div className="form-group">
              <label>Alias Name</label>
              <input
                type="text"
                name="aliasName"
                value={formData.aliasName}
                onChange={handleChange}
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
                value={formData.businessAddrLine1}
                onChange={handleChange}
                placeholder="Enter Address Line 1"
              />
            </div>
            <div className="form-group">
              <label>Address Line 2</label>
              <input
                type="text"
                name="businessAddrLine2"
                value={formData.businessAddrLine2}
                onChange={handleChange}
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
                value={formData.businessAddrLine3}
                onChange={handleChange}
                placeholder="Enter Address Line 3"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="businessCity"
                value={formData.businessCity}
                onChange={handleChange}
                placeholder="Enter City"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Country</label>
              <select
                name="businessCountryId"
                value={formData.businessCountryId}
                onChange={handleChange}
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
                value={formData.businessStateId}
                onChange={handleChange}
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
                value={formData.businessPostalCode}
                onChange={handleChange}
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
                value={formData.mailingAddrLine1}
                onChange={handleChange}
                placeholder="Enter Address Line 1"
              />
            </div>
            <div className="form-group">
              <label>Address Line 2</label>
              <input
                type="text"
                name="mailingAddrLine2"
                value={formData.mailingAddrLine2}
                onChange={handleChange}
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
                value={formData.mailingAddrLine3}
                onChange={handleChange}
                placeholder="Enter Address Line 3"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="mailingCity"
                value={formData.mailingCity}
                onChange={handleChange}
                placeholder="Enter City"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Country</label>
              <select
                name="mailingCountryId"
                value={formData.mailingCountryId}
                onChange={handleChange}
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
                value={formData.mailingStateId}
                onChange={handleChange}
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
                value={formData.mailingPostalCode}
                onChange={handleChange}
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
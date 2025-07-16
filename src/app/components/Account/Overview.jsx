'use client';

import React, { useState, useEffect } from 'react';
import { 
  fetchAccountByOrgId, 
  fetchAccountById, 
  updateAccount
} from '@/app/serverActions/Account/Overview';

import { addAccount } from '@/app/serverActions/Account/AddAccountServerAction';
import { useRouter } from 'next/navigation';
import './overview.css';


const Overview = ({
  accountTypes,
  branchTypes,
  countries,
  states,
  orgid,
  error: initialError,
  accounts
}) => 
{
  const [selectedAccntId, setSelectedAccntId] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [formData, setFormData] = useState({
    accntId: '',
    orgid: orgid || '',
    activeFlag: '1',
    acctTypeCd: '',
    email: '',
    aliasName: '',
    businessAddrLine1: '',
    businessAddrLine2: '',
    businessAddrLine3: '',
    businessCity: '',
    businessStateId: '',
    businessCountryId: '185',
    businessPostalCode: '',
    mailingAddrLine1: '',
    mailingAddrLine2: '',
    mailingAddrLine3: '',
    mailingCity: '',
    mailingStateId: '',
    mailingCountryId: '185',
    mailingPostalCode: '',
    lastLoginDate: '',
    branchType: '',
    createdBy: '',
    lastUpdatedBy: '',
    lastUpdatedDate: ''
  });
  const [error, setError] = useState(initialError);
  const [canEditAccounts, setCanEditAccounts] = useState(true); // Default to true for all authenticated users
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingBusinessAddress, setEditingBusinessAddress] = useState(false);
  const [editingMailingAddress, setEditingMailingAddress] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isadd,setisadd]=useState(false);
  // Utility function to format dates for display
  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      return date.toISOString().split('T')[0]; // Convert Date to YYYY-MM-DD
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0]; // Handle timestamp or date string
    }
    return ''; // Fallback for invalid dates
  };

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  useEffect(() => {
    const loadAccountDetails = async () => {
      if (!selectedAccntId) {
        setAccountDetails(null);
        setFormData({
          accntId: '',
          orgid: orgid || '',
          activeFlag: '1',
          acctTypeCd: '',
          email: '',
          aliasName: '',
          businessAddrLine1: '',
          businessAddrLine2: '',
          businessAddrLine3: '',
          businessCity: '',
          businessStateId: '',
          businessCountryId: '185',
          businessPostalCode: '',
          mailingAddrLine1: '',
          mailingAddrLine2: '',
          mailingAddrLine3: '',
          mailingCity: '',
          mailingStateId: '',
          mailingCountryId: '185',
          mailingPostalCode: '',
          lastLoginDate: '',
          branchType: '',
          createdBy: '',
          lastUpdatedBy: '',
          lastUpdatedDate: ''
        });
        return;
      }
      try {
        setIsLoading(true);
        const account = await fetchAccountById(selectedAccntId);
        if (!account.ORGID) {
          setError('Account data is missing organization ID.');
          return;
        }
        setAccountDetails(account);
        setFormData({
          accntId: account.ACCNT_ID || '',
          orgid: account.ORGID || orgid || '',
          activeFlag: account.ACTIVE_FLAG ? '1' : '0',
          acctTypeCd: account.ACCT_TYPE_CD || '',
          email: account.EMAIL || '',
          aliasName: account.ALIAS_NAME || '',
          businessAddrLine1: account.BUSINESS_ADDR_LINE1 || '',
          businessAddrLine2: account.BUSINESS_ADDR_LINE2 || '',
          businessAddrLine3: account.BUSINESS_ADDR_LINE3 || '',
          businessCity: account.BUSINESS_CITY || '',
          businessStateId: account.BUSINESS_STATE_ID ? String(account.BUSINESS_STATE_ID) : '',
          businessCountryId: account.BUSINESS_COUNTRY_ID ? String(account.BUSINESS_COUNTRY_ID) : '185',
          businessPostalCode: account.BUSINESS_POSTAL_CODE || '',
          mailingAddrLine1: account.MAILING_ADDR_LINE1 || '',
          mailingAddrLine2: account.MAILING_ADDR_LINE2 || '',
          mailingAddrLine3: account.MAILING_ADDR_LINE3 || '',
          mailingCity: account.MAILING_CITY || '',
          mailingStateId: account.MAILING_STATE_ID ? String(account.MAILING_STATE_ID) : '',
          mailingCountryId: account.MAILING_COUNTRY_ID ? String(account.MAILING_COUNTRY_ID) : '185',
          mailingPostalCode: account.MAILING_POSTAL_CODE || '',
          lastLoginDate: account.LAST_LOGIN_DATE ? formatDate(account.LAST_LOGIN_DATE) : '',
          branchType: account.BRANCH_TYPE || '',
          createdBy: account.CREATED_BY || '',
          lastUpdatedBy: account.LAST_UPDATED_BY || '',
          lastUpdatedDate: formatDate(account.LAST_UPDATED_DATE) || ''
        });
        setError(null);
      } catch (err) {
        console.error('Error loading account details:', err);
        setError(err.message);
        setAccountDetails(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadAccountDetails();
  }, [selectedAccntId, orgid]);

  const handleRowClick = (accntId) => {
    setSelectedAccntId(accntId);
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setError(null);
    setisadd(false);
  };

  const handleBackClick = () => {
     router.refresh();
    setSelectedAccntId(null);
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setError(null);
    setisadd(false);
   
  };
  const handleaddaccount=()=>{
     setSelectedAccntId(null);
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setError(null);
    setisadd(true);
  }

  const handleEdit = (section) => {
    if (section === 'basic') setEditingBasic(true);
    if (section === 'businessAddress') setEditingBusinessAddress(true);
    if (section === 'mailingAddress') setEditingMailingAddress(true);
  };

  const ensureOrgId = async () => {
    if (!formData.orgid || formData.orgid === '') {
      if (orgid) {
        setFormData(prev => ({ ...prev, orgid }));
        return orgid;
      }
      setError('Organization ID is missing or invalid.');
      return null;
    }
    return formData.orgid;
  };

  const handleSave = async (section) => {
    const orgid = await ensureOrgId();
    if (!orgid) {
      setError('Organization ID is missing or invalid.');
      return;
    }
    setIsLoading(true);
    const formDataToSubmit = new FormData();
    formDataToSubmit.append('ACCNT_ID', formData.accntId);
    formDataToSubmit.append('ORGID', orgid);
    formDataToSubmit.append('section', section);

    if (section === 'basic') {
      if (!formData.acctTypeCd) {
        setError('Account Type is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.email) {
        setError('Email is required.');
        setIsLoading(false);
        return;
      }
      formDataToSubmit.append('ACTIVE_FLAG', formData.activeFlag);
      formDataToSubmit.append('ACCT_TYPE_CD', formData.acctTypeCd);
      formDataToSubmit.append('EMAIL', formData.email);
      formDataToSubmit.append('ALIAS_NAME', formData.aliasName || '');
      formDataToSubmit.append('BRANCH_TYPE', formData.branchType || '');
    } else if (section === 'businessAddress') {
      formDataToSubmit.append('BUSINESS_ADDR_LINE1', formData.businessAddrLine1 || '');
      formDataToSubmit.append('BUSINESS_ADDR_LINE2', formData.businessAddrLine2 || '');
      formDataToSubmit.append('BUSINESS_ADDR_LINE3', formData.businessAddrLine3 || '');
      formDataToSubmit.append('BUSINESS_CITY', formData.businessCity || '');
      formDataToSubmit.append('BUSINESS_STATE_ID', formData.businessStateId || '');
      formDataToSubmit.append('BUSINESS_COUNTRY_ID', formData.businessCountryId || '');
      formDataToSubmit.append('BUSINESS_POSTAL_CODE', formData.businessPostalCode || '');
    } else if (section === 'mailingAddress') {
      formDataToSubmit.append('MAILING_ADDR_LINE1', formData.mailingAddrLine1 || '');
      formDataToSubmit.append('MAILING_ADDR_LINE2', formData.mailingAddrLine2 || '');
      formDataToSubmit.append('MAILING_ADDR_LINE3', formData.mailingAddrLine3 || '');
      formDataToSubmit.append('MAILING_CITY', formData.mailingCity || '');
      formDataToSubmit.append('MAILING_STATE_ID', formData.mailingStateId || '');
      formDataToSubmit.append('MAILING_COUNTRY_ID', formData.mailingCountryId || '');
      formDataToSubmit.append('MAILING_POSTAL_CODE', formData.mailingPostalCode || '');
    }

    try {
      console.log('FormData to submit:', Object.fromEntries(formDataToSubmit));
      const result = await updateAccount(formDataToSubmit);
      if (result && result.success) {
        const updatedAccount = await fetchAccountById(formData.accntId);
        setAccountDetails(updatedAccount);
        // Update accounts array to reflect changes in table
        accounts.forEach((account, index) => {
          if (account.ACCNT_ID === formData.accntId) {
            accounts[index] = {
              ...account,
              ACTIVE_FLAG: updatedAccount.ACTIVE_FLAG || account.ACTIVE_FLAG,
              ACCT_TYPE_CD: updatedAccount.ACCT_TYPE_CD || account.ACCT_TYPE_CD,
              EMAIL: updatedAccount.EMAIL || account.EMAIL,
              ALIAS_NAME: updatedAccount.ALIAS_NAME || account.ALIAS_NAME,
              BRANCH_TYPE: updatedAccount.BRANCH_TYPE || account.BRANCH_TYPE,
              BUSINESS_ADDR_LINE1: updatedAccount.BUSINESS_ADDR_LINE1 || account.BUSINESS_ADDR_LINE1,
              BUSINESS_ADDR_LINE2: updatedAccount.BUSINESS_ADDR_LINE2 || account.BUSINESS_ADDR_LINE2,
              BUSINESS_ADDR_LINE3: updatedAccount.BUSINESS_ADDR_LINE3 || account.BUSINESS_ADDR_LINE3,
              BUSINESS_CITY: updatedAccount.BUSINESS_CITY || account.BUSINESS_CITY,
              BUSINESS_STATE_ID: updatedAccount.BUSINESS_STATE_ID || account.BUSINESS_STATE_ID,
              BUSINESS_COUNTRY_ID: updatedAccount.BUSINESS_COUNTRY_ID || account.BUSINESS_COUNTRY_ID,
              BUSINESS_POSTAL_CODE: updatedAccount.BUSINESS_POSTAL_CODE || account.BUSINESS_POSTAL_CODE,
              MAILING_ADDR_LINE1: updatedAccount.MAILING_ADDR_LINE1 || account.MAILING_ADDR_LINE1,
              MAILING_ADDR_LINE2: updatedAccount.MAILING_ADDR_LINE2 || account.MAILING_ADDR_LINE2,
              MAILING_ADDR_LINE3: updatedAccount.MAILING_ADDR_LINE3 || account.MAILING_ADDR_LINE3,
              MAILING_CITY: updatedAccount.MAILING_CITY || account.MAILING_CITY,
              MAILING_STATE_ID: updatedAccount.MAILING_STATE_ID || account.MAILING_STATE_ID,
              MAILING_COUNTRY_ID: updatedAccount.MAILING_COUNTRY_ID || account.MAILING_COUNTRY_ID,
              MAILING_POSTAL_CODE: updatedAccount.MAILING_POSTAL_CODE || account.MAILING_POSTAL_CODE,
              LAST_LOGIN_DATE: updatedAccount.LAST_LOGIN_DATE || account.LAST_LOGIN_DATE,
              CREATED_BY: updatedAccount.CREATED_BY || account.CREATED_BY,
              LAST_UPDATED_BY: updatedAccount.LAST_UPDATED_BY || account.LAST_UPDATED_BY,
              LAST_UPDATED_DATE: updatedAccount.LAST_UPDATED_DATE || account.LAST_UPDATED_DATE
            };
          }
        });
        if (section === 'basic') setEditingBasic(false);
        if (section === 'businessAddress') setEditingBusinessAddress(false);
        if (section === 'mailingAddress') setEditingMailingAddress(false);
        setError(null);
      } else {
        setError(result.error || 'Failed to save: Invalid response from server');
      }
    } catch (err) {
      console.error('Error saving account:', err);
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getAccountTypeName = (acctTypeCd) => {
    const accountType = accountTypes.find(type => type.Name === acctTypeCd);
    return accountType ? accountType.Name : 'No Account Type';
  };

  const getBranchTypeName = (branchType) => {
    const branch = branchTypes.find(type => type.Name === branchType);
    return branch ? branch.Name : 'No Branch Type';
  };

  const getCountryName = (countryId) => {
    const country = countries.find(c => c.ID === countryId);
    return country ? country.VALUE : 'No Country';
  };

  const getStateName = (stateId) => {
    const state = states.find(s => s.ID === stateId);
    return state ? state.VALUE : 'No State';
  };

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };








//add account


 const router = useRouter();
  const [addFormError, addsetFormError] = useState(null);
  const [addFormSuccess, addsetFormSuccess] = useState(null);

  const [addformData, setaddFormData] = useState({
    accountName: '',
    acctTypeCd: '',
    branchType: '',
    email: '',
    // aliasName: '',
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
        // aliasName: '',
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
      setTimeout(() => addsetFormSuccess(null), 3000);
      setTimeout(() => router.refresh(), 4000);
      //setTimeout(() => router.push('/userscreens/account/overview'), 2000); // Redirect after success
    }
  };


  return (
    <div className="employee-overview-container">
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading-message">Saving...</div>}
    
      {isadd&&(
       
        <div className="employee-overview-container">
           <button className="back-button" onClick={handleBackClick}>x</button>
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
            {/* <div className="form-group">
              <label>Alias Name</label>
              <input
                type="text"
                name="aliasName"
                value={addformData.aliasName}
                onChange={addhandleChange}
                placeholder="Enter Alias Name"
              />
            </div> */}
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
                  <option key={country.ID} value={country.ID}>
                    {country.VALUE}
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
                  <option key={state.ID} value={state.ID}>
                    {state.VALUE}
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
                  <option key={country.ID} value={country.ID}>
                    {country.VALUE}
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
                  <option key={state.ID} value={state.ID}>
                    {state.VALUE}
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
          <button type="submit" className="save-button">
            Add Account
          </button>
        </div>
      </form>
    </div>
      )}
      {!isadd&&!selectedAccntId ? (
        <div className="employee-list">
          <button onClick={()=>handleaddaccount()} className='save-button'>Add Account</button>
        {accounts.length === 0 && !error ? (
            <p>No active accounts found.</p>
          ) : (
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Account Name</th>
                  <th>Account Type</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={account.ACCNT_ID}
                    onClick={() => handleRowClick(account.ACCNT_ID)}
                    className={selectedAccntId === account.ACCNT_ID ? 'selected-row' : ''}
                  >
                    <td>Account-{getdisplayprojectid(account.ACCNT_ID)}</td>
                    <td>{account.ALIAS_NAME || '-'}</td>
                    <td>{getAccountTypeName(account.ACCT_TYPE_CD)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : !isadd&&(
        accountDetails && (
          <div className="employee-details-container">
            <button className="back-button" onClick={handleBackClick}>x</button>

            {/* Basic Details Section */}
            <div className="details-block">
              <h3>Basic Details</h3>
              {editingBasic && canEditAccounts ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('basic'); }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Account Name</label>
                      <input type="text" name="aliasName" value={formData.aliasName} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Account Type*</label>
                      <select name="acctTypeCd" value={formData.acctTypeCd} onChange={handleFormChange} required>
                        <option value="">Select Account Type</option>
                        {accountTypes.map((type) => (
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
                      <input type="email" name="email" value={formData.email} onChange={handleFormChange} required />
                    </div>
                    <div className="form-group">
                      <label>Active Flag</label>
                      <select name="activeFlag" value={formData.activeFlag} onChange={handleFormChange}>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Branch Type</label>
                      <select name="branchType" value={formData.branchType} onChange={handleFormChange}>
                        <option value="">Select Branch Type</option>
                        {branchTypes.map((type) => (
                          <option key={type.id} value={type.Name}>
                            {type.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button type="submit" className="save-button" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="cancel-button" onClick={() => setEditingBasic(false)} disabled={isLoading}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) :(
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-group">
                      <label>Account ID</label>
                      <p>Account-{getdisplayprojectid(accountDetails.ACCNT_ID)}</p>
                    </div>
                    <div className="details-group">
                      <label>Organization ID</label>
                      <p>{accountDetails.ORGID}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Active Flag</label>
                      <p>{accountDetails.ACTIVE_FLAG ? 'Active' : 'Inactive'}</p>
                    </div>
                    <div className="details-group">
                      <label>Account Type</label>
                      <p>{getAccountTypeName(accountDetails.ACCT_TYPE_CD)}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Email</label>
                      <p>{accountDetails.EMAIL || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Account Name</label>
                      <p>{accountDetails.ALIAS_NAME || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Branch Type</label>
                      <p>{getBranchTypeName(accountDetails.BRANCH_TYPE)}</p>
                    </div>
                    <div className="details-group">
                      <label>Last Login Date</label>
                      <p>{accountDetails.LAST_LOGIN_DATE ? formatDate(accountDetails.LAST_LOGIN_DATE) : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Created By</label>
                      <p>{accountDetails.CREATED_BY || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Last Updated By</label>
                      <p>{accountDetails.LAST_UPDATED_BY || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Last Updated Date</label>
                      <p>{formatDate(accountDetails.LAST_UPDATED_DATE) || '-'}</p>
                    </div>
                  </div>
                  {canEditAccounts && (
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('basic')}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Business Address Section */}
            <div className="details-block">
              <h3>Business Address</h3>
              {editingBusinessAddress && canEditAccounts ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('businessAddress'); }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 1</label>
                      <input type="text" name="businessAddrLine1" value={formData.businessAddrLine1} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Address Line 2</label>
                      <input type="text" name="businessAddrLine2" value={formData.businessAddrLine2} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 3</label>
                      <input type="text" name="businessAddrLine3" value={formData.businessAddrLine3} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>City</label>
                      <input type="text" name="businessCity" value={formData.businessCity} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Country</label>
                      <select name="businessCountryId" value={formData.businessCountryId} onChange={handleFormChange}>
                        <option value="">Select Country</option>
                        {countries.map((country) => (
                          <option key={country.ID} value={country.ID}>
                            {country.VALUE}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <select name="businessStateId" value={formData.businessStateId} onChange={handleFormChange}>
                        <option value="">Select State</option>
                        {states.map((state) => (
                          <option key={state.ID} value={state.ID}>
                            {state.VALUE}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Postal Code</label>
                      <input type="text" name="businessPostalCode" value={formData.businessPostalCode} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button type="submit" className="save-button" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="cancel-button" onClick={() => setEditingBusinessAddress(false)} disabled={isLoading}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-group">
                      <label>Address Line 1</label>
                      <p>{accountDetails.BUSINESS_ADDR_LINE1 || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Address Line 2</label>
                      <p>{accountDetails.BUSINESS_ADDR_LINE2 || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Address Line 3</label>
                      <p>{accountDetails.BUSINESS_ADDR_LINE3 || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>City</label>
                      <p>{accountDetails.BUSINESS_CITY || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Country</label>
                      <p>{getCountryName(accountDetails.BUSINESS_COUNTRY_ID)}</p>
                    </div>
                    <div className="details-group">
                      <label>State</label>
                      <p>{accountDetails.BUSINESS_STATE_ID ? getStateName(accountDetails.BUSINESS_STATE_ID) : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Postal Code</label>
                      <p>{accountDetails.BUSINESS_POSTAL_CODE || '-'}</p>
                    </div>
                  </div>
                  {canEditAccounts && (
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('businessAddress')}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mailing Address Section */}
            <div className="details-block">
              <h3>Mailing Address</h3>
              {editingMailingAddress && canEditAccounts ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('mailingAddress'); }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 1</label>
                      <input type="text" name="mailingAddrLine1" value={formData.mailingAddrLine1} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Address Line 2</label>
                      <input type="text" name="mailingAddrLine2" value={formData.mailingAddrLine2} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 3</label>
                      <input type="text" name="mailingAddrLine3" value={formData.mailingAddrLine3} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>City</label>
                      <input type="text" name="mailingCity" value={formData.mailingCity} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Country</label>
                      <select name="mailingCountryId" value={formData.mailingCountryId} onChange={handleFormChange}>
                        <option value="">Select Country</option>
                        {countries.map((country) => (
                          <option key={country.ID} value={country.ID}>
                            {country.VALUE}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <select name="mailingStateId" value={formData.mailingStateId} onChange={handleFormChange}>
                        <option value="">Select State</option>
                        {states.map((state) => (
                          <option key={state.ID} value={state.ID}>
                            {state.VALUE}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Postal Code</label>
                      <input type="text" name="mailingPostalCode" value={formData.mailingPostalCode} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button type="submit" className="save-button" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="cancel-button" onClick={() => setEditingMailingAddress(false)} disabled={isLoading}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-group">
                      <label>Address Line 1</label>
                      <p>{accountDetails.MAILING_ADDR_LINE1 || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Address Line 2</label>
                      <p>{accountDetails.MAILING_ADDR_LINE2 || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Address Line 3</label>
                      <p>{accountDetails.MAILING_ADDR_LINE3 || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>City</label>
                      <p>{accountDetails.MAILING_CITY || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Country</label>
                      <p>{getCountryName(accountDetails.MAILING_COUNTRY_ID)}</p>
                    </div>
                    <div className="details-group">
                      <label>State</label>
                      <p>{accountDetails.MAILING_STATE_ID ? getStateName(accountDetails.MAILING_STATE_ID) : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Postal Code</label>
                      <p>{accountDetails.MAILING_POSTAL_CODE || '-'}</p>
                    </div>
                  </div>
                  {canEditAccounts && (
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('mailingAddress')}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default Overview;
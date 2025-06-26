'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateAccount } from '@/app/serverActions/Account/Overview';
import './editaccount.css';

const EditAccount = ({ accountData }) => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    ACCNT_ID: '',
    ACTIVE_FLAG: '0',
    ACCT_TYPE_CD: '',
    EMAIL: '',
    ALIAS_NAME: '',
    BUSINESS_ADDR_LINE1: '',
    BUSINESS_ADDR_LINE2: '',
    BUSINESS_ADDR_LINE3: '',
    BUSINESS_CITY: '',
    BUSINESS_STATE_ID: '',
    BUSINESS_COUNTRY_ID: '',
    BUSINESS_POSTAL_CODE: '',
    MAILING_ADDR_LINE1: '',
    MAILING_ADDR_LINE2: '',
    MAILING_ADDR_LINE3: '',
    MAILING_CITY: '',
    MAILING_STATE_ID: '',
    MAILING_COUNTRY_ID: '',
    MAILING_POSTAL_CODE: '',
    FAIL_ATTEMPTS_CNT: '0',
    LAST_LOGIN_DATE: '',
    CREATED_DATE: '',
    LAST_UPDATED_DATE: '',
    CREATED_BY: '',
    LAST_UPDATED_BY: '',
    ORGID: '',
    BRANCH_TYPE: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (accountData) {
      setFormData({
        ACCNT_ID: accountData.ACCNT_ID || '',
        ACTIVE_FLAG: accountData.ACTIVE_FLAG ? '1' : '0',
        ACCT_TYPE_CD: accountData.ACCT_TYPE_CD || '',
        EMAIL: accountData.EMAIL || '',
        ALIAS_NAME: accountData.ALIAS_NAME || '',
        BUSINESS_ADDR_LINE1: accountData.BUSINESS_ADDR_LINE1 || '',
        BUSINESS_ADDR_LINE2: accountData.BUSINESS_ADDR_LINE2 || '',
        BUSINESS_ADDR_LINE3: accountData.BUSINESS_ADDR_LINE3 || '',
        BUSINESS_CITY: accountData.BUSINESS_CITY || '',
        BUSINESS_STATE_ID: accountData.BUSINESS_STATE_ID || '',
        BUSINESS_COUNTRY_ID: accountData.BUSINESS_COUNTRY_ID || '',
        BUSINESS_POSTAL_CODE: accountData.BUSINESS_POSTAL_CODE || '',
        MAILING_ADDR_LINE1: accountData.MAILING_ADDR_LINE1 || '',
        MAILING_ADDR_LINE2: accountData.MAILING_ADDR_LINE2 || '',
        MAILING_ADDR_LINE3: accountData.MAILING_ADDR_LINE3 || '',
        MAILING_CITY: accountData.MAILING_CITY || '',
        MAILING_STATE_ID: accountData.MAILING_STATE_ID || '',
        MAILING_COUNTRY_ID: accountData.MAILING_COUNTRY_ID || '',
        MAILING_POSTAL_CODE: accountData.MAILING_POSTAL_CODE || '',
        FAIL_ATTEMPTS_CNT: accountData.FAIL_ATTEMPTS_CNT || '0',
        LAST_LOGIN_DATE: accountData.LAST_LOGIN_DATE || '',
        CREATED_DATE: accountData.CREATED_DATE ? new Date(accountData.CREATED_DATE).toLocaleString() : '',
        LAST_UPDATED_DATE: accountData.LAST_UPDATED_DATE ? new Date(accountData.LAST_UPDATED_DATE).toLocaleString() : '',
        CREATED_BY: accountData.CREATED_BY || '',
        LAST_UPDATED_BY: accountData.LAST_UPDATED_BY || '',
        ORGID: accountData.ORGID || '',
        BRANCH_TYPE: accountData.BRANCH_TYPE || '',
      });
    }
  }, [accountData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formDataToSubmit = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSubmit.append(key, value);
    });

    try {
      const result = await updateAccount(formDataToSubmit);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => router.push('/userscreens/account/overview'), 2000);
      } else {
        setError(result.error || 'Update failed');
      }
    } catch (err) {
      console.error('Error updating account:', err);
      setError(err.message);
    }
  };

  return (
    <div className="edit-account-container">
      <h2>Edit Account</h2>
      {success && <div className="success-message">Account updated successfully! Redirecting...</div>}
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Account ID:</label>
          <input type="text" name="ACCNT_ID" value={formData.ACCNT_ID} onChange={handleChange} readOnly className="bg-gray-100" />
        </div>
        <div>
          <label>Active Flag:</label>
          <select name="ACTIVE_FLAG" value={formData.ACTIVE_FLAG} onChange={handleChange}>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </div>
        <div>
          <label>Account Type:</label>
          <input type="text" name="ACCT_TYPE_CD" value={formData.ACCT_TYPE_CD} onChange={handleChange} />
        </div>
        <div>
          <label>Email:</label>
          <input type="email" name="EMAIL" value={formData.EMAIL} onChange={handleChange} />
        </div>
        <div>
          <label>Alias Name:</label>
          <input type="text" name="ALIAS_NAME" value={formData.ALIAS_NAME} onChange={handleChange} />
        </div>
        <div>
          <label>Business Address Line 1:</label>
          <input type="text" name="BUSINESS_ADDR_LINE1" value={formData.BUSINESS_ADDR_LINE1} onChange={handleChange} />
        </div>
        <div>
          <label>Business Address Line 2:</label>
          <input type="text" name="BUSINESS_ADDR_LINE2" value={formData.BUSINESS_ADDR_LINE2} onChange={handleChange} />
        </div>
        <div>
          <label>Business Address Line 3:</label>
          <input type="text" name="BUSINESS_ADDR_LINE3" value={formData.BUSINESS_ADDR_LINE3} onChange={handleChange} />
        </div>
        <div>
          <label>Business City:</label>
          <input type="text" name="BUSINESS_CITY" value={formData.BUSINESS_CITY} onChange={handleChange} />
        </div>
        <div>
          <label>Business State ID:</label>
          <input type="number" name="BUSINESS_STATE_ID" value={formData.BUSINESS_STATE_ID} onChange={handleChange} />
        </div>
        <div>
          <label>Business Country ID:</label>
          <input type="number" name="BUSINESS_COUNTRY_ID" value={formData.BUSINESS_COUNTRY_ID} onChange={handleChange} />
        </div>
        <div>
          <label>Business Postal Code:</label>
          <input type="text" name="BUSINESS_POSTAL_CODE" value={formData.BUSINESS_POSTAL_CODE} onChange={handleChange} />
        </div>
        <div>
          <label>Mailing Address Line 1:</label>
          <input type="text" name="MAILING_ADDR_LINE1" value={formData.MAILING_ADDR_LINE1} onChange={handleChange} />
        </div>
        <div>
          <label>Mailing Address Line 2:</label>
          <input type="text" name="MAILING_ADDR_LINE2" value={formData.MAILING_ADDR_LINE2} onChange={handleChange} />
        </div>
        <div>
          <label>Mailing Address Line 3:</label>
          <input type="text" name="MAILING_ADDR_LINE3" value={formData.MAILING_ADDR_LINE3} onChange={handleChange} />
        </div>
        <div>
          <label>Mailing City:</label>
          <input type="text" name="MAILING_CITY" value={formData.MAILING_CITY} onChange={handleChange} />
        </div>
        <div>
          <label>Mailing State ID:</label>
          <input type="number" name="MAILING_STATE_ID" value={formData.MAILING_STATE_ID} onChange={handleChange} />
        </div>
        <div>
          <label>Mailing Country ID:</label>
          <input type="number" name="MAILING_COUNTRY_ID" value={formData.MAILING_COUNTRY_ID} onChange={handleChange} />
        </div>
        <div>
          <label>Mailing Postal Code:</label>
          <input type="text" name="MAILING_POSTAL_CODE" value={formData.MAILING_POSTAL_CODE} onChange={handleChange} />
        </div>
        <div>
          <label>Fail Attempts Count:</label>
          <input type="number" name="FAIL_ATTEMPTS_CNT" value={formData.FAIL_ATTEMPTS_CNT} onChange={handleChange} />
        </div>
        <div>
          <label>Last Login Date:</label>
          <input type="date" name="LAST_LOGIN_DATE" value={formData.LAST_LOGIN_DATE || ''} onChange={handleChange} />
        </div>
        <div>
          <label>Created Date:</label>
          <input type="text" name="CREATED_DATE" value={formData.CREATED_DATE} readOnly className="bg-gray-100" />
        </div>
        <div>
          <label>Last Updated Date:</label>
          <input type="text" name="LAST_UPDATED_DATE" value={formData.LAST_UPDATED_DATE} readOnly className="bg-gray-100" />
        </div>
        <div>
          <label>Created By:</label>
          <input type="text" name="CREATED_BY" value={formData.CREATED_BY} onChange={handleChange} />
        </div>
        <div>
          <label>Last Updated By:</label>
          <input type="text" name="LAST_UPDATED_BY" value={formData.LAST_UPDATED_BY} onChange={handleChange} />
        </div>
        <div>
          <label>ORGID:</label>
          <input type="number" name="ORGID" value={formData.ORGID} onChange={handleChange} readOnly className="bg-gray-100" />
        </div>
        <div>
          <label>Branch Type:</label>
          <input type="text" name="BRANCH_TYPE" value={formData.BRANCH_TYPE} onChange={handleChange} />
        </div>
        <button type="submit">Save Changes</button>
      </form>
    </div>
  );
};

export default EditAccount;
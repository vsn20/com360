'use client';

import React, { useState, useEffect, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addContact } from '@/app/serverActions/Contacts/actions';
import './contact.css'

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="contact_save" disabled={pending}>
      {pending ? 'Saving...' : 'Save Contact'}
    </button>
  );
}

// Re-usable Address Block Component
function AddressBlock({ title, countries, states, prefix, formData, handleChange }) {
  const countryId = formData[`${prefix}_COUNTRY_ID`];
  const isUS = countryId === '185' || countryId === 185;

  return (
    <div className="contact_form-block">
      <h3>{title}</h3>
      <div className="contact_form-row">
        <div className="contact_form-group">
          <label>Address Line 1</label>
          <input name={`${prefix}_ADDR_LINE1`} value={formData[`${prefix}_ADDR_LINE1`]} onChange={handleChange} />
        </div>
        <div className="contact_form-group">
          <label>Address Line 2</label>
          <input name={`${prefix}_ADDR_LINE2`} value={formData[`${prefix}_ADDR_LINE2`]} onChange={handleChange} />
        </div>
        <div className="contact_form-group">
          <label>Address Line 3</label>
          <input name={`${prefix}_ADDR_LINE3`} value={formData[`${prefix}_ADDR_LINE3`]} onChange={handleChange} />
        </div>
      </div>
      <div className="contact_form-row">
        <div className="contact_form-group">
          <label>City</label>
          <input name={`${prefix}_CITY`} value={formData[`${prefix}_CITY`]} onChange={handleChange} />
        </div>
        <div className="contact_form-group">
          <label>Country</label>
          <select name={`${prefix}_COUNTRY_ID`} value={countryId} onChange={handleChange}>
            <option value="">Select Country</option>
            {countries.map((c) => (
              <option key={c.ID} value={c.ID}>{c.VALUE}</option>
            ))}
          </select>
        </div>
        <div className="contact_form-group">
          <label>State</label>
          <select name={`${prefix}_STATE_ID`} value={formData[`${prefix}_STATE_ID`]} onChange={handleChange} disabled={!isUS}>
            <option value="">Select State</option>
            {states.map((s) => (
              <option key={s.ID} value={s.ID}>{s.VALUE}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="contact_form-row">
        <div className="contact_form-group">
          <label>Custom State</label>
          <input
            name={`${prefix}_CUSTOM_STATE`}
            value={formData[`${prefix}_CUSTOM_STATE`]}
            onChange={handleChange}
            disabled={isUS}
            placeholder={isUS ? 'N/A (Use State dropdown)' : 'Enter state/province'}
          />
        </div>
        <div className="contact_form-group">
          <label>Postal Code</label>
          <input name={`${prefix}_POSTAL_CODE`} value={formData[`${prefix}_POSTAL_CODE`]} onChange={handleChange} />
        </div>
      </div>
    </div>
  );
}

// Main Add Form Component
export default function AddContactForm({
  accounts,
  suborgs,
  countries,
  states,
  orgid,
  contactTypes,
  userSuborgId,
  onBackClick,
  onSaveSuccess,
  prefilledData, // AI prefilled data
}) {
  const [state, formAction] = useActionState(addContact, {});
  const [formData, setFormData] = useState({
    FIRST_NAME: '',
    LAST_NAME: '',
    ACCOUNT_ID: '',
    SUBORGID: userSuborgId || '',
    CONTACT_TYPE_CD: '',
    JOB_TITLE: '',
    DEPARTMENT: '',
    IS_PRIMARY: '0',
    EMAIL: '',
    ALT_EMAIL: '',
    PHONE: '',
    MOBILE: '',
    FAX: '',
    HOME_ADDR_LINE1: '',
    HOME_ADDR_LINE2: '',
    HOME_ADDR_LINE3: '',
    HOME_CITY: '',
    HOME_COUNTRY_ID: '185',
    HOME_STATE_ID: '',
    HOME_CUSTOM_STATE: '',
    HOME_POSTAL_CODE: '',
    MAILING_ADDR_LINE1: '',
    MAILING_ADDR_LINE2: '',
    MAILING_ADDR_LINE3: '',
    MAILING_CITY: '',
    MAILING_COUNTRY_ID: '185',
    MAILING_STATE_ID: '',
    MAILING_CUSTOM_STATE: '',
    MAILING_POSTAL_CODE: '',
  });
  const [suborgName, setSuborgName] = useState('');

  // Prefill form when AI provides data
  useEffect(() => {
    if (prefilledData) {
      setFormData(prev => ({
        ...prev,
        FIRST_NAME: prefilledData.FIRST_NAME !== null ? prefilledData.FIRST_NAME : prev.FIRST_NAME,
        LAST_NAME: prefilledData.LAST_NAME !== null ? prefilledData.LAST_NAME : prev.LAST_NAME,
        ACCOUNT_ID: prefilledData.ACCOUNT_ID !== null ? prefilledData.ACCOUNT_ID : prev.ACCOUNT_ID,
        SUBORGID: prefilledData.SUBORGID !== null ? prefilledData.SUBORGID : prev.SUBORGID,
        CONTACT_TYPE_CD: prefilledData.CONTACT_TYPE_CD !== null ? prefilledData.CONTACT_TYPE_CD : prev.CONTACT_TYPE_CD,
        JOB_TITLE: prefilledData.JOB_TITLE !== null ? prefilledData.JOB_TITLE : prev.JOB_TITLE,
        DEPARTMENT: prefilledData.DEPARTMENT !== null ? prefilledData.DEPARTMENT : prev.DEPARTMENT,
        IS_PRIMARY: prefilledData.IS_PRIMARY !== null ? prefilledData.IS_PRIMARY : prev.IS_PRIMARY,
        // Map all fields from AI
        EMAIL: prefilledData.EMAIL !== null ? prefilledData.EMAIL : prev.EMAIL,
        ALT_EMAIL: prefilledData.ALT_EMAIL !== null ? prefilledData.ALT_EMAIL : prev.ALT_EMAIL,
        PHONE: prefilledData.PHONE !== null ? prefilledData.PHONE : prev.PHONE,
        MOBILE: prefilledData.MOBILE !== null ? prefilledData.MOBILE : prev.MOBILE,
        FAX: prefilledData.FAX !== null ? prefilledData.FAX : prev.FAX,
        // Address mappings
        HOME_ADDR_LINE1: prefilledData.HOME_ADDR_LINE1 !== null ? prefilledData.HOME_ADDR_LINE1 : prev.HOME_ADDR_LINE1,
        HOME_ADDR_LINE2: prefilledData.HOME_ADDR_LINE2 !== null ? prefilledData.HOME_ADDR_LINE2 : prev.HOME_ADDR_LINE2,
        HOME_ADDR_LINE3: prefilledData.HOME_ADDR_LINE3 !== null ? prefilledData.HOME_ADDR_LINE3 : prev.HOME_ADDR_LINE3,
        HOME_CITY: prefilledData.HOME_CITY !== null ? prefilledData.HOME_CITY : prev.HOME_CITY,
        HOME_COUNTRY_ID: prefilledData.HOME_COUNTRY_ID !== null ? prefilledData.HOME_COUNTRY_ID : prev.HOME_COUNTRY_ID,
        HOME_STATE_ID: prefilledData.HOME_STATE_ID !== null ? prefilledData.HOME_STATE_ID : prev.HOME_STATE_ID,
        HOME_POSTAL_CODE: prefilledData.HOME_POSTAL_CODE !== null ? prefilledData.HOME_POSTAL_CODE : prev.HOME_POSTAL_CODE,
        HOME_CUSTOM_STATE: prefilledData.HOME_CUSTOM_STATE !== null ? prefilledData.HOME_CUSTOM_STATE : prev.HOME_CUSTOM_STATE,
        MAILING_ADDR_LINE1: prefilledData.MAILING_ADDR_LINE1 !== null ? prefilledData.MAILING_ADDR_LINE1 : prev.MAILING_ADDR_LINE1,
        MAILING_ADDR_LINE2: prefilledData.MAILING_ADDR_LINE2 !== null ? prefilledData.MAILING_ADDR_LINE2 : prev.MAILING_ADDR_LINE2,
        MAILING_ADDR_LINE3: prefilledData.MAILING_ADDR_LINE3 !== null ? prefilledData.MAILING_ADDR_LINE3 : prev.MAILING_ADDR_LINE3,
        MAILING_CITY: prefilledData.MAILING_CITY !== null ? prefilledData.MAILING_CITY : prev.MAILING_CITY,
        MAILING_COUNTRY_ID: prefilledData.MAILING_COUNTRY_ID !== null ? prefilledData.MAILING_COUNTRY_ID : prev.MAILING_COUNTRY_ID,
        MAILING_STATE_ID: prefilledData.MAILING_STATE_ID !== null ? prefilledData.MAILING_STATE_ID : prev.MAILING_STATE_ID,
        MAILING_POSTAL_CODE: prefilledData.MAILING_POSTAL_CODE !== null ? prefilledData.MAILING_POSTAL_CODE : prev.MAILING_POSTAL_CODE,
        MAILING_CUSTOM_STATE: prefilledData.MAILING_CUSTOM_STATE !== null ? prefilledData.MAILING_CUSTOM_STATE : prev.MAILING_CUSTOM_STATE,
      }));
    }
  }, [prefilledData]);

  // Auto-fill Suborganization
  useEffect(() => {
    if (formData.ACCOUNT_ID) {
      const selectedAccount = accounts.find((a) => String(a.ACCNT_ID) === String(formData.ACCOUNT_ID));
      if (selectedAccount && selectedAccount.suborgid) {
        setFormData((prev) => ({ ...prev, SUBORGID: selectedAccount.suborgid }));
        const suborg = suborgs.find((s) => s.suborgid === selectedAccount.suborgid);
        setSuborgName(suborg ? suborg.suborgname : 'N/A');
      } else {
        setFormData((prev) => ({ ...prev, SUBORGID: '' }));
        setSuborgName('');
      }
    } else {
      // If no account selected, default to user's suborganization (editable)
      if (userSuborgId && !formData.SUBORGID) {
        setFormData((prev) => ({ ...prev, SUBORGID: userSuborgId }));
      }
      const suborg = suborgs.find((s) => s.suborgid === formData.SUBORGID);
      setSuborgName(suborg ? suborg.suborgname : '');
    }
  }, [formData.ACCOUNT_ID, formData.SUBORGID, accounts, suborgs, userSuborgId]);

  // Handle successful save
  useEffect(() => {
    if (state.success) {
      onSaveSuccess();
    }
  }, [state, onSaveSuccess]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCopyHomeAddress = () => {
    setFormData(prev => ({
      ...prev,
      MAILING_ADDR_LINE1: prev.HOME_ADDR_LINE1,
      MAILING_ADDR_LINE2: prev.HOME_ADDR_LINE2,
      MAILING_ADDR_LINE3: prev.HOME_ADDR_LINE3,
      MAILING_CITY: prev.HOME_CITY,
      MAILING_COUNTRY_ID: prev.HOME_COUNTRY_ID,
      MAILING_STATE_ID: prev.HOME_STATE_ID,
      MAILING_CUSTOM_STATE: prev.HOME_CUSTOM_STATE,
      MAILING_POSTAL_CODE: prev.HOME_POSTAL_CODE,
    }));
  };

  return (
    <div className="contact_add-container">
      <div className="contact_header-section">
        <h1 className="contact_title">Add New Contact</h1>
        <button className="contact_back-button" onClick={onBackClick}></button>
      </div>

      {state?.error && <p className="contact_error-message">{state.error}</p>}

      <form action={formAction}>
        <input type="hidden" name="ORGID" value={orgid} />
        
        <div className="contact_form-block">
          <h3>Core Information</h3>
          <div className="contact_form-row">
            <div className="contact_form-group">
              <label>First Name*</label>
              <input type="text" name="FIRST_NAME" value={formData.FIRST_NAME} onChange={handleChange} required />
            </div>
            <div className="contact_form-group">
              <label>Last Name*</label>
              <input type="text" name="LAST_NAME" value={formData.LAST_NAME} onChange={handleChange} required />
            </div>
          </div>
          <div className="contact_form-row">
            <div className="contact_form-group">
              <label>Account</label>
              <select name="ACCOUNT_ID" value={formData.ACCOUNT_ID} onChange={handleChange}>
                <option value="">Select an Account</option>
                {accounts.map((acc) => (
                  <option key={acc.ACCNT_ID} value={acc.ACCNT_ID}>{acc.ALIAS_NAME}</option>
                ))}
              </select>
            </div>
            <div className="contact_form-group">
              <label>Organization{formData.ACCOUNT_ID ? ' (Auto-filled)' : '*'}</label>
              {formData.ACCOUNT_ID ? (
                <>
                  <input type="text" value={suborgName} readOnly placeholder="Select an account to populate" />
                  <input type="hidden" name="SUBORGID" value={formData.SUBORGID} />
                </>
              ) : (
                <select name="SUBORGID" value={formData.SUBORGID} onChange={handleChange} required>
                  <option value="">Select Organization</option>
                  {suborgs.map((sub) => (
                    <option key={sub.suborgid} value={sub.suborgid}>{sub.suborgname}</option>
                  ))}
                </select>
                // Disabled version for later use:
                // <input type="text" value={suborgName} readOnly disabled />
                // <input type="hidden" name="SUBORGID" value={formData.SUBORGID} />
              )}
            </div>
          </div>
          <div className="contact_form-row">
            <div className="contact_form-group">
              <label>Contact Type</label>
              <select name="CONTACT_TYPE_CD" value={formData.CONTACT_TYPE_CD} onChange={handleChange}>
                <option value="">Select Contact Type</option>
                {contactTypes && contactTypes.map((ct) => (
                  <option key={ct.ID} value={ct.VALUE}>{ct.VALUE}</option>
                ))}
              </select>
            </div>
            <div className="contact_form-group">
              <label>Job Title</label>
              <input type="text" name="JOB_TITLE" value={formData.JOB_TITLE} onChange={handleChange} />
            </div>
            <div className="contact_form-group">
              <label>Department</label>
              <input type="text" name="DEPARTMENT" value={formData.DEPARTMENT} onChange={handleChange} />
            </div>
          </div>
          <div className="contact_form-row">
            <div className="contact_form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                name="IS_PRIMARY" 
                checked={formData.IS_PRIMARY === '1'} 
                onChange={(e) => setFormData(prev => ({ ...prev, IS_PRIMARY: e.target.checked ? '1' : '0' }))}
                style={{ width: 'auto' }}
              />
              <label style={{ marginBottom: 0 }}>Is Primary Contact</label>
              <input type="hidden" name="IS_PRIMARY" value={formData.IS_PRIMARY} />
            </div>
          </div>
          
          {/* Contact Details */}
          <div className="contact_form-row">
            <div className="contact_form-group">
              <label>Email</label>
              <input type="email" name="EMAIL" value={formData.EMAIL} onChange={handleChange} />
            </div>
            <div className="contact_form-group">
              <label>Alternate Email</label>
              <input type="email" name="ALT_EMAIL" value={formData.ALT_EMAIL} onChange={handleChange} />
            </div>
          </div>
          <div className="contact_form-row">
            <div className="contact_form-group">
              <label>Phone</label>
              <input type="tel" name="PHONE" value={formData.PHONE} onChange={handleChange} />
            </div>
            <div className="contact_form-group">
              <label>Mobile</label>
              <input type="tel" name="MOBILE" value={formData.MOBILE} onChange={handleChange} />
            </div>
            <div className="contact_form-group">
              <label>Fax</label>
              <input type="tel" name="FAX" value={formData.FAX} onChange={handleChange} />
            </div>
          </div>
        </div>

        <AddressBlock title="Home Address" prefix="HOME" countries={countries} states={states} formData={formData} handleChange={handleChange} />
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px', marginTop: '-15px' }}>
          <button 
            type="button" 
            onClick={handleCopyHomeAddress} 
            className="contact_button" 
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            Copy Home Address
          </button>
        </div>

        <AddressBlock title="Mailing Address" prefix="MAILING" countries={countries} states={states} formData={formData} handleChange={handleChange} />

        <div className="contact_form-buttons">
          <SubmitButton />
          <button type="button" className="contact_cancel" onClick={onBackClick}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
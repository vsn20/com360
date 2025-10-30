'use client';

import React, { useState, useEffect, useActionState } from 'react'; // <-- IMPORT useActionState
import { useFormStatus } from 'react-dom';
import { addContact } from '@/app/serverActions/Contacts/actions';
import './contact.css'

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="contact-submit-button" disabled={pending}>
      {pending ? 'Saving...' : 'Save Contact'}
    </button>
  );
}

// Re-usable Address Block Component
function AddressBlock({ title, countries, states, prefix, formData, handleChange }) {
  const countryId = formData[`${prefix}_COUNTRY_ID`];
  const isUS = countryId === '185' || countryId === 185;

  return (
    <div className="contact-form-block">
      <h3>{title}</h3>
      <div className="contact-form-row">
        <div className="contact-form-group">
          <label>Address Line 1</label>
          <input name={`${prefix}_ADDR_LINE1`} value={formData[`${prefix}_ADDR_LINE1`]} onChange={handleChange} />
        </div>
        <div className="contact-form-group">
          <label>Address Line 2</label>
          <input name={`${prefix}_ADDR_LINE2`} value={formData[`${prefix}_ADDR_LINE2`]} onChange={handleChange} />
        </div>
        <div className="contact-form-group">
          <label>Address Line 3</label>
          <input name={`${prefix}_ADDR_LINE3`} value={formData[`${prefix}_ADDR_LINE3`]} onChange={handleChange} />
        </div>
      </div>
      <div className="contact-form-row">
        <div className="contact-form-group">
          <label>City</label>
          <input name={`${prefix}_CITY`} value={formData[`${prefix}_CITY`]} onChange={handleChange} />
        </div>
        <div className="contact-form-group">
          <label>Country</label>
          <select name={`${prefix}_COUNTRY_ID`} value={countryId} onChange={handleChange}>
            <option value="">Select Country</option>
            {countries.map((c) => (
              <option key={c.ID} value={c.ID}>{c.VALUE}</option>
            ))}
          </select>
        </div>
        <div className="contact-form-group">
          <label>State</label>
          <select name={`${prefix}_STATE_ID`} value={formData[`${prefix}_STATE_ID`]} onChange={handleChange} disabled={!isUS}>
            <option value="">Select State</option>
            {states.map((s) => (
              <option key={s.ID} value={s.ID}>{s.VALUE}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="contact-form-row">
        <div className="contact-form-group">
          <label>Custom State</label>
          <input
            name={`${prefix}_CUSTOM_STATE`}
            value={formData[`${prefix}_CUSTOM_STATE`]}
            onChange={handleChange}
            disabled={isUS}
            placeholder={isUS ? 'N/A (Use State dropdown)' : 'Enter state/province'}
          />
        </div>
        <div className="contact-form-group">
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
  onBackClick,
  onSaveSuccess,
}) {
  const [state, formAction] = useActionState(addContact, {}); // <-- USE useActionState
  const [formData, setFormData] = useState({
    ACCOUNT_ID: '',
    SUBORGID: '',
    CONTACT_TYPE_CD: '',
    EMAIL: '',
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

  // Auto-fill Suborganization
  useEffect(() => {
    if (formData.ACCOUNT_ID) {
      const selectedAccount = accounts.find((a) => a.ACCNT_ID == formData.ACCOUNT_ID);
      if (selectedAccount && selectedAccount.suborgid) {
        setFormData((prev) => ({ ...prev, SUBORGID: selectedAccount.suborgid }));
        const suborg = suborgs.find((s) => s.suborgid === selectedAccount.suborgid);
        setSuborgName(suborg ? suborg.suborgname : 'N/A');
      } else {
        setFormData((prev) => ({ ...prev, SUBORGID: '' }));
        setSuborgName('');
      }
    } else {
      setFormData((prev) => ({ ...prev, SUBORGID: '' }));
      setSuborgName('');
    }
  }, [formData.ACCOUNT_ID, accounts, suborgs]);

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

  const contactType = formData.CONTACT_TYPE_CD;

  return (
    <div className="contact-add-container">
      <div className="contact-header-section">
        <h1 className="contact-title">Add New Contact</h1>
        <button className="contact-back-button" onClick={onBackClick}></button>
      </div>

      {state?.error && <p className="contact-error-message">{state.error}</p>}

      <form action={formAction}>
        <input type="hidden" name="ORGID" value={orgid} />
        
        <div className="contact-form-block">
          <h3>Core Information</h3>
          <div className="contact-form-row">
            <div className="contact-form-group">
              <label>Account*</label>
              <select name="ACCOUNT_ID" value={formData.ACCOUNT_ID} onChange={handleChange} required>
                <option value="">Select an Account</option>
                {accounts.map((acc) => (
                  <option key={acc.ACCNT_ID} value={acc.ACCNT_ID}>{acc.ALIAS_NAME}</option>
                ))}
              </select>
            </div>
            <div className="contact-form-group">
              <label>Organization (Auto-filled)</label>
              <input type="text" value={suborgName} readOnly placeholder="Select an account to populate" />
              <input type="hidden" name="SUBORGID" value={formData.SUBORGID} />
            </div>
          </div>
          <div className="contact-form-row">
            <div className="contact-form-group">
              <label>Contact Type*</label>
              <select name="CONTACT_TYPE_CD" value={formData.CONTACT_TYPE_CD} onChange={handleChange} required>
                <option value="">Select Contact Type</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="Mobile">Mobile</option>
                <option value="Fax">Fax</option>
              </select>
            </div>
            {/* Dynamic Contact Fields */}
            {contactType === 'Email' && (
              <div className="contact-form-group"><label>Email Address*</label><input type="email" name="EMAIL" value={formData.EMAIL} onChange={handleChange} required /></div>
            )}
            {contactType === 'Phone' && (
              <div className="contact-form-group"><label>Phone Number*</label><input type="tel" name="PHONE" value={formData.PHONE} onChange={handleChange} required /></div>
            )}
            {contactType === 'Mobile' && (
              <div className="contact-form-group"><label>Mobile Number*</label><input type="tel" name="MOBILE" value={formData.MOBILE} onChange={handleChange} required /></div>
            )}
            {contactType === 'Fax' && (
              <div className="contact-form-group"><label>Fax Number*</label><input type="tel" name="FAX" value={formData.FAX} onChange={handleChange} required /></div>
            )}
          </div>
        </div>

        <AddressBlock title="Home Address" prefix="HOME" countries={countries} states={states} formData={formData} handleChange={handleChange} />
        <AddressBlock title="Mailing Address" prefix="MAILING" countries={countries} states={states} formData={formData} handleChange={handleChange} />

        <div className="contact-form-buttons">
          <SubmitButton />
          <button type="button" className="contact-cancel-button" onClick={onBackClick}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
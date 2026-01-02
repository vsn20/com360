'use client';

import React, { useState, useEffect } from 'react';
import { updateContact, fetchContactById } from '@/app/serverActions/Contacts/actions';
import './contact.css';

// --- Helper Components ---

// Re-usable Address Block Component (Renders View or Edit Inputs)
function AddressBlock({
  countries,
  states,
  prefix,
  formData,
  handleChange,
  isEditing,
  contactDetails,
}) {
  const data = isEditing ? formData : contactDetails;

  const countryId = data?.[`${prefix}_COUNTRY_ID`] ?? '';
  const stateId = data?.[`${prefix}_STATE_ID`] ?? '';
  const customState = data?.[`${prefix}_CUSTOM_STATE`] ?? '';

  const isUS = String(countryId) === '185';

  const getCountryName = (id) => countries.find(c => String(c.ID) === String(id))?.VALUE || '-';
  const getStateName = (id) => states.find(s => String(s.ID) === String(id))?.VALUE || '-';

  return (
    <>
      {isEditing ? (
        <>
          <div className="contact_form-row">
            <div className="contact_form-group">
              <label>Address Line 1</label>
              <input name={`${prefix}_ADDR_LINE1`} value={formData?.[`${prefix}_ADDR_LINE1`] || ''} onChange={handleChange} />
            </div>
            <div className="contact_form-group">
              <label>Address Line 2</label>
              <input name={`${prefix}_ADDR_LINE2`} value={formData?.[`${prefix}_ADDR_LINE2`] || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="contact_form-row">
            <div className="contact_form-group">
              <label>Address Line 3</label>
              <input name={`${prefix}_ADDR_LINE3`} value={formData?.[`${prefix}_ADDR_LINE3`] || ''} onChange={handleChange} />
            </div>
            <div className="contact_form-group">
              <label>City</label>
              <input name={`${prefix}_CITY`} value={formData?.[`${prefix}_CITY`] || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="contact_form-row">
            <div className="contact_form-group">
              <label>Country</label>
              <select name={`${prefix}_COUNTRY_ID`} value={countryId || '185'} onChange={handleChange}>
                <option value="">Select Country</option>
                {countries.map((c) => (
                  <option key={c.ID} value={String(c.ID)}>{c.VALUE}</option>
                ))}
              </select>
            </div>
            <div className="contact_form-group">
              <label>State</label>
              <select name={`${prefix}_STATE_ID`} value={stateId || ''} onChange={handleChange} disabled={!isUS}>
                <option value="">Select State</option>
                {states.map((s) => (
                  <option key={s.ID} value={String(s.ID)}>{s.VALUE}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="contact_form-row">
            <div className="contact_form-group">
              <label>Custom State</label>
              <input
                name={`${prefix}_CUSTOM_STATE`}
                value={customState || ''}
                onChange={handleChange}
                disabled={isUS}
                placeholder={isUS ? 'N/A (Use State dropdown)' : 'Enter state/province'}
              />
            </div>
            <div className="contact_form-group">
              <label>Postal Code</label>
              <input name={`${prefix}_POSTAL_CODE`} value={formData?.[`${prefix}_POSTAL_CODE`] || ''} onChange={handleChange} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="contact_view-details">
            <div className="contact_details-row">
              <div className="contact_details-group">
                <label>Address Line 1</label>
                <p>{data?.[`${prefix}_ADDR_LINE1`] || '-'}</p>
              </div>
              <div className="contact_details-group">
                <label>Address Line 2</label>
                <p>{data?.[`${prefix}_ADDR_LINE2`] || '-'}</p>
              </div>
            </div>
            <div className="contact_details-row">
              <div className="contact_details-group">
                <label>Address Line 3</label>
                <p>{data?.[`${prefix}_ADDR_LINE3`] || '-'}</p>
              </div>
              <div className="contact_details-group">
                <label>City</label>
                <p>{data?.[`${prefix}_CITY`] || '-'}</p>
              </div>
            </div>
            <div className="contact_details-row">
              <div className="contact_details-group">
                <label>Country</label>
                <p>{getCountryName(countryId)}</p>
              </div>
              <div className="contact_details-group">
                <label>State</label>
                <p>{isUS ? getStateName(stateId) : customState || '-'}</p>
              </div>
            </div>
            <div className="contact_details-row">
              <div className="contact_details-group">
                <label>Postal Code</label>
                <p>{data?.[`${prefix}_POSTAL_CODE`] || '-'}</p>
              </div>
              <div className="contact_details-group"></div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// --- Main Edit Form Component ---
export default function EditContactForm({
  selectedContactId,
  accounts,
  suborgs,
  countries,
  states,
  orgid,
  contactTypes,
  userSuborgId,
  onBackClick,
  onSaveSuccess,
  aiPrefilledData,
}) {
  const [formData, setFormData] = useState(null);
  const [contactDetails, setContactDetails] = useState(null);
  const [suborgName, setSuborgName] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [editingCoreInfo, setEditingCoreInfo] = useState(false);
  const [editingHomeAddress, setEditingHomeAddress] = useState(false);
  const [editingMailingAddress, setEditingMailingAddress] = useState(false);

  const [activeTab, setActiveTab] = useState('information');

  const updateSuborgDisplay = (accountId, allAccounts, allSuborgs, setNameCallback, defaultSuborgId = null) => {
    const accountIdStr = accountId ? String(accountId) : '';
    const selectedAccount = allAccounts.find((a) => String(a.ACCNT_ID) === accountIdStr);

    if (selectedAccount && selectedAccount.suborgid) {
      const suborg = allSuborgs.find((s) => s.suborgid === selectedAccount.suborgid);
      setNameCallback(suborg ? suborg.suborgname : 'N/A');
      return selectedAccount.suborgid;
    } else if (defaultSuborgId) {
      // When no account selected, use default suborg (user's suborg)
      const suborg = allSuborgs.find((s) => s.suborgid === defaultSuborgId);
      setNameCallback(suborg ? suborg.suborgname : '');
      return defaultSuborgId;
    } else {
      setNameCallback('');
      return '';
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (selectedContactId) {
      const loadContact = async () => {
        setIsLoading(true);
        setEditingCoreInfo(false);
        setEditingHomeAddress(false);
        setEditingMailingAddress(false);
        try {
          setError(null);
          setSuccess(null);
          const contact = await fetchContactById(selectedContactId);
          const initialFormData = {
            ...contact,
            HOME_COUNTRY_ID: contact.HOME_COUNTRY_ID ? String(contact.HOME_COUNTRY_ID) : '185',
            MAILING_COUNTRY_ID: contact.MAILING_COUNTRY_ID ? String(contact.MAILING_COUNTRY_ID) : '185',
            HOME_STATE_ID: contact.HOME_STATE_ID ? String(contact.HOME_STATE_ID) : '',
            MAILING_STATE_ID: contact.MAILING_STATE_ID ? String(contact.MAILING_STATE_ID) : '',
            ACCOUNT_ID: contact.ACCOUNT_ID ? String(contact.ACCOUNT_ID) : '',
          };

          if (isMounted) {
            setContactDetails(initialFormData);
            setFormData(initialFormData);
            updateSuborgDisplay(initialFormData.ACCOUNT_ID, accounts, suborgs, setSuborgName);
          }
        } catch (err) {
          if (isMounted) {
            setError(`Failed to load contact: ${err.message}`);
            setContactDetails(null);
            setFormData(null);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };
      loadContact();
    }

    return () => {
      isMounted = false;
      setFormData(null);
      setContactDetails(null);
      setError(null);
      setSuccess(null);
      setSuborgName('');
      setEditingCoreInfo(false);
      setEditingHomeAddress(false);
      setEditingMailingAddress(false);
      setActiveTab('information');
      setIsLoading(false);
      setIsSaving(false);
    };
  }, [selectedContactId, accounts, suborgs]);

  // AI Prefilled Data Application
  useEffect(() => {
    if (aiPrefilledData && contactDetails && formData) {
      let hasCore = false;
      let hasHome = false;
      let hasMailing = false;

      // Check Core Info fields
      if (
        aiPrefilledData.ACCOUNT_ID !== null ||
        aiPrefilledData.EMAIL !== null ||
        aiPrefilledData.ALT_EMAIL !== null ||
        aiPrefilledData.PHONE !== null ||
        aiPrefilledData.MOBILE !== null ||
        aiPrefilledData.FAX !== null
      ) {
        hasCore = true;
      }

      // Check Home Address fields
      if (
        aiPrefilledData.HOME_ADDR_LINE1 !== null ||
        aiPrefilledData.HOME_ADDR_LINE2 !== null ||
        aiPrefilledData.HOME_ADDR_LINE3 !== null ||
        aiPrefilledData.HOME_CITY !== null ||
        aiPrefilledData.HOME_COUNTRY_ID !== null ||
        aiPrefilledData.HOME_STATE_ID !== null ||
        aiPrefilledData.HOME_POSTAL_CODE !== null ||
        aiPrefilledData.HOME_CUSTOM_STATE !== null
      ) {
        hasHome = true;
      }

      // Check Mailing Address fields
      if (
        aiPrefilledData.MAILING_ADDR_LINE1 !== null ||
        aiPrefilledData.MAILING_ADDR_LINE2 !== null ||
        aiPrefilledData.MAILING_ADDR_LINE3 !== null ||
        aiPrefilledData.MAILING_CITY !== null ||
        aiPrefilledData.MAILING_COUNTRY_ID !== null ||
        aiPrefilledData.MAILING_STATE_ID !== null ||
        aiPrefilledData.MAILING_POSTAL_CODE !== null ||
        aiPrefilledData.MAILING_CUSTOM_STATE !== null
      ) {
        hasMailing = true;
      }

      if (hasCore) {
        setEditingCoreInfo(true);
        setActiveTab('information');
      } else if (hasHome || hasMailing) {
        setActiveTab('address');
        if (hasHome) setEditingHomeAddress(true);
        if (hasMailing) setEditingMailingAddress(true);
      }

      setFormData(prev => {
        if (!prev) return null;
        const newForm = { ...prev };

        if (aiPrefilledData.ACCOUNT_ID !== null) {
          newForm.ACCOUNT_ID = String(aiPrefilledData.ACCOUNT_ID);
          const newSuborgId = updateSuborgDisplay(aiPrefilledData.ACCOUNT_ID, accounts, suborgs, setSuborgName);
          newForm.SUBORGID = newSuborgId;
        }
        
        if (aiPrefilledData.SUBORGID !== null) newForm.SUBORGID = String(aiPrefilledData.SUBORGID);
        if (aiPrefilledData.EMAIL !== null) newForm.EMAIL = aiPrefilledData.EMAIL;
        if (aiPrefilledData.ALT_EMAIL !== null) newForm.ALT_EMAIL = aiPrefilledData.ALT_EMAIL;
        if (aiPrefilledData.PHONE !== null) newForm.PHONE = aiPrefilledData.PHONE;
        if (aiPrefilledData.MOBILE !== null) newForm.MOBILE = aiPrefilledData.MOBILE;
        if (aiPrefilledData.FAX !== null) newForm.FAX = aiPrefilledData.FAX;

        if (aiPrefilledData.HOME_ADDR_LINE1 !== null) newForm.HOME_ADDR_LINE1 = aiPrefilledData.HOME_ADDR_LINE1;
        if (aiPrefilledData.HOME_ADDR_LINE2 !== null) newForm.HOME_ADDR_LINE2 = aiPrefilledData.HOME_ADDR_LINE2;
        if (aiPrefilledData.HOME_ADDR_LINE3 !== null) newForm.HOME_ADDR_LINE3 = aiPrefilledData.HOME_ADDR_LINE3;
        if (aiPrefilledData.HOME_CITY !== null) newForm.HOME_CITY = aiPrefilledData.HOME_CITY;
        if (aiPrefilledData.HOME_POSTAL_CODE !== null) newForm.HOME_POSTAL_CODE = aiPrefilledData.HOME_POSTAL_CODE;

        if (aiPrefilledData.HOME_COUNTRY_ID !== null) {
          const homeCountryId = String(aiPrefilledData.HOME_COUNTRY_ID);
          newForm.HOME_COUNTRY_ID = homeCountryId;
          const isHomeUS = homeCountryId === '185';
          if (isHomeUS) {
            if (aiPrefilledData.HOME_STATE_ID !== null) newForm.HOME_STATE_ID = String(aiPrefilledData.HOME_STATE_ID);
            newForm.HOME_CUSTOM_STATE = ''; 
          } else {
            newForm.HOME_STATE_ID = ''; 
            if (aiPrefilledData.HOME_CUSTOM_STATE !== null) newForm.HOME_CUSTOM_STATE = aiPrefilledData.HOME_CUSTOM_STATE;
          }
        }

        if (aiPrefilledData.MAILING_ADDR_LINE1 !== null) newForm.MAILING_ADDR_LINE1 = aiPrefilledData.MAILING_ADDR_LINE1;
        if (aiPrefilledData.MAILING_ADDR_LINE2 !== null) newForm.MAILING_ADDR_LINE2 = aiPrefilledData.MAILING_ADDR_LINE2;
        if (aiPrefilledData.MAILING_ADDR_LINE3 !== null) newForm.MAILING_ADDR_LINE3 = aiPrefilledData.MAILING_ADDR_LINE3;
        if (aiPrefilledData.MAILING_CITY !== null) newForm.MAILING_CITY = aiPrefilledData.MAILING_CITY;
        if (aiPrefilledData.MAILING_POSTAL_CODE !== null) newForm.MAILING_POSTAL_CODE = aiPrefilledData.MAILING_POSTAL_CODE;

        if (aiPrefilledData.MAILING_COUNTRY_ID !== null) {
          const mailingCountryId = String(aiPrefilledData.MAILING_COUNTRY_ID);
          newForm.MAILING_COUNTRY_ID = mailingCountryId;
          const isMailingUS = mailingCountryId === '185';
          if (isMailingUS) {
            if (aiPrefilledData.MAILING_STATE_ID !== null) newForm.MAILING_STATE_ID = String(aiPrefilledData.MAILING_STATE_ID);
            newForm.MAILING_CUSTOM_STATE = '';
          } else {
            newForm.MAILING_STATE_ID = '';
            if (aiPrefilledData.MAILING_CUSTOM_STATE !== null) newForm.MAILING_CUSTOM_STATE = aiPrefilledData.MAILING_CUSTOM_STATE;
          }
        }

        return newForm;
      });
    }
  }, [aiPrefilledData, contactDetails, accounts, suborgs]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setError(null);
    setSuccess(null);

    setFormData((prev) => {
      if (!prev) return null;
      const newFormData = { ...prev, [name]: value };

      if (name === 'ACCOUNT_ID') {
        const newSuborgId = updateSuborgDisplay(value, accounts, suborgs, setSuborgName, userSuborgId);
        newFormData.SUBORGID = newSuborgId;
      }

      if (name === 'HOME_COUNTRY_ID') {
        const isNowUS = String(value) === '185';
        newFormData.HOME_STATE_ID = isNowUS ? (prev.HOME_STATE_ID || '') : '';
        newFormData.HOME_CUSTOM_STATE = !isNowUS ? (prev.HOME_CUSTOM_STATE || '') : '';
        newFormData.HOME_COUNTRY_ID = String(value);
      }

      if (name === 'MAILING_COUNTRY_ID') {
        const isNowUS = String(value) === '185';
        newFormData.MAILING_STATE_ID = isNowUS ? (prev.MAILING_STATE_ID || '') : '';
        newFormData.MAILING_CUSTOM_STATE = !isNowUS ? (prev.MAILING_CUSTOM_STATE || '') : '';
        newFormData.MAILING_COUNTRY_ID = String(value);
      }

      if (name === 'HOME_STATE_ID' || name === 'MAILING_STATE_ID') {
        newFormData[name] = String(value);
      }

      return newFormData;
    });
  };

  const handleEdit = (section) => {
    if (!contactDetails) return;
    setError(null);
    setSuccess(null);
    setFormData({ ...contactDetails });
    updateSuborgDisplay(contactDetails.ACCOUNT_ID, accounts, suborgs, setSuborgName);

    if (section === 'core') setEditingCoreInfo(true);
    if (section === 'home') setEditingHomeAddress(true);
    if (section === 'mailing') setEditingMailingAddress(true);
  };

  const handleCancel = (section) => {
    setError(null);
    setSuccess(null);
    if (!contactDetails) return;
    setFormData({ ...contactDetails });
    updateSuborgDisplay(contactDetails.ACCOUNT_ID, accounts, suborgs, setSuborgName);

    if (section === 'core') setEditingCoreInfo(false);
    if (section === 'home') setEditingHomeAddress(false);
    if (section === 'mailing') setEditingMailingAddress(false);
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

  const handleSave = async (section) => {
    if (!formData) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    // Basic Validations for Core section
    if (section === 'core') {
      if (!formData.FIRST_NAME) {
        setError('First Name is required.');
        setIsSaving(false);
        return;
      }
      if (!formData.LAST_NAME) {
        setError('Last Name is required.');
        setIsSaving(false);
        return;
      }
      if (!formData.ACCOUNT_ID && !formData.SUBORGID) {
        setError('Organization is required when no Account is selected.');
        setIsSaving(false);
        return;
      }
    }

    const formDataToSubmit = new FormData();
    formDataToSubmit.append('ROW_ID', contactDetails.ROW_ID);
    formDataToSubmit.append('ORGID', orgid);
    formDataToSubmit.append('section', section);

    Object.entries(formData).forEach(([key, value]) => {
      const valueToSend = (value === null || value === undefined) ? '' : value;
      formDataToSubmit.append(key, valueToSend);
    });

    try {
      const result = await updateContact({}, formDataToSubmit);

      if (result && result.success) {
        const updatedContact = await fetchContactById(selectedContactId);
        const updatedStateData = {
          ...updatedContact,
          HOME_COUNTRY_ID: updatedContact.HOME_COUNTRY_ID ? String(updatedContact.HOME_COUNTRY_ID) : '185',
          MAILING_COUNTRY_ID: updatedContact.MAILING_COUNTRY_ID ? String(updatedContact.MAILING_COUNTRY_ID) : '185',
          HOME_STATE_ID: updatedContact.HOME_STATE_ID ? String(updatedContact.HOME_STATE_ID) : '',
          MAILING_STATE_ID: updatedContact.MAILING_STATE_ID ? String(updatedContact.MAILING_STATE_ID) : '',
          ACCOUNT_ID: updatedContact.ACCOUNT_ID ? String(updatedContact.ACCOUNT_ID) : '',
        };
        setContactDetails(updatedStateData);
        setFormData(updatedStateData);
        updateSuborgDisplay(updatedStateData.ACCOUNT_ID, accounts, suborgs, setSuborgName);
        setSuccess(`${section.charAt(0).toUpperCase() + section.slice(1)} information updated successfully!`);

        if (section === 'core') setEditingCoreInfo(false);
        if (section === 'home') setEditingHomeAddress(false);
        if (section === 'mailing') setEditingMailingAddress(false);

        setTimeout(() => setSuccess(null), 3000);

        if (onSaveSuccess) {
          onSaveSuccess();
        }
      } else {
        setError(result?.error || `Failed to update ${section} information.`);
      }
    } catch (err) {
      setError(`An error occurred while saving: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="contact_edit-container">
        <p>Loading contact details...</p>
      </div>
    );
  }

  if (error && !contactDetails) {
    return (
      <div className="contact_edit-container">
        <div className="contact_header-section">
          <h1 className="contact_title">Edit Contact</h1>
          <button className="contact_back-button" onClick={onBackClick}></button>
        </div>
        <p className="contact_error-message">{error}</p>
      </div>
    );
  }

  if (!contactDetails || !formData) {
    return (
      <div className="contact_edit-container">
        <div className="contact_header-section">
          <h1 className="contact_title">Edit Contact</h1>
          <button className="contact_back-button" onClick={onBackClick}></button>
        </div>
        <p>Contact data not available or still loading...</p>
      </div>
    );
  }

  return (
    <div className="contact_edit-container">
      <div className="contact_header-section">
        <h1 className="contact_title">Edit Contact</h1>
        <button className="contact_back-button" onClick={onBackClick}></button>
      </div>

      <div className="contact_submenu-bar">
        <button
          className={activeTab === 'information' ? 'active' : ''}
          onClick={() => setActiveTab('information')}
        >
          Information
        </button>
        <button
          className={activeTab === 'address' ? 'active' : ''}
          onClick={() => setActiveTab('address')}
        >
          Address
        </button>
      </div>

      {error && <p className="contact_error-message">{error}</p>}
      {success && <p className="contact_success-message">{success}</p>}

      <div className="contact_details-content">
        {activeTab === 'information' && (
          <div className="contact_details-block">
            <div className="contact_details-header">
              <h2>Core Information</h2>
              {!editingCoreInfo && (
                <button className="contact_button" onClick={() => handleEdit('core')}>
                  Edit
                </button>
              )}
            </div>

            {editingCoreInfo ? (
              <>
                <div className="contact_form-row">
                  <div className="contact_form-group">
                    <label>First Name*</label>
                    <input type="text" name="FIRST_NAME" value={formData.FIRST_NAME || ''} onChange={handleChange} required />
                  </div>
                  <div className="contact_form-group">
                    <label>Last Name*</label>
                    <input type="text" name="LAST_NAME" value={formData.LAST_NAME || ''} onChange={handleChange} required />
                  </div>
                </div>
                <div className="contact_form-row">
                  <div className="contact_form-group">
                    <label>Account</label>
                    <select name="ACCOUNT_ID" value={formData.ACCOUNT_ID} onChange={handleChange}>
                      <option value="">Select an Account</option>
                      {accounts.map((acc) => (
                        <option key={String(acc.ACCNT_ID)} value={String(acc.ACCNT_ID)}>{acc.ALIAS_NAME}</option>
                      ))}
                    </select>
                  </div>
                  <div className="contact_form-group">
                    <label>Organization{formData.ACCOUNT_ID ? ' (Auto-filled)' : '*'}</label>
                    {formData.ACCOUNT_ID ? (
                      <>
                        <input type="text" value={suborgName} readOnly placeholder="Select an account" />
                        <input type="hidden" name="SUBORGID" value={formData.SUBORGID || ''} />
                      </>
                    ) : (
                      <select name="SUBORGID" value={formData.SUBORGID || ''} onChange={handleChange} required>
                        <option value="">Select Organization</option>
                        {suborgs.map((sub) => (
                          <option key={sub.suborgid} value={sub.suborgid}>{sub.suborgname}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="contact_form-row">
                  <div className="contact_form-group">
                    <label>Contact Type</label>
                    <select name="CONTACT_TYPE_CD" value={formData.CONTACT_TYPE_CD || ''} onChange={handleChange}>
                      <option value="">Select Contact Type</option>
                      {contactTypes && contactTypes.map((ct) => (
                        <option key={ct.ID} value={ct.VALUE}>{ct.VALUE}</option>
                      ))}
                    </select>
                  </div>
                  <div className="contact_form-group">
                    <label>Job Title</label>
                    <input type="text" name="JOB_TITLE" value={formData.JOB_TITLE || ''} onChange={handleChange} />
                  </div>
                  <div className="contact_form-group">
                    <label>Department</label>
                    <input type="text" name="DEPARTMENT" value={formData.DEPARTMENT || ''} onChange={handleChange} />
                  </div>
                </div>
                <div className="contact_form-row">
                  <div className="contact_form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="checkbox" 
                      name="IS_PRIMARY_CHECKBOX" 
                      checked={formData.IS_PRIMARY === 1 || formData.IS_PRIMARY === '1'} 
                      onChange={(e) => setFormData(prev => ({ ...prev, IS_PRIMARY: e.target.checked ? '1' : '0' }))}
                      style={{ width: 'auto' }}
                    />
                    <label style={{ marginBottom: 0 }}>Is Primary Contact</label>
                    <input type="hidden" name="IS_PRIMARY" value={formData.IS_PRIMARY === 1 || formData.IS_PRIMARY === '1' ? '1' : '0'} />
                  </div>
                </div>
                <div className="contact_form-row">
                  <div className="contact_form-group">
                    <label>Email Address</label>
                    <input type="email" name="EMAIL" value={formData.EMAIL || ''} onChange={handleChange} />
                  </div>
                  <div className="contact_form-group">
                    <label>Alt Email</label>
                    <input type="email" name="ALT_EMAIL" value={formData.ALT_EMAIL || ''} onChange={handleChange} />
                  </div>
                </div>
                <div className="contact_form-row">
                  <div className="contact_form-group">
                    <label>Phone</label>
                    <input type="tel" name="PHONE" value={formData.PHONE || ''} onChange={handleChange} />
                  </div>
                  <div className="contact_form-group">
                    <label>Mobile</label>
                    <input type="tel" name="MOBILE" value={formData.MOBILE || ''} onChange={handleChange} />
                  </div>
                  <div className="contact_form-group">
                    <label>Fax</label>
                    <input type="tel" name="FAX" value={formData.FAX || ''} onChange={handleChange} />
                  </div>
                </div>
                <div className="contact_form-buttons">
                  <button type="button" className="contact_save" onClick={() => handleSave('core')} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Core Info'}
                  </button>
                  <button type="button" className="contact_cancel" onClick={() => handleCancel('core')} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="contact_view-details">
                  <div className="contact_details-row">
                    <div className="contact_details-group">
                      <label>First Name</label>
                      <p>{contactDetails.FIRST_NAME || '-'}</p>
                    </div>
                    <div className="contact_details-group">
                      <label>Last Name</label>
                      <p>{contactDetails.LAST_NAME || '-'}</p>
                    </div>
                  </div>
                  <div className="contact_details-row">
                    <div className="contact_details-group">
                      <label>Account</label>
                      <p>{accounts.find(a => String(a.ACCNT_ID) === String(contactDetails?.ACCOUNT_ID))?.ALIAS_NAME || '-'}</p>
                    </div>
                    <div className="contact_details-group">
                      <label>Organization</label>
                      <p>{suborgs.find(s => s.suborgid === contactDetails?.SUBORGID)?.suborgname || '-'}</p>
                    </div>
                  </div>
                  <div className="contact_details-row">
                    <div className="contact_details-group">
                      <label>Contact Type</label>
                      <p>{contactDetails.CONTACT_TYPE_CD || '-'}</p>
                    </div>
                    <div className="contact_details-group">
                      <label>Job Title</label>
                      <p>{contactDetails.JOB_TITLE || '-'}</p>
                    </div>
                    <div className="contact_details-group">
                      <label>Department</label>
                      <p>{contactDetails.DEPARTMENT || '-'}</p>
                    </div>
                  </div>
                  <div className="contact_details-row">
                    <div className="contact_details-group">
                      <label>Primary Contact</label>
                      <p>{contactDetails.IS_PRIMARY === 1 || contactDetails.IS_PRIMARY === '1' ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                  <div className="contact_details-row">
                    <div className="contact_details-group"><label>Email</label><p>{contactDetails.EMAIL || '-'}</p></div>
                    <div className="contact_details-group"><label>Alt Email</label><p>{contactDetails.ALT_EMAIL || '-'}</p></div>
                  </div>
                  <div className="contact_details-row">
                    <div className="contact_details-group"><label>Phone</label><p>{contactDetails.PHONE || '-'}</p></div>
                    <div className="contact_details-group"><label>Mobile</label><p>{contactDetails.MOBILE || '-'}</p></div>
                    <div className="contact_details-group"><label>Fax</label><p>{contactDetails.FAX || '-'}</p></div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'address' && (
          <>
            <div className="contact_details-block">
              <div className="contact_details-header">
                <h2>Home Address</h2>
                {!editingHomeAddress && (
                  <button className="contact_button" onClick={() => handleEdit('home')}>
                    Edit
                  </button>
                )}
              </div>
              <AddressBlock
                prefix="HOME"
                countries={countries}
                states={states}
                formData={formData}
                handleChange={handleChange}
                isEditing={editingHomeAddress}
                contactDetails={contactDetails}
              />
              {editingHomeAddress && (
                <div className="contact_form-buttons">
                  <button type="button" className="contact_save" onClick={() => handleSave('home')} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Home Address'}
                  </button>
                  <button type="button" className="contact_cancel" onClick={() => handleCancel('home')} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="contact_details-block">
              <div className="contact_details-header">
                <h2>Mailing Address</h2>
                {!editingMailingAddress && (
                  <button className="contact_button" onClick={() => handleEdit('mailing')}>
                    Edit
                  </button>
                )}
                {editingMailingAddress && (
                   <button 
                    type="button" 
                    onClick={handleCopyHomeAddress} 
                    className="contact_button" 
                    style={{ fontSize: '13px', padding: '6px 12px', marginLeft: '10px' }}
                  >
                    Copy Home Address
                  </button>
                )}
              </div>
              <AddressBlock
                prefix="MAILING"
                countries={countries}
                states={states}
                formData={formData}
                handleChange={handleChange}
                isEditing={editingMailingAddress}
                contactDetails={contactDetails}
              />
              {editingMailingAddress && (
                <div className="contact_form-buttons">
                  <button type="button" className="contact_save" onClick={() => handleSave('mailing')} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Mailing Address'}
                  </button>
                  <button type="button" className="contact_cancel" onClick={() => handleCancel('mailing')} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
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
          <div className="edit_contact_form_row">
            <div className="edit_contact_form_group">
              <label>Address Line 1</label>
              <input name={`${prefix}_ADDR_LINE1`} value={formData?.[`${prefix}_ADDR_LINE1`] || ''} onChange={handleChange} />
            </div>
            <div className="edit_contact_form_group">
              <label>Address Line 2</label>
              <input name={`${prefix}_ADDR_LINE2`} value={formData?.[`${prefix}_ADDR_LINE2`] || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="edit_contact_form_row">
            <div className="edit_contact_form_group">
              <label>Address Line 3</label>
              <input name={`${prefix}_ADDR_LINE3`} value={formData?.[`${prefix}_ADDR_LINE3`] || ''} onChange={handleChange} />
            </div>
            <div className="edit_contact_form_group">
              <label>City</label>
              <input name={`${prefix}_CITY`} value={formData?.[`${prefix}_CITY`] || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="edit_contact_form_row">
            <div className="edit_contact_form_group">
              <label>Country</label>
              <select name={`${prefix}_COUNTRY_ID`} value={countryId || '185'} onChange={handleChange}>
                <option value="">Select Country</option>
                {countries.map((c) => (
                  <option key={c.ID} value={String(c.ID)}>{c.VALUE}</option>
                ))}
              </select>
            </div>
            <div className="edit_contact_form_group">
              <label>State</label>
              <select name={`${prefix}_STATE_ID`} value={stateId || ''} onChange={handleChange} disabled={!isUS}>
                <option value="">Select State</option>
                {states.map((s) => (
                  <option key={s.ID} value={String(s.ID)}>{s.VALUE}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="edit_contact_form_row">
            <div className="edit_contact_form_group">
              <label>Custom State</label>
              <input
                name={`${prefix}_CUSTOM_STATE`}
                value={customState || ''}
                onChange={handleChange}
                disabled={isUS}
                placeholder={isUS ? 'N/A (Use State dropdown)' : 'Enter state/province'}
              />
            </div>
            <div className="edit_contact_form_group">
              <label>Postal Code</label>
              <input name={`${prefix}_POSTAL_CODE`} value={formData?.[`${prefix}_POSTAL_CODE`] || ''} onChange={handleChange} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="edit_contact_view_details">
            <div className="edit_contact_details_row">
              <div className="edit_contact_details_group">
                <label>Address Line 1</label>
                <p>{data?.[`${prefix}_ADDR_LINE1`] || '-'}</p>
              </div>
              <div className="edit_contact_details_group">
                <label>Address Line 2</label>
                <p>{data?.[`${prefix}_ADDR_LINE2`] || '-'}</p>
              </div>
            </div>
            <div className="edit_contact_details_row">
              <div className="edit_contact_details_group">
                <label>Address Line 3</label>
                <p>{data?.[`${prefix}_ADDR_LINE3`] || '-'}</p>
              </div>
              <div className="edit_contact_details_group">
                <label>City</label>
                <p>{data?.[`${prefix}_CITY`] || '-'}</p>
              </div>
            </div>
            <div className="edit_contact_details_row">
              <div className="edit_contact_details_group">
                <label>Country</label>
                <p>{getCountryName(countryId)}</p>
              </div>
              <div className="edit_contact_details_group">
                <label>State</label>
                <p>{isUS ? getStateName(stateId) : customState || '-'}</p>
              </div>
            </div>
            <div className="edit_contact_details_row">
              <div className="edit_contact_details_group">
                <label>Postal Code</label>
                <p>{data?.[`${prefix}_POSTAL_CODE`] || '-'}</p>
              </div>
              <div className="edit_contact_details_group"></div>
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

  // Section Editing States
  const [editingCoreInfo, setEditingCoreInfo] = useState(false);
  const [editingHomeAddress, setEditingHomeAddress] = useState(false);
  const [editingMailingAddress, setEditingMailingAddress] = useState(false);

  // Submenu State
  const [activeTab, setActiveTab] = useState('information');

  // Helper to update suborg name display based on account ID
  const updateSuborgDisplay = (accountId, allAccounts, allSuborgs, setNameCallback) => {
    const accountIdStr = accountId ? String(accountId) : '';
    const selectedAccount = allAccounts.find((a) => String(a.ACCNT_ID) === accountIdStr);

    if (selectedAccount && selectedAccount.suborgid) {
      const suborg = allSuborgs.find((s) => s.suborgid === selectedAccount.suborgid);
      setNameCallback(suborg ? suborg.suborgname : 'N/A');
      return selectedAccount.suborgid;
    } else {
      setNameCallback('');
      return '';
    }
  };

  // Fetch contact details when component mounts or ID changes
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
      console.log('Applying AI prefilled data:', aiPrefilledData);
      
      // Determine which sections have data to edit
      let hasCore = false;
      let hasHome = false;
      let hasMailing = false;

      // Check Core Info fields
      if (
        aiPrefilledData.ACCOUNT_ID !== null ||
        aiPrefilledData.CONTACT_TYPE_CD !== null ||
        aiPrefilledData.EMAIL !== null ||
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

      // Auto-activate editing mode and switch tabs
      if (hasCore) {
        setEditingCoreInfo(true);
        setActiveTab('information');
      } else if (hasHome || hasMailing) {
        // If only address data, switch to address tab
        setActiveTab('address');
        if (hasHome) setEditingHomeAddress(true);
        if (hasMailing) setEditingMailingAddress(true);
      }

      // Apply AI data to form with proper state/custom state handling
      setFormData(prev => {
        if (!prev) return null;

        const newForm = { ...prev };

        // === Core Info Fields ===
        if (aiPrefilledData.ACCOUNT_ID !== null) {
          newForm.ACCOUNT_ID = String(aiPrefilledData.ACCOUNT_ID);
          // Update suborg based on new account
          const newSuborgId = updateSuborgDisplay(aiPrefilledData.ACCOUNT_ID, accounts, suborgs, setSuborgName);
          newForm.SUBORGID = newSuborgId;
        }
        
        if (aiPrefilledData.SUBORGID !== null) {
          newForm.SUBORGID = String(aiPrefilledData.SUBORGID);
        }
        
        if (aiPrefilledData.CONTACT_TYPE_CD !== null) {
          newForm.CONTACT_TYPE_CD = aiPrefilledData.CONTACT_TYPE_CD;
        }
        
        if (aiPrefilledData.EMAIL !== null) {
          newForm.EMAIL = aiPrefilledData.EMAIL;
        }
        
        if (aiPrefilledData.PHONE !== null) {
          newForm.PHONE = aiPrefilledData.PHONE;
        }
        
        if (aiPrefilledData.MOBILE !== null) {
          newForm.MOBILE = aiPrefilledData.MOBILE;
        }
        
        if (aiPrefilledData.FAX !== null) {
          newForm.FAX = aiPrefilledData.FAX;
        }

        // === Home Address Fields ===
        if (aiPrefilledData.HOME_ADDR_LINE1 !== null) {
          newForm.HOME_ADDR_LINE1 = aiPrefilledData.HOME_ADDR_LINE1;
        }
        
        if (aiPrefilledData.HOME_ADDR_LINE2 !== null) {
          newForm.HOME_ADDR_LINE2 = aiPrefilledData.HOME_ADDR_LINE2;
        }
        
        if (aiPrefilledData.HOME_ADDR_LINE3 !== null) {
          newForm.HOME_ADDR_LINE3 = aiPrefilledData.HOME_ADDR_LINE3;
        }
        
        if (aiPrefilledData.HOME_CITY !== null) {
          newForm.HOME_CITY = aiPrefilledData.HOME_CITY;
        }
        
        if (aiPrefilledData.HOME_POSTAL_CODE !== null) {
          newForm.HOME_POSTAL_CODE = aiPrefilledData.HOME_POSTAL_CODE;
        }

        // Handle Home Country and State/Custom State
        if (aiPrefilledData.HOME_COUNTRY_ID !== null) {
          const homeCountryId = String(aiPrefilledData.HOME_COUNTRY_ID);
          newForm.HOME_COUNTRY_ID = homeCountryId;
          const isHomeUS = homeCountryId === '185';
          
          if (isHomeUS) {
            // US selected - use state dropdown
            if (aiPrefilledData.HOME_STATE_ID !== null) {
              newForm.HOME_STATE_ID = String(aiPrefilledData.HOME_STATE_ID);
            }
            newForm.HOME_CUSTOM_STATE = ''; // Clear custom state
          } else {
            // Non-US - use custom state
            newForm.HOME_STATE_ID = ''; // Clear state dropdown
            if (aiPrefilledData.HOME_CUSTOM_STATE !== null) {
              newForm.HOME_CUSTOM_STATE = aiPrefilledData.HOME_CUSTOM_STATE;
            }
          }
        } else {
          // Country not changed by AI, but state might be
          if (aiPrefilledData.HOME_STATE_ID !== null) {
            newForm.HOME_STATE_ID = String(aiPrefilledData.HOME_STATE_ID);
          }
          if (aiPrefilledData.HOME_CUSTOM_STATE !== null) {
            newForm.HOME_CUSTOM_STATE = aiPrefilledData.HOME_CUSTOM_STATE;
          }
        }

        // === Mailing Address Fields ===
        if (aiPrefilledData.MAILING_ADDR_LINE1 !== null) {
          newForm.MAILING_ADDR_LINE1 = aiPrefilledData.MAILING_ADDR_LINE1;
        }
        
        if (aiPrefilledData.MAILING_ADDR_LINE2 !== null) {
          newForm.MAILING_ADDR_LINE2 = aiPrefilledData.MAILING_ADDR_LINE2;
        }
        
        if (aiPrefilledData.MAILING_ADDR_LINE3 !== null) {
          newForm.MAILING_ADDR_LINE3 = aiPrefilledData.MAILING_ADDR_LINE3;
        }
        
        if (aiPrefilledData.MAILING_CITY !== null) {
          newForm.MAILING_CITY = aiPrefilledData.MAILING_CITY;
        }
        
        if (aiPrefilledData.MAILING_POSTAL_CODE !== null) {
          newForm.MAILING_POSTAL_CODE = aiPrefilledData.MAILING_POSTAL_CODE;
        }

        // Handle Mailing Country and State/Custom State
        if (aiPrefilledData.MAILING_COUNTRY_ID !== null) {
          const mailingCountryId = String(aiPrefilledData.MAILING_COUNTRY_ID);
          newForm.MAILING_COUNTRY_ID = mailingCountryId;
          const isMailingUS = mailingCountryId === '185';
          
          if (isMailingUS) {
            // US selected - use state dropdown
            if (aiPrefilledData.MAILING_STATE_ID !== null) {
              newForm.MAILING_STATE_ID = String(aiPrefilledData.MAILING_STATE_ID);
            }
            newForm.MAILING_CUSTOM_STATE = ''; // Clear custom state
          } else {
            // Non-US - use custom state
            newForm.MAILING_STATE_ID = ''; // Clear state dropdown
            if (aiPrefilledData.MAILING_CUSTOM_STATE !== null) {
              newForm.MAILING_CUSTOM_STATE = aiPrefilledData.MAILING_CUSTOM_STATE;
            }
          }
        } else {
          // Country not changed by AI, but state might be
          if (aiPrefilledData.MAILING_STATE_ID !== null) {
            newForm.MAILING_STATE_ID = String(aiPrefilledData.MAILING_STATE_ID);
          }
          if (aiPrefilledData.MAILING_CUSTOM_STATE !== null) {
            newForm.MAILING_CUSTOM_STATE = aiPrefilledData.MAILING_CUSTOM_STATE;
          }
        }

        console.log('New form data after AI application:', newForm);
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

      // If the account ID changed, update the suborg fields
      if (name === 'ACCOUNT_ID') {
        const newSuborgId = updateSuborgDisplay(value, accounts, suborgs, setSuborgName);
        newFormData.SUBORGID = newSuborgId;
      }

      // If country changes, clear the irrelevant state field
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

      // Ensure state ID is stored as string if selected
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

  const handleSave = async (section) => {
    if (!formData) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    // Basic Validations
    if (section === 'core') {
      if (!formData.ACCOUNT_ID) {
        setError('Account is required.');
        setIsSaving(false);
        return;
      }
      if (!formData.CONTACT_TYPE_CD) {
        setError('Contact Type is required.');
        setIsSaving(false);
        return;
      }
      const contactType = formData.CONTACT_TYPE_CD?.toUpperCase();
      if (!contactType || !(formData[contactType]?.trim())) {
        setError(`${formData.CONTACT_TYPE_CD || 'Selected Contact Type'} value is required.`);
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

  // --- Render Logic ---

  if (isLoading) {
    return (
      <div className="edit_contact_container">
        <p className="edit_contact_loading_message">Loading contact details...</p>
      </div>
    );
  }

  if (error && !contactDetails) {
    return (
      <div className="edit_contact_container">
        <div className="edit_contact_header_section">
          <h1 className="edit_contact_title">Edit Contact</h1>
          <button className="edit_contact_back_button" onClick={onBackClick}></button>
        </div>
        <p className="edit_contact_error_message">{error}</p>
      </div>
    );
  }

  if (!contactDetails || !formData) {
    return (
      <div className="edit_contact_container">
        <div className="edit_contact_header_section">
          <h1 className="edit_contact_title">Edit Contact</h1>
          <button className="edit_contact_back_button" onClick={onBackClick}></button>
        </div>
        <p>Contact data not available or still loading...</p>
      </div>
    );
  }

  const contactType = formData.CONTACT_TYPE_CD;

  return (
    <div className="edit_contact_container">
      <div className="edit_contact_header_section">
        <h1 className="edit_contact_title">Edit Contact</h1>
        <button className="edit_contact_back_button" onClick={onBackClick}></button>
      </div>

      <div className="edit_contact_submenu_bar">
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

      {error && <p className="edit_contact_error_message">{error}</p>}
      {success && <p className="edit_contact_success_message">{success}</p>}

      <div className="edit_contact_details_content">
        {activeTab === 'information' && (
          <div className="edit_contact_details_block">
            <div className="edit_contact_details_header">
              <h3 className="edit_contact_details_header_title">Core Information</h3>
              {!editingCoreInfo && (
                <div className="edit_contact_details_buttons">
                  <button className="edit_contact_edit_button" onClick={() => handleEdit('core')}>
                    Edit
                  </button>
                </div>
              )}
            </div>

            {editingCoreInfo ? (
              <>
                <div className="edit_contact_form_row">
                  <div className="edit_contact_form_group">
                    <label>Account*</label>
                    <select name="ACCOUNT_ID" value={formData.ACCOUNT_ID} onChange={handleChange} required>
                      <option value="">Select an Account</option>
                      {accounts.map((acc) => (
                        <option key={String(acc.ACCNT_ID)} value={String(acc.ACCNT_ID)}>{acc.ALIAS_NAME}</option>
                      ))}
                    </select>
                  </div>
                  <div className="edit_contact_form_group">
                    <label>Organization (Auto-filled)</label>
                    <input type="text" value={suborgName} readOnly placeholder="Select an account" />
                    <input type="hidden" name="SUBORGID" value={formData.SUBORGID || ''} />
                  </div>
                </div>
                <div className="edit_contact_form_row">
                  <div className="edit_contact_form_group">
                    <label>Contact Type*</label>
                    <select name="CONTACT_TYPE_CD" value={formData.CONTACT_TYPE_CD} onChange={handleChange} required>
                      <option value="">Select Contact Type</option>
                      <option value="Email">Email</option>
                      <option value="Phone">Phone</option>
                      <option value="Mobile">Mobile</option>
                      <option value="Fax">Fax</option>
                    </select>
                  </div>
                  {contactType === 'Email' && (
                    <div className="edit_contact_form_group"><label>Email Address*</label><input type="email" name="EMAIL" value={formData.EMAIL || ''} onChange={handleChange} required /></div>
                  )}
                  {contactType === 'Phone' && (
                    <div className="edit_contact_form_group"><label>Phone Number*</label><input type="tel" name="PHONE" value={formData.PHONE || ''} onChange={handleChange} required /></div>
                  )}
                  {contactType === 'Mobile' && (
                    <div className="edit_contact_form_group"><label>Mobile Number*</label><input type="tel" name="MOBILE" value={formData.MOBILE || ''} onChange={handleChange} required /></div>
                  )}
                  {contactType === 'Fax' && (
                    <div className="edit_contact_form_group"><label>Fax Number*</label><input type="tel" name="FAX" value={formData.FAX || ''} onChange={handleChange} required /></div>
                  )}
                </div>
                <div className="edit_contact_form_buttons">
                  <button type="button" className="edit_contact_submit_button" onClick={() => handleSave('core')} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Core Info'}
                  </button>
                  <button type="button" className="edit_contact_cancel_button" onClick={() => handleCancel('core')} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="edit_contact_view_details">
                  <div className="edit_contact_details_row">
                    <div className="edit_contact_details_group">
                      <label>Account</label>
                      <p>{accounts.find(a => String(a.ACCNT_ID) === String(contactDetails?.ACCOUNT_ID))?.ALIAS_NAME || '-'}</p>
                    </div>
                    <div className="edit_contact_details_group">
                      <label>Organization</label>
                      <p>{suborgs.find(s => s.suborgid === contactDetails?.SUBORGID)?.suborgname || '-'}</p>
                    </div>
                  </div>
                  <div className="edit_contact_details_row">
                    <div className="edit_contact_details_group">
                      <label>Contact Type</label>
                      <p>{contactDetails?.CONTACT_TYPE_CD || '-'}</p>
                    </div>
                    <div className="edit_contact_details_group">
                      <label>Contact Info</label>
                      <p>
                        {contactDetails?.CONTACT_TYPE_CD === 'Email' ? contactDetails.EMAIL :
                         contactDetails?.CONTACT_TYPE_CD === 'Phone' ? contactDetails.PHONE :
                         contactDetails?.CONTACT_TYPE_CD === 'Mobile' ? contactDetails.MOBILE :
                         contactDetails?.CONTACT_TYPE_CD === 'Fax' ? contactDetails.FAX : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'address' && (
          <>
            <div className="edit_contact_details_block">
              <div className="edit_contact_details_header">
                <h3 className="edit_contact_details_header_title">Home Address</h3>
                {!editingHomeAddress && (
                  <div className="edit_contact_details_buttons">
                    <button className="edit_contact_edit_button" onClick={() => handleEdit('home')}>
                      Edit
                    </button>
                  </div>
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
                <div className="edit_contact_form_buttons">
                  <button type="button" className="edit_contact_submit_button" onClick={() => handleSave('home')} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Home Address'}
                  </button>
                  <button type="button" className="edit_contact_cancel_button" onClick={() => handleCancel('home')} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="edit_contact_details_block">
              <div className="edit_contact_details_header">
                <h3 className="edit_contact_details_header_title">Mailing Address</h3>
                {!editingMailingAddress && (
                  <div className="edit_contact_details_buttons">
                    <button className="edit_contact_edit_button" onClick={() => handleEdit('mailing')}>
                      Edit
                    </button>
                  </div>
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
                <div className="edit_contact_form_buttons">
                  <button type="button" className="edit_contact_submit_button" onClick={() => handleSave('mailing')} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Mailing Address'}
                  </button>
                  <button type="button" className="edit_contact_cancel_button" onClick={() => handleCancel('mailing')} disabled={isSaving}>
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
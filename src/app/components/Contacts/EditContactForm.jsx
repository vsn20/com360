'use client';

import React, { useState, useEffect } from 'react';
// We don't need useActionState here because save is handled locally per section
// import { useFormStatus } from 'react-dom'; // Not needed for local button handlers
import { updateContact, fetchContactById } from '@/app/serverActions/Contacts/actions';

import './contact.css'; // Assuming styles are in contacts.css

// --- Helper Components ---

// Re-usable Address Block Component (Renders View or Edit Inputs)
function AddressBlock({
  // title prop removed - handled outside now
  countries,
  states,
  prefix,
  formData, // Current data being edited
  handleChange,
  isEditing, // Prop to control edit mode
  contactDetails, // Original data for view mode
}) {
  // Use formData if editing, otherwise use original contactDetails for viewing
  const data = isEditing ? formData : contactDetails;

  // Ensure data is not null before accessing properties
  const countryId = data?.[`${prefix}_COUNTRY_ID`] ?? '';
  const stateId = data?.[`${prefix}_STATE_ID`] ?? '';
  const customState = data?.[`${prefix}_CUSTOM_STATE`] ?? '';

  const isUS = String(countryId) === '185'; // Always compare as strings

  const getCountryName = (id) => countries.find(c => String(c.ID) === String(id))?.VALUE || '-';
  const getStateName = (id) => states.find(s => String(s.ID) === String(id))?.VALUE || '-';

  return (
    // No wrapping div/block here, rendering controlled by parent
    <>
      {isEditing ? (
        <>
          {/* --- Edit Mode Inputs --- */}
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
                  <option key={c.ID} value={String(c.ID)}>{c.VALUE}</option> // Ensure value is string
                ))}
              </select>
            </div>
            <div className="edit_contact_form_group">
              <label>State</label>
              <select name={`${prefix}_STATE_ID`} value={stateId || ''} onChange={handleChange} disabled={!isUS}>
                <option value="">Select State</option>
                {states.map((s) => (
                  <option key={s.ID} value={String(s.ID)}>{s.VALUE}</option> // Ensure value is string
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
          {/* --- View Mode Details --- */}
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
              <div className="edit_contact_details_group"> {/* Placeholder for alignment */}
              </div>
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
  onSaveSuccess, // Callback to refresh list in parent
}) {
  const [formData, setFormData] = useState(null); // Holds current form values when editing
  const [contactDetails, setContactDetails] = useState(null); // Holds original/saved values
  const [suborgName, setSuborgName] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null); // Local success message per section
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const [isSaving, setIsSaving] = useState(false); // Specific saving state for buttons

  // Section Editing States
  const [editingCoreInfo, setEditingCoreInfo] = useState(false);
  const [editingHomeAddress, setEditingHomeAddress] = useState(false);
  const [editingMailingAddress, setEditingMailingAddress] = useState(false);

  // Submenu State
  const [activeTab, setActiveTab] = useState('information'); // 'information' or 'address'

  // Helper to update suborg name display based on account ID
  const updateSuborgDisplay = (accountId, allAccounts, allSuborgs, setNameCallback) => {
      // Ensure accountId is treated as a string for comparison
      const accountIdStr = accountId ? String(accountId) : '';
      const selectedAccount = allAccounts.find((a) => String(a.ACCNT_ID) === accountIdStr);

      if (selectedAccount && selectedAccount.suborgid) {
          const suborg = allSuborgs.find((s) => s.suborgid === selectedAccount.suborgid);
          setNameCallback(suborg ? suborg.suborgname : 'N/A');
          // Return the suborgid found
          return selectedAccount.suborgid;
      } else {
          setNameCallback('');
          // Return empty if no suborgid found
          return '';
      }
  };

  // Fetch contact details when component mounts or ID changes
  useEffect(() => {
    let isMounted = true; // Flag to prevent state update on unmounted component
    if (selectedContactId) {
      const loadContact = async () => {
        setIsLoading(true);
        setEditingCoreInfo(false); // Reset editing states on load
        setEditingHomeAddress(false);
        setEditingMailingAddress(false);
        try {
          setError(null);
          setSuccess(null);
          const contact = await fetchContactById(selectedContactId);
          // Ensure IDs are strings for reliable state comparisons and dropdown matching
          const initialFormData = {
            ...contact,
            HOME_COUNTRY_ID: contact.HOME_COUNTRY_ID ? String(contact.HOME_COUNTRY_ID) : '185',
            MAILING_COUNTRY_ID: contact.MAILING_COUNTRY_ID ? String(contact.MAILING_COUNTRY_ID) : '185',
            HOME_STATE_ID: contact.HOME_STATE_ID ? String(contact.HOME_STATE_ID) : '',
            MAILING_STATE_ID: contact.MAILING_STATE_ID ? String(contact.MAILING_STATE_ID) : '',
            ACCOUNT_ID: contact.ACCOUNT_ID ? String(contact.ACCOUNT_ID) : '',
          };

          if (isMounted) {
              setContactDetails(initialFormData); // Store original details
              setFormData(initialFormData); // Initialize form data

              // Set initial Suborg Name based on fetched data
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

     // Cleanup function
     return () => {
        isMounted = false; // Set flag to false when unmounting
        // Reset state if component unmounts or ID becomes null
        setFormData(null);
        setContactDetails(null);
        setError(null);
        setSuccess(null);
        setSuborgName('');
        setEditingCoreInfo(false);
        setEditingHomeAddress(false);
        setEditingMailingAddress(false);
        setActiveTab('information');
        setIsLoading(false); // Ensure loading is reset
        setIsSaving(false); // Ensure saving is reset
     };
  }, [selectedContactId, accounts, suborgs]); // Rerun if ID, accounts, or suborgs change


  const handleChange = (e) => {
    const { name, value } = e.target;
    setError(null); // Clear error on change
    setSuccess(null); // Clear success on change

    setFormData((prev) => {
        if (!prev) return null; // Guard against updates before data is loaded
        const newFormData = { ...prev, [name]: value };

        // If the account ID changed, update the suborg fields
        if (name === 'ACCOUNT_ID') {
           const newSuborgId = updateSuborgDisplay(value, accounts, suborgs, setSuborgName);
           newFormData.SUBORGID = newSuborgId; // Update SUBORGID in the form data state
        }
        // If country changes, clear the irrelevant state field and update type consistency
        if (name === 'HOME_COUNTRY_ID') {
            const isNowUS = String(value) === '185';
            newFormData.HOME_STATE_ID = isNowUS ? (prev.HOME_STATE_ID || '') : ''; // Keep state if US, else clear
            newFormData.HOME_CUSTOM_STATE = !isNowUS ? (prev.HOME_CUSTOM_STATE || '') : ''; // Keep custom if not US, else clear
            // Ensure country ID is stored as string
            newFormData.HOME_COUNTRY_ID = String(value);
        }
         if (name === 'MAILING_COUNTRY_ID') {
            const isNowUS = String(value) === '185';
            newFormData.MAILING_STATE_ID = isNowUS ? (prev.MAILING_STATE_ID || '') : '';
            newFormData.MAILING_CUSTOM_STATE = !isNowUS ? (prev.MAILING_CUSTOM_STATE || '') : '';
            // Ensure country ID is stored as string
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
    if (!contactDetails) return; // Don't allow edit if data hasn't loaded
    setError(null);
    setSuccess(null);
    // Reset form data to the last saved state before editing
    setFormData({ ...contactDetails });
     // Ensure suborg name is also reset correctly based on saved details
    updateSuborgDisplay(contactDetails.ACCOUNT_ID, accounts, suborgs, setSuborgName);

    if (section === 'core') setEditingCoreInfo(true);
    if (section === 'home') setEditingHomeAddress(true);
    if (section === 'mailing') setEditingMailingAddress(true);
  };

  const handleCancel = (section) => {
    setError(null);
    setSuccess(null);
     if (!contactDetails) return; // Should not happen, but safeguard
    // Discard changes by resetting form data to original/last saved
    setFormData({ ...contactDetails });
    // Update suborg display based on original/last saved account
    updateSuborgDisplay(contactDetails.ACCOUNT_ID, accounts, suborgs, setSuborgName);

    if (section === 'core') setEditingCoreInfo(false);
    if (section === 'home') setEditingHomeAddress(false);
    if (section === 'mailing') setEditingMailingAddress(false);
  };

  const handleSave = async (section) => {
    if (!formData) return; // Prevent save if form data isn't ready
    setIsSaving(true); // Indicate saving process for this section
    setError(null);
    setSuccess(null);

    // Basic Validations before sending to server
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
    // Add validations for address sections if needed (e.g., postal code format)

    const formDataToSubmit = new FormData();
    formDataToSubmit.append('ROW_ID', contactDetails.ROW_ID); // Use original ID from contactDetails
    formDataToSubmit.append('ORGID', orgid);
    formDataToSubmit.append('section', section);

    // Append ALL fields from the current formData state
    Object.entries(formData).forEach(([key, value]) => {
      // Send empty strings for null/undefined to avoid issues in backend
      const valueToSend = (value === null || value === undefined) ? '' : value;
      formDataToSubmit.append(key, valueToSend);
    });

    try {
      // Call the updateContact server action
      const result = await updateContact({}, formDataToSubmit); // Pass empty state {}

      if (result && result.success) {
        // Fetch the *updated* details to refresh the view
        const updatedContact = await fetchContactById(selectedContactId);
        // Ensure IDs are strings again after fetching
        const updatedStateData = {
             ...updatedContact,
             HOME_COUNTRY_ID: updatedContact.HOME_COUNTRY_ID ? String(updatedContact.HOME_COUNTRY_ID) : '185',
             MAILING_COUNTRY_ID: updatedContact.MAILING_COUNTRY_ID ? String(updatedContact.MAILING_COUNTRY_ID) : '185',
             HOME_STATE_ID: updatedContact.HOME_STATE_ID ? String(updatedContact.HOME_STATE_ID) : '',
             MAILING_STATE_ID: updatedContact.MAILING_STATE_ID ? String(updatedContact.MAILING_STATE_ID) : '',
             ACCOUNT_ID: updatedContact.ACCOUNT_ID ? String(updatedContact.ACCOUNT_ID) : '',
        };
        setContactDetails(updatedStateData); // Update the 'original/saved' state
        setFormData(updatedStateData); // Reset form state to the newly saved state
        updateSuborgDisplay(updatedStateData.ACCOUNT_ID, accounts, suborgs, setSuborgName); // Update display name
        setSuccess(`${section.charAt(0).toUpperCase() + section.slice(1)} information updated successfully!`);

        // Exit edit mode for the saved section
        if (section === 'core') setEditingCoreInfo(false);
        if (section === 'home') setEditingHomeAddress(false);
        if (section === 'mailing') setEditingMailingAddress(false);

        // Clear success message after a delay
        setTimeout(() => setSuccess(null), 3000);

        // Notify parent to refresh list if necessary
        if (onSaveSuccess) {
            onSaveSuccess(); // Call the callback passed from parent
        }

      } else {
        setError(result?.error || `Failed to update ${section} information.`);
      }
    } catch (err) {
      setError(`An error occurred while saving: ${err.message}`);
    } finally {
      setIsSaving(false); // Finish saving process
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

  // Show error only if loading failed completely
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

   // Guard against rendering before data is loaded and ready
   if (!contactDetails || !formData) {
     return (
        <div className="edit_contact_container">
            <div className="edit_contact_header_section">
                 <h1 className="edit_contact_title">Edit Contact</h1>
                 <button className="edit_contact_back_button" onClick={onBackClick}></button>
            </div>
            {/* Display loading or a placeholder */}
            <p>Contact data not available or still loading...</p>
        </div>
     );
   }


  const contactType = formData.CONTACT_TYPE_CD; // Needed for dynamic fields in Core Info

  return (
    <div className="edit_contact_container">
      <div className="edit_contact_header_section">
        <h1 className="edit_contact_title">Edit Contact</h1>
        <button className="edit_contact_back_button" onClick={onBackClick}></button>
      </div>

      {/* --- Submenu Bar --- */}
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
        {/* Add other tabs like 'Documents' here if needed */}
      </div>

      {/* Display Global/Persistent Messages - Placed below submenu */}
      {/* Show non-loading errors here */}
      {error && <p className="edit_contact_error_message">{error}</p>}
      {success && <p className="edit_contact_success_message">{success}</p>}

      {/* --- Content Area --- */}
      <div className="edit_contact_details_content">

        {/* --- Information Tab Content --- */}
        {activeTab === 'information' && (
          <div className="edit_contact_details_block"> {/* Use the specific CSS class */}
            <div className="edit_contact_details_header"> {/* Use the specific CSS class */}
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
                {/* --- Edit Mode --- */}
                  <div className="edit_contact_form_row">
                    <div className="edit_contact_form_group">
                      <label>Account*</label>
                      <select name="ACCOUNT_ID" value={formData.ACCOUNT_ID} onChange={handleChange} required>
                        <option value="">Select an Account</option>
                        {accounts.map((acc) => (
                           // Ensure key and value are strings
                          <option key={String(acc.ACCNT_ID)} value={String(acc.ACCNT_ID)}>{acc.ALIAS_NAME}</option>
                        ))}
                      </select>
                    </div>
                    <div className="edit_contact_form_group">
                      <label>Organization (Auto-filled)</label>
                      <input type="text" value={suborgName} readOnly placeholder="Select an account" />
                      {/* SUBORGID is updated internally in handleChange */}
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
                    {/* Dynamic Contact Fields */}
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
                     {/* No <form> needed here, using onClick for save */}
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
                {/* --- View Mode --- */}
                <div className="edit_contact_view_details">
                    <div className="edit_contact_details_row">
                        <div className="edit_contact_details_group">
                            <label>Account</label>
                             {/* Ensure comparison uses string */}
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
        )} {/* End of Information Tab */}

        {/* --- Address Tab Content --- */}
        {activeTab === 'address' && (
          <>
            {/* --- Home Address Block --- */}
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

            {/* --- Mailing Address Block --- */}
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
        )} {/* End of Address Tab */}
         {/* Add other tab content containers here */}
         {/* e.g., {activeTab === 'documents' && ( ... )} */}
      </div> {/* End of content area */}
    </div> // End of main container
  );
}


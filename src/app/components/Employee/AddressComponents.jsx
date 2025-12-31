'use client';
import React, { useState } from 'react';

export const WorkAddress = ({
  editing,
  setEditing,
  onCancel,
  formData,
  handleFormChange,
  onSave,
  employeeDetails,
  countries,
  states,
  canEdit,
  helpers,
  isSaving,
  onCopyHomeAddress // New Prop
}) => {
  const { getCountryName, getStateName } = helpers;
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyClick = () => {
    if (onCopyHomeAddress) {
      setIsCopying(true);
      onCopyHomeAddress();
      setTimeout(() => setIsCopying(false), 500);
    }
  };

  return (
    <div className="role-details-block96">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>
        <h3 style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>Work Address</h3>
        {editing && (
          <button 
            type="button" 
            onClick={handleCopyClick}
            className="account_copy_button"
            disabled={isCopying}
          >
            {isCopying ? 'Copying...' : 'Copy Home Address'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave('workAddress'); }}>
           <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 1</label>
                      <input type="text" name="workAddrLine1" value={formData.workAddrLine1} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Address Line 2</label>
                      <input type="text" name="workAddrLine2" value={formData.workAddrLine2} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 3</label>
                      <input type="text" name="workAddrLine3" value={formData.workAddrLine3} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>City</label>
                      <input type="text" name="workCity" value={formData.workCity} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Country</label>
                      <select name="workCountryId" value={formData.workCountryId} onChange={handleFormChange}>
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
                      <select name="workStateId" value={formData.workStateId} onChange={handleFormChange} disabled={formData.workCountryId !== '185'}>
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
                      <label>Custom State Name</label>
                      <input type="text" name="workStateNameCustom" value={formData.workStateNameCustom} onChange={handleFormChange} disabled={formData.workCountryId === '185'} />
                    </div>
                    <div className="form-group">
                      <label>Postal Code</label>
                      <input type="text" name="workPostalCode" value={formData.workPostalCode} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-buttons">
                    {isSaving && <p style={{ color: '#007bff', marginBottom: '10px' }}>Saving changes, please wait...</p>}
                    <button type="submit" className="save" disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="cancel" onClick={onCancel} disabled={isSaving}>Cancel</button>
                  </div>
        </form>
      ) : (
        <div className="view-details">
            <div className="details-row">
            <div className="details-g">
                <label>Address Line 1</label>
                <p>{employeeDetails.WORK_ADDR_LINE1 || '-'}</p>
            </div>
            <div className="details-g">
                <label>Address Line 2</label>
                <p>{employeeDetails.WORK_ADDR_LINE2 || '-'}</p>
            </div>
            </div>
            <div className="details-row">
            <div className="details-g">
                <label>Address Line 3</label>
                <p>{employeeDetails.WORK_ADDR_LINE3 || '-'}</p>
            </div>
            <div className="details-g">
                <label>City</label>
                <p>{employeeDetails.WORK_CITY || '-'}</p>
            </div>
            </div>
            <div className="details-row">
            <div className="details-g">
                <label>Country</label>
                <p>{getCountryName(employeeDetails.WORK_COUNTRY_ID)}</p>
            </div>
            <div className="details-g">
                <label>State</label>
                <p>{employeeDetails.WORK_STATE_ID ? getStateName(employeeDetails.WORK_STATE_ID) : employeeDetails.WORK_STATE_NAME_CUSTOM || '-'}</p>
            </div>
            </div>
            <div className="details-row">
            <div className="details-g">
                <label>Postal Code</label>
                <p>{employeeDetails.WORK_POSTAL_CODE || '-'}</p>
            </div>
            </div>
          {canEdit && <button className="button" onClick={() => setEditing(true)}>Edit</button>}
        </div>
      )}
    </div>
  );
};

export const HomeAddress = ({
  editing,
  setEditing,
  onCancel,
  formData,
  handleFormChange,
  onSave,
  employeeDetails,
  countries,
  states,
  canEdit,
  helpers,
  isSaving,
  onCopyWorkAddress // New Prop
}) => {
  const { getCountryName, getStateName } = helpers;
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyClick = () => {
    if (onCopyWorkAddress) {
      setIsCopying(true);
      onCopyWorkAddress();
      setTimeout(() => setIsCopying(false), 500);
    }
  };

  return (
    <div className="role-details-block96">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>
        <h3 style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>Home Address</h3>
        {editing && (
          <button 
            type="button" 
            onClick={handleCopyClick}
            className="account_copy_button"
            disabled={isCopying}
          >
            {isCopying ? 'Copying...' : 'Copy Work Address'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave('homeAddress'); }}>
          <div className="form-row">
            <div className="form-group">
                <label>Address Line 1</label>
                <input type="text" name="homeAddrLine1" value={formData.homeAddrLine1} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>Address Line 2</label>
                <input type="text" name="homeAddrLine2" value={formData.homeAddrLine2} onChange={handleFormChange} />
            </div>
            </div>
            <div className="form-row">
            <div className="form-group">
                <label>Address Line 3</label>
                <input type="text" name="homeAddrLine3" value={formData.homeAddrLine3} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>City</label>
                <input type="text" name="homeCity" value={formData.homeCity} onChange={handleFormChange} />
            </div>
            </div>
            <div className="form-row">
            <div className="form-group">
                <label>Country</label>
                <select name="homeCountryId" value={formData.homeCountryId} onChange={handleFormChange}>
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
                <select name="homeStateId" value={formData.homeStateId} onChange={handleFormChange} disabled={formData.homeCountryId !== '185'}>
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
                <label>Custom State Name</label>
                <input type="text" name="homeStateNameCustom" value={formData.homeStateNameCustom} onChange={handleFormChange} disabled={formData.homeCountryId === '185'} />
            </div>
            <div className="form-group">
                <label>Postal Code</label>
                <input type="text" name="homePostalCode" value={formData.homePostalCode} onChange={handleFormChange} />
            </div>
            </div>
            <div className="form-buttons">
            {isSaving && <p style={{ color: '#007bff', marginBottom: '10px' }}>Saving changes, please wait...</p>}
            <button type="submit" className="save" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="cancel" onClick={onCancel} disabled={isSaving}>Cancel</button>
            </div>
        </form>
      ) : (
        <div className="view-details">
          <div className="details-row">
            <div className="details-g">
                <label>Address Line 1</label>
                <p>{employeeDetails.HOME_ADDR_LINE1 || '-'}</p>
            </div>
            <div className="details-g">
                <label>Address Line 2</label>
                <p>{employeeDetails.HOME_ADDR_LINE2 || '-'}</p>
            </div>
            </div>
            <div className="details-row">
            <div className="details-g">
                <label>Address Line 3</label>
                <p>{employeeDetails.HOME_ADDR_LINE3 || '-'}</p>
            </div>
            <div className="details-g">
                <label>City</label>
                <p>{employeeDetails.HOME_CITY || '-'}</p>
            </div>
            </div>
            <div className="details-row">
            <div className="details-g">
                <label>Country</label>
                <p>{getCountryName(employeeDetails.HOME_COUNTRY_ID)}</p>
            </div>
            <div className="details-g">
                <label>State</label>
                <p>{employeeDetails.HOME_STATE_ID ? getStateName(employeeDetails.HOME_STATE_ID) : employeeDetails.HOME_STATE_NAME_CUSTOM || '-'}</p>
            </div>
            </div>
            <div className="details-row">
            <div className="details-g">
                <label>Postal Code</label>
                <p>{employeeDetails.HOME_POSTAL_CODE || '-'}</p>
            </div>
            </div>
          {canEdit && <button className="button" onClick={() => setEditing(true)}>Edit</button>}
        </div>
      )}
    </div>
  );
};

export const EmergencyContact = ({
  editing,
  setEditing,
  onCancel,
  formData,
  handleFormChange,
  onSave,
  employeeDetails,
  countries,
  states,
  canEdit,
  helpers,
  isSaving
}) => {
  const { getCountryName, getStateName } = helpers;
  return (
    <div className="role-details-block96">
      <h3>Emergency Contact</h3>
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave('emergencyContact'); }}>
           <div className="form-row">
            <div className="form-group">
                <label>Name</label>
                <input type="text" name="emergCnctName" value={formData.emergCnctName} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>Phone Number</label>
                <input type="text" name="emergCnctPhoneNumber" value={formData.emergCnctPhoneNumber} onChange={handleFormChange} />
            </div>
            </div>
            <div className="form-row">
            <div className="form-group">
                <label>Email</label>
                <input type="email" name="emergCnctEmail" value={formData.emergCnctEmail} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>Address Line 1</label>
                <input type="text" name="emergCnctAddrLine1" value={formData.emergCnctAddrLine1} onChange={handleFormChange} />
            </div>
            </div>
            <div className="form-row">
            <div className="form-group">
                <label>Address Line 2</label>
                <input type="text" name="emergCnctAddrLine2" value={formData.emergCnctAddrLine2} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>Address Line 3</label>
                <input type="text" name="emergCnctAddrLine3" value={formData.emergCnctAddrLine3} onChange={handleFormChange} />
            </div>
            </div>
            <div className="form-row">
            <div className="form-group">
                <label>City</label>
                <input type="text" name="emergCnctCity" value={formData.emergCnctCity} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>Country</label>
                <select name="emergCnctCountryId" value={formData.emergCnctCountryId} onChange={handleFormChange}>
                <option value="">Select Country</option>
                {countries.map((country) => (
                    <option key={country.ID} value={country.ID}>
                    {country.VALUE}
                    </option>
                ))}
                </select>
            </div>
            </div>
            <div className="form-row">
            <div className="form-group">
                <label>State</label>
                <select name="emergCnctStateId" value={formData.emergCnctStateId} onChange={handleFormChange} disabled={formData.emergCnctCountryId !== '185'}>
                <option value="">Select State</option>
                {states.map((state) => (
                    <option key={state.ID} value={state.ID}>
                    {state.VALUE}
                    </option>
                ))}
                </select>
            </div>
            <div className="form-group">
                <label>Custom State Name</label>
                <input type="text" name="emergCnctStateNameCustom" value={formData.emergCnctStateNameCustom} onChange={handleFormChange} disabled={formData.emergCnctCountryId === '185'} />
            </div>
            </div>
            <div className="form-row">
            <div className="form-group">
                <label>Postal Code</label>
                <input type="text" name="emergCnctPostalCode" value={formData.emergCnctPostalCode} onChange={handleFormChange} />
            </div>
            </div>
            <div className="form-buttons">
            {isSaving && <p style={{ color: '#007bff', marginBottom: '10px' }}>Saving changes, please wait...</p>}
            <button type="submit" className="save" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="cancel" onClick={onCancel} disabled={isSaving}>Cancel</button>
            </div>
        </form>
      ) : (
        <div className="view-details">
           <div className="details-row">
            <div className="details-g">
                <label>Name</label>
                <p>{employeeDetails.EMERG_CNCT_NAME || '-'}</p>
            </div>
            <div className="details-g">
                <label>Phone Number</label>
                <p>{employeeDetails.EMERG_CNCT_PHONE_NUMBER || '-'}</p>
            </div>
            </div>
            <div className="details-row">
            <div className="details-g">
                <label>Email</label>
                <p>{employeeDetails.EMERG_CNCT_EMAIL || '-'}</p>
            </div>
            <div className="details-g">
                <label>Address Line 1</label>
                <p>{employeeDetails.EMERG_CNCT_ADDR_LINE1 || '-'}</p>
            </div>
            </div>
            <div className="details-row">
            <div className="details-g">
                <label>Address Line 2</label>
                <p>{employeeDetails.EMERG_CNCT_ADDR_LINE2 || '-'}</p>
            </div>
            <div className="details-g">
                <label>Address Line 3</label>
                <p>{employeeDetails.EMERG_CNCT_ADDR_LINE3 || '-'}</p>
            </div>
            </div>
            <div className="details-row">
            <div className="details-g">
                <label>City</label>
                <p>{employeeDetails.EMERG_CNCT_CITY || '-'}</p>
            </div>
            <div className="details-g">
                <label>Country</label>
                <p>{getCountryName(employeeDetails.EMERG_CNCT_COUNTRY_ID)}</p>
            </div>
            </div>
            <div className="details-row">
            <div className="details-g">
                <label>State</label>
                <p>{employeeDetails.EMERG_CNCT_STATE_ID ? getStateName(employeeDetails.EMERG_CNCT_STATE_ID) : employeeDetails.EMERG_CNCT_STATE_NAME_CUSTOM || '-'}</p>
            </div>
            <div className="details-g">
                <label>Postal Code</label>
                <p>{employeeDetails.EMERG_CNCT_POSTAL_CODE || '-'}</p>
            </div>
            </div>
          {canEdit && <button className="button" onClick={() => setEditing(true)}>Edit</button>}
        </div>
      )}
    </div>
  );
};
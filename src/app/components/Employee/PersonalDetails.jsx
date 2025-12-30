import React from 'react';
import Image from 'next/image';

const formatDate = (date) => {
  if (!date) return '';
  // Handle YYYY-MM-DD format directly without creating Date object to avoid timezone issues
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = date.split('-');
    return `${month}/${day}/${year}`;
  }
  // Fallback for other date formats
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${d.getFullYear()}`;
};

const PersonalDetails = ({
  editing,
  setEditing,
  onCancel,
  formData,
  handleFormChange,
  onSave,
  employeeDetails,
  canEdit,
  getDisplayProjectId,
  signatureSrc,
  onSignatureFileChange,
  onDeleteSignature,
  isSaving
}) => {
  return (
    <div className="role-details-block96">
      <h3>Personal Details</h3>
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave('personal'); }}>
          <div className="form-row">
            <div className="form-group">
              <label>First Name*</label>
              <input type="text" name="empFstName" value={formData.empFstName} onChange={handleFormChange} required />
            </div>
            <div className="form-group">
              <label>Middle Name</label>
              <input type="text" name="empMidName" value={formData.empMidName} onChange={handleFormChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Last Name*</label>
              <input type="text" name="empLastName" value={formData.empLastName} onChange={handleFormChange} required />
            </div>
            <div className="form-group">
              <label>Preferred Name</label>
              <input type="text" name="empPrefName" value={formData.empPrefName} onChange={handleFormChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email*</label>
              <input type="email" name="email" value={formData.email} onChange={handleFormChange} required />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select name="gender" value={formData.gender} onChange={handleFormChange}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Mobile Number</label>
              <input type="text" name="mobileNumber" value={formData.mobileNumber} onChange={handleFormChange} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleFormChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" name="dob" value={formData.dob} onChange={handleFormChange} className="date-input" />
            </div>
            <div className="form-group">
              <label>SSN</label>
              <input type="text" name="ssn" value={formData.ssn} onChange={handleFormChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>LinkedIn URL</label>
              <input type="url" name="linkedinUrl" value={formData.linkedinUrl} onChange={handleFormChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Employee Number</label>
              <input
                type="text"
                name="employee_number"
                value={formData.employee_number}
                onChange={handleFormChange}
                maxLength="20"
                placeholder="e.g. A12345"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Signature (Upload .jpg)</label>
              {signatureSrc && (
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ border: '1px solid #ccc', display: 'inline-block', padding: '5px' }}>
                    <Image 
                      src={signatureSrc} 
                      alt="Signature" 
                      width={150} 
                      height={60} 
                      unoptimized 
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={onDeleteSignature}
                    style={{ 
                      backgroundColor: '#dc3545', 
                      color: 'white', 
                      border: 'none', 
                      padding: '5px 10px', 
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
              <input 
                type="file" 
                accept="image/jpeg, image/jpg" 
                onChange={onSignatureFileChange}
                className="form-control"
              />
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
          {/* <div className="details-row">
            <div className="details-g">
              <label>Employee ID</label>
              <p>Employee-{getDisplayProjectId(employeeDetails.empid)}</p>
            </div>
          </div> */}
          <div className="details-row">
            <div className="details-g">
              <label>Employee Number</label>
              <p>{employeeDetails.employee_number || 'Not Configured'}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>First Name</label>
              <p>{employeeDetails.EMP_FST_NAME}</p>
            </div>
            <div className="details-g">
              <label>Middle Name</label>
              <p>{employeeDetails.EMP_MID_NAME || '-'}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Last Name</label>
              <p>{employeeDetails.EMP_LAST_NAME}</p>
            </div>
            <div className="details-g">
              <label>Preferred Name</label>
              <p>{employeeDetails.EMP_PREF_NAME || '-'}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Email</label>
              <p>{employeeDetails.email}</p>
            </div>
            <div className="details-g">
              <label>Gender</label>
              <p>{employeeDetails.GENDER || '-'}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Mobile Number</label>
              <p>{employeeDetails.MOBILE_NUMBER || '-'}</p>
            </div>
            <div className="details-g">
              <label>Phone Number</label>
              <p>{employeeDetails.PHONE_NUMBER || '-'}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Date of Birth</label>
              <p>{employeeDetails.DOB ? formatDate(employeeDetails.DOB) : '-'}</p>
            </div>
            <div className="details-g">
              <label>SSN</label>
              {/* CHANGE HERE: Masking logic applied */}
              <p>
                {employeeDetails.SSN 
                  ? `xxxxxx${employeeDetails.SSN.slice(-4)}` 
                  : '-'}
              </p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>LinkedIn URL</label>
              <p>{employeeDetails.LINKEDIN_URL || '-'}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>Signature</label>
              {signatureSrc ? (
                <div style={{ marginTop: '5px', border: '1px solid #eee', display: 'inline-block', padding: '5px' }}>
                  <Image 
                    src={signatureSrc} 
                    alt="Signature" 
                    width={150} 
                    height={60} 
                    unoptimized 
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              ) : (
                <p>-</p>
              )}
            </div>
          </div>
          {canEdit && (
            <button className="button" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      )}
    </div>
  );
};

export default PersonalDetails;
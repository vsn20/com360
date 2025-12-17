import React from 'react';

const PersonalDetails = ({
  editing,
  setEditing,
  formData,
  handleFormChange,
  onSave,
  employeeDetails,
  canEdit,
  getDisplayProjectId
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
                maxLength="5"
                pattern="[0-9]*"
                onInput={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
              />
            </div>
          </div>
          <div className="form-buttons">
            <button type="submit" className="save">Save</button>
            <button type="button" className="cancel" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="view-details">
          <div className="details-row">
            <div className="details-g">
              <label>Employee ID</label>
              <p>Employee-{getDisplayProjectId(employeeDetails.empid)}</p>
            </div>
          </div>
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
              <p>{employeeDetails.DOB ? new Date(employeeDetails.DOB).toLocaleDateString('en-US') : '-'}</p>
            </div>
            <div className="details-g">
              <label>SSN</label>
              <p>{employeeDetails.SSN || '-'}</p>
            </div>
          </div>
          <div className="details-row">
            <div className="details-g">
              <label>LinkedIn URL</label>
              <p>{employeeDetails.LINKEDIN_URL || '-'}</p>
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
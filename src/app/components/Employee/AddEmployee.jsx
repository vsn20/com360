'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addemployee } from '@/app/serverActions/addemployee';
import './addemployee.css';

export default function AddEmployee({ roles, currentrole, orgid, error, employees, leaveTypes, countries, states, departments, payFrequencies, jobTitles, statuses, workerCompClasses }) {
  const router = useRouter();
  const [addform_formError, addform_setFormError] = useState(null);
  const [addform_leaves, addform_setLeaves] = useState({});
  const [addform_workCountryId, addform_setWorkCountryId] = useState('185');
  const [addform_homeCountryId, addform_setHomeCountryId] = useState('185');
  const [addform_emergCnctCountryId, addform_setEmergCnctCountryId] = useState('185');
  const [addform_selectedRoles, addform_setSelectedRoles] = useState([]); // State for selected roles
  const [addform_isDropdownOpen, addform_setIsDropdownOpen] = useState(false); // State for dropdown visibility
  const [addform_isSubmitting, addform_setIsSubmitting] = useState(false); // State to prevent multiple submissions
  const[addform_success,addform_setsuccess]=useState(null);
  const addform_today = new Date().toISOString().split('T')[0];

  const addform_handleRoleToggle = (roleid) => {
    addform_setSelectedRoles((prev) => {
      const newRoles = prev.includes(roleid)
        ? prev.filter((id) => id !== roleid)
        : [...prev, roleid];
      // Ensure uniqueness using Set
      return [...new Set(newRoles)];
    });
  };

  const addform_toggleDropdown = () => {
    addform_setIsDropdownOpen((prev) => !prev);
  };

  const addform_handleSubmit = async (formData) => {
    if (addform_isSubmitting) return; // Prevent multiple submissions
    addform_setIsSubmitting(true);

    // Append currentRole and unique roleids
    formData.append('currentRole', currentrole || '');
    const addform_uniqueRoleIds = [...new Set(addform_selectedRoles)]; // Ensure no duplicates
    addform_uniqueRoleIds.forEach((roleid) => {
      formData.append('roleids', roleid); // Append each unique roleid
    });
    Object.entries(addform_leaves).forEach(([leaveid, noofleaves]) => {
      if (noofleaves !== '') formData.append(`leaves[${leaveid}]`, noofleaves || '0');
    });

    try {
      const addform_result = await addemployee(formData);
      if (addform_result?.error) {
        addform_setFormError(addform_result.error);
        setTimeout(()=>addform_setFormError(null),4000)
      } else {
      addform_setsuccess("Employee added Successfully!");
      setTimeout(()=>addform_setsuccess(null),4000);
      }
    } catch (error) {
      addform_setFormError(`Submission failed: ${error.message}`);
      setTimeout(()=>addform_setsuccess(null),4000);
    } finally {
      addform_setIsSubmitting(false);
    }
  };

  const addform_handleLeaveChange = (leaveid, value) => {
    addform_setLeaves((prev) => ({ ...prev, [leaveid]: value }));
  };

  const addform_employeesWithRoles = employees.map((employee) => {
    const role = roles.find((r) => r.roleid === employee.roleid);
    const rolename = role ? role.rolename : 'Unknown Role';
    return { ...employee, rolename };
  });

  return (
    <div className="add-employee-container">
      <h1>Add Employee</h1>
      {error && <p className="error-message">{error}</p>}
      {addform_formError && <p className="error-message">{addform_formError}</p>}
      {addform_success && <p className="error-message">{addform_success}</p>}
      <form action={addform_handleSubmit}>
        <div className="form-container">
          {/* Personal Details */}
          <div className="form-block">
            <h3>Personal Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="orgid">Organization ID:</label>
                <input
                  type="text"
                  id="orgid"
                  name="orgid"
                  value={orgid || ''}
                  disabled
                />
              </div>
              <div className="form-group">
                <label htmlFor="empFstName">First Name: *</label>
                <input
                  type="text"
                  id="empFstName"
                  name="empFstName"
                  placeholder="Enter First Name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="empMidName">Middle Name:</label>
                <input
                  type="text"
                  id="empMidName"
                  name="empMidName"
                  placeholder="Enter Middle Name"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="empLastName">Last Name: *</label>
                <input
                  type="text"
                  id="empLastName"
                  name="empLastName"
                  placeholder="Enter Last Name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email: *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter Email"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="empPrefName">Preferred Name:</label>
                <input
                  type="text"
                  id="empPrefName"
                  name="empPrefName"
                  placeholder="Enter Preferred Name"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="gender">Gender:</label>
                <select id="gender" name="gender">
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="mobileNumber">Mobile Number:</label>
                <input
                  type="tel"
                  id="mobileNumber"
                  name="mobileNumber"
                  placeholder="Enter Mobile Number"
                />
              </div>
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number:</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  placeholder="Enter Phone Number"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="dob">Date of Birth:</label>
                <input
                  type="date"
                  id="dob"
                  name="dob"
                />
              </div>
              <div className="form-group">
                <label htmlFor="ssn">SSN:</label>
                <input
                  type="text"
                  id="ssn"
                  name="ssn"
                  placeholder="Enter SSN"
                />
              </div>
              <div className="form-group">
                <label htmlFor="linkedinUrl">LinkedIn URL:</label>
                <input
                  type="url"
                  id="linkedinUrl"
                  name="linkedinUrl"
                  placeholder="Enter LinkedIn URL"
                />
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div className="form-block">
            <h3>Employment Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="roleids">Roles: * (Click to select/deselect)</label>
                <div className="custom-select-container">
                  <div
                    className={`custom-select ${addform_isDropdownOpen ? 'open' : ''}`}
                    onClick={addform_toggleDropdown}
                  >
                    <div className="selected-value">
                      {addform_selectedRoles.length > 0
                        ? addform_selectedRoles
                            .map((id) => roles.find((r) => r.roleid === id)?.rolename)
                            .join(', ')
                        : 'Select Roles'}
                    </div>
                    {addform_isDropdownOpen && (
                      <div className="options-container">
                        {roles.map((role) => (
                          <div
                            key={role.roleid}
                            className={`option ${addform_selectedRoles.includes(role.roleid) ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent closing dropdown
                              addform_handleRoleToggle(role.roleid);
                            }}
                          >
                            {role.rolename}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {addform_selectedRoles.length === 0 && (
                    <input type="hidden" name="roleids" value="" disabled /> // Ensure form validation
                  )}
                  {addform_selectedRoles.map((roleid) => (
                    <input key={roleid} type="hidden" name="roleids" value={roleid} />
                  ))}
                </div>
                {addform_selectedRoles.length > 0 && (
                  <div className="selected-roles">
                    <p>Selected Roles: {addform_selectedRoles.map((id) => roles.find((r) => r.roleid === id)?.rolename).join(', ')}</p>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="superior">Superior:</label>
                <select id="superior" name="superior">
                  <option value="">Select a Superior (Optional)</option>
                  {addform_employeesWithRoles.map((employee) => (
                    <option key={employee.empid} value={employee.empid}>
                      {`${employee.empid} - ${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME} (${employee.rolename})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="hireDate">Hire Date: *</label>
                <input
                  type="date"
                  id="hireDate"
                  name="hireDate"
                  defaultValue={addform_today}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="status">Status: *</label>
                <select id="status" name="status" required>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.Name}>
                      {status.Name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="jobTitle">Job Title:</label>
                <select id="jobTitle" name="jobTitle">
                  <option value="">Select Job Title</option>
                  {jobTitles.map((job) => (
                    <option key={job.job_title} value={job.job_title}>
                      {`${job.job_title} (Level: ${job.level})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="payFrequency">Pay Frequency:</label>
                <select id="payFrequency" name="payFrequency">
                  <option value="">Select Pay Frequency</option>
                  {payFrequencies.map((freq) => (
                    <option key={freq.id} value={freq.Name}>
                      {freq.Name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="deptId">Department:</label>
                <select id="deptId" name="deptId">
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="workCompClass">Work Compensation Class:</label>
                <select id="workCompClass" name="workCompClass">
                  <option value="">Select Work Compensation Class</option>
                  {workerCompClasses.map((compClass) => (
                    <option key={compClass.class_code} value={compClass.class_code}>
                      {`${compClass.class_code} - ${compClass.phraseology}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Work Address */}
          <div className="form-block">
            <h3>Work Address</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="workAddrLine1">Address Line 1:</label>
                <input
                  type="text"
                  id="workAddrLine1"
                  name="workAddrLine1"
                  placeholder="Enter Work Address Line 1"
                />
              </div>
              <div className="form-group">
                <label htmlFor="workAddrLine2">Address Line 2:</label>
                <input
                  type="text"
                  id="workAddrLine2"
                  name="workAddrLine2"
                  placeholder="Enter Work Address Line 2"
                />
              </div>
              <div className="form-group">
                <label htmlFor="workAddrLine3">Address Line 3:</label>
                <input
                  type="text"
                  id="workAddrLine3"
                  name="workAddrLine3"
                  placeholder="Enter Work Address Line 3"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="workCity">City:</label>
                <input
                  type="text"
                  id="workCity"
                  name="workCity"
                  placeholder="Enter Work City"
                />
              </div>
              <div className="form-group">
                <label htmlFor="workStateId">State:</label>
                <select
                  id="workStateId"
                  name="workStateId"
                  disabled={addform_workCountryId !== '185'}
                >
                  <option value="">Select State</option>
                  {states.map((state) => (
                    <option key={state.ID} value={state.ID}>
                      {state.VALUE}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="workStateNameCustom">Custom State Name:</label>
                <input
                  type="text"
                  id="workStateNameCustom"
                  name="workStateNameCustom"
                  placeholder="Enter Custom State Name"
                  disabled={addform_workCountryId === '185'}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="workCountryId">Country:</label>
                <select
                  id="workCountryId"
                  name="workCountryId"
                  value={addform_workCountryId}
                  onChange={(e) => addform_setWorkCountryId(e.target.value)}
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
                <label htmlFor="workPostalCode">Postal Code:</label>
                <input
                  type="text"
                  id="workPostalCode"
                  name="workPostalCode"
                  placeholder="Enter Work Postal Code"
                />
              </div>
            </div>
          </div>

          {/* Home Address */}
          <div className="form-block">
            <h3>Home Address</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="homeAddrLine1">Address Line 1:</label>
                <input
                  type="text"
                  id="homeAddrLine1"
                  name="homeAddrLine1"
                  placeholder="Enter Home Address Line 1"
                />
              </div>
              <div className="form-group">
                <label htmlFor="homeAddrLine2">Address Line 2:</label>
                <input
                  type="text"
                  id="homeAddrLine2"
                  name="homeAddrLine2"
                  placeholder="Enter Home Address Line 2"
                />
              </div>
              <div className="form-group">
                <label htmlFor="homeAddrLine3">Address Line 3:</label>
                <input
                  type="text"
                  id="homeAddrLine3"
                  name="homeAddrLine3"
                  placeholder="Enter Home Address Line 3"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="homeCity">City:</label>
                <input
                  type="text"
                  id="homeCity"
                  name="homeCity"
                  placeholder="Enter Home City"
                />
              </div>
              <div className="form-group">
                <label htmlFor="homeStateId">State:</label>
                <select
                  id="homeStateId"
                  name="homeStateId"
                  disabled={addform_homeCountryId !== '185'}
                >
                  <option value="">Select State</option>
                  {states.map((state) => (
                    <option key={state.ID} value={state.ID}>
                      {state.VALUE}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="homeStateNameCustom">Custom State Name:</label>
                <input
                  type="text"
                  id="homeStateNameCustom"
                  name="homeStateNameCustom"
                  placeholder="Enter Custom State Name"
                  disabled={addform_homeCountryId === '185'}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="homeCountryId">Country:</label>
                <select
                  id="homeCountryId"
                  name="homeCountryId"
                  value={addform_homeCountryId}
                  onChange={(e) => addform_setHomeCountryId(e.target.value)}
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
                <label htmlFor="homePostalCode">Postal Code:</label>
                <input
                  type="text"
                  id="homePostalCode"
                  name="homePostalCode"
                  placeholder="Enter Home Postal Code"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="form-block">
            <h3>Emergency Contact</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="emergCnctName">Name:</label>
                <input
                  type="text"
                  id="emergCnctName"
                  name="emergCnctName"
                  placeholder="Enter Emergency Contact Name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="emergCnctPhoneNumber">Phone Number:</label>
                <input
                  type="tel"
                  id="emergCnctPhoneNumber"
                  name="emergCnctPhoneNumber"
                  placeholder="Enter Emergency Contact Phone Number"
                />
              </div>
              <div className="form-group">
                <label htmlFor="emergCnctEmail">Email:</label>
                <input
                  type="email"
                  id="emergCnctEmail"
                  name="emergCnctEmail"
                  placeholder="Enter Emergency Contact Email"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="emergCnctAddrLine1">Address Line 1:</label>
                <input
                  type="text"
                  id="emergCnctAddrLine1"
                  name="emergCnctAddrLine1"
                  placeholder="Enter Emergency Contact Address Line 1"
                />
              </div>
              <div className="form-group">
                <label htmlFor="emergCnctAddrLine2">Address Line 2:</label>
                <input
                  type="text"
                  id="emergCnctAddrLine2"
                  name="emergCnctAddrLine2"
                  placeholder="Enter Emergency Contact Address Line 2"
                />
              </div>
              <div className="form-group">
                <label htmlFor="emergCnctAddrLine3">Address Line 3:</label>
                <input
                  type="text"
                  id="emergCnctAddrLine3"
                  name="emergCnctAddrLine3"
                  placeholder="Enter Emergency Contact Address Line 3"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="emergCnctCity">City:</label>
                <input
                  type="text"
                  id="emergCnctCity"
                  name="emergCnctCity"
                  placeholder="Enter Emergency Contact City"
                />
              </div>
              <div className="form-group">
                <label htmlFor="emergCnctStateId">State:</label>
                <select
                  id="emergCnctStateId"
                  name="emergCnctStateId"
                  disabled={addform_emergCnctCountryId !== '185'}
                >
                  <option value="">Select State</option>
                  {states.map((state) => (
                    <option key={state.ID} value={state.ID}>
                      {state.VALUE}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="emergCnctStateNameCustom">Custom State Name:</label>
                <input
                  type="text"
                  id="emergCnctStateNameCustom"
                  name="emergCnctStateNameCustom"
                  placeholder="Enter Custom State Name"
                  disabled={addform_emergCnctCountryId === '185'}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="emergCnctCountryId">Country:</label>
                <select
                  id="emergCnctCountryId"
                  name="emergCnctCountryId"
                  value={addform_emergCnctCountryId}
                  onChange={(e) => addform_setEmergCnctCountryId(e.target.value)}
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
                <label htmlFor="emergCnctPostalCode">Postal Code:</label>
                <input
                  type="text"
                  id="emergCnctPostalCode"
                  name="emergCnctPostalCode"
                  placeholder="Enter Emergency Contact Postal Code"
                />
              </div>
            </div>
          </div>

          {/* Leaves */}
          <div className="form-block">
            <h3>Leaves</h3>
            <div className="leaves-container">
              {leaveTypes.map((leave) => (
                <div key={leave.id} className="form-group">
                  <label htmlFor={`noofleaves_${leave.id}`}>{leave.Name} (Number of Leaves):</label>
                  <input
                    type="number"
                    id={`noofleaves_${leave.id}`}
                    name={`noofleaves_${leave.id}`}
                    value={addform_leaves[leave.id] || ''}
                    onChange={(e) => addform_handleLeaveChange(leave.id, e.target.value)}
                    min="0"
                    step="any"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="form-buttons">
            <button type="submit" className="submit-button" disabled={addform_isSubmitting}>
              {addform_isSubmitting ? 'Submitting...' : 'Add Employee'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
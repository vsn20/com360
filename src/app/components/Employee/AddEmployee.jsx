'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addemployee } from '@/app/serverActions/addemployee';

export default function AddEmployee({ roles, currentrole, orgid, error, employees, leaveTypes, countries, states, departments, payFrequencies, jobTitles, statuses, workerCompClasses }) {
  const router = useRouter();
  const [formError, setFormError] = useState(null);
  const [leaves, setLeaves] = useState({});
  const [workCountryId, setWorkCountryId] = useState('185');
  const [homeCountryId, setHomeCountryId] = useState('185');
  const [emergCnctCountryId, setEmergCnctCountryId] = useState('185');

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (formData) => {
    formData.append('currentRole', currentrole || '');
    Object.entries(leaves).forEach(([leaveid, noofleaves]) => {
      if (noofleaves !== '') formData.append(`leaves[${leaveid}]`, noofleaves || '0');
    });
    const result = await addemployee(formData);
    if (result?.error) {
      setFormError(result.error);
    } else {
      router.push(`/userscreens/employee?success=Employee%20added%20successfully`);
    }
  };

  const handleLeaveChange = (leaveid, value) => {
    setLeaves(prev => ({ ...prev, [leaveid]: value }));
  };

  const employeesWithRoles = employees.map(employee => {
    const role = roles.find(r => r.roleid === employee.roleid);
    const rolename = role ? role.rolename : 'Unknown Role';
    return { ...employee, rolename };
  });

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Add Employee</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {formError && <p style={{ color: "red" }}>{formError}</p>}
      <form action={handleSubmit}>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="orgid" style={{ display: "block", marginBottom: "5px" }}>
            Organization ID:
          </label>
          <input
            type="text"
            id="orgid"
            name="orgid"
            value={orgid || ''}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
              backgroundColor: "#f0f0f0",
            }}
            disabled
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="empFstName" style={{ display: "block", marginBottom: "5px" }}>
            First Name: *
          </label>
          <input
            type="text"
            id="empFstName"
            name="empFstName"
            placeholder="Enter First Name"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
            required
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="empMidName" style={{ display: "block", marginBottom: "5px" }}>
            Middle Name:
          </label>
          <input
            type="text"
            id="empMidName"
            name="empMidName"
            placeholder="Enter Middle Name"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="empLastName" style={{ display: "block", marginBottom: "5px" }}>
            Last Name: *
          </label>
          <input
            type="text"
            id="empLastName"
            name="empLastName"
            placeholder="Enter Last Name"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
            required
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="email" style={{ display: "block", marginBottom: "5px" }}>
            Email: *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter Email"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
            required
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="roleid" style={{ display: "block", marginBottom: "5px" }}>
            Role: *
          </label>
          <select
            id="roleid"
            name="roleid"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
            required
          >
            <option value="">Select a Role</option>
            {roles.map((role) => (
              <option key={role.roleid} value={role.roleid}>
                {role.rolename}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="superior" style={{ display: "block", marginBottom: "5px" }}>
            Superior:
          </label>
          <select
            id="superior"
            name="superior"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          >
            <option value="">Select a Superior (Optional)</option>
            {employeesWithRoles.map((employee) => (
              <option key={employee.empid} value={employee.empid}>
                {`${employee.empid} - ${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME} (${employee.rolename})`}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="empPrefName" style={{ display: "block", marginBottom: "5px" }}>
            Preferred Name:
          </label>
          <input
            type="text"
            id="empPrefName"
            name="empPrefName"
            placeholder="Enter Preferred Name"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="gender" style={{ display: "block", marginBottom: "5px" }}>
            Gender:
          </label>
          <select
            id="gender"
            name="gender"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="mobileNumber" style={{ display: "block", marginBottom: "5px" }}>
            Mobile Number:
          </label>
          <input
            type="tel"
            id="mobileNumber"
            name="mobileNumber"
            placeholder="Enter Mobile Number"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="phoneNumber" style={{ display: "block", marginBottom: "5px" }}>
            Phone Number:
          </label>
          <input
            type="tel"
            id="phoneNumber"
            name="phoneNumber"
            placeholder="Enter Phone Number"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="dob" style={{ display: "block", marginBottom: "5px" }}>
            Date of Birth:
          </label>
          <input
            type="date"
            id="dob"
            name="dob"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="hireDate" style={{ display: "block", marginBottom: "5px" }}>
            Hire Date: *
          </label>
          <input
            type="date"
            id="hireDate"
            name="hireDate"
            defaultValue={today}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
            required
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="ssn" style={{ display: "block", marginBottom: "5px" }}>
            SSN:
          </label>
          <input
            type="text"
            id="ssn"
            name="ssn"
            placeholder="Enter SSN"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="status" style={{ display: "block", marginBottom: "5px" }}>
            Status: *
          </label>
          <select
            id="status"
            name="status"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
            required
          >
            {statuses.map((status) => (
              <option key={status.id} value={status.Name}>
                {status.Name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="linkedinUrl" style={{ display: "block", marginBottom: "5px" }}>
            LinkedIn URL:
          </label>
          <input
            type="url"
            id="linkedinUrl"
            name="linkedinUrl"
            placeholder="Enter LinkedIn URL"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="jobTitle" style={{ display: "block", marginBottom: "5px" }}>
            Job Title:
          </label>
          <select
            id="jobTitle"
            name="jobTitle"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          >
            <option value="">Select Job Title</option>
            {jobTitles.map((job) => (
              <option key={job.job_title} value={job.job_title}>
                {`${job.job_title} (Level: ${job.level})`}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="payFrequency" style={{ display: "block", marginBottom: "5px" }}>
            Pay Frequency:
          </label>
          <select
            id="payFrequency"
            name="payFrequency"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          >
            <option value="">Select Pay Frequency</option>
            {payFrequencies.map((freq) => (
              <option key={freq.id} value={freq.Name}>
                {freq.Name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="deptId" style={{ display: "block", marginBottom: "5px" }}>
            Department:
          </label>
          <select
            id="deptId"
            name="deptId"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          >
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="workCompClass" style={{ display: "block", marginBottom: "5px" }}>
            Work Compensation Class:
          </label>
          <select
            id="workCompClass"
            name="workCompClass"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          >
            <option value="">Select Work Compensation Class</option>
            {workerCompClasses.map((compClass) => (
              <option key={compClass.class_code} value={compClass.class_code}>
                {`${compClass.class_code} - ${compClass.phraseology}`}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <h3>Work Address</h3>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="workAddrLine1" style={{ display: "block", marginBottom: "5px" }}>
              Address Line 1:
            </label>
            <input
              type="text"
              id="workAddrLine1"
              name="workAddrLine1"
              placeholder="Enter Work Address Line 1"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="workAddrLine2" style={{ display: "block", marginBottom: "5px" }}>
              Address Line 2:
            </label>
            <input
              type="text"
              id="workAddrLine2"
              name="workAddrLine2"
              placeholder="Enter Work Address Line 2"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="workAddrLine3" style={{ display: "block", marginBottom: "5px" }}>
              Address Line 3:
            </label>
            <input
              type="text"
              id="workAddrLine3"
              name="workAddrLine3"
              placeholder="Enter Work Address Line 3"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="workCity" style={{ display: "block", marginBottom: "5px" }}>
              City:
            </label>
            <input
              type="text"
              id="workCity"
              name="workCity"
              placeholder="Enter Work City"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="workStateId" style={{ display: "block", marginBottom: "5px" }}>
              State:
            </label>
            <select
              id="workStateId"
              name="workStateId"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
              disabled={workCountryId !== '185'}
            >
              <option value="">Select State</option>
              {states.map((state) => (
                <option key={state.ID} value={state.ID}>
                  {state.VALUE}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="workStateNameCustom" style={{ display: "block", marginBottom: "5px" }}>
              Custom State Name:
            </label>
            <input
              type="text"
              id="workStateNameCustom"
              name="workStateNameCustom"
              placeholder="Enter Custom State Name"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
              disabled={workCountryId === '185'}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="workCountryId" style={{ display: "block", marginBottom: "5px" }}>
              Country:
            </label>
            <select
              id="workCountryId"
              name="workCountryId"
              value={workCountryId}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
              onChange={(e) => setWorkCountryId(e.target.value)}
            >
              <option value="">Select Country</option>
              {countries.map((country) => (
                <option key={country.ID} value={country.ID}>
                  {country.VALUE}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="workPostalCode" style={{ display: "block", marginBottom: "5px" }}>
              Postal Code:
            </label>
            <input
              type="text"
              id="workPostalCode"
              name="workPostalCode"
              placeholder="Enter Work Postal Code"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <h3>Home Address</h3>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="homeAddrLine1" style={{ display: "block", marginBottom: "5px" }}>
              Address Line 1:
            </label>
            <input
              type="text"
              id="homeAddrLine1"
              name="homeAddrLine1"
              placeholder="Enter Home Address Line 1"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="homeAddrLine2" style={{ display: "block", marginBottom: "5px" }}>
              Address Line 2:
            </label>
            <input
              type="text"
              id="homeAddrLine2"
              name="homeAddrLine2"
              placeholder="Enter Home Address Line 2"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="homeAddrLine3" style={{ display: "block", marginBottom: "5px" }}>
              Address Line 3:
            </label>
            <input
              type="text"
              id="homeAddrLine3"
              name="homeAddrLine3"
              placeholder="Enter Home Address Line 3"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="homeCity" style={{ display: "block", marginBottom: "5px" }}>
              City:
            </label>
            <input
              type="text"
              id="homeCity"
              name="homeCity"
              placeholder="Enter Home City"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="homeStateId" style={{ display: "block", marginBottom: "5px" }}>
              State:
            </label>
            <select
              id="homeStateId"
              name="homeStateId"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
              disabled={homeCountryId !== '185'}
            >
              <option value="">Select State</option>
              {states.map((state) => (
                <option key={state.ID} value={state.ID}>
                  {state.VALUE}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="homeStateNameCustom" style={{ display: "block", marginBottom: "5px" }}>
              Custom State Name:
            </label>
            <input
              type="text"
              id="homeStateNameCustom"
              name="homeStateNameCustom"
              placeholder="Enter Custom State Name"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
              disabled={homeCountryId === '185'}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="homeCountryId" style={{ display: "block", marginBottom: "5px" }}>
              Country:
            </label>
            <select
              id="homeCountryId"
              name="homeCountryId"
              value={homeCountryId}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
              onChange={(e) => setHomeCountryId(e.target.value)}
            >
              <option value="">Select Country</option>
              {countries.map((country) => (
                <option key={country.ID} value={country.ID}>
                  {country.VALUE}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="homePostalCode" style={{ display: "block", marginBottom: "5px" }}>
              Postal Code:
            </label>
            <input
              type="text"
              id="homePostalCode"
              name="homePostalCode"
              placeholder="Enter Home Postal Code"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <h3>Emergency Contact</h3>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctName" style={{ display: "block", marginBottom: "5px" }}>
              Name:
            </label>
            <input
              type="text"
              id="emergCnctName"
              name="emergCnctName"
              placeholder="Enter Emergency Contact Name"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctPhoneNumber" style={{ display: "block", marginBottom: "5px" }}>
              Phone Number:
            </label>
            <input
              type="tel"
              id="emergCnctPhoneNumber"
              name="emergCnctPhoneNumber"
              placeholder="Enter Emergency Contact Phone Number"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctEmail" style={{ display: "block", marginBottom: "5px" }}>
              Email:
            </label>
            <input
              type="email"
              id="emergCnctEmail"
              name="emergCnctEmail"
              placeholder="Enter Emergency Contact Email"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctAddrLine1" style={{ display: "block", marginBottom: "5px" }}>
              Address Line 1:
            </label>
            <input
              type="text"
              id="emergCnctAddrLine1"
              name="emergCnctAddrLine1"
              placeholder="Enter Emergency Contact Address Line 1"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctAddrLine2" style={{ display: "block", marginBottom: "5px" }}>
              Address Line 2:
            </label>
            <input
              type="text"
              id="emergCnctAddrLine2"
              name="emergCnctAddrLine2"
              placeholder="Enter Emergency Contact Address Line 2"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctAddrLine3" style={{ display: "block", marginBottom: "5px" }}>
              Address Line 3:
            </label>
            <input
              type="text"
              id="emergCnctAddrLine3"
              name="emergCnctAddrLine3"
              placeholder="Enter Emergency Contact Address Line 3"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctCity" style={{ display: "block", marginBottom: "5px" }}>
              City:
            </label>
            <input
              type="text"
              id="emergCnctCity"
              name="emergCnctCity"
              placeholder="Enter Emergency Contact City"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctStateId" style={{ display: "block", marginBottom: "5px" }}>
              State:
            </label>
            <select
              id="emergCnctStateId"
              name="emergCnctStateId"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
              disabled={emergCnctCountryId !== '185'}
            >
              <option value="">Select State</option>
              {states.map((state) => (
                <option key={state.ID} value={state.ID}>
                  {state.VALUE}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctStateNameCustom" style={{ display: "block", marginBottom: "5px" }}>
              Custom State Name:
            </label>
            <input
              type="text"
              id="emergCnctStateNameCustom"
              name="emergCnctStateNameCustom"
              placeholder="Enter Custom State Name"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
              disabled={emergCnctCountryId === '185'}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctCountryId" style={{ display: "block", marginBottom: "5px" }}>
              Country:
            </label>
            <select
              id="emergCnctCountryId"
              name="emergCnctCountryId"
              value={emergCnctCountryId}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
              onChange={(e) => setEmergCnctCountryId(e.target.value)}
            >
              <option value="">Select Country</option>
              {countries.map((country) => (
                <option key={country.ID} value={country.ID}>
                  {country.VALUE}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="emergCnctPostalCode" style={{ display: "block", marginBottom: "5px" }}>
              Postal Code:
            </label>
            <input
              type="text"
              id="emergCnctPostalCode"
              name="emergCnctPostalCode"
              placeholder="Enter Emergency Contact Postal Code"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
        </div>
        {leaveTypes.map((leave) => (
          <div key={leave.id} style={{ marginBottom: "20px" }}>
            <label htmlFor={`noofleaves_${leave.id}`} style={{ display: "block", marginBottom: "5px" }}>
              {leave.Name} (Number of Leaves):
            </label>
            <input
              type="number"
              id={`noofleaves_${leave.id}`}
              name={`noofleaves_${leave.id}`}
              value={leaves[leave.id] || ''}
              onChange={(e) => handleLeaveChange(leave.id, e.target.value)}
              min="0"
              step="any"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>
        ))}
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Add Employee
        </button>
      </form>
    </div>
  );
}
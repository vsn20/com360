'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addemployee } from '@/app/serverActions/addemployee';

export default function AddEmployee({ roles, currentrole, orgid, error }) {
  const router = useRouter();
  const [formError, setFormError] = useState(null);

  // Today's date in YYYY-MM-DD format for the input field
  const today = new Date().toISOString().split('T')[0]; // "2025-06-16"

  const handleSubmit = async (formData) => {
    formData.append('currentRole', currentrole);
    await addemployee(formData);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Add Employee</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {formError && <p style={{ color: "red" }}>{formError}</p>}
      <form action={handleSubmit}>
        {/* Organization ID (Non-editable) */}
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="orgid" style={{ display: "block", marginBottom: "5px" }}>
            Organization ID:
          </label>
          <input
            type="text"
            id="orgid"
            name="orgid"
            value={orgid}
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

        {/* Required Fields */}
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="empFstName" style={{ display: "block", marginBottom: "5px" }}>
            First Name: 
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
            Last Name: 
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
            Email: 
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

        {/* Role Dropdown */}
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="roleid" style={{ display: "block", marginBottom: "5px" }}>
            Role: 
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

        {/* Optional Fields */}
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
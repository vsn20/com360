'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addemployee } from '@/app/serverActions/addemployee';

export default function AddEmployee({ roles, currentrole, orgid, error, employees, leaveTypes }) {
  const router = useRouter();
  const [formError, setFormError] = useState(null);
  const [leaves, setLeaves] = useState({});

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
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
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
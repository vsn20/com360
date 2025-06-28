'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchEmployeeById, fetchRolesByOrgId, updateEmployee, fetchEmployeesByOrgId } from '@/app/serverActions/Employee/overview';
import './editemployee.css';

const EditEmployee = () => {
  const router = useRouter();
  const params = useParams();
  const empid = params.empid;

  const [formData, setFormData] = useState({
    empid: '',
    orgid: '',
    EMP_FST_NAME: '',
    EMP_MID_NAME: '',
    EMP_LAST_NAME: '',
    EMP_PREF_NAME: '',
    email: '',
    roleid: '',
    GENDER: '',
    MOBILE_NUMBER: '',
    DOB: '',
    HIRE: '',
    LAST_WORK_DATE: '',
    TERMINATED_DATE: '',
    REJOIN_DATE: '',
    superior: '', // Added superior field
  });
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]); // Added employees state for superior dropdown
  const [state, setState] = useState({ error: null, success: false });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [employee, rolesData, employeesData] = await Promise.all([
          fetchEmployeeById(empid),
          fetchRolesByOrgId(),
          fetchEmployeesByOrgId(), // Fetch employees for superior dropdown
        ]);
        setFormData({
          empid: employee.empid || '',
          orgid: employee.orgid || '',
          EMP_FST_NAME: employee.EMP_FST_NAME || '',
          EMP_MID_NAME: employee.EMP_MID_NAME || '',
          EMP_LAST_NAME: employee.EMP_LAST_NAME || '',
          EMP_PREF_NAME: employee.EMP_PREF_NAME || '',
          email: employee.email || '',
          roleid: employee.roleid || '',
          GENDER: employee.GENDER || '',
          MOBILE_NUMBER: employee.MOBILE_NUMBER || '',
          DOB: employee.DOB ? new Date(employee.DOB).toISOString().split('T')[0] : '',
          HIRE: employee.HIRE ? new Date(employee.HIRE).toISOString().split('T')[0] : '',
          LAST_WORK_DATE: employee.LAST_WORK_DATE ? new Date(employee.LAST_WORK_DATE).toISOString().split('T')[0] : '',
          TERMINATED_DATE: employee.TERMINATED_DATE ? new Date(employee.TERMINATED_DATE).toISOString().split('T')[0] : '',
          REJOIN_DATE: employee.REJOIN_DATE ? new Date(employee.REJOIN_DATE).toISOString().split('T')[0] : '',
          superior: employee.superior || '', // Set initial superior value
        });
        setRoles(rolesData);
        setEmployees(employeesData); // Set employees for superior dropdown
        setState({ error: null, success: false });
      } catch (err) {
        console.error('Error loading data:', err);
        setState({ error: err.message, success: false });
      }
    };
    if (empid) loadData();
  }, [empid]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formDataToSubmit = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSubmit.append(key, value);
    });
    const result = await updateEmployee({}, formDataToSubmit);
    setState(result);
    if (result.success) {
      router.push('/userscreens/employee/overview');
    }
  };

  // Map employees with their roles for the dropdown
  const employeesWithRoles = employees.map(employee => {
    const role = roles.find(r => r.roleid === employee.roleid);
    const rolename = role ? role.rolename : 'Unknown Role';
    return { ...employee, rolename };
  });

  return (
    <div className="edit-employee-container">
      <h2>Edit Employee</h2>
      {state.success && <div className="success-message">Employee updated successfully!</div>}
      {state.error && <div className="error-message">{state.error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Employee ID*:</label>
          <input
            type="text"
            name="empid"
            value={formData.empid}
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div>
          <label>Organization ID*:</label>
          <input
            type="number"
            name="orgid"
            value={formData.orgid}
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div>
          <label>First Name*:</label>
          <input
            type="text"
            name="EMP_FST_NAME"
            value={formData.EMP_FST_NAME}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Middle Name:</label>
          <input
            type="text"
            name="EMP_MID_NAME"
            value={formData.EMP_MID_NAME}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Last Name*:</label>
          <input
            type="text"
            name="EMP_LAST_NAME"
            value={formData.EMP_LAST_NAME}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Preferred Name:</label>
          <input
            type="text"
            name="EMP_PREF_NAME"
            value={formData.EMP_PREF_NAME}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Email*:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Role:</label>
          <select
            name="roleid"
            value={formData.roleid}
            onChange={handleChange}
          >
            <option value="">No Role</option>
            {roles.map((role) => (
              <option key={role.roleid} value={role.roleid}>
                {role.rolename}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Gender:</label>
          <select
            name="GENDER"
            value={formData.GENDER}
            onChange={handleChange}
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label>Mobile Number:</label>
          <input
            type="text"
            name="MOBILE_NUMBER"
            value={formData.MOBILE_NUMBER}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Date of Birth:</label>
          <input
            type="date"
            name="DOB"
            value={formData.DOB}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Hire Date:</label>
          <input
            type="date"
            name="HIRE"
            value={formData.HIRE}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Last Work Date:</label>
          <input
            type="date"
            name="LAST_WORK_DATE"
            value={formData.LAST_WORK_DATE}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Terminated Date:</label>
          <input
            type="date"
            name="TERMINATED_DATE"
            value={formData.TERMINATED_DATE}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Rejoin Date:</label>
          <input
            type="date"
            name="REJOIN_DATE"
            value={formData.REJOIN_DATE}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Superior:</label>
          <select
            name="superior"
            value={formData.superior}
            onChange={handleChange}
          >
            <option value="">Select a Superior (Optional)</option>
            {employeesWithRoles.map((employee) => (
              <option key={employee.empid} value={employee.empid}>
                {`${employee.empid} - ${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME} (${employee.rolename})`}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default EditEmployee;
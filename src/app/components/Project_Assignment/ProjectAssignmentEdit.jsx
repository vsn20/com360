'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchProjectAssignmentDetails, updateProjectAssignment } from '@/app/serverActions/ProjectAssignments/Overview';
import './projectassignmentedit.css';

const ProjectAssignmentEdit = () => {
  const params = useParams();
  const { PRJ_ID } = params;
  const router = useRouter();

  const [assignmentData, setAssignmentData] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState({
    startDt: '',
    endDt: '',
    billRate: '',
    billType: '',
    otBillRate: '',
    otBillType: '',
    billableFlag: false,
    otBillableFlag: false,
    payTerm: ''
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadAssignmentData = async () => {
      try {
        if (!PRJ_ID) throw new Error('Project ID is missing');
        const data = await fetchProjectAssignmentDetails(PRJ_ID);
        setAssignmentData(data);
        if (data.length > 0) {
          setSelectedEmployee(data[0]); // Default to first employee
          setFormData({
            startDt: data[0].START_DT || '',
            endDt: data[0].END_DT || '',
            billRate: data[0].BILL_RATE || '',
            billType: data[0].BILL_TYPE || '',
            otBillRate: data[0].OT_BILL_RATE || '',
            otBillType: data[0].OT_BILL_TYPE || '',
            billableFlag: data[0].BILLABLE_FLAG === 1,
            otBillableFlag: data[0].OT_BILLABLE_FLAG === 1,
            payTerm: data[0].PAY_TERM || ''
          });
        }
        setError(null);
      } catch (err) {
        console.error('Error loading assignment data:', err);
        setError(err.message);
      }
    };
    loadAssignmentData();
  }, [PRJ_ID]);

  const handleEmployeeSelect = (EMP_ID) => {
    const employee = assignmentData.find(emp => emp.EMP_ID === EMP_ID);
    setSelectedEmployee(employee);
    if (employee) {
      setFormData({
        startDt: employee.START_DT || '',
        endDt: employee.END_DT || '',
        billRate: employee.BILL_RATE || '',
        billType: employee.BILL_TYPE || '',
        otBillRate: employee.OT_BILL_RATE || '',
        otBillType: employee.OT_BILL_TYPE || '',
        billableFlag: employee.BILLABLE_FLAG === 1,
        otBillableFlag: employee.OT_BILLABLE_FLAG === 1,
        payTerm: employee.PAY_TERM || ''
      });
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      if (!selectedEmployee) throw new Error('Please select an employee');
      const result = await updateProjectAssignment(PRJ_ID, selectedEmployee.EMP_ID, formData);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => router.push('/userscreens/Project_Assign/overview'), 2000);
      } else {
        throw new Error('Update failed');
      }
    } catch (err) {
      console.error('Error updating assignment:', err);
      setError(err.message);
    }
  };

  return (
    <div className="assignment-edit-container">
      <h2>Edit Project Assignment for {PRJ_ID}</h2>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">Update successful! Redirecting...</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Assigned Employees:</label>
          <select onChange={(e) => handleEmployeeSelect(e.target.value)} value={selectedEmployee?.EMP_ID || ''}>
            <option value="">Select Employee</option>
            {assignmentData.map((emp) => (
              <option key={emp.EMP_ID} value={emp.EMP_ID}>
                {emp.EMP_ID} - {emp.EMP_NAME || 'No Name'} {/* Added EMP_NAME with fallback */}
              </option>
            ))}
          </select>
        </div>
        {selectedEmployee && (
          <div className="employee-details">
            <h3>Employee Details</h3>
            <div>
              <label>Start Date:</label>
              <input type="date" name="startDt" value={formData.startDt} onChange={handleChange} />
            </div>
            <div>
              <label>End Date:</label>
              <input type="date" name="endDt" value={formData.endDt} onChange={handleChange} />
            </div>
            <div>
              <label>Bill Rate:</label>
              <input type="number" step="0.01" name="billRate" value={formData.billRate} onChange={handleChange} />
            </div>
            <div>
              <label>Bill Type:</label>
              <select name="billType" value={formData.billType} onChange={handleChange}>
                <option value="">Select Type</option>
                <option value="hourly">Hourly</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div>
              <label>OT Bill Rate:</label>
              <input type="number" step="0.01" name="otBillRate" value={formData.otBillRate} onChange={handleChange} />
            </div>
            <div>
              <label>OT Bill Type:</label>
              <select name="otBillType" value={formData.otBillType} onChange={handleChange}>
                <option value="">Select Type</option>
                <option value="hourly">Hourly</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div>
              <label>Billable Flag:</label>
              <input type="checkbox" name="billableFlag" checked={formData.billableFlag} onChange={handleChange} />
            </div>
            <div>
              <label>OT Billable Flag:</label>
              <input type="checkbox" name="otBillableFlag" checked={formData.otBillableFlag} onChange={handleChange} />
            </div>
            <div>
              <label>Pay Term:</label>
              <select  name="payTerm" value={formData.payTerm} onChange={handleChange}>
                  <option value="">Select Term</option>
            <option value="net30">Net 30</option>
            <option value="net60">Net 60</option>
              </select>
            </div>
            <button type="submit">Save Changes</button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ProjectAssignmentEdit;
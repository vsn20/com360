'use client';
import React, { useState, useEffect } from 'react';
import { addProjectAssignment, fetchEmployeesByOrgId, fetchProjectsByOrgId } from '@/app/serverActions/ProjectAssignments/AddProjectAssignments';
import { useActionState } from 'react';
import './projectassignment.css' // Ensure this CSS file exists or adjust the path

const initialState = { error: null, success: false };

const AddProjectAssignment = ({ orgId }) => {
  const [formData, setFormData] = useState({
    empId: '',
    prjId: '',
    startDt: '',
    endDt: '',
    billRate: '',
    billType: '',
    otBillRate: '',
    otBillType: '',
    billableFlag: 'No',
    otBillableFlag: 'No',
    payTerm: '',
  });

  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [state, formAction] = useActionState(addProjectAssignment, initialState);

  useEffect(() => {
    const loadData = async () => {
      if (!orgId) {
        console.warn('No valid orgId provided, data not fetched');
        setEmployees([]);
        setProjects([]);
        return;
      }

      try {
        console.log('Fetching data for orgId:', orgId);
        const employeesData = await fetchEmployeesByOrgId(parseInt(orgId, 10));
        const projectsData = await fetchProjectsByOrgId(parseInt(orgId, 10));
        console.log('Fetched employees:', employeesData);
        console.log('Fetched projects:', projectsData);
        setEmployees(employeesData || []);
        setProjects(projectsData || []);
      } catch (error) {
        console.error('Error loading data for orgId', orgId, ':', error);
        setEmployees([]);
        setProjects([]);
      }
    };
    loadData();
  }, [orgId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Reset form on success
  useEffect(() => {
    if (state.success) {
      setFormData({
        empId: '',
        prjId: '',
        startDt: '',
        endDt: '',
        billRate: '',
        billType: '',
        otBillRate: '',
        otBillType: '',
        billableFlag: 'No',
        otBillableFlag: 'No',
        payTerm: '',
      });
    }
  }, [state.success]);

  return (
    <div className="add-assignment-container">
      <h2>Add Project Assignment</h2>
      {state.success && <div className="success-message">Assignment added successfully!</div>}
      {state.error && <div className="error-message">{state.error}</div>}
      <form action={formAction}>
        <div>
          <label>Employee*:</label>
          <select name="empId" value={formData.empId} onChange={handleChange} required disabled={!orgId}>
            <option value="">Select Employee</option>
            {employees.map((employee) => (
              <option key={employee.empid} value={employee.empid}>
                {employee.emp_fst_name} {employee.emp_last_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Project*:</label>
          <select name="prjId" value={formData.prjId} onChange={handleChange} required disabled={!orgId}>
            <option value="">Select Project</option>
            {projects.map((project) => (
              <option key={project.prj_id} value={project.prj_id}>
                {project.prj_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Start Date*:</label>
          <input
            type="date"
            name="startDt"
            value={formData.startDt}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>End Date:</label>
          <input
            type="date"
            name="endDt"
            value={formData.endDt}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Bill Rate*:</label>
          <input
            type="number"
            step="0.01"
            name="billRate"
            value={formData.billRate}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Bill Type*:</label>
          <select name="billType" value={formData.billType} onChange={handleChange} required>
            <option value="">Select Type</option>
            <option value="hourly">Hourly</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
        <div>
          <label>OT Bill Rate:</label>
          <input
            type="number"
            step="0.01"
            name="otBillRate"
            value={formData.otBillRate}
            onChange={handleChange}
          />
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
          <label>Billable*:</label>
          <select name="billableFlag" value={formData.billableFlag} onChange={handleChange} required>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
        <div>
          <label>OT Billable:</label>
          <select name="otBillableFlag" value={formData.otBillableFlag} onChange={handleChange}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
        <div>
          <label>Payment Term*:</label>
          <select name="payTerm" value={formData.payTerm} onChange={handleChange} required>
            <option value="">Select Term</option>
            <option value="net30">Net 30</option>
            <option value="net60">Net 60</option>
          </select>
        </div>
        <button type="submit" disabled={!orgId}>Add Assignment</button>
      </form>
    </div>
  );
};

export default AddProjectAssignment;
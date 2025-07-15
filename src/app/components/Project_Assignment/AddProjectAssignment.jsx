'use client';
import React, { useState, useEffect } from 'react';
import { addProjectAssignment, fetchEmployeesByOrgId, fetchProjectsByOrgId } from '@/app/serverActions/ProjectAssignments/AddProjectAssignments';
import { useActionState } from 'react';
import './projectassignment.css';

const initialState = { error: null, success: false };

const AddProjectAssignment = ({ orgId, billTypes, otBillType, payTerms }) => {
  console.log("generic values", billTypes, otBillType, payTerms);
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
    projectStartDt: '',
    projectEndDt: '',
  });

  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [state, formAction] = useActionState(addProjectAssignment, initialState);

  useEffect(() => {
    const loadProjects = async () => {
      if (!orgId) {
        console.warn('No valid orgId provided, projects not fetched');
        setProjects([]);
        return;
      }

      try {
        console.log('Fetching projects for orgId:', orgId);
        const projectsData = await fetchProjectsByOrgId(parseInt(orgId, 10));
        console.log('Fetched projects:', projectsData);
        setProjects(projectsData || []);
      } catch (error) {
        console.error('Error loading projects for orgId', orgId, ':', error);
        setProjects([]);
      }
    };
    loadProjects();
  }, [orgId]);

  useEffect(() => {
    const loadEmployees = async () => {
      if (!orgId || !formData.prjId) {
        console.warn('No valid orgId or prjId provided, employees not fetched');
        setEmployees([]);
        return;
      }

      try {
        console.log('Fetching employees for orgId:', orgId, 'and prjId:', formData.prjId);
        const employeesData = await fetchEmployeesByOrgId(parseInt(orgId, 10), formData.prjId);
        console.log('Fetched employees:', employeesData);
        setEmployees(employeesData || []);
      } catch (error) {
        console.error('Error loading employees for orgId', orgId, 'and prjId', formData.prjId, ':', error);
        setEmployees([]);
      }
    };
    loadEmployees();
  }, [orgId, formData.prjId]);

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
        projectStartDt: '',
        projectEndDt: '',
      });
    }
  }, [state.success]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '';
  };

  // Update project start/end dates when project is selected
  useEffect(() => {
    if (formData.prjId) {
      const selectedProject = projects.find((project) => project.prj_id === formData.prjId);
      if (selectedProject) {
        setFormData((prev) => ({
          ...prev,
          projectStartDt: formatDate(selectedProject.START_DT),
          projectEndDt: formatDate(selectedProject.END_DT),
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          projectStartDt: '',
          projectEndDt: '',
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        projectStartDt: '',
        projectEndDt: '',
        empId: '', // Reset employee selection when project is cleared
      }));
    }
  }, [formData.prjId, projects]);

  return (
    <div className="add-assignment-container">
      <h2>Add Project Assignment</h2>
      {state.success && <div className="success-message">Assignment added successfully!</div>}
      {state.error && <div className="error-message">{state.error}</div>}
      <form action={formAction}>
        <div className="details-block">
          <h3>Selection Details</h3>
          <div className="form-row">
            <div className="form-group">
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
            <div className="form-group">
              <label>Employee*:</label>
              <select name="empId" value={formData.empId} onChange={handleChange} required disabled={!orgId || !formData.prjId}>
                <option value="">Select Employee</option>
                {employees.map((employee) => (
                  <option key={employee.empid} value={employee.empid}>
                    {employee.emp_fst_name} {employee.emp_last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Project Start Date:</label>
              <input
                type="date"
                name="projectStartDt"
                value={formData.projectStartDt}
                readOnly
                className="bg-gray-100"
              />
            </div>
            <div className="form-group">
              <label>Project End Date:</label>
              <input
                type="date"
                name="projectEndDt"
                value={formData.projectEndDt}
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>
        </div>
        <div className="details-block">
          <h3>Date Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Assignment Start Date*:</label>
              <input
                type="date"
                name="startDt"
                value={formData.startDt}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Assignment End Date:</label>
              <input
                type="date"
                name="endDt"
                value={formData.endDt}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
        <div className="details-block">
          <h3>Billing Details</h3>
          <div className="form-row">
            <div className="form-group">
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
            <div className="form-group">
              <label>Bill Type*:</label>
              <select name="billType" value={formData.billType} onChange={handleChange} required>
                <option value="">Select Type</option>
                {billTypes.map((type) => (
                  <option key={type.id} value={type.Name}>
                    {type.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>OT Bill Rate:</label>
              <input
                type="number"
                step="0.01"
                name="otBillRate"
                value={formData.otBillRate}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>OT Bill Type:</label>
              <select name="otBillType" value={formData.otBillType} onChange={handleChange}>
                <option value="">Select Type</option>
                {otBillType.map((type) => (
                  <option key={type.id} value={type.Name}>
                    {type.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Billable*:</label>
              <select name="billableFlag" value={formData.billableFlag} onChange={handleChange} required>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className="form-group">
              <label>OT Billable:</label>
              <select name="otBillableFlag" value={formData.otBillableFlag} onChange={handleChange}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Payment Term*:</label>
              <select name="payTerm" value={formData.payTerm} onChange={handleChange} required>
                <option value="">Select Term</option>
                {payTerms.map((term) => (
                  <option key={term.id} value={term.Name}>
                    {term.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="form-buttons">
          <button type="submit" disabled={!orgId || !formData.prjId || !formData.empId} className="submit-button">Add Assignment</button>
        </div>
      </form>
    </div>
  );
};

export default AddProjectAssignment;
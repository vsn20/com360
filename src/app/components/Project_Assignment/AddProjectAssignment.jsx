'use client';
import React, { useState, useEffect } from 'react';
import { addProjectAssignment, fetchEmployeesByOrgId, fetchProjectsByOrgId } from '@/app/serverActions/ProjectAssignments/AddProjectAssignments';
import { useActionState } from 'react';
import './projectassignment.css';

const addform_initialState = { error: null, success: false };

const AddProjectAssignment = ({ orgId, billTypes, otBillType, payTerms }) => {
  console.log("generic values", billTypes, otBillType, payTerms);
  const [addformData, setaddFormData] = useState({
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

  const [addform_employees, addform_setEmployees] = useState([]);
  const [addform_projects, addform_setProjects] = useState([]);
  const [addform_state, addform_formAction] = useActionState(addProjectAssignment, addform_initialState);

  useEffect(() => {
    const addform_loadProjects = async () => {
      if (!orgId) {
        console.warn('No valid orgId provided, projects not fetched');
        addform_setProjects([]);
        return;
      }

      try {
        console.log('Fetching projects for orgId:', orgId);
        const addform_projectsData = await fetchProjectsByOrgId(parseInt(orgId, 10));
        console.log('Fetched projects:', addform_projectsData);
        addform_setProjects(addform_projectsData || []);
      } catch (error) {
        console.error('Error loading projects for orgId', orgId, ':', error);
        addform_setProjects([]);
      }
    };
    addform_loadProjects();
  }, [orgId]);

  useEffect(() => {
    const addform_loadEmployees = async () => {
      if (!orgId || !addformData.prjId) {
        console.warn('No valid orgId or prjId provided, employees not fetched');
        addform_setEmployees([]);
        return;
      }

      try {
        console.log('Fetching employees for orgId:', orgId, 'and prjId:', addformData.prjId);
        const addform_employeesData = await fetchEmployeesByOrgId(parseInt(orgId, 10), addformData.prjId);
        console.log('Fetched employees:', addform_employeesData);
        addform_setEmployees(addform_employeesData || []);
      } catch (error) {
        console.error('Error loading employees for orgId', orgId, 'and prjId', addformData.prjId, ':', error);
        addform_setEmployees([]);
      }
    };
    addform_loadEmployees();
  }, [orgId, addformData.prjId]);

  useEffect(() => {
    if (addform_state.success) {
      setaddFormData({
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
  }, [addform_state.success]);

  const handleform_handleChange = (e) => {
    const { name, value } = e.target;
    setaddFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addform_formatDate = (date) => {
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
    if (addformData.prjId) {
      const selectedProject = addform_projects.find((project) => project.prj_id === addformData.prjId);
      if (selectedProject) {
        setaddFormData((prev) => ({
          ...prev,
          projectStartDt: addform_formatDate(selectedProject.START_DT),
          projectEndDt: addform_formatDate(selectedProject.END_DT),
        }));
      } else {
        setaddFormData((prev) => ({
          ...prev,
          projectStartDt: '',
          projectEndDt: '',
        }));
      }
    } else {
      setaddFormData((prev) => ({
        ...prev,
        projectStartDt: '',
        projectEndDt: '',
        empId: '', // Reset employee selection when project is cleared
      }));
    }
  }, [addformData.prjId, addform_projects]);

  return (
    <div className="add-assignment-container">
      <h2>Add Project Assignment</h2>
      {addform_state.success && <div className="success-message">Assignment added successfully!</div>}
      {addform_state.error && <div className="error-message">{addform_state.error}</div>}
      <form action={addform_formAction}>
        <div className="details-block">
          <h3>Selection Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Project*:</label>
              <select name="prjId" value={addformData.prjId} onChange={handleform_handleChange} required disabled={!orgId}>
                <option value="">Select Project</option>
                {addform_projects.map((project) => (
                  <option key={project.prj_id} value={project.prj_id}>
                    {project.prj_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Employee*:</label>
              <select name="empId" value={addformData.empId} onChange={handleform_handleChange} required disabled={!orgId || !addformData.prjId}>
                <option value="">Select Employee</option>
                {addform_employees.map((employee) => (
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
                value={addformData.projectStartDt}
                readOnly
                className="bg-gray-100"
              />
            </div>
            <div className="form-group">
              <label>Project End Date:</label>
              <input
                type="date"
                name="projectEndDt"
                value={addformData.projectEndDt}
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
                value={addformData.startDt}
                onChange={handleform_handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Assignment End Date:</label>
              <input
                type="date"
                name="endDt"
                value={addformData.endDt}
                onChange={handleform_handleChange}
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
                value={addformData.billRate}
                onChange={handleform_handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Bill Type*:</label>
              <select name="billType" value={addformData.billType} onChange={handleform_handleChange} required>
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
                value={addformData.otBillRate}
                onChange={handleform_handleChange}
              />
            </div>
            <div className="form-group">
              <label>OT Bill Type:</label>
              <select name="otBillType" value={addformData.otBillType} onChange={handleform_handleChange}>
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
              <select name="billableFlag" value={addformData.billableFlag} onChange={handleform_handleChange} required>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className="form-group">
              <label>OT Billable:</label>
              <select name="otBillableFlag" value={addformData.otBillableFlag} onChange={handleform_handleChange}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Payment Term*:</label>
              <select name="payTerm" value={addformData.payTerm} onChange={handleform_handleChange} required>
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
          <button type="submit" disabled={!orgId || !addformData.prjId || !addformData.empId} className="submit-button">Add Assignment</button>
        </div>
      </form>
    </div>
  );
};

export default AddProjectAssignment;
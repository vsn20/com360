'use client';

import React, { useState, useEffect } from 'react';
import { fetchProjectsForAssignment, fetchProjectAssignmentDetails, updateProjectAssignment } from '@/app/serverActions/ProjectAssignments/Overview';
import './overview.css';
import { addProjectAssignment, fetchEmployeesByOrgId, fetchProjectsByOrgId } from '@/app/serverActions/ProjectAssignments/AddProjectAssignments';
import { useActionState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const addform_initialState = { error: null, success: false };

const Overview = ({ orgId, billTypes, otBillType, payTerms }) => {
  const searchparams = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [assignmentData, setAssignmentData] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingAdditional, setEditingAdditional] = useState(false);
  const [isadd, setisadd] = useState(false);
  const router = useRouter();
  const [addform_success, setaddfrom_success] = useState(null);
  const [addform_error, setaddform_error] = useState(null);
  // State for sorted projects
  const [allProjects, setAllProjects] = useState([]);
  // State for sorting configuration
  const [sortConfig, setSortConfig] = useState({ column: 'prjId', direction: 'asc' });

  // Utility function to format dates for display and form input
  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      // Use local date components to preserve YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      // If it's already a date string (YYYY-MM-DD), return it as is
      return date.split('T')[0];
    }
    return ''; // Fallback for invalid dates
  };

  useEffect(() => {
    handleBack();
  }, [searchparams.get('refresh')]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectData = await fetchProjectsForAssignment();
        setProjects(projectData);
        setError(null);
      } catch (err) {
        console.error('Error loading projects for assignment:', err);
        setError(err.message);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    setAllProjects(projects); // Initialize with projects state
  }, [projects]);

  useEffect(() => {
    const sortedProjects = [...projects].sort((a, b) => sortProjects(a, b, sortConfig.column, sortConfig.direction));
    setAllProjects(sortedProjects);
  }, [sortConfig, projects]);

  useEffect(() => {
    const loadAssignmentData = async () => {
      if (!selectedProject) {
        setAssignmentData([]);
        setSelectedEmployeeId('');
        setEmployeeDetails(null);
        setFormData({});
        return;
      }
      try {
        setIsLoading(true);
        const data = await fetchProjectAssignmentDetails(selectedProject.PRJ_ID);
        setAssignmentData(data);
        setError(null);
      } catch (err) {
        console.error('Error loading assignment data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadAssignmentData();
  }, [selectedProject]);

  useEffect(() => {
    const loadEmployeeDetails = async () => {
      if (!selectedProject || !selectedEmployeeId) {
        setEmployeeDetails(null);
        setFormData({});
        return;
      }
      try {
        setIsLoading(true);
        const data = await fetchProjectAssignmentDetails(selectedProject.PRJ_ID, selectedEmployeeId);
        if (data.length > 0) {
          setEmployeeDetails(data[0]);
          setFormData({
            empId: data[0].EMP_ID || '',
            prjId: data[0].PRJ_ID || '',
            startDt: formatDate(data[0].START_DT) || '',
            endDt: formatDate(data[0].END_DT) || '',
            billRate: data[0].BILL_RATE || '',
            billType: data[0].BILL_TYPE || '',
            otBillRate: data[0].OT_BILL_RATE || '',
            otBillType: data[0].OT_BILL_TYPE || '',
            billableFlag: data[0].BILLABLE_FLAG === 1 ? 'Yes' : 'No',
            otBillableFlag: data[0].OT_BILLABLE_FLAG === 1 ? 'Yes' : 'No',
            payTerm: data[0].PAY_TERM || '',
            createdBy: data[0].CREATED_BY || '',
            updatedBy: data[0].LAST_UPDATED_BY || '',
            lastUpdatedDate: formatDate(data[0].LAST_UPDATED_DATE) || '',
            projectStartDt: formatDate(selectedProject.START_DT) || '',
            projectEndDt: formatDate(selectedProject.END_DT) || '',
          });
        } else {
          setEmployeeDetails(null);
          setFormData({
            empId: '',
            prjId: selectedProject.PRJ_ID,
            startDt: '',
            endDt: '',
            billRate: '',
            billType: '',
            otBillRate: '',
            otBillType: '',
            billableFlag: 'No',
            otBillableFlag: 'No',
            payTerm: '',
            createdBy: '',
            updatedBy: '',
            lastUpdatedDate: '',
            projectStartDt: formatDate(selectedProject.START_DT) || '',
            projectEndDt: formatDate(selectedProject.END_DT) || '',
          });
        }
        setError(null);
      } catch (err) {
        console.error('Error loading employee details:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadEmployeeDetails();
  }, [selectedProject, selectedEmployeeId]);

  const handleRowClick = (project) => {
    setSelectedProject(project);
    setSelectedEmployeeId('');
    setEmployeeDetails(null);
    setFormData({});
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setisadd(false);
    router.refresh();
  };

  const handleBack = () => {
    router.refresh();
    setSelectedProject(null);
    setSelectedEmployeeId('');
    setEmployeeDetails(null);
    setFormData({});
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setisadd(false);
  };

  const handleaddprojectassignment = () => {
    setSelectedProject(null);
    setSelectedEmployeeId('');
    setEmployeeDetails(null);
    setFormData({});
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setisadd(true);
  };

  const handleEmployeeSelect = (empId) => {
    setSelectedEmployeeId(empId);
    setEditingBasic(false);
    setEditingAdditional(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEdit = (section) => {
    if (section === 'basic') setEditingBasic(true);
    if (section === 'additional') setEditingAdditional(true);
  };

  const handleSave = async (section) => {
    if (section === 'basic') {
      if (!formData.startDt) {
        setError('Start Date is required.');
        return;
      }
      if (formData.startDt && formData.projectStartDt && new Date(formData.startDt) < new Date(formData.projectStartDt)) {
        setError(`Assignment Start Date must be on or after Project Start Date (${formData.projectStartDt}).`);
        return;
      }
      if (formData.endDt && formData.projectEndDt && new Date(formData.endDt) > new Date(formData.projectEndDt)) {
        setError(`Assignment End Date must be on or before Project End Date (${formData.projectEndDt}).`);
        return;
      }
    } else if (section === 'additional') {
      if (!formData.billRate) {
        setError('Bill Rate is required.');
        return;
      }
      if (!formData.billType) {
        setError('Bill Type is required.');
        return;
      }
      if (!formData.payTerm) {
        setError('Payment Term is required.');
        return;
      }
    }

    setIsLoading(true);
    const formDataToSubmit = new FormData();
    formDataToSubmit.append('PRJ_ID', formData.prjId);
    formDataToSubmit.append('EMP_ID', formData.empId);
    formDataToSubmit.append('section', section);

    if (section === 'basic') {
      formDataToSubmit.append('START_DT', formData.startDt || '');
      formDataToSubmit.append('END_DT', formData.endDt || '');
    } else if (section === 'additional') {
      formDataToSubmit.append('BILL_RATE', formData.billRate || '');
      formDataToSubmit.append('BILL_TYPE', formData.billType || '');
      formDataToSubmit.append('OT_BILL_RATE', formData.otBillRate || '');
      formDataToSubmit.append('OT_BILL_TYPE', formData.otBillType || '');
      formDataToSubmit.append('BILLABLE_FLAG', formData.billableFlag === 'Yes' ? '1' : '0');
      formDataToSubmit.append('OT_BILLABLE_FLAG', formData.otBillableFlag === 'Yes' ? '1' : '0');
      formDataToSubmit.append('PAY_TERM', formData.payTerm || '');
    }

    try {
      const result = await updateProjectAssignment(formDataToSubmit);
      if (result && result.success) {
        const updatedDetails = await fetchProjectAssignmentDetails(formData.prjId, formData.empId);
        if (updatedDetails.length > 0) {
          setEmployeeDetails(updatedDetails[0]);
          setFormData({
            empId: updatedDetails[0].EMP_ID || '',
            prjId: updatedDetails[0].PRJ_ID || '',
            startDt: formatDate(updatedDetails[0].START_DT) || '',
            endDt: formatDate(updatedDetails[0].END_DT) || '',
            billRate: updatedDetails[0].BILL_RATE || '',
            billType: updatedDetails[0].BILL_TYPE || '',
            otBillRate: updatedDetails[0].OT_BILL_RATE || '',
            otBillType: updatedDetails[0].OT_BILL_TYPE || '',
            billableFlag: updatedDetails[0].BILLABLE_FLAG === 1 ? 'Yes' : 'No',
            otBillableFlag: updatedDetails[0].OT_BILLABLE_FLAG === 1 ? 'Yes' : 'No',
            payTerm: updatedDetails[0].PAY_TERM || '',
            createdBy: updatedDetails[0].CREATED_BY || '',
            updatedBy: updatedDetails[0].LAST_UPDATED_BY || '',
            lastUpdatedDate: formatDate(updatedDetails[0].LAST_UPDATED_DATE) || '',
            projectStartDt: formData.projectStartDt || '',
            projectEndDt: formData.projectEndDt || '',
          });
          // Update assignmentData to reflect changes in the employee dropdown
          setAssignmentData((prev) =>
            prev.map((emp) =>
              emp.EMP_ID === formData.empId
                ? { ...emp, ...updatedDetails[0] }
                : emp
            )
          );
        }
        if (section === 'basic') setEditingBasic(false);
        if (section === 'additional') setEditingAdditional(false);
        setError(null);
      } else {
        setError(result.error || 'Failed to save: Invalid response from server');
      }
    } catch (err) {
      console.error('Error saving assignment:', err);
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayValue = (value, options) => {
    if (!value || !options) return '-';
    const option = options.find(opt => opt.Name === value);
    return option ? option.Name : value;
  };

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  const getdisplayemployeeid = (prjid) => {
    return prjid.split('_')[1] || prjid;
  };

  // Add Project Assignment Logic
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
      setaddfrom_success('Project Assigned successfully!');
      setTimeout(() => setaddfrom_success(null), 4000);
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
      // Use local date components to preserve YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      // If it's already a date string (YYYY-MM-DD), return it as is
      return date.split('T')[0];
    }
    return ''; // Fallback for invalid dates
  };

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

  // Sorting functions
  const sortProjects = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'prjId':
        aValue = parseInt(a.PRJ_ID.split('-')[1] || a.PRJ_ID);
        bValue = parseInt(b.PRJ_ID.split('-')[1] || b.PRJ_ID);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'prjName':
        aValue = (a.PRJ_NAME || '').toLowerCase();
        bValue = (b.PRJ_NAME || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'prsDesc':
        aValue = (a.PRS_DESC || '').toLowerCase();
        bValue = (b.PRS_DESC || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'accntId':
        aValue = (a.ACCNT_ID || '').toLowerCase();
        bValue = (b.ACCNT_ID || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'startDt':
        aValue = new Date(a.START_DT || '1970-01-01');
        bValue = new Date(b.START_DT || '1970-01-01');
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'endDt':
        aValue = new Date(a.END_DT || '1970-01-01');
        bValue = new Date(b.END_DT || '1970-01-01');
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      default:
        return 0;
    }
  };

  const requestSort = (column) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <div className="overview-container">
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading-message">Saving...</div>}
      {isadd && (
        <div className="add-assignment-container">
          <h2>Add Project Assignment</h2>
          <button className="back-button" onClick={handleBack}>x</button>
          {addform_success && <div className="success-message">{addform_success}</div>}
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
      )}
      {!isadd && !selectedProject ? (
        <div>
          <button onClick={() => handleaddprojectassignment()} className="submit-button">Assign Project</button>
          {projects.length === 0 ? (
            <p>No Projects found.</p>
          ) : (
            <table className="project-table">
              <thead>
                <tr>
                  <th onClick={() => requestSort('prjId')}>
                    Project ID 
                  </th>
                  <th onClick={() => requestSort('prjName')}>
                    Project Name 
                  </th>
                  <th >
                    Description 
                  </th>
                  <th onClick={() => requestSort('accntId')}>
                    Account 
                  </th>
                  <th onClick={() => requestSort('startDt')}>
                    Start Date 
                  </th>
                  <th onClick={() => requestSort('endDt')}>
                    End Date 
                  </th>
                </tr>
              </thead>
              <tbody>
                {allProjects.map((project) => (
                  <tr
                    key={project.PRJ_ID}
                    onClick={() => handleRowClick(project)}
                    className="clickable-row"
                  >
                    <td>Project-{getdisplayprojectid(project.PRJ_ID)}</td>
                    <td>{project.PRJ_NAME || '-'}</td>
                    <td>{project.PRS_DESC || '-'}</td>
                    <td>Account-{getdisplayprojectid(project.ACCNT_ID)}</td>
                    <td>{formatDate(project.START_DT) || '-'}</td>
                    <td>{formatDate(project.END_DT) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : !isadd && (
        <div className="employee-details-container">
          <button className="back-button" onClick={handleBack}>x</button>
          <div className="details-block">
            <h3>Select Employee*</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Assigned Employees:</label>
                <select
                  name="empId"
                  onChange={(e) => handleEmployeeSelect(e.target.value)}
                  value={selectedEmployeeId}
                  required
                >
                  <option value="">Select Employee</option>
                  {assignmentData.map((emp) => (
                    <option key={emp.EMP_ID} value={emp.EMP_ID}>
                      {emp.EMP_NAME || 'No Name'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {employeeDetails && (
            <>
              <div className="details-block">
                <h3>Basic Details</h3>
                {editingBasic ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave('basic'); }} className="assignment-form">
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
                    <div className="form-buttons">
                      <button type="submit" className="submit-button" disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="cancel-button"
                        onClick={() => setEditingBasic(false)}
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="view-details">
                    <div className="details-row">
                      <div className="details-group">
                        <label>Employee ID:</label>
                        <p>Employee-{getdisplayemployeeid(employeeDetails.EMP_ID) || '-'}</p>
                      </div>
                      <div className="details-group">
                        <label>Project ID:</label>
                        <p>Project-{getdisplayprojectid(employeeDetails.PRJ_ID) || '-'}</p>
                      </div>
                    </div>
                    <div className="details-row">
                      <div className="details-group">
                        <label>Project Start Date:</label>
                        <p>{formatDate(selectedProject.START_DT) || '-'}</p>
                      </div>
                      <div className="details-group">
                        <label>Project End Date:</label>
                        <p>{formatDate(selectedProject.END_DT) || '-'}</p>
                      </div>
                    </div>
                    <div className="details-row">
                      <div className="details-group">
                        <label>Assignment Start Date:</label>
                        <p>{formatDate(employeeDetails.START_DT) || '-'}</p>
                      </div>
                      <div className="details-group">
                        <label>Assignment End Date:</label>
                        <p>{formatDate(employeeDetails.END_DT) || '-'}</p>
                      </div>
                    </div>
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('basic')}>
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="details-block">
                <h3>Additional Details</h3>
                {editingAdditional ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave('additional'); }} className="assignment-form">
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
                    <div className="form-buttons">
                      <button type="submit" className="submit-button" disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="cancel-button"
                        onClick={() => setEditingAdditional(false)}
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="view-details">
                    <div className="details-row">
                      <div className="details-group">
                        <label>Bill Rate:</label>
                        <p>{employeeDetails.BILL_RATE || '-'}</p>
                      </div>
                      <div className="details-group">
                        <label>Bill Type:</label>
                        <p>{getDisplayValue(employeeDetails.BILL_TYPE, billTypes)}</p>
                      </div>
                    </div>
                    <div className="details-row">
                      <div className="details-group">
                        <label>OT Bill Rate:</label>
                        <p>{employeeDetails.OT_BILL_RATE || '-'}</p>
                      </div>
                      <div className="details-group">
                        <label>OT Bill Type:</label>
                        <p>{getDisplayValue(employeeDetails.OT_BILL_TYPE, otBillType)}</p>
                      </div>
                    </div>
                    <div className="details-row">
                      <div className="details-group">
                        <label>Billable:</label>
                        <p>{employeeDetails.BILLABLE_FLAG === 1 ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="details-group">
                        <label>OT Billable:</label>
                        <p>{employeeDetails.OT_BILLABLE_FLAG === 1 ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                    <div className="details-row">
                      <div className="details-group">
                        <label>Payment Term:</label>
                        <p>{getDisplayValue(employeeDetails.PAY_TERM, payTerms)}</p>
                      </div>
                    </div>
                    <div className="details-row">
                      <div className="details-group">
                        <label>Created By:</label>
                        <p>{employeeDetails.CREATED_BY || '-'}</p>
                      </div>
                      <div className="details-group">
                        <label>Updated By:</label>
                        <p>{employeeDetails.LAST_UPDATED_BY || '-'}</p>
                      </div>
                    </div>
                    <div className="details-row">
                      <div className="details-group">
                        <label>Last Updated Date:</label>
                        <p>{formatDate(employeeDetails.LAST_UPDATED_DATE) || '-'}</p>
                      </div>
                    </div>
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('additional')}>
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Overview;
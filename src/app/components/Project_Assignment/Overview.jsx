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
  const [allProjects, setAllProjects] = useState([]);
  const [sortConfig, setSortConfig] = useState({ column: 'prjId', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [projectsPerPage, setProjectsPerPage] = useState(10);
  const [projectsPerPageInput, setProjectsPerPageInput] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [accountOptions, setAccountOptions] = useState([]);
  const [basicdetailsdisplay,setbasicdetailsdisplay]=useState(false);
  const [additionaldetailsdisplay,setadditionaldetailsdisplay]=useState(false);
  const [activetab, setactivetab] = useState('basic');
  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '';
  };

  useEffect(() => {
    handleBack();
  }, [searchparams.get('refresh')]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectData = await fetchProjectsForAssignment();
        setProjects(projectData);
        // Extract unique account IDs for dropdown
        const uniqueAccounts = [...new Set(projectData.map(project => project.ACCNT_ID))].filter(id => id).sort();
        setAccountOptions(uniqueAccounts);
        setError(null);
      } catch (err) {
        console.error('Error loading projects for assignment:', err);
        setError(err.message);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    setAllProjects(projects);
  }, [projects]);

  useEffect(() => {
    const sortedProjects = [...projects].sort((a, b) => sortProjects(a, b, sortConfig.column, sortConfig.direction));
    setAllProjects(sortedProjects);
  }, [sortConfig, projects]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

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
            skills: data[0].SKILLS || '',
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
            skills: '',
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
    setbasicdetailsdisplay(true);
    setadditionaldetailsdisplay(false);
    setactivetab('basic');
    router.refresh();
  };

  const handlebasicdetailsdisplay=()=>{
    setbasicdetailsdisplay(true);
    setadditionaldetailsdisplay(false);
    setactivetab('basic');
  };
  const handleadditionaldetailsdisplay=()=>{
    setbasicdetailsdisplay(false);
    setadditionaldetailsdisplay(true);
    setactivetab('additional');
  }

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
    setbasicdetailsdisplay(false);
    setadditionaldetailsdisplay(false);
    setSearchQuery('');
    setAccountFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setCurrentPage(1);
    setPageInputValue('1');
    setactivetab('');
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
    setbasicdetailsdisplay(false);
    setadditionaldetailsdisplay(false);
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

  // Cancel handlers to reset form data to original values
  const handleCancelBasic = () => {
    setEditingBasic(false);
    if (employeeDetails) {
      setFormData(prev => ({
        ...prev,
        startDt: formatDate(employeeDetails.START_DT) || '',
        endDt: formatDate(employeeDetails.END_DT) || '',
        skills: employeeDetails.SKILLS || '',
      }));
    }
    setError(null);
  };

  const handleCancelAdditional = () => {
    setEditingAdditional(false);
    if (employeeDetails) {
      setFormData(prev => ({
        ...prev,
        billRate: employeeDetails.BILL_RATE || '',
        billType: employeeDetails.BILL_TYPE || '',
        otBillRate: employeeDetails.OT_BILL_RATE || '',
        otBillType: employeeDetails.OT_BILL_TYPE || '',
        billableFlag: employeeDetails.BILLABLE_FLAG === 1 ? 'Yes' : 'No',
        otBillableFlag: employeeDetails.OT_BILLABLE_FLAG === 1 ? 'Yes' : 'No',
        payTerm: employeeDetails.PAY_TERM || '',
      }));
    }
    setError(null);
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
      formDataToSubmit.append('SKILLS', formData.skills || '');
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
            skills: updatedDetails[0].SKILLS || '',
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
    const option = options.find(opt => opt.id === parseInt(value,10));
    return option ? option.Name : value;
  };

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  const getdisplayemployeeid = (prjid) => {
    return prjid.split('_')[1] || prjid;
  };

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

  const [addformData, setaddFormData] = useState({
    empId: '',
    prjId: '',
    startDt: '',
    endDt: '',
    skills: '',
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
  const [addform_state, addform_formAction, addform_isPending] = useActionState(addProjectAssignment, addform_initialState);

  useEffect(() => {
    const addform_loadProjects = async () => {
      if (!orgId) {
        console.warn('No valid orgId provided, projects not fetched');
        addform_setProjects([]);
        return;
      }
      try {
        const addform_projectsData = await fetchProjectsByOrgId(parseInt(orgId, 10));
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
        const addform_employeesData = await fetchEmployeesByOrgId(parseInt(orgId, 10), addformData.prjId);
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
        skills: '',
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
      
      // Wait 2 seconds to show the success message, then go back to the list
      setTimeout(() => {
        setaddfrom_success(null);
        handleBack();
      }, 2000);
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
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '';
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
        empId: '',
      }));
    }
  }, [addformData.prjId, addform_projects]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handlecancelclick=()=>{
    setEditingAdditional(false);
  }
  const handleAccountFilterChange = (e) => {
    setAccountFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleStartDateFilterChange = (e) => {
    setStartDateFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleEndDateFilterChange = (e) => {
    setEndDateFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handlePageInputChange = (e) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(pageInputValue, 10);
      if (!isNaN(value) && value >= 1 && value <= totalPages) {
        setCurrentPage(value);
        setPageInputValue(value.toString());
      } else {
        setPageInputValue(currentPage.toString());
      }
    }
  };

  const handleProjectsPerPageInputChange = (e) => {
    setProjectsPerPageInput(e.target.value);
  };

  const handleProjectsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setProjectsPerPage(value);
        setProjectsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setProjectsPerPageInput(projectsPerPage.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      }
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
      setPageInputValue((currentPage + 1).toString());
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      setPageInputValue((currentPage - 1).toString());
    }
  };

  // Filter logic
  const filteredProjects = allProjects.filter((project) => {
    const matchesSearch = project.PRJ_NAME?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAccount = accountFilter ? project.ACCNT_ID === accountFilter : true;
    const matchesStartDate = startDateFilter
      ? new Date(project.START_DT).toISOString().slice(0, 10) >= startDateFilter
      : true;
    const matchesEndDate = endDateFilter
      ? project.END_DT
        ? new Date(project.END_DT).toISOString().slice(0, 10) <= endDateFilter
        : true
      : true;
    return matchesSearch && matchesAccount && matchesStartDate && matchesEndDate;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const indexOfLastProject = currentPage * projectsPerPage;
  const indexOfFirstProject = indexOfLastProject - projectsPerPage;
  const currentProjects = filteredProjects.slice(indexOfFirstProject, indexOfLastProject);

  return (
    <div className="project_assign_overview_container">
      {error && <div className="project_assign_error_message">{error}</div>}
      {isLoading && <div className="project_assign_loading_message">Saving...</div>}
      {isadd && (
        <div className="project_assign_add_container">
          <div className="project_assign_header_section">
            <h2 className="project_assign_title">Add Project Assignment</h2>
            <button className="project_assign_back_button" onClick={handleBack}></button>
          </div>
          {addform_success && <div className="project_assign_success_message">{addform_success}</div>}
          {addform_state.error && <div className="project_assign_error_message">{addform_state.error}</div>}
          {addform_isPending && <div className="project_assign_loading_message">Project is assigning, please wait...</div>}
          <form action={addform_formAction}>
            <div className="project_assign_details_block">
              <h3>Selection Details</h3>
              <div className="project_assign_form_row">
                <div className="project_assign_form_group">
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
                <div className="project_assign_form_group">
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
              <div className="project_assign_form_row">
                <div className="project_assign_form_group">
                  <label>Project Start Date:</label>
                  <input
                    type="date"
                    name="projectStartDt"
                    value={addformData.projectStartDt}
                    readOnly
                    className="project_assign_bg_gray_100"
                  />
                </div>
                <div className="project_assign_form_group">
                  <label>Project End Date:</label>
                  <input
                    type="date"
                    name="projectEndDt"
                    value={addformData.projectEndDt}
                    readOnly
                    className="project_assign_bg_gray_100"
                  />
                </div>
              </div>
              <div className="project_assign_form_row">
                <div className="project_assign_form_group">
                  <label>Skills:</label>
                  <input
                    type="text"
                    name="skills"
                    value={addformData.skills}
                    onChange={handleform_handleChange}
                    placeholder="Enter skills"
                  />
                </div>
              </div>
            </div>
            <div className="project_assign_details_block">
              <h3>Date Details</h3>
              <div className="project_assign_form_row">
                <div className="project_assign_form_group">
                  <label>Assignment Start Date*:</label>
                  <input
                    type="date"
                    name="startDt"
                    value={addformData.startDt}
                    onChange={handleform_handleChange}
                    required
                  />
                </div>
                <div className="project_assign_form_group">
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
            <div className="project_assign_details_block">
              <h3>Billing Details</h3>
              <div className="project_assign_form_row">
                <div className="project_assign_form_group">
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
                <div className="project_assign_form_group">
                  <label>Bill Type*:</label>
                  <select name="billType" value={addformData.billType} onChange={handleform_handleChange} required>
                    <option value="">Select Type</option>
                    {billTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="project_assign_form_row">
                <div className="project_assign_form_group">
                  <label>OT Bill Rate:</label>
                  <input
                    type="number"
                    step="0.01"
                    name="otBillRate"
                    value={addformData.otBillRate}
                    onChange={handleform_handleChange}
                  />
                </div>
                <div className="project_assign_form_group">
                  <label>OT Bill Type:</label>
                  <select name="otBillType" value={addformData.otBillType} onChange={handleform_handleChange}>
                    <option value="">Select Type</option>
                    {otBillType.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="project_assign_form_row">
                <div className="project_assign_form_group">
                  <label>Billable*:</label>
                  <select name="billableFlag" value={addformData.billableFlag} onChange={handleform_handleChange} required>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <div className="project_assign_form_group">
                  <label>OT Billable:</label>
                  <select name="otBillableFlag" value={addformData.otBillableFlag} onChange={handleform_handleChange}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>
              <div className="project_assign_form_row">
                <div className="project_assign_form_group">
                  <label>Payment Term*:</label>
                  <select name="payTerm" value={addformData.payTerm} onChange={handleform_handleChange} required>
                    <option value="">Select Term</option>
                    {payTerms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="project_assign_form_buttons">
              <button type="submit" disabled={!orgId || !addformData.prjId || !addformData.empId || addform_isPending} className="project_assign_submit_button">{addform_isPending ? 'Assigning...' : 'Add Assignment'}</button>
            </div>
          </form>
        </div>
      )}
      {!isadd && !selectedProject ? (
        <div>
          <div className="project_assign_header_section">
            <h2 className="project_assign_title">Projects</h2>
            <button onClick={() => handleaddprojectassignment()} className="project_assign_button">Assign Project</button>
          </div>

          <div className="project_assign_search_filter_container">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              className="project_assign_search_input"
              placeholder="Search by project name..."
            />
            <select
              value={accountFilter}
              onChange={handleAccountFilterChange}
              className="project_assign_filter_select"
            >
              <option value="">All Accounts</option>
              {accountOptions.map((accountId) => (
                <option key={accountId} value={accountId}>
                  Account-{getdisplayprojectid(accountId)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={startDateFilter}
              onChange={handleStartDateFilterChange}
              className="project_assign_date_input"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={endDateFilter}
              onChange={handleEndDateFilterChange}
              className="project_assign_date_input"
              placeholder="End Date"
            />
          </div>
          {filteredProjects.length === 0 ? (
            <p>No Projects found.</p>
          ) : (
            <>
              <div className="project_assign_table_wrapper">
                <table className="project_assign_table project_assign_four_column">
                  <colgroup>
                    
                    <col />
                    <col />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      {/* <th onClick={() => requestSort('prjId')} className={`project_assign_sortable ${sortConfig.column === 'prjId' ? `project_assign_sort_${sortConfig.direction}` : ''}`}>
                        Project ID
                      </th> */}
                      <th onClick={() => requestSort('prjName')} className={`project_assign_sortable ${sortConfig.column === 'prjName' ? `project_assign_sort_${sortConfig.direction}` : ''}`}>
                        Project Name
                      </th>
                      <th>
                        Description
                      </th>
                      <th onClick={() => requestSort('accntId')} className={`project_assign_sortable ${sortConfig.column === 'accntId' ? `project_assign_sort_${sortConfig.direction}` : ''}`}>
                        Account Name
                      </th>
                      
                      <th onClick={() => requestSort('startDt')} className={`project_assign_sortable ${sortConfig.column === 'startDt' ? `project_assign_sort_${sortConfig.direction}` : ''}`}>
                        Start Date
                      </th>
                      <th onClick={() => requestSort('endDt')} className={`project_assign_sortable ${sortConfig.column === 'endDt' ? `project_assign_sort_${sortConfig.direction}` : ''}`}>
                        End Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentProjects.map((project) => (
                      <tr
                        key={project.PRJ_ID}
                        onClick={() => handleRowClick(project)}
                        className="project_assign_clickable_row"
                      >
                        <td className="project_assign_id_cell">
                          <span className="project_assign_indicator"></span>
                         {project.PRJ_NAME || '-'}
                        </td>
                       
                        <td>{project.PRS_DESC || '-'}</td>
                        {/* <td>Account-{getdisplayprojectid(project.ACCNT_ID)}</td> */}
                         <td>{project.ALIAS_NAME || '-'}</td>
                        <td>{formatDate(project.START_DT) || '-'}</td>
                        <td>{formatDate(project.END_DT) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredProjects.length > projectsPerPage && (
                <div className="project_assign_pagination_container">
                  <button
                    className="project_assign_button"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  <span className="project_assign_pagination_text">
                    Page{' '}
                    <input
                      type="text"
                      value={pageInputValue}
                      onChange={handlePageInputChange}
                      onKeyPress={handlePageInputKeyPress}
                      className="project_assign_pagination_input"
                    />{' '}
                    of {totalPages}
                  </span>
                  <button
                    className="project_assign_button"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
              {filteredProjects.length > 0 && (
                <div className="project_assign_rows_per_page_container">
                  <label className="project_assign_rows_per_page_label">Rows/ Page</label>
                  <input
                    type="text"
                    value={projectsPerPageInput}
                    onChange={handleProjectsPerPageInputChange}
                    onKeyPress={handleProjectsPerPageInputKeyPress}
                    className="project_assign_rows_per_page_input"
                    aria-label="Number of rows per page"
                  />
                </div>
              )}
            </>
          )}
        </div>
      ) : !isadd && (
        <div className="project_assign_details_container">
          <div className="project_assign_header_section">
            <h2 className="project_assign_title">{employeeDetails?.EMP_NAME ? `${employeeDetails.EMP_NAME} - ` : ''}{selectedProject?.PRJ_NAME || ''} Project Assignment Details</h2>
            <button className="project_assign_back_button" onClick={handleBack}></button>
          </div>
          <div className="project_assign_details_block">
            <div className="project_assign_form_row">
              <div className="project_assign_form_group">
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
            <div className='project_assign_submenu_bar'>
            <button onClick={()=>{handlebasicdetailsdisplay()}} className={activetab==='basic'?'project_assign_active':''}>Basic Details</button>
            <button onClick={()=>{handleadditionaldetailsdisplay()}} className={activetab==='additional'?'project_assign_active':''}>Additional Details</button>
            </div>
            {basicdetailsdisplay && !additionaldetailsdisplay&&
            (
              <div className="project_assign_details_block">
                {editingBasic ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave('basic'); }} className="project_assign_form">
                    <h3>Basic Details</h3>
                    <div className="project_assign_form_row">
                      <div className="project_assign_form_group">
                        <label>Project Start Date:</label>
                        <input
                          type="date"
                          name="projectStartDt"
                          value={formData.projectStartDt}
                          readOnly
                          className="project_assign_bg_gray_100"
                        />
                      </div>
                      <div className="project_assign_form_group">
                        <label>Project End Date:</label>
                        <input
                          type="date"
                          name="projectEndDt"
                          value={formData.projectEndDt}
                          readOnly
                          className="project_assign_bg_gray_100"
                        />
                      </div>
                    </div>
                    <div className="project_assign_form_row">
                      <div className="project_assign_form_group">
                        <label>Assignment Start Date*:</label>
                        <input
                          type="date"
                          name="startDt"
                          value={formData.startDt}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="project_assign_form_group">
                        <label>Assignment End Date:</label>
                        <input
                          type="date"
                          name="endDt"
                          value={formData.endDt}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className="project_assign_form_row">
                      <div className="project_assign_form_group">
                        <label>Skills:</label>
                        <input
                          type="text"
                          name="skills"
                          value={formData.skills || ''}
                          onChange={handleChange}
                          placeholder="Enter skills"
                        />
                      </div>
                    </div>
                    <div className="project_assign_form_buttons">
                      <button type="submit" className="project_assign_submit_button" disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="project_assign_cancel_button"
                        onClick={handleCancelBasic}
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="project_assign_details_header">
                      <h3>Basic Details</h3>
                      <div className="project_assign_details_buttons">
                          <button className="project_assign_edit_button" onClick={() => handleEdit('basic')}>
                            Edit
                          </button>
                      </div>
                    </div>
                    <div className="project_assign_view_details">
                      <div className="project_assign_details_row">
                        <div className="project_assign_details_group">
                          <label>Employee Name:</label>
                          <p>{employeeDetails.EMP_NAME || '-'}</p>
                        </div>
                        <div className="project_assign_details_group">
                          <label>Project Name:</label>
                          <p>{selectedProject.PRJ_NAME || '-'}</p>
                        </div>
                      </div>
                      <div className="project_assign_details_row">
                        <div className="project_assign_details_group">
                          <label>Project Start Date:</label>
                          <p>{formatDate(selectedProject.START_DT) || '-'}</p>
                        </div>
                        <div className="project_assign_details_group">
                          <label>Project End Date:</label>
                          <p>{formatDate(selectedProject.END_DT) || '-'}</p>
                        </div>
                      </div>
                      <div className="project_assign_details_row">
                        <div className="project_assign_details_group">
                          <label>Assignment Start Date:</label>
                          <p>{formatDate(employeeDetails.START_DT) || '-'}</p>
                        </div>
                        <div className="project_assign_details_group">
                          <label>Assignment End Date:</label>
                          <p>{formatDate(employeeDetails.END_DT) || '-'}</p>
                        </div>
                      </div>
                      <div className="project_assign_details_row">
                        <div className="project_assign_details_group">
                          <label>Skills:</label>
                          <p>{employeeDetails.SKILLS || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
              {additionaldetailsdisplay&&
            (
            <div className="project_assign_details_block">
              {editingAdditional ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('additional'); }} className="project_assign_form">
                  <h3>Additional Details</h3>
                  <div className="project_assign_form_row">
                    <div className="project_assign_form_group">
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
                    <div className="project_assign_form_group">
                      <label>Bill Type*:</label>
                      <select name="billType" value={formData.billType} onChange={handleChange} required>
                        <option value="">Select Type</option>
                        {billTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="project_assign_form_row">
                    <div className="project_assign_form_group">
                      <label>OT Bill Rate:</label>
                      <input
                        type="number"
                        step="0.01"
                        name="otBillRate"
                        value={formData.otBillRate}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="project_assign_form_group">
                      <label>OT Bill Type:</label>
                      <select name="otBillType" value={formData.otBillType} onChange={handleChange}>
                        <option value="">Select Type</option>
                        {otBillType.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="project_assign_form_row">
                    <div className="project_assign_form_group">
                      <label>Billable*:</label>
                      <select name="billableFlag" value={addformData.billableFlag} onChange={handleChange} required>
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                    <div className="project_assign_form_group">
                      <label>OT Billable:</label>
                      <select name="otBillableFlag" value={addformData.otBillableFlag} onChange={handleform_handleChange}>
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  </div>
                  <div className="project_assign_form_row">
                    <div className="project_assign_form_group">
                      <label>Payment Term*:</label>
                      <select name="payTerm" value={addformData.payTerm} onChange={handleform_handleChange} required>
                        <option value="">Select Term</option>
                        {payTerms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="project_assign_form_buttons">
                    <button type="submit" className="project_assign_submit_button" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="project_assign_cancel_button"
                      onClick={handleCancelAdditional}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="project_assign_details_header">
                    <h3>Additional Details</h3>
                    <div className="project_assign_details_buttons">
                      <button className="project_assign_edit_button" onClick={() => handleEdit('additional')}>
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="project_assign_view_details">
                    <div className="project_assign_details_row">
                      <div className="project_assign_details_group">
                        <label>Bill Rate:</label>
                        <p>{employeeDetails.BILL_RATE || '-'}</p>
                      </div>
                      <div className="project_assign_details_group">
                        <label>Bill Type:</label>
                        <p>{getDisplayValue(employeeDetails.BILL_TYPE, billTypes)}</p>
                      </div>
                    </div>
                    <div className="project_assign_details_row">
                      <div className="project_assign_details_group">
                        <label>OT Bill Rate:</label>
                        <p>{employeeDetails.OT_BILL_RATE || '-'}</p>
                      </div>
                      <div className="project_assign_details_group">
                        <label>OT Bill Type:</label>
                        <p>{getDisplayValue(employeeDetails.OT_BILL_TYPE, otBillType)}</p>
                      </div>
                    </div>
                    <div className="project_assign_details_row">
                      <div className="project_assign_details_group">
                        <label>Billable:</label>
                        <p>{employeeDetails.BILLABLE_FLAG === 1 ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="project_assign_details_group">
                        <label>OT Billable:</label>
                        <p>{employeeDetails.OT_BILLABLE_FLAG === 1 ? 'No' : 'Yes'}</p>
                      </div>
                    </div>
                    <div className="project_assign_details_row">
                      <div className="project_assign_details_group">
                        <label>Payment Term:</label>
                        <p>{getDisplayValue(employeeDetails.PAY_TERM, payTerms)}</p>
                      </div>
                    </div>
                    <div className="project_assign_details_row">
                      <div className="project_assign_details_group">
                        <label>Created By:</label>
                        <p>{employeeDetails.CREATED_BY || '-'}</p>
                      </div>
                      <div className="project_assign_details_group">
                        <label>Updated By:</label>
                        <p>{employeeDetails.LAST_UPDATED_BY || '-'}</p>
                      </div>
                    </div>
                    <div className="project_assign_details_row">
                      <div className="project_assign_details_group">
                        <label>Last Updated Date:</label>
                        <p>{formatDate(employeeDetails.LAST_UPDATED_DATE) || '-'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Overview;
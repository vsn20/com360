'use client';

import React, { useState, useEffect } from 'react';
import { updateproject, fetchProjectById } from '@/app/serverActions/Projects/overview';
import { addProject, fetchAccountsByOrgId } from '@/app/serverActions/Projects/AddprojectAction';
import './projectoverview.css';
import { useActionState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { set } from 'mongoose';

const addform_intialstate = { error: null, success: false };

const Overview = ({ orgId, projects, billTypes, otBillTypes, payTerms, accounts }) => {
  const searchparams = useSearchParams();
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [canEditProjects, setCanEditProjects] = useState(true);
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingAdditional, setEditingAdditional] = useState(false);
  const [isadd, setisadd] = useState(false);
  const [addformsuccess, setaddformsuccess] = useState(null);
  const [allProjects, setAllProjects] = useState(projects);
  const [sortConfig, setSortConfig] = useState({ column: 'prjId', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [projectsPerPage, setProjectsPerPage] = useState(10);
  const [projectsPerPageInput, setProjectsPerPageInput] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [basicdetailsdisplay, setbasicdetailsdisplay] = useState(false);
  const [additionaldetailsdisplay, setadditionaldetailsdisplay] = useState(false);
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
    setAllProjects(projects);
  }, [projects]);

  useEffect(() => {
    const sortedProjects = [...projects].sort((a, b) => sortProjects(a, b, sortConfig.column, sortConfig.direction));
    setAllProjects(sortedProjects);
  }, [sortConfig, projects]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

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
        aValue = getAccountName(a.ACCNT_ID).toLowerCase();
        bValue = getAccountName(b.ACCNT_ID).toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
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

  const handleRowClick = (project) => {
    console.log('Selected project:', { PRJ_ID: project.PRJ_ID, suborgid: project.suborgid, suborgname: project.suborgname });
    setSelectedProject(project);
    setFormData({
      prjId: project.PRJ_ID,
      prjName: project.PRJ_NAME || '',
      prsDesc: project.PRS_DESC || '',
      accntId: project.ACCNT_ID || '',
      billRate: project.BILL_RATE || '',
      billType: project.BILL_TYPE || '',
      otBillRate: project.OT_BILL_RATE || '',
      otBillType: project.OT_BILL_TYPE || '',
      billableFlag: project.BILLABLE_FLAG ? 'Yes' : 'No',
      startDt: formatDate(project.START_DT),
      endDt: formatDate(project.END_DT),
      clientId: project.CLIENT_ID || '',
      payTerm: project.PAY_TERM || '',
      invoiceEmail: project.INVOICE_EMAIL || '',
      invoiceFax: project.INVOICE_FAX || '',
      invoicePhone: project.INVOICE_PHONE || '',
      createdBy: project.Createdby || '',
      updatedBy: project.Updatedby || '',
      lastUpdatedDate: formatDate(project.last_updated_date) || '',
      suborgid: project.suborgid || '',
      suborgname: project.suborgname || ''
    });
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setIsLoading(false);
    setisadd(false);
    setbasicdetailsdisplay(true);
    setadditionaldetailsdisplay(false);
    setSearchQuery('');
    setAccountFilter('all');
    setactivetab('basic');
  };

  const handlebasicdetailsdisplay = () => {
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setIsLoading(false);
    setisadd(false);
    setSearchQuery('');
    setAccountFilter('all');
    setbasicdetailsdisplay(true);
    setadditionaldetailsdisplay(false);
    setactivetab('basic');
  };

  const handleadditionaldetailsdisplay = () => {
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setIsLoading(false);
    setisadd(false);
    setSearchQuery('');
    setAccountFilter('all');
    setbasicdetailsdisplay(false);
    setadditionaldetailsdisplay(true);
    setactivetab('additional');
  };

  const handleBack = () => {
    router.refresh();
    setSelectedProject(null);
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setIsLoading(false);
    setisadd(false);
    setSearchQuery('');
    setAccountFilter('all');
    setbasicdetailsdisplay(false);
    setadditionaldetailsdisplay(false);
    setactivetab('');
  };

  const handleaddproject = () => {
    setSelectedProject(null);
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setIsLoading(false);
    setisadd(true);
    setbasicdetailsdisplay(false);
    setadditionaldetailsdisplay(false);
  };

  const handleEdit = (section) => {
    if (section === 'basic') setEditingBasic(true);
    if (section === 'additional') setEditingAdditional(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      let newData = { ...prev, [name]: value };
      if (name === 'accntId') {
        const selectedAccount = accounts.find(acc => acc.ACCNT_ID === value);
        console.log('Account changed:', { accntId: value, selectedAccount });
        if (selectedAccount) {
          newData.suborgid = selectedAccount.suborgid || '';
          newData.suborgname = selectedAccount.suborgname || '';
          console.log('Updated suborg:', { suborgid: newData.suborgid, suborgname: newData.suborgname });
        } else {
          newData.suborgid = '';
          newData.suborgname = '';
          console.log('No account found, resetting suborg:', { suborgid: '', suborgname: '' });
        }
      }
      return newData;
    });
  };

  const handleSave = async (section) => {
    if (section === 'basic') {
      if (!formData.prjName) {
        setError('Project Name is required.');
        return;
      }
      if (!formData.accntId) {
        setError('Account is required.');
        return;
      }
    } else if (section === 'additional') {
      if (!formData.clientId) {
        setError('Client is required.');
        return;
      }
    }

    setIsLoading(true);
    const formDataToSubmit = new FormData();
    formDataToSubmit.append('PRJ_ID', formData.prjId);
    formDataToSubmit.append('section', section);

    if (section === 'basic') {
      formDataToSubmit.append('PRJ_NAME', formData.prjName || '');
      formDataToSubmit.append('PRS_DESC', formData.prsDesc || '');
      formDataToSubmit.append('ACCNT_ID', formData.accntId || '');
      formDataToSubmit.append('suborgid', formData.suborgid || '');
    } else if (section === 'additional') {
      formDataToSubmit.append('BILL_RATE', formData.billRate || '');
      formDataToSubmit.append('BILL_TYPE', formData.billType || '');
      formDataToSubmit.append('OT_BILL_RATE', formData.otBillRate || '');
      formDataToSubmit.append('OT_BILL_TYPE', formData.otBillType || '');
      formDataToSubmit.append('BILLABLE_FLAG', formData.billableFlag === 'Yes' ? '1' : '0');
      formDataToSubmit.append('START_DT', formData.startDt || '');
      formDataToSubmit.append('END_DT', formData.endDt || '');
      formDataToSubmit.append('CLIENT_ID', formData.clientId || '');
      formDataToSubmit.append('PAY_TERM', formData.payTerm || '');
      formDataToSubmit.append('INVOICE_EMAIL', formData.invoiceEmail || '');
      formDataToSubmit.append('INVOICE_FAX', formData.invoiceFax || '');
      formDataToSubmit.append('INVOICE_PHONE', formData.invoicePhone || '');
    }

    try {
      console.log('Submitting form data:', Object.fromEntries(formDataToSubmit));
      const result = await updateproject(formDataToSubmit);
      if (result && result.success) {
        const updatedProject = await fetchProjectById(formData.prjId);
        console.log('Fetched updated project:', updatedProject);
        setSelectedProject(updatedProject);
        projects.forEach((project, index) => {
          if (project.PRJ_ID === formData.prjId) {
            projects[index] = {
              ...project,
              PRJ_NAME: updatedProject.PRJ_NAME || project.PRJ_NAME,
              PRS_DESC: updatedProject.PRS_DESC || project.PRS_DESC,
              ACCNT_ID: updatedProject.ACCNT_ID || project.ACCNT_ID,
              BILL_RATE: updatedProject.BILL_RATE || project.BILL_RATE,
              BILL_TYPE: updatedProject.BILL_TYPE || project.BILL_TYPE,
              OT_BILL_RATE: updatedProject.OT_BILL_RATE || project.OT_BILL_RATE,
              OT_BILL_TYPE: updatedProject.OT_BILL_TYPE || project.OT_BILL_TYPE,
              BILLABLE_FLAG: updatedProject.BILLABLE_FLAG || project.BILLABLE_FLAG,
              START_DT: updatedProject.START_DT || project.START_DT,
              END_DT: updatedProject.END_DT || project.END_DT,
              CLIENT_ID: updatedProject.CLIENT_ID || project.CLIENT_ID,
              PAY_TERM: updatedProject.PAY_TERM || project.PAY_TERM,
              INVOICE_EMAIL: updatedProject.INVOICE_EMAIL || project.INVOICE_EMAIL,
              INVOICE_FAX: updatedProject.INVOICE_FAX || project.INVOICE_FAX,
              INVOICE_PHONE: updatedProject.INVOICE_PHONE || project.INVOICE_PHONE,
              Createdby: updatedProject.Createdby || project.Createdby,
              Updatedby: updatedProject.Updatedby || project.Updatedby,
              last_updated_date: updatedProject.last_updated_date || project.last_updated_date,
              suborgid: updatedProject.suborgid || project.suborgid,
              suborgname: updatedProject.suborgname || project.suborgname
            };
          }
        });
        if (section === 'basic') setEditingBasic(false);
        if (section === 'additional') setEditingAdditional(false);
        setError(null);
      } else {
        setError(result.error || 'Failed to save: Invalid response from server');
      }
    } catch (err) {
      console.error('Error saving project:', err);
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayValue = (value, options) => {
    if (!value || !options) return '-';
    const option = options.find(opt => String(opt.id) === String(value));
    return option ? option.Name : value;
  };

  const getAccountName = (accntId) => {
    if (!accntId || !accounts) return '-';
    const account = accounts.find(acc => acc.ACCNT_ID === accntId);
    return account ? account.ALIAS_NAME : accntId;
  };

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
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

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleAccountFilterChange = (e) => {
    setAccountFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  // Filter logic
  const filteredProjects = allProjects.filter((project) => {
    const matchesSearch = project.PRJ_NAME?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAccount = accountFilter === 'all' || String(project.ACCNT_ID) === accountFilter;
    return matchesSearch && matchesAccount;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const indexOfLastProject = currentPage * projectsPerPage;
  const indexOfFirstProject = indexOfLastProject - projectsPerPage;
  const currentProjects = filteredProjects.slice(indexOfFirstProject, indexOfLastProject);

  const [addformData, setaddFormData] = useState({
    prjName: '',
    prsDesc: '',
    accntId: '',
    orgId: orgId || '',
    billRate: '',
    billType: '',
    otBillRate: '',
    otBillType: '',
    billableFlag: 'No',
    startDt: '',
    endDt: '',
    clientId: '',
    payTerm: '',
    invoiceEmail: '',
    invoiceFax: '',
    invoicePhone: '',
    suborgid: '',
    suborgname: ''
  });

  const [addform_accounts, addform_setAccounts] = useState([]);
  const [state, formAction] = useActionState(addProject, addform_intialstate);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (orgId) {
          const accountsData = await fetchAccountsByOrgId(parseInt(orgId, 10));
          console.log('Loaded accounts for add form:', accountsData);
          addform_setAccounts(accountsData);
        } else {
          addform_setAccounts([]);
          console.warn('No valid orgId provided, accounts not fetched');
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
      }
    };
    loadData();
  }, [orgId]);

  const addform_handleChange = (e) => {
    const { name, value } = e.target;
    setaddFormData((prev) => {
      let newData = { ...prev, [name]: value };
      if (name === 'accntId') {
        const selectedAccount = addform_accounts.find(acc => acc.ACCNT_ID === value);
        console.log('Add form account changed:', { accntId: value, selectedAccount });
        if (selectedAccount) {
          newData.suborgid = selectedAccount.suborgid || '';
          newData.suborgname = selectedAccount.suborgname || '';
          console.log('Add form updated suborg:', { suborgid: newData.suborgid, suborgname: newData.suborgname });
        } else {
          newData.suborgid = '';
          newData.suborgname = '';
          console.log('Add form no account found, resetting suborg:', { suborgid: '', suborgname: '' });
        }
      }
      return newData;
    });
  };

  const addform_enhancedFormAction = async (formData) => {
    console.log('Add form data before submission:', Object.fromEntries(formData));
    formData.append('billTypes', JSON.stringify(billTypes));
    formData.append('otBillTypes', JSON.stringify(otBillTypes));
    formData.append('payTerms', JSON.stringify(payTerms));
    return formAction(formData);
  };

  useEffect(() => {
    if (state.success) {
      setaddFormData({
        prjName: '',
        prsDesc: '',
        accntId: '',
        orgId: orgId || '',
        billRate: '',
        billType: '',
        otBillRate: '',
        otBillType: '',
        billableFlag: 'No',
        startDt: '',
        endDt: '',
        clientId: '',
        payTerm: '',
        invoiceEmail: '',
        invoiceFax: '',
        invoicePhone: '',
        suborgid: '',
        suborgname: ''
      });
      setaddformsuccess('Project added successfully!');
      setTimeout(() => setaddformsuccess(null), 4000);
      setTimeout(() => router.refresh(), 4000);
    }
  }, [state.success, orgId]);

  return (
    <div className="project_overview_container">
      {error && <div className="project_error_message">{error}</div>}
      {isLoading && <div className="project_loading_message">Saving...</div>}
    
      {isadd && (
        <div className="project_add_container">
          <div className="project_header_section">
            <h2 className="project_title">Add Project</h2>
            <button className="project_back_button" onClick={handleBack}></button>
          </div>
          {addformsuccess && <div className="project_success_message">{addformsuccess}</div>}
          {state.error && <div className="project_error_message">{state.error}</div>}
          <form action={addform_enhancedFormAction} className="project_form_container">
            <div className="project_form_section">
              <h3>Basic Details</h3>
              <div className="project_form_row">
                <div className="project_form_group">
                  <label>Project Name*:</label>
                  <input
                    type="text"
                    name="prjName"
                    value={addformData.prjName}
                    onChange={addform_handleChange}
                    required
                  />
                </div>
                <div className="project_form_group">
                  <label>Description:</label>
                  <input
                    type="text"
                    name="prsDesc"
                    value={addformData.prsDesc}
                    onChange={addform_handleChange}
                  />
                </div>
              </div>
              <div className="project_form_row">
                <div className="project_form_group">
                  <label>Account*:</label>
                  <select
                    name="accntId"
                    value={addformData.accntId}
                    onChange={addform_handleChange}
                    required
                    disabled={!orgId}
                  >
                    <option value="">Select Account</option>
                    {addform_accounts.map((account) => (
                      <option key={account.ACCNT_ID} value={account.ACCNT_ID}>
                        {account.ALIAS_NAME}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="project_form_group">
                  <label>Organization:</label>
                  <input
                    type="text"
                    value={addformData.suborgname || ''}
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="project_form_section">
              <h3>Additional Details</h3>
              <div className="project_form_row">
                <div className="project_form_group">
                  <label>Bill Rate:</label>
                  <input
                    type="number"
                    step="0.01"
                    name="billRate"
                    value={addformData.billRate}
                    onChange={addform_handleChange}
                  />
                </div>
                <div className="project_form_group">
                  <label>Bill Type:</label>
                  <select
                    name="billType"
                    value={addformData.billType}
                    onChange={(e) => {
                      console.log('Selected billType:', e.target.value);
                      addform_handleChange(e);
                    }}
                  >
                    <option value="">Select Type</option>
                    {billTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="project_form_row">
                <div className="project_form_group">
                  <label>OT Bill Rate:</label>
                  <input
                    type="number"
                    step="0.01"
                    name="otBillRate"
                    value={addformData.otBillRate}
                    onChange={addform_handleChange}
                  />
                </div>
                <div className="project_form_group">
                  <label>OT Bill Type:</label>
                  <select
                    name="otBillType"
                    value={addformData.otBillType}
                    onChange={(e) => {
                      console.log('Selected otBillType:', e.target.value);
                      addform_handleChange(e);
                    }}
                  >
                    <option value="">Select Type</option>
                    {otBillTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="project_form_row">
                <div className="project_form_group">
                  <label>Billable:</label>
                  <select
                    name="billableFlag"
                    value={addformData.billableFlag}
                    onChange={addform_handleChange}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <div className="project_form_group">
                  <label>Start Date:</label>
                  <input
                    type="date"
                    name="startDt"
                    value={addformData.startDt}
                    onChange={addform_handleChange}
                    placeholder="mm/dd/yyyy"
                  />
                </div>
              </div>
              <div className="project_form_row">
                <div className="project_form_group">
                  <label>End Date:</label>
                  <input
                    type="date"
                    name="endDt"
                    value={addformData.endDt}
                    onChange={addform_handleChange}
                    placeholder="mm/dd/yyyy"
                  />
                </div>
                <div className="project_form_group">
                  <label>Client*:</label>
                  <select
                    name="clientId"
                    value={addformData.clientId}
                    onChange={addform_handleChange}
                    required
                    disabled={!orgId}
                  >
                    <option value="">Select Client</option>
                    {addform_accounts.map((account) => (
                      <option key={account.ACCNT_ID} value={account.ACCNT_ID}>
                        {account.ALIAS_NAME}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="project_form_row">
                <div className="project_form_group">
                  <label>Payment Term:</label>
                  <select
                    name="payTerm"
                    value={addformData.payTerm}
                    onChange={(e) => {
                      console.log('Selected payTerm:', e.target.value);
                      addform_handleChange(e);
                    }}
                  >
                    <option value="">Select Term</option>
                    {payTerms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="project_form_group">
                  <label>Invoice Email:</label>
                  <input
                    type="email"
                    name="invoiceEmail"
                    value={addformData.invoiceEmail}
                    onChange={addform_handleChange}
                  />
                </div>
              </div>
              <div className="project_form_row">
                <div className="project_form_group">
                  <label>Invoice Fax:</label>
                  <input
                    type="text"
                    name="invoiceFax"
                    value={addformData.invoiceFax}
                    onChange={addform_handleChange}
                  />
                </div>
                <div className="project_form_group">
                  <label>Invoice Phone:</label>
                  <input
                    type="text"
                    name="invoicePhone"
                    value={addformData.invoicePhone}
                    onChange={addform_handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="project_form_buttons">
              <button type="submit" className="project_submit_button" disabled={!orgId}>
                Add Project
              </button>
            </div>
          </form>
        </div>
      )}

      {!isadd && !selectedProject ? (
        <div className="project_list">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 className="project_title">Existing Projects</h1>
            <button onClick={() => handleaddproject()} className="project_submit_button">Add Project</button>
          </div>
          <div className="project_search_filter_container">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              className="project_search_input"
              placeholder="Search by project name..."
            />
            <select value={accountFilter} onChange={handleAccountFilterChange} className="project_filter_select">
              <option value="all">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.ACCNT_ID} value={account.ACCNT_ID}>
                  {account.ALIAS_NAME}
                </option>
              ))}
            </select>
          </div>
          {filteredProjects.length === 0 ? (
            <div className="project_empty_state">No projects found.</div>
          ) : (
            <>
              <div className="project_table_wrapper">
                <table className="project_table">
                  <thead>
                    <tr>
                      <th className={sortConfig.column === 'prjId' ? `project_sortable project_sort_${sortConfig.direction}` : 'project_sortable'} onClick={() => requestSort('prjId')}>
                        Project ID
                      </th>
                      <th className={sortConfig.column === 'prjName' ? `project_sortable project_sort_${sortConfig.direction}` : 'project_sortable'} onClick={() => requestSort('prjName')}>
                        Project Name
                      </th>
                      <th className={sortConfig.column === 'prsDesc' ? `project_sortable project_sort_${sortConfig.direction}` : 'project_sortable'} onClick={() => requestSort('prsDesc')}>
                        Description
                      </th>
                      <th className={sortConfig.column === 'accntId' ? `project_sortable project_sort_${sortConfig.direction}` : 'project_sortable'} onClick={() => requestSort('accntId')}>
                        Account
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentProjects.map((project) => (

                      <tr
                        key={project.PRJ_ID}
                        onClick={() => handleRowClick(project)}
                        className={selectedProject && selectedProject.PRJ_ID === project.PRJ_ID ? 'project_selected_row' : 'project_clickable_row'}
                      >
                        <td className='project_id_cell'>
                          <span className='project_indicator'></span>
                            Project-{getdisplayprojectid(project.PRJ_ID)}
                          </td>
                        <td>{project.PRJ_NAME || '-'}</td>
                        <td>{project.PRS_DESC || '-'}</td>
                        <td>{getAccountName(project.ACCNT_ID)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredProjects.length > projectsPerPage && (
                <div className="project_pagination_container">
                  <button
                    className="project_button"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  <span className="project_pagination_text">
                    Page{' '}
                    <input
                      type="text"
                      value={pageInputValue}
                      onChange={handlePageInputChange}
                      onKeyPress={handlePageInputKeyPress}
                      className="project_pagination_input"
                    />{' '}
                    of {totalPages}
                  </span>
                  <button
                    className="project_button"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
              {filteredProjects.length > 0 && (
                <div className="project_rows_per_page_container">
                  <label className="project_rows_per_page_label">Rows/ Page</label>
                  <input
                    type="text"
                    value={projectsPerPageInput}
                    onChange={handleProjectsPerPageInputChange}
                    onKeyPress={handleProjectsPerPageInputKeyPress}
                    className="project_rows_per_page_input"
                    aria-label="Number of rows per page"
                  />
                </div>
              )}
            </>
          )}
        </div>
      ) : !isadd && (
        <div className="project_details_container">
          <div className="project_header_section">
            <h1 className="project_title">Project Details</h1>
            <button className="project_back_button" onClick={handleBack}></button>
          </div>
          <div className="project_submenu_bar">
            <button onClick={handlebasicdetailsdisplay} className={activetab==='basic'? 'project_active':''}>Basic Details</button>
            <button onClick={handleadditionaldetailsdisplay} className={activetab==='additional'?'project_active':''}>Additional Details</button>
          </div>
          {basicdetailsdisplay && !additionaldetailsdisplay && (
            <div className="project_details_block">
              <h3>Basic Details</h3>
              {editingBasic && canEditProjects ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('basic'); }} className="project_form">
                  <div className="project_form_row">
                    <div className="project_form_group">
                      <label>Project Name*:</label>
                      <input
                        type="text"
                        name="prjName"
                        value={formData.prjName}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="project_form_row">
                    <div className="project_form_group">
                      <label>Description:</label>
                      <input
                        type="text"
                        name="prsDesc"
                        value={formData.prsDesc}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="project_form_group">
                      <label>Account*:</label>
                      <select
                        name="accntId"
                        value={formData.accntId}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select Account</option>
                        {accounts.map((account) => (
                          <option key={account.ACCNT_ID} value={account.ACCNT_ID}>
                            {account.ALIAS_NAME}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="project_form_row">
                    <div className="project_form_group">
                      <label>Organization:</label>
                      <input
                        type="text"
                        value={formData.suborgname || ''}
                        disabled
                      />
                    </div>
                  </div>
                  <div className="project_form_buttons">
                    <button type="submit" className="project_submit_button" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="project_cancel_button" onClick={() => setEditingBasic(false)} disabled={isLoading}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="project_view_details">
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>Project ID:</label>
                      <p>Project-{getdisplayprojectid(selectedProject.PRJ_ID)}</p>
                    </div>
                    <div className="project_details_group">
                      <label>Project Name:</label>
                      <p>{selectedProject.PRJ_NAME || '-'}</p>
                    </div>
                  </div>
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>Description:</label>
                      <p>{selectedProject.PRS_DESC || '-'}</p>
                    </div>
                    <div className="project_details_group">
                      <label>Account:</label>
                      <p>{getAccountName(selectedProject.ACCNT_ID)}</p>
                    </div>
                  </div>
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>Organization:</label>
                      <p>{selectedProject.suborgname || '---'}</p>
                    </div>
                  </div>
                  {canEditProjects && (
                    <div className="project_details_buttons">
                      <button className="project_edit_button" onClick={() => handleEdit('basic')}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {additionaldetailsdisplay && (
            <div className="project_details_block">
              <h3>Additional Details</h3>
              {editingAdditional && canEditProjects ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('additional'); }} className="project_form">
                  <div className="project_form_row">
                    <div className="project_form_group">
                      <label>Bill Rate:</label>
                      <input
                        type="number"
                        step="0.01"
                        name="billRate"
                        value={formData.billRate}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="project_form_group">
                      <label>Bill Type:</label>
                      <select
                        name="billType"
                        value={formData.billType}
                        onChange={(e) => {
                          console.log('Selected billType:', e.target.value);
                          handleChange(e);
                        }}
                      >
                        <option value="">Select Type</option>
                        {billTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="project_form_row">
                    <div className="project_form_group">
                      <label>OT Bill Rate:</label>
                      <input
                        type="number"
                        step="0.01"
                        name="otBillRate"
                        value={formData.otBillRate}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="project_form_group">
                      <label>OT Bill Type:</label>
                      <select
                        name="otBillType"
                        value={formData.otBillType}
                        onChange={(e) => {
                          console.log('Selected otBillType:', e.target.value);
                          handleChange(e);
                        }}
                      >
                        <option value="">Select Type</option>
                        {otBillTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="project_form_row">
                    <div className="project_form_group">
                      <label>Billable:</label>
                      <select
                        name="billableFlag"
                        value={formData.billableFlag}
                        onChange={handleChange}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                    <div className="project_form_group">
                      <label>Start Date:</label>
                      <input
                        type="date"
                        name="startDt"
                        value={formData.startDt}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className="project_form_row">
                    <div className="project_form_group">
                      <label>End Date:</label>
                      <input
                        type="date"
                        name="endDt"
                        value={formData.endDt}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="project_form_group">
                      <label>Client*:</label>
                      <select
                        name="clientId"
                        value={formData.clientId}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select Client</option>
                        {accounts.map((account) => (
                          <option key={account.ACCNT_ID} value={account.ACCNT_ID}>
                            {account.ALIAS_NAME}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="project_form_row">
                    <div className="project_form_group">
                      <label>Payment Term:</label>
                      <select
                        name="payTerm"
                        value={formData.payTerm}
                        onChange={(e) => {
                          console.log('Selected payTerm:', e.target.value);
                          handleChange(e);
                        }}
                      >
                        <option value="">Select Term</option>
                        {payTerms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="project_form_group">
                      <label>Invoice Email:</label>
                      <input
                        type="email"
                        name="invoiceEmail"
                        value={formData.invoiceEmail}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className="project_form_row">
                    <div className="project_form_group">
                      <label>Invoice Fax:</label>
                      <input
                        type="text"
                        name="invoiceFax"
                        value={formData.invoiceFax}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="project_form_group">
                      <label>Invoice Phone:</label>
                      <input
                        type="text"
                        name="invoicePhone"
                        value={formData.invoicePhone}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className="project_form_buttons">
                    <button type="submit" className="project_submit_button" disabled={isLoading}>
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="project_cancel_button" onClick={() => setEditingAdditional(false)} disabled={isLoading}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="project_view_details">
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>Bill Rate:</label>
                      <p>{selectedProject.BILL_RATE || '-'}</p>
                    </div>
                    <div className="project_details_group">
                      <label>Bill Type:</label>
                      <p>{getDisplayValue(selectedProject.BILL_TYPE, billTypes)}</p>
                    </div>
                  </div>
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>OT Bill Rate:</label>
                      <p>{selectedProject.OT_BILL_RATE || '-'}</p>
                    </div>
                    <div className="project_details_group">
                      <label>OT Bill Type:</label>
                      <p>{getDisplayValue(selectedProject.OT_BILL_TYPE, otBillTypes)}</p>
                    </div>
                  </div>
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>Billable:</label>
                      <p>{selectedProject.BILLABLE_FLAG ? 'Yes' : 'No'}</p>
                    </div>
                    <div className="project_details_group">
                      <label>Start Date:</label>
                      <p>{formatDate(selectedProject.START_DT) || '-'}</p>
                    </div>
                  </div>
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>End Date:</label>
                      <p>{formatDate(selectedProject.END_DT) || '-'}</p>
                    </div>
                    <div className="project_details_group">
                      <label>Client:</label>
                      <p>{getAccountName(selectedProject.CLIENT_ID)}</p>
                    </div>
                  </div>
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>Payment Term:</label>
                      <p>{getDisplayValue(selectedProject.PAY_TERM, payTerms)}</p>
                    </div>
                    <div className="project_details_group">
                      <label>Invoice Email:</label>
                      <p>{selectedProject.INVOICE_EMAIL || '-'}</p>
                    </div>
                  </div>
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>Invoice Fax:</label>
                      <p>{selectedProject.INVOICE_FAX || '-'}</p>
                    </div>
                    <div className="project_details_group">
                      <label>Invoice Phone:</label>
                      <p>{selectedProject.INVOICE_PHONE || '-'}</p>
                    </div>
                  </div>
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>Created By:</label>
                      <p>{selectedProject.Createdby || '-'}</p>
                    </div>
                    <div className="project_details_group">
                      <label>Updated By:</label>
                      <p>{selectedProject.Updatedby || '-'}</p>
                    </div>
                  </div>
                  <div className="project_details_row">
                    <div className="project_details_group">
                      <label>Last Updated Date:</label>
                      <p>{formatDate(selectedProject.last_updated_date) || '-'}</p>
                    </div>
                  </div>
                  {canEditProjects && (
                    <div className="project_details_buttons">
                      <button className="project_edit_button" onClick={() => handleEdit('additional')}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Overview;
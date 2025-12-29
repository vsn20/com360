'use client';

import React, { useState, useEffect } from 'react';
import { updateproject, fetchProjectById } from '@/app/serverActions/Projects/overview';
import { addProject, fetchAccountsByOrgId } from '@/app/serverActions/Projects/AddprojectAction';
import './projectoverview.css';
import { useActionState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const addform_intialstate = { error: null, success: false };

const Overview = ({ orgId, projects, billTypes, otBillTypes, payTerms, accounts, industries }) => {
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
  const [industryFilter, setIndustryFilter] = useState('all');
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
    setSelectedProject(project.PRJ_ID);
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setisadd(false);
    setactivetab('basic');
    setbasicdetailsdisplay(true);
    setadditionaldetailsdisplay(false);
  };

  const handleBack = () => {
    router.refresh();
    setSelectedProject(null);
    setFormData({});
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setisadd(false);
    setSearchQuery('');
    setAccountFilter('all');
    setIndustryFilter('all');
    setactivetab('basic');
    setbasicdetailsdisplay(false);
    setadditionaldetailsdisplay(false);
  };

  const handleaddproject = () => {
    setSelectedProject(null);
    setFormData({});
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setisadd(true);
    setactivetab('basic');
    setbasicdetailsdisplay(false);
    setadditionaldetailsdisplay(false);
  };

  const handletabClick = (tab) => {
    setactivetab(tab);
    if (tab === 'basic') {
      setbasicdetailsdisplay(true);
      setadditionaldetailsdisplay(false);
    } else if (tab === 'additional') {
      setbasicdetailsdisplay(false);
      setadditionaldetailsdisplay(true);
    }
    setEditingBasic(false);
    setEditingAdditional(false);
  };

  const handleEdit = (section) => {
    if (section === 'basic') setEditingBasic(true);
    if (section === 'additional') setEditingAdditional(true);
  };

  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
  const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };
  const handlePageInputChange = (e) => setPageInputValue(e.target.value);
  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(pageInputValue, 10);
      if (!isNaN(value) && value >= 1 && value <= totalPages) setCurrentPage(value);
      else setPageInputValue(currentPage.toString());
    }
  };
  const handleProjectsPerPageInputChange = (e) => setProjectsPerPageInput(e.target.value);
  const handleProjectsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setProjectsPerPage(value);
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setProjectsPerPageInput(projectsPerPage.toString());
      }
    }
  };

  const handleSearchChange = (e) => { setSearchQuery(e.target.value); setCurrentPage(1); };
  const handleAccountFilterChange = (e) => { setAccountFilter(e.target.value); setCurrentPage(1); };
  const handleIndustryFilterChange = (e) => { setIndustryFilter(e.target.value); setCurrentPage(1); };

  const filteredProjects = allProjects.filter((project) => {
    const matchesSearch = project.PRJ_NAME?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAccount = accountFilter === 'all' || String(project.ACCNT_ID) === accountFilter;
    const matchesIndustry = industryFilter === 'all' || String(project.Industries) === industryFilter;
    return matchesSearch && matchesAccount && matchesIndustry;
  });

  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const currentProjects = filteredProjects.slice((currentPage - 1) * projectsPerPage, currentPage * projectsPerPage);

  useEffect(() => {
    const loadProjectDetails = async () => {
      if (!selectedProject) return;
      try {
        setIsLoading(true);
        const project = await fetchProjectById(selectedProject);
        setFormData({
          prjId: project.PRJ_ID || '',
          prjName: project.PRJ_NAME || '',
          prsDesc: project.PRS_DESC || '',
          accntId: project.ACCNT_ID || '',
          orgId: project.ORG_ID || orgId || '',
          billRate: project.BILL_RATE || '',
          billType: project.BILL_TYPE || '',
          otBillRate: project.OT_BILL_RATE || '',
          otBillType: project.OT_BILL_TYPE || '',
          billableFlag: project.BILLABLE_FLAG ? '1' : '0',
          startDt: project.START_DT ? formatDate(project.START_DT) : '',
          endDt: project.END_DT ? formatDate(project.END_DT) : '',
          clientId: project.CLIENT_ID || '',
          payTerm: project.PAY_TERM || '',
          invoiceEmail: project.INVOICE_EMAIL || '',
          invoiceFax: project.INVOICE_FAX || '',
          invoicePhone: project.INVOICE_PHONE || '',
          createdBy: project.Createdby || '',
          updatedBy: project.Updatedby || '',
          lastUpdatedDate: project.last_updated_date ? formatDate(project.last_updated_date) : '',
          suborgid: project.suborgid || '',
          suborgname: project.suborgname || '',
          industries: project.Industries || ''
        });
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadProjectDetails();
  }, [selectedProject, orgId]);

  const handleCancelBasic = () => {
    setEditingBasic(false);
    if (selectedProject) {
      const project = projects.find(p => p.PRJ_ID === selectedProject);
      if (project) {
        setFormData(prev => ({
          ...prev,
          prjName: project.PRJ_NAME || '',
          prsDesc: project.PRS_DESC || '',
          accntId: project.ACCNT_ID || '',
          startDt: project.START_DT ? formatDate(project.START_DT) : '',
          endDt: project.END_DT ? formatDate(project.END_DT) : '',
          suborgid: project.suborgid || '',
          suborgname: project.suborgname || '',
          industries: project.Industries || ''
        }));
      }
    }
  };

  const handleCancelAdditional = () => {
    setEditingAdditional(false);
    if (selectedProject) {
      const project = projects.find(p => p.PRJ_ID === selectedProject);
      if (project) {
        setFormData(prev => ({
          ...prev,
          billRate: project.BILL_RATE || '',
          billType: project.BILL_TYPE || '',
          otBillRate: project.OT_BILL_RATE || '',
          otBillType: project.OT_BILL_TYPE || '',
          billableFlag: project.BILLABLE_FLAG ? '1' : '0',
          clientId: project.CLIENT_ID || '',
          payTerm: project.PAY_TERM || '',
          invoiceEmail: project.INVOICE_EMAIL || '',
          invoiceFax: project.INVOICE_FAX || '',
          invoicePhone: project.INVOICE_PHONE || ''
        }));
      }
    }
  };

  const handleSave = async (section) => {
    if (!formData.orgId) { setError('Organization ID missing.'); return; }
    setIsLoading(true);

    const formDataToSubmit = new FormData();
    formDataToSubmit.append('PRJ_ID', formData.prjId);
    formDataToSubmit.append('section', section);

    if (section === 'basic') {
      formDataToSubmit.append('PRJ_NAME', formData.prjName);
      formDataToSubmit.append('PRS_DESC', formData.prsDesc || '');
      formDataToSubmit.append('ACCNT_ID', formData.accntId);
      formDataToSubmit.append('START_DT', formData.startDt || '');
      formDataToSubmit.append('END_DT', formData.endDt || '');
      formDataToSubmit.append('suborgid', formData.suborgid || '');
      formDataToSubmit.append('Industries', formData.industries || '');
    } else if (section === 'additional') {
      formDataToSubmit.append('BILL_RATE', formData.billRate || '');
      formDataToSubmit.append('BILL_TYPE', formData.billType || '');
      formDataToSubmit.append('OT_BILL_RATE', formData.otBillRate || '');
      formDataToSubmit.append('OT_BILL_TYPE', formData.otBillType || '');
      formDataToSubmit.append('BILLABLE_FLAG', formData.billableFlag || '0');
      formDataToSubmit.append('CLIENT_ID', formData.clientId || '');
      formDataToSubmit.append('PAY_TERM', formData.payTerm || '');
      formDataToSubmit.append('INVOICE_EMAIL', formData.invoiceEmail || '');
      formDataToSubmit.append('INVOICE_FAX', formData.invoiceFax || '');
      formDataToSubmit.append('INVOICE_PHONE', formData.invoicePhone || '');
    }

    try {
      const result = await updateproject(formDataToSubmit);
      if (result && result.success) {
        const updatedProject = await fetchProjectById(formData.prjId);
        setFormData(prev => ({
          ...prev,
          ...updatedProject,
          prjId: updatedProject.PRJ_ID,
          prjName: updatedProject.PRJ_NAME,
          prsDesc: updatedProject.PRS_DESC,
          accntId: updatedProject.ACCNT_ID,
          orgId: updatedProject.ORG_ID,
          billRate: updatedProject.BILL_RATE,
          billType: updatedProject.BILL_TYPE,
          otBillRate: updatedProject.OT_BILL_RATE,
          otBillType: updatedProject.OT_BILL_TYPE,
          billableFlag: updatedProject.BILLABLE_FLAG ? '1' : '0',
          startDt: updatedProject.START_DT ? formatDate(updatedProject.START_DT) : '',
          endDt: updatedProject.END_DT ? formatDate(updatedProject.END_DT) : '',
          clientId: updatedProject.CLIENT_ID,
          payTerm: updatedProject.PAY_TERM,
          invoiceEmail: updatedProject.INVOICE_EMAIL,
          invoiceFax: updatedProject.INVOICE_FAX,
          invoicePhone: updatedProject.INVOICE_PHONE,
          suborgid: updatedProject.suborgid,
          suborgname: updatedProject.suborgname,
          industries: updatedProject.Industries
        }));

        if (section === 'basic') setEditingBasic(false);
        if (section === 'additional') setEditingAdditional(false);
        setError(null);
      } else {
        setError(result.error || 'Failed to save.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      let newData = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'accntId') {
        const selectedAccount = accounts.find(acc => acc.ACCNT_ID === value);
        if (selectedAccount) {
          newData.suborgid = selectedAccount.suborgid || '';
          newData.suborgname = selectedAccount.suborgname || '';
        } else {
          newData.suborgid = '';
          newData.suborgname = '';
        }
      }
      return newData;
    });
  };

  const getAccountName = (id) => accounts.find(a => String(a.ACCNT_ID) === String(id))?.ALIAS_NAME || 'Unknown Account';
  const getBillTypeName = (id) => billTypes.find(t => String(t.id) === String(id))?.Name || 'Unknown Type';
  const getOtBillTypeName = (id) => otBillTypes.find(t => String(t.id) === String(id))?.Name || 'Unknown Type';
  const getPayTermName = (id) => payTerms.find(t => String(t.id) === String(id))?.Name || 'Unknown Term';
  const getIndustryName = (id) => industries.find(i => String(i.id) === String(id))?.Name || 'Unknown Industry';

  // Add Form States and Logic
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
    suborgname: '',
    industries: ''
  });

  const [addform_accounts, addform_setAccounts] = useState([]);
  const [addform_filteredClients, addform_setFilteredClients] = useState([]);
  const [state, formAction, isPending] = useActionState(addProject, addform_intialstate);

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
          
          // Filter clients based on the selected account's ourorg value (including the same account)
          const accountOurorg = selectedAccount.ourorg;
          const filteredClients = addform_accounts.filter(acc => acc.ourorg === accountOurorg);
          addform_setFilteredClients(filteredClients);
          
          // Reset clientId if it doesn't match the filter
          if (prev.clientId) {
            const clientStillValid = filteredClients.some(acc => acc.ACCNT_ID === prev.clientId);
            if (!clientStillValid) {
              newData.clientId = '';
            }
          }
          
          console.log('Add form updated suborg and filtered clients:', { 
            suborgid: newData.suborgid, 
            suborgname: newData.suborgname, 
            accountOurorg,
            filteredClientsCount: filteredClients.length 
          });
        } else {
          newData.suborgid = '';
          newData.suborgname = '';
          newData.clientId = '';
          addform_setFilteredClients([]);
          console.log('Add form no account found, resetting suborg and clients');
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
        suborgname: '',
        industries: ''
      });
      addform_setFilteredClients([]);
      setaddformsuccess('Project added successfully!');
      setTimeout(() => {
        setaddformsuccess(null);
        setisadd(false);
        router.refresh();
      }, 2000);
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
          {isPending && <div className="project_loading_message">Adding project, please wait...</div>}
          {addformsuccess && <div className="project_success_message">{addformsuccess}</div>}
          {state.error && <div className="project_error_message">{state.error}</div>}
          <form action={addform_enhancedFormAction} onSubmit={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="project_details_block">
              <h3>Basic Details</h3>
              <div className="project_form_grid">
                <div className="project_form_group">
                  <label>Project Name*</label>
                  <input
                    type="text"
                    name="prjName"
                    value={addformData.prjName}
                    onChange={addform_handleChange}
                    required
                  />
                </div>
                <div className="project_form_group">
                  <label>Industry</label>
                  <select
                    name="industries"
                    value={addformData.industries}
                    onChange={addform_handleChange}
                  >
                    <option value="">Select Industry</option>
                    {industries.map((industry) => (
                      <option key={industry.id} value={industry.id}>
                        {industry.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="project_form_group">
                  <label>Account*</label>
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
                  <label>Organization</label>
                  <input
                    type="text"
                    value={addformData.suborgname || ''}
                    disabled
                  />
                </div>
                <div className="project_form_group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    name="startDt"
                    value={addformData.startDt}
                    onChange={addform_handleChange}
                    placeholder="mm/dd/yyyy"
                  />
                </div>
                <div className="project_form_group">
                  <label>End Date</label>
                  <input
                    type="date"
                    name="endDt"
                    value={addformData.endDt}
                    onChange={addform_handleChange}
                    placeholder="mm/dd/yyyy"
                  />
                </div>
                <div className="project_form_group">
                  <label>Description</label>
                  <input
                    type="text"
                    name="prsDesc"
                    value={addformData.prsDesc}
                    onChange={addform_handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="project_details_block">
              <h3>Additional Details</h3>
              <div className="project_form_grid">
                <div className="project_form_group">
                  <label>Bill Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    name="billRate"
                    value={addformData.billRate}
                    onChange={addform_handleChange}
                  />
                </div>
                <div className="project_form_group">
                  <label>Bill Type</label>
                  <select
                    name="billType"
                    value={addformData.billType}
                    onChange={addform_handleChange}
                  >
                    <option value="">Select Type</option>
                    {billTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="project_form_group">
                  <label>OT Bill Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    name="otBillRate"
                    value={addformData.otBillRate}
                    onChange={addform_handleChange}
                  />
                </div>
                <div className="project_form_group">
                  <label>OT Bill Type</label>
                  <select
                    name="otBillType"
                    value={addformData.otBillType}
                    onChange={addform_handleChange}
                  >
                    <option value="">Select Type</option>
                    {otBillTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="project_form_group">
                  <label>Billable</label>
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
                  <label>Client*</label>
                  <select
                    name="clientId"
                    value={addformData.clientId}
                    onChange={addform_handleChange}
                    required
                    disabled={!addformData.accntId || addform_filteredClients.length === 0}
                  >
                    <option value="">
                      {!addformData.accntId 
                        ? 'Select Account First' 
                        : addform_filteredClients.length === 0 
                          ? 'No Matching Clients Available'
                          : 'Select Client'}
                    </option>
                    {addform_filteredClients.map((account) => (
                      <option key={account.ACCNT_ID} value={account.ACCNT_ID}>
                        {account.ALIAS_NAME}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="project_form_group">
                  <label>Payment Term</label>
                  <select
                    name="payTerm"
                    value={addformData.payTerm}
                    onChange={addform_handleChange}
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
                  <label>Invoice Email</label>
                  <input
                    type="email"
                    name="invoiceEmail"
                    value={addformData.invoiceEmail}
                    onChange={addform_handleChange}
                  />
                </div>
                <div className="project_form_group">
                  <label>Invoice Fax</label>
                  <input
                    type="text"
                    name="invoiceFax"
                    value={addformData.invoiceFax}
                    onChange={addform_handleChange}
                  />
                </div>
                <div className="project_form_group">
                  <label>Invoice Phone</label>
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
              <button type="submit" className="project_submit_button" disabled={isPending}>
                {isPending ? 'Adding...' : 'Add Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isadd && !selectedProject ? (
        <div className="project_list">
          <div className="project_header_section">
            <h1 className="project_title">Existing Projects</h1>
            <button onClick={handleaddproject} className="project_submit_button">Add Project</button>
          </div>
          <div className="project_search_filter_container">
            <input type="text" value={searchQuery} onChange={handleSearchChange} className="project_search_input" placeholder="Search by name..." />
            <select value={accountFilter} onChange={handleAccountFilterChange} className="project_filter_select">
              <option value="all">All Accounts</option>
              {accounts.map(a => <option key={a.ACCNT_ID} value={a.ACCNT_ID}>{a.ALIAS_NAME}</option>)}
            </select>
            <select value={industryFilter} onChange={handleIndustryFilterChange} className="project_filter_select">
              <option value="all">All Industries</option>
              {industries.map(i => <option key={i.id} value={i.id}>{i.Name}</option>)}
            </select>
          </div>

          <div className="project_table_wrapper">
            <table className="project_table">
              <thead>
                <tr>
                  <th className="project_sortable" onClick={() => requestSort('prjId')}>Project ID</th>
                  <th className="project_sortable" onClick={() => requestSort('prjName')}>Project Name</th>
                  <th className="project_sortable" onClick={() => requestSort('accntId')}>Account</th>
                  <th>Industry</th>
                  <th>Start Date</th>
                </tr>
              </thead>
              <tbody>
                {currentProjects.length > 0 ? currentProjects.map((project) => (
                  <tr key={project.PRJ_ID} onClick={() => handleRowClick(project)} className="project_clickable_row">
                    <td>{project.PRJ_ID}</td>
                    <td>{project.PRJ_NAME}</td>
                    <td>{getAccountName(project.ACCNT_ID)}</td>
                    <td>{getIndustryName(project.Industries)}</td>
                    <td>{project.START_DT ? formatDate(project.START_DT) : '-'}</td>
                  </tr>
                )) : <tr><td colSpan="5" style={{textAlign: 'center'}}>No projects found.</td></tr>}
              </tbody>
            </table>
          </div>
          {filteredProjects.length > projectsPerPage && (
            <div className="project_pagination_container">
              <button className="project_button" onClick={handlePrevPage} disabled={currentPage === 1}>← Previous</button>
              <span className="project_pagination_text">Page {currentPage} of {totalPages}</span>
              <button className="project_button" onClick={handleNextPage} disabled={currentPage === totalPages}>Next →</button>
            </div>
          )}
        </div>
      ) : !isadd && selectedProject && (
        <div className="project_details_container">
          <div className="project_header_section">
            <h1 className="project_title">Project Details</h1>
            <button className="project_back_button" onClick={handleBack}></button>
          </div>

          <div className="project_submenu_bar">
            <button className={activetab === 'basic' ? 'project_active' : ''} onClick={() => handletabClick('basic')}>Basic Details</button>
            <button className={activetab === 'additional' ? 'project_active' : ''} onClick={() => handletabClick('additional')}>Additional Details</button>
          </div>

          <div className="project_details_content">
            {basicdetailsdisplay && (
              <div className="project_details_block">
                <h3>Basic Details</h3>
                {editingBasic && canEditProjects ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave('basic'); }}>
                    <div className="project_form_grid">
                      <div className="project_form_group"><label>Project Name*</label><input type="text" name="prjName" value={formData.prjName} onChange={handleFormChange} required /></div>
                      <div className="project_form_group"><label>Industry</label><select name="industries" value={formData.industries} onChange={handleFormChange}><option value="">Select Industry</option>{industries.map(i => <option key={i.id} value={i.id}>{i.Name}</option>)}</select></div>
                      <div className="project_form_group"><label>Account*</label><select name="accntId" value={formData.accntId} onChange={handleFormChange} required><option value="">Select Account</option>{accounts.map(a => <option key={a.ACCNT_ID} value={a.ACCNT_ID}>{a.ALIAS_NAME}</option>)}</select></div>
                      <div className="project_form_group"><label>Organization</label><input type="text" value={formData.suborgname || ''} disabled /></div>
                      <div className="project_form_group"><label>Start Date</label><input type="date" name="startDt" value={formData.startDt} onChange={handleFormChange} /></div>
                      <div className="project_form_group"><label>End Date</label><input type="date" name="endDt" value={formData.endDt} onChange={handleFormChange} /></div>
                      <div className="project_form_group"><label>Description</label><input type="text" name="prsDesc" value={formData.prsDesc} onChange={handleFormChange} /></div>
                    </div>
                    <div className="project_form_buttons">
                      <button type="submit" className="project_submit_button" disabled={isLoading}>Save</button>
                      <button type="button" className="project_cancel_button" onClick={handleCancelBasic}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                  <div className="project_view_grid">
                    <div className="project_view_group"><label>Project ID</label><p>{formData.prjId}</p></div>
                    <div className="project_view_group"><label>Project Name</label><p>{formData.prjName}</p></div>
                    <div className="project_view_group"><label>Industry</label><p>{getIndustryName(formData.industries)}</p></div>
                    <div className="project_view_group"><label>Account</label><p>{getAccountName(formData.accntId)}</p></div>
                    <div className="project_view_group"><label>Organization</label><p>{formData.suborgname || '-'}</p></div>
                    <div className="project_view_group"><label>Start Date</label><p>{formData.startDt || '-'}</p></div>
                    <div className="project_view_group"><label>End Date</label><p>{formData.endDt || '-'}</p></div>
                    <div className="project_view_group"><label>Description</label><p>{formData.prsDesc || '-'}</p></div>
                    <div className="project_view_group"><label>Updated By</label><p>{formData.updatedBy || '-'}</p></div>
                  </div>
                  {canEditProjects && <div className="project_form_buttons"><button className="project_edit_button" onClick={() => handleEdit('basic')}>Edit</button></div>}
                  </>
                )}
              </div>
            )}
            
            {additionaldetailsdisplay && (
              <div className="project_details_block">
                <h3>Additional Details</h3>
                {editingAdditional && canEditProjects ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave('additional'); }}>
                    <div className="project_form_grid">
                      <div className="project_form_group"><label>Bill Rate</label><input type="number" step="0.01" name="billRate" value={formData.billRate} onChange={handleFormChange} /></div>
                      <div className="project_form_group"><label>Bill Type</label><select name="billType" value={formData.billType} onChange={handleFormChange}><option value="">Select Type</option>{billTypes.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}</select></div>
                      <div className="project_form_group"><label>OT Bill Rate</label><input type="number" step="0.01" name="otBillRate" value={formData.otBillRate} onChange={handleFormChange} /></div>
                      <div className="project_form_group"><label>OT Bill Type</label><select name="otBillType" value={formData.otBillType} onChange={handleFormChange}><option value="">Select Type</option>{otBillTypes.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}</select></div>
                      <div className="project_form_group"><label>Billable</label><select name="billableFlag" value={formData.billableFlag} onChange={handleFormChange}><option value="0">No</option><option value="1">Yes</option></select></div>
                      <div className="project_form_group"><label>Client*</label><select name="clientId" value={formData.clientId} onChange={handleFormChange} required><option value="">Select Client</option>{accounts.map(a => <option key={a.ACCNT_ID} value={a.ACCNT_ID}>{a.ALIAS_NAME}</option>)}</select></div>
                      <div className="project_form_group"><label>Payment Term</label><select name="payTerm" value={formData.payTerm} onChange={handleFormChange}><option value="">Select Term</option>{payTerms.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}</select></div>
                      <div className="project_form_group"><label>Invoice Email</label><input type="email" name="invoiceEmail" value={formData.invoiceEmail} onChange={handleFormChange} /></div>
                      <div className="project_form_group"><label>Invoice Fax</label><input type="text" name="invoiceFax" value={formData.invoiceFax} onChange={handleFormChange} /></div>
                      <div className="project_form_group"><label>Invoice Phone</label><input type="text" name="invoicePhone" value={formData.invoicePhone} onChange={handleFormChange} /></div>
                    </div>
                    <div className="project_form_buttons">
                      <button type="submit" className="project_submit_button" disabled={isLoading}>Save</button>
                      <button type="button" className="project_cancel_button" onClick={handleCancelAdditional}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                  <div className="project_view_grid">
                    <div className="project_view_group"><label>Bill Rate</label><p>{formData.billRate || '-'}</p></div>
                    <div className="project_view_group"><label>Bill Type</label><p>{getBillTypeName(formData.billType)}</p></div>
                    <div className="project_view_group"><label>OT Bill Rate</label><p>{formData.otBillRate || '-'}</p></div>
                    <div className="project_view_group"><label>OT Bill Type</label><p>{getOtBillTypeName(formData.otBillType)}</p></div>
                    <div className="project_view_group"><label>Billable</label><p>{formData.billableFlag === '1' ? 'Yes' : 'No'}</p></div>
                    <div className="project_view_group"><label>Client</label><p>{getAccountName(formData.clientId)}</p></div>
                    <div className="project_view_group"><label>Payment Term</label><p>{getPayTermName(formData.payTerm)}</p></div>
                    <div className="project_view_group"><label>Invoice Email</label><p>{formData.invoiceEmail || '-'}</p></div>
                    <div className="project_view_group"><label>Invoice Fax</label><p>{formData.invoiceFax || '-'}</p></div>
                    <div className="project_view_group"><label>Invoice Phone</label><p>{formData.invoicePhone || '-'}</p></div>
                  </div>
                  {canEditProjects && <div className="project_form_buttons"><button className="project_edit_button" onClick={() => handleEdit('additional')}>Edit</button></div>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Overview;
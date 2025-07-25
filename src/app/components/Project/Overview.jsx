'use client';

import React, { useState, useEffect } from 'react';
import { updateproject, fetchProjectById } from '@/app/serverActions/Projects/overview';
import { useActionState } from 'react';
import { addProject, fetchAccountsByOrgId } from '@/app/serverActions/Projects/AddprojectAction';
import './projectoverview.css';
import { useRouter, useSearchParams } from 'next/navigation';

const addform_intialstate = { error: null, success: false };

const Overview = ({ orgId, projects, billTypes, otBillTypes, payTerms, accounts }) => {
  const searchparams = useSearchParams();
  const [selectedProject, setSelectedProject] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [canEditProjects, setCanEditProjects] = useState(true); // Default to true for all authenticated users
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingAdditional, setEditingAdditional] = useState(false);
  const [isadd, setisadd] = useState(false);
  const [addformsuccess, setaddformsuccess] = useState(null);
  const router = useRouter();
  // State for sorted projects
  const [allProjects, setAllProjects] = useState(projects);
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
    setAllProjects(projects); // Initialize with projects prop
  }, [projects]);

  useEffect(() => {
    const sortedProjects = [...projects].sort((a, b) => sortProjects(a, b, sortConfig.column, sortConfig.direction));
    setAllProjects(sortedProjects);
  }, [sortConfig, projects]);

  const handleRowClick = (project) => {
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
    });
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setIsLoading(false);
    setisadd(false);
  };

  const handleBack = () => {
    router.refresh();
    setSelectedProject(null);
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setIsLoading(false);
    setisadd(false);
  };

  const handleaddproject = () => {
    setSelectedProject(null);
    setEditingBasic(false);
    setEditingAdditional(false);
    setError(null);
    setIsLoading(false);
    setisadd(true);
  };

  const handleEdit = (section) => {
    if (section === 'basic') setEditingBasic(true);
    if (section === 'additional') setEditingAdditional(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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
      console.log('FormData to submit:', Object.fromEntries(formDataToSubmit));
      const result = await updateproject(formDataToSubmit);
      if (result && result.success) {
        const updatedProject = await fetchProjectById(formData.prjId);
        setSelectedProject(updatedProject);
        // Update projects array to reflect changes in table
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
    const option = options.find(opt => opt.Name === value);
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
      case ' acclId':
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

  // Add Project Logic
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
  });

  const [addform_accounts, addform_setAccounts] = useState([]);
  const [state, formAction] = useActionState(addProject, addform_intialstate);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (orgId) {
          const accountsData = await fetchAccountsByOrgId(parseInt(orgId, 10));
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
    const { name, value, type, checked } = e.target;
    setaddFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const addform_enhancedFormAction = async (formData) => {
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
      });
      setaddformsuccess('Project added successfully!');
      setTimeout(() => setaddformsuccess(null), 4000); // Clear success message after 2 seconds
    }
  }, [state.success, orgId]);

  return (
    <div className="project-overview-container">
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading-message">Saving...</div>}
    
      {isadd && (
        <div className="project-overview-container">
          <h2>Add Project</h2>
          <button className="back-button" onClick={handleBack}>x</button>
          {addformsuccess && <div className="success-message">{addformsuccess}</div>}
          {state.error && <div className="error-message">{state.error}</div>}
          <form action={addform_enhancedFormAction} className="project-details-container">
            {/* Basic Details Block */}
            <div className="details-block">
              <h3>Basic Details</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Project Name*:</label>
                  <input
                    type="text"
                    name="prjName"
                    value={addformData.prjName}
                    onChange={addform_handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Description:</label>
                  <input
                    type="text"
                    name="prsDesc"
                    value={addformData.prsDesc}
                    onChange={addform_handleChange}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
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
                <div className="form-group">
                  <label>Organization*:</label>
                  <input
                    type="number"
                    name="orgId"
                    value={orgId || ''}
                    readOnly
                    className="bg-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* Additional Details Block */}
            <div className="details-block">
              <h3>Additional Details</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Bill Rate:</label>
                  <input
                    type="number"
                    step="0.01"
                    name="billRate"
                    value={addformData.billRate}
                    onChange={addform_handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Bill Type:</label>
                  <select
                    name="billType"
                    value={addformData.billType}
                    onChange={addform_handleChange}
                  >
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
                    onChange={addform_handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>OT Bill Type:</label>
                  <select
                    name="otBillType"
                    value={addformData.otBillType}
                    onChange={addform_handleChange}
                  >
                    <option value="">Select Type</option>
                    {otBillTypes.map((type) => (
                      <option key={type.id} value={type.Name}>
                        {type.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
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
                <div className="form-group">
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
              <div className="form-row">
                <div className="form-group">
                  <label>End Date:</label>
                  <input
                    type="date"
                    name="endDt"
                    value={addformData.endDt}
                    onChange={addform_handleChange}
                    placeholder="mm/dd/yyyy"
                  />
                </div>
                <div className="form-group">
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
              <div className="form-row">
                <div className="form-group">
                  <label>Payment Term:</label>
                  <select
                    name="payTerm"
                    value={addformData.payTerm}
                    onChange={addform_handleChange}
                  >
                    <option value="">Select Term</option>
                    {payTerms.map((term) => (
                      <option key={term.id} value={term.Name}>
                        {term.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Invoice Email:</label>
                  <input
                    type="email"
                    name="invoiceEmail"
                    value={addformData.invoiceEmail}
                    onChange={addform_handleChange}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Invoice Fax:</label>
                  <input
                    type="text"
                    name="invoiceFax"
                    value={addformData.invoiceFax}
                    onChange={addform_handleChange}
                  />
                </div>
                <div className="form-group">
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

            <div className="form-buttons">
              <button type="submit" className="submit-button" disabled={!orgId}>
                Add Project
              </button>
            </div>
          </form>
        </div>
      )}

      {!isadd && !selectedProject ? (
        <div>
          <button onClick={() => handleaddproject()} className='submit-button'>Add Project</button>
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
                  <th>
                    Description 
                  </th>
                  <th onClick={() => requestSort('accntId')}>
                    Account 
                  </th>
                </tr>
              </thead>
              <tbody>
                {allProjects.map((project) => (
                  <tr key={project.PRJ_ID} onClick={() => handleRowClick(project)} className="clickable-row">
                    <td>Project-{getdisplayprojectid(project.PRJ_ID)}</td>
                    <td>{project.PRJ_NAME || '-'}</td>
                    <td>{project.PRS_DESC || '-'}</td>
                    <td>{getAccountName(project.ACCNT_ID)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : !isadd && (
        <div className="project-details-container">
          <button className="back-button" onClick={handleBack}>x</button>

          {/* Basic Details Block */}
          <div className="details-block">
            <h3>Basic Details</h3>
            {editingBasic && canEditProjects ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave('basic'); }} className="project-form">
                <div className="form-row">
                  <div className="form-group">
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
                <div className="form-row">
                  <div className="form-group">
                    <label>Description:</label>
                    <input
                      type="text"
                      name="prsDesc"
                      value={formData.prsDesc}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
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
                <div className="form-buttons">
                  <button type="submit" className="submit-button" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="cancel-button" onClick={() => setEditingBasic(false)} disabled={isLoading}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="view-details">
                <div className="details-row">
                  <div className="details-group">
                    <label>Project ID:</label>
                    <p>Project-{getdisplayprojectid(selectedProject.PRJ_ID)}</p>
                  </div>
                  <div className="details-group">
                    <label>Project Name:</label>
                    <p>{selectedProject.PRJ_NAME || '-'}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Description:</label>
                    <p>{selectedProject.PRS_DESC || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>Account:</label>
                    <p>{getAccountName(selectedProject.ACCNT_ID)}</p>
                  </div>
                </div>
                {canEditProjects && (
                  <div className="details-buttons">
                    <button className="edit-button" onClick={() => handleEdit('basic')}>Edit</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Additional Details Block */}
          <div className="details-block">
            <h3>Additional Details</h3>
            {editingAdditional && canEditProjects ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave('additional'); }} className="project-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Bill Rate:</label>
                    <input
                      type="number"
                      step="0.01"
                      name="billRate"
                      value={formData.billRate}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Bill Type:</label>
                    <select
                      name="billType"
                      value={formData.billType}
                      onChange={handleChange}
                    >
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
                    <select
                      name="otBillType"
                      value={formData.otBillType}
                      onChange={handleChange}
                    >
                      <option value="">Select Type</option>
                      {otBillTypes.map((type) => (
                        <option key={type.id} value={type.Name}>
                          {type.Name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
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
                  <div className="form-group">
                    <label>Start Date:</label>
                    <input
                      type="date"
                      name="startDt"
                      value={formData.startDt}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>End Date:</label>
                    <input
                      type="date"
                      name="endDt"
                      value={formData.endDt}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
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
                <div className="form-row">
                  <div className="form-group">
                    <label>Payment Term:</label>
                    <select
                      name="payTerm"
                      value={formData.payTerm}
                      onChange={handleChange}
                    >
                      <option value="">Select Term</option>
                      {payTerms.map((term) => (
                        <option key={term.id} value={term.Name}>
                          {term.Name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Invoice Email:</label>
                    <input
                      type="email"
                      name="invoiceEmail"
                      value={formData.invoiceEmail}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Invoice Fax:</label>
                    <input
                      type="text"
                      name="invoiceFax"
                      value={formData.invoiceFax}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Invoice Phone:</label>
                    <input
                      type="text"
                      name="invoicePhone"
                      value={formData.invoicePhone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="form-buttons">
                  <button type="submit" className="submit-button" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="cancel-button" onClick={() => setEditingAdditional(false)} disabled={isLoading}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="view-details">
                <div className="details-row">
                  <div className="details-group">
                    <label>Bill Rate:</label>
                    <p>{selectedProject.BILL_RATE || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>Bill Type:</label>
                    <p>{getDisplayValue(selectedProject.BILL_TYPE, billTypes)}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>OT Bill Rate:</label>
                    <p>{selectedProject.OT_BILL_RATE || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>OT Bill Type:</label>
                    <p>{getDisplayValue(selectedProject.OT_BILL_TYPE, otBillTypes)}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Billable:</label>
                    <p>{selectedProject.BILLABLE_FLAG ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="details-group">
                    <label>Start Date:</label>
                    <p>{formatDate(selectedProject.START_DT) || '-'}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>End Date:</label>
                    <p>{formatDate(selectedProject.END_DT) || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>Client:</label>
                    <p>{getAccountName(selectedProject.CLIENT_ID)}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Payment Term:</label>
                    <p>{getDisplayValue(selectedProject.PAY_TERM, payTerms)}</p>
                  </div>
                  <div className="details-group">
                    <label>Invoice Email:</label>
                    <p>{selectedProject.INVOICE_EMAIL || '-'}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Invoice Fax:</label>
                    <p>{selectedProject.INVOICE_FAX || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>Invoice Phone:</label>
                    <p>{selectedProject.INVOICE_PHONE || '-'}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Created By:</label>
                    <p>{selectedProject.Createdby || '-'}</p>
                  </div>
                  <div className="details-group">
                    <label>Updated By:</label>
                    <p>{selectedProject.Updatedby || '-'}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Last Updated Date:</label>
                    <p>{formatDate(selectedProject.last_updated_date) || '-'}</p>
                  </div>
                </div>
                {canEditProjects && (
                  <div className="details-buttons">
                    <button className="edit-button" onClick={() => handleEdit('additional')}>Edit</button>
                  </div>
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
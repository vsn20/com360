'use client';

import React, { useState, useEffect } from 'react';
import { updateLead, fetchLeadById } from '@/app/serverActions/leads/overview';
import { addLead, fetchAccountsByOrgId } from '@/app/serverActions/leads/AddLeadAction';
import './leadoverview.css'; 
import { useActionState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const addform_intialstate = { error: null, success: false };

// UPDATED: Added billTypes and otBillTypes to props
const Overview = ({ orgId, leads, billTypes, otBillTypes, payTerms, accounts, industries }) => {
  const searchparams = useSearchParams();
  const router = useRouter();
  
  const [selectedLead, setSelectedLead] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [canEditLeads, setCanEditLeads] = useState(true);
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingAdditional, setEditingAdditional] = useState(false);
  const [isadd, setisadd] = useState(false);
  const [addformsuccess, setaddformsuccess] = useState(null);
  const [allLeads, setAllLeads] = useState(leads);
  
  const [sortConfig, setSortConfig] = useState({ column: 'leadId', direction: 'asc' });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [leadsPerPage, setLeadsPerPage] = useState(10); 
  const [leadsPerPageInput, setLeadsPerPageInput] = useState('10'); 
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
    setAllLeads(leads);
  }, [leads]);

  useEffect(() => {
    const sortedLeads = [...leads].sort((a, b) => sortLeads(a, b, sortConfig.column, sortConfig.direction));
    setAllLeads(sortedLeads);
  }, [sortConfig, leads]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const sortLeads = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'leadId':
        aValue = parseInt(a.LEAD_ID.split('-')[1] || a.LEAD_ID);
        bValue = parseInt(b.LEAD_ID.split('-')[1] || b.LEAD_ID);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'leadName':
        aValue = (a.LEAD_NAME || '').toLowerCase();
        bValue = (b.LEAD_NAME || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'leadDesc':
        aValue = (a.LEAD_DESC || '').toLowerCase();
        bValue = (b.LEAD_DESC || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'accntId':
        aValue = getAccountName(a.ACCNT_ID).toLowerCase();
        bValue = getAccountName(b.ACCNT_ID).toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'cost':
        aValue = parseFloat(a.COST || 0);
        bValue = parseFloat(b.COST || 0);
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

  const handleRowClick = (lead) => {
    setSelectedLead(lead.LEAD_ID);
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
    setSelectedLead(null);
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

  const handleAddLead = () => {
    setSelectedLead(null);
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
  
  const handleSearchChange = (e) => { setSearchQuery(e.target.value); setCurrentPage(1); };
  const handleAccountFilterChange = (e) => { setAccountFilter(e.target.value); setCurrentPage(1); };
  const handleIndustryFilterChange = (e) => { setIndustryFilter(e.target.value); setCurrentPage(1); };

  const filteredLeads = allLeads.filter((lead) => {
    const matchesSearch = lead.LEAD_NAME?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAccount = accountFilter === 'all' || String(lead.ACCNT_ID) === accountFilter;
    const matchesIndustry = industryFilter === 'all' || String(lead.Industries) === industryFilter;
    return matchesSearch && matchesAccount && matchesIndustry;
  });

  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
  const currentLeads = filteredLeads.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

  // Load Lead Details (View/Edit)
  useEffect(() => {
    const loadLeadDetails = async () => {
      if (!selectedLead) return;
      try {
        setIsLoading(true);
        const lead = await fetchLeadById(selectedLead);
        setFormData({
          leadId: lead.LEAD_ID || '',
          leadName: lead.LEAD_NAME || '',
          leadDesc: lead.LEAD_DESC || '',
          accntId: lead.ACCNT_ID || '',
          orgId: lead.ORG_ID || orgId || '',
          cost: lead.COST || '', 
          otCost: lead.OT_COST || '', 
          // UPDATED: Map new fields
          billType: lead.BILL_TYPE || '',
          otBillType: lead.OT_BILL_TYPE || '',
          billableFlag: lead.BILLABLE_FLAG ? 'Yes' : 'No', // Mapping to Yes/No for select
          
          startDt: lead.START_DT ? formatDate(lead.START_DT) : '',
          endDt: lead.END_DT ? formatDate(lead.END_DT) : '',
          clientId: lead.CLIENT_ID || '',
          payTerm: lead.PAY_TERM || '',
          createdBy: lead.CREATED_BY || '',
          updatedBy: lead.LAST_UPDATED_BY || '',
          lastUpdatedDate: lead.last_updated_date ? formatDate(lead.last_updated_date) : '',
          suborgid: lead.suborgid || '',
          suborgname: lead.suborgname || '',
          industries: lead.Industries || ''
        });
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadLeadDetails();
  }, [selectedLead, orgId]);

  const handleCancelBasic = () => {
    setEditingBasic(false);
    if (selectedLead) {
      const lead = leads.find(p => p.LEAD_ID === selectedLead);
      if (lead) {
        setFormData(prev => ({
          ...prev,
          leadName: lead.LEAD_NAME || '',
          leadDesc: lead.LEAD_DESC || '',
          accntId: lead.ACCNT_ID || '',
          clientId: lead.CLIENT_ID || '',
          startDt: lead.START_DT ? formatDate(lead.START_DT) : '',
          endDt: lead.END_DT ? formatDate(lead.END_DT) : '',
          suborgid: lead.suborgid || '',
          suborgname: lead.suborgname || '',
          industries: lead.Industries || ''
        }));
      }
    }
  };

  const handleCancelAdditional = () => {
    setEditingAdditional(false);
    if (selectedLead) {
      const lead = leads.find(p => p.LEAD_ID === selectedLead);
      if (lead) {
        setFormData(prev => ({
          ...prev,
          cost: lead.COST || '',
          otCost: lead.OT_COST || '',
          payTerm: lead.PAY_TERM || '',
          // UPDATED: Reset new fields
          billType: lead.BILL_TYPE || '',
          otBillType: lead.OT_BILL_TYPE || '',
          billableFlag: lead.BILLABLE_FLAG ? 'Yes' : 'No'
        }));
      }
    }
  };

  const handleSave = async (section) => {
    if (!formData.orgId) { setError('Organization ID missing.'); return; }
    setIsLoading(true);

    const formDataToSubmit = new FormData();
    formDataToSubmit.append('LEAD_ID', formData.leadId);
    formDataToSubmit.append('section', section);

    if (section === 'basic') {
      formDataToSubmit.append('LEAD_NAME', formData.leadName);
      formDataToSubmit.append('LEAD_DESC', formData.leadDesc || '');
      formDataToSubmit.append('ACCNT_ID', formData.accntId);
      formDataToSubmit.append('CLIENT_ID', formData.clientId || '');
      formDataToSubmit.append('START_DT', formData.startDt || '');
      formDataToSubmit.append('END_DT', formData.endDt || '');
      formDataToSubmit.append('suborgid', formData.suborgid || '');
      formDataToSubmit.append('Industries', formData.industries || '');
    } else if (section === 'additional') {
      formDataToSubmit.append('COST', formData.cost || '');
      formDataToSubmit.append('OT_COST', formData.otCost || '');
      formDataToSubmit.append('PAY_TERM', formData.payTerm || '');
      // UPDATED: Append new fields
      formDataToSubmit.append('BILL_TYPE', formData.billType || '');
      formDataToSubmit.append('OT_BILL_TYPE', formData.otBillType || '');
      formDataToSubmit.append('BILLABLE_FLAG', formData.billableFlag === 'Yes' ? '1' : '0');
    }

    try {
      const result = await updateLead(formDataToSubmit);
      if (result && result.success) {
        const updatedLead = await fetchLeadById(formData.leadId);
        setFormData(prev => ({
          ...prev,
          ...updatedLead,
          leadId: updatedLead.LEAD_ID,
          leadName: updatedLead.LEAD_NAME,
          leadDesc: updatedLead.LEAD_DESC,
          accntId: updatedLead.ACCNT_ID,
          orgId: updatedLead.ORG_ID,
          cost: updatedLead.COST,
          otCost: updatedLead.OT_COST,
          startDt: updatedLead.START_DT ? formatDate(updatedLead.START_DT) : '',
          endDt: updatedLead.END_DT ? formatDate(updatedLead.END_DT) : '',
          clientId: updatedLead.CLIENT_ID,
          payTerm: updatedLead.PAY_TERM,
          suborgid: updatedLead.suborgid,
          suborgname: updatedLead.suborgname,
          industries: updatedLead.Industries,
          // UPDATED: Update state with response
          billType: updatedLead.BILL_TYPE,
          otBillType: updatedLead.OT_BILL_TYPE,
          billableFlag: updatedLead.BILLABLE_FLAG ? 'Yes' : 'No',
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
  const getPayTermName = (id) => payTerms.find(t => String(t.id) === String(id))?.Name || 'Unknown Term';
  const getIndustryName = (id) => industries.find(i => String(i.id) === String(id))?.Name || 'Unknown Industry';
  // UPDATED: Helper functions for view mode
  const getBillTypeName = (id) => billTypes?.find(t => String(t.id) === String(id))?.Name || 'Unknown Type';
  const getOtBillTypeName = (id) => otBillTypes?.find(t => String(t.id) === String(id))?.Name || 'Unknown Type';

  // --- Add Lead Form States and Logic ---
  const [addFormData, setaddFormData] = useState({
    leadName: '',
    leadDesc: '',
    accntId: '',
    orgId: orgId || '',
    cost: '',
    otCost: '',
    startDt: '',
    endDt: '',
    clientId: '',
    payTerm: '',
    suborgid: '',
    suborgname: '',
    industries: '',
    // UPDATED: Initial state for new fields
    billType: '',
    otBillType: '',
    billableFlag: 'No'
  });

  const [addform_accounts, addform_setAccounts] = useState([]);
  const [state, formAction, isPending] = useActionState(addLead, addform_intialstate);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (orgId) {
          const accountsData = await fetchAccountsByOrgId(parseInt(orgId, 10));
          addform_setAccounts(accountsData);
        } else {
          addform_setAccounts([]);
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
        if (selectedAccount) {
          newData.suborgid = selectedAccount.suborgid || '';
          newData.suborgname = selectedAccount.suborgname || '';
        } else {
          newData.suborgid = '';
          newData.suborgname = '';
          newData.clientId = '';
        }
      }
      return newData;
    });
  };

  const addform_enhancedFormAction = async (formData) => {
    formData.append('payTerms', JSON.stringify(payTerms));
    // UPDATED: Pass bill types in case action needs them for validation
    formData.append('billTypes', JSON.stringify(billTypes));
    formData.append('otBillTypes', JSON.stringify(otBillTypes));
    return formAction(formData);
  };

  useEffect(() => {
    if (state.success) {
      setaddFormData({
        leadName: '',
        leadDesc: '',
        accntId: '',
        orgId: orgId || '',
        cost: '',
        otCost: '',
        startDt: '',
        endDt: '',
        clientId: '',
        payTerm: '',
        suborgid: '',
        suborgname: '',
        industries: '',
        billType: '',
        otBillType: '',
        billableFlag: 'No'
      });
      setaddformsuccess('Lead added successfully!');
      setTimeout(() => {
        setaddformsuccess(null);
        setisadd(false);
        router.refresh();
      }, 2000);
    }
  }, [state.success, orgId]);

  return (
    <div className="lead_overview_container">
      {error && <div className="lead_error_message">{error}</div>}
      {isLoading && <div className="lead_loading_message">Saving...</div>}
    
      {/* ADD LEAD VIEW */}
      {isadd && (
        <div className="lead_add_container">
          <div className="lead_header_section">
            <h2 className="lead_title">Add Lead</h2>
            <button className="lead_back_button" onClick={handleBack}></button>
          </div>
          {isPending && <div className="lead_loading_message">Adding lead, please wait...</div>}
          {addformsuccess && <div className="lead_success_message">{addformsuccess}</div>}
          {state.error && <div className="lead_error_message">{state.error}</div>}
          
          <form action={addform_enhancedFormAction} onSubmit={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="lead_details_block">
              <div className="lead_form_grid">
                
                <div className="lead_form_group">
                  <label>Lead Name *</label>
                  <input type="text" name="leadName" value={addFormData.leadName} onChange={addform_handleChange} required />
                </div>
                
                <div className="lead_form_group">
                  <label>Description</label>
                  <textarea name="leadDesc" value={addFormData.leadDesc} onChange={addform_handleChange} className="lead_textarea"></textarea>
                </div>
                
                <div className="lead_form_group">
                  <label>Account *</label>
                  <select name="accntId" value={addFormData.accntId} onChange={addform_handleChange} required disabled={!orgId}>
                    <option value="">Select Account</option>
                    {addform_accounts.map((account) => (
                      <option key={account.ACCNT_ID} value={account.ACCNT_ID}>{account.ALIAS_NAME}</option>
                    ))}
                  </select>
                </div>
                
                <div className="lead_form_group">
                  <label>Client *</label>
                  <select name="clientId" value={addFormData.clientId} onChange={addform_handleChange} required disabled={!addFormData.accntId}>
                    <option value="">{!addFormData.accntId ? 'Select Account First' : 'Select Client'}</option>
                    {addform_accounts.map((account) => (
                      <option key={account.ACCNT_ID} value={account.ACCNT_ID}>{account.ALIAS_NAME}</option>
                    ))}
                  </select>
                </div>
                
                <div className="lead_form_group">
                  <label>Cost</label>
                  <input type="number" step="0.01" name="cost" value={addFormData.cost} onChange={addform_handleChange} />
                </div>
                
                {/* UPDATED: Added Bill Type */}
                <div className="lead_form_group">
                  <label>Bill Type</label>
                  <select name="billType" value={addFormData.billType} onChange={addform_handleChange}>
                    <option value="">Select Bill Type</option>
                    {billTypes?.map(type => (
                      <option key={type.id} value={type.id}>{type.Name}</option>
                    ))}
                  </select>
                </div>

                <div className="lead_form_group">
                  <label>OT Cost</label>
                  <input type="number" step="0.01" name="otCost" value={addFormData.otCost} onChange={addform_handleChange} />
                </div>

                {/* UPDATED: Added OT Bill Type */}
                <div className="lead_form_group">
                  <label>OT Bill Type</label>
                  <select name="otBillType" value={addFormData.otBillType} onChange={addform_handleChange}>
                    <option value="">Select OT Bill Type</option>
                    {otBillTypes?.map(type => (
                      <option key={type.id} value={type.id}>{type.Name}</option>
                    ))}
                  </select>
                </div>
                
                {/* UPDATED: Added Billable Flag */}
                <div className="lead_form_group">
                  <label>Billable</label>
                  <select name="billableFlag" value={addFormData.billableFlag} onChange={addform_handleChange}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                <div className="lead_form_group">
                  <label>Start Date *</label>
                  <input type="date" name="startDt" value={addFormData.startDt} onChange={addform_handleChange} required />
                </div>
                
                <div className="lead_form_group">
                  <label>End Date</label>
                  <input type="date" name="endDt" value={addFormData.endDt} onChange={addform_handleChange} />
                </div>
                
                <div className="lead_form_group">
                  <label>Payment Term</label>
                  <select name="payTerm" value={addFormData.payTerm} onChange={addform_handleChange}>
                    <option value="">Select Term</option>
                    {payTerms.map((term) => (
                      <option key={term.id} value={term.id}>{term.Name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="lead_form_group">
                  <label>Industry</label>
                  <select name="industries" value={addFormData.industries} onChange={addform_handleChange}>
                    <option value="">Select Industry</option>
                    {industries.map((industry) => (
                      <option key={industry.id} value={industry.id}>{industry.Name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="lead_form_group">
                  <label>Sub Organization</label>
                  <input type="text" name="suborgid" value={addFormData.suborgname || ''} disabled placeholder="Auto-populated" />
                </div>

              </div>
            </div>

            <div className="lead_form_buttons">
              <button type="submit" className="lead_submit_button" disabled={isPending}>
                {isPending ? 'Adding...' : 'Add Lead'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LIST VIEW */}
      {!isadd && !selectedLead ? (
        <div className="lead_list">
          <div className="lead_header_section">
            <h1 className="lead_title">Leads</h1>
            <button onClick={handleAddLead} className="lead_submit_button">Add Lead</button>
          </div>
          <div className="lead_search_filter_container">
            <input type="text" value={searchQuery} onChange={handleSearchChange} className="lead_search_input" placeholder="Search by name..." />
            <select value={accountFilter} onChange={handleAccountFilterChange} className="lead_filter_select">
              <option value="all">All Accounts</option>
              {accounts.map(a => <option key={a.ACCNT_ID} value={a.ACCNT_ID}>{a.ALIAS_NAME}</option>)}
            </select>
            <select value={industryFilter} onChange={handleIndustryFilterChange} className="lead_filter_select">
              <option value="all">All Industries</option>
              {industries.map(i => <option key={i.id} value={i.id}>{i.Name}</option>)}
            </select>
          </div>

          <div className="lead_table_wrapper">
            <table className="lead_table">
              <thead>
                <tr>
                  <th className="lead_sortable" onClick={() => requestSort('leadId')}>Lead ID</th>
                  <th className="lead_sortable" onClick={() => requestSort('leadName')}>Lead Name</th>
                  <th className="lead_sortable" onClick={() => requestSort('leadDesc')}>Description</th>
                  <th className="lead_sortable" onClick={() => requestSort('accntId')}>Account</th>
                  <th className="lead_sortable" onClick={() => requestSort('cost')}>Cost</th>
                  <th>OT Cost</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentLeads.length > 0 ? currentLeads.map((lead) => (
                  <tr key={lead.LEAD_ID} onClick={() => handleRowClick(lead)} className="lead_clickable_row">
                    <td>{lead.LEAD_ID}</td>
                    <td>{lead.LEAD_NAME}</td>
                    <td>{lead.LEAD_DESC ? (lead.LEAD_DESC.length > 30 ? lead.LEAD_DESC.substring(0,30)+'...' : lead.LEAD_DESC) : '-'}</td>
                    <td>{getAccountName(lead.ACCNT_ID)}</td>
                    <td>${parseFloat(lead.COST || 0).toFixed(2)}</td>
                    <td>{lead.OT_COST ? `$${parseFloat(lead.OT_COST).toFixed(2)}` : '-'}</td>
                    <td>{lead.START_DT ? formatDate(lead.START_DT) : '-'}</td>
                    <td>{lead.END_DT ? formatDate(lead.END_DT) : '-'}</td>
                    <td><button className="lead_edit_button_small">View</button></td>
                  </tr>
                )) : <tr><td colSpan="9" style={{textAlign: 'center'}}>No leads found.</td></tr>}
              </tbody>
            </table>
          </div>
          {filteredLeads.length > leadsPerPage && (
            <div className="lead_pagination_container">
              <button className="lead_button" onClick={handlePrevPage} disabled={currentPage === 1}>← Previous</button>
              <span className="lead_pagination_text">Page {currentPage} of {totalPages}</span>
              <button className="lead_button" onClick={handleNextPage} disabled={currentPage === totalPages}>Next →</button>
            </div>
          )}
        </div>
      ) : !isadd && selectedLead && (
        
        /* DETAILS VIEW (READ/EDIT) */
        <div className="lead_details_container">
          <div className="lead_header_section">
            <h1 className="lead_title">{`${formData.leadName || '-'}`} Lead Details</h1>
            <button className="lead_back_button" onClick={handleBack}></button>
          </div>

          <div className="lead_submenu_bar">
            <button className={activetab === 'basic' ? 'lead_active' : ''} onClick={() => handletabClick('basic')}>Basic Details</button>
            <button className={activetab === 'additional' ? 'lead_active' : ''} onClick={() => handletabClick('additional')}>Additional Details</button>
          </div>

          <div className="lead_details_content">
            {basicdetailsdisplay && (
              <div className="lead_details_block">
                <h3>Basic Details</h3>
                {editingBasic && canEditLeads ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave('basic'); }}>
                    <div className="lead_form_grid">
                      <div className="lead_form_group"><label>Lead Name*</label><input type="text" name="leadName" value={formData.leadName} onChange={handleFormChange} required /></div>
                      <div className="lead_form_group"><label>Industry</label><select name="industries" value={formData.industries} onChange={handleFormChange}><option value="">Select Industry</option>{industries.map(i => <option key={i.id} value={i.id}>{i.Name}</option>)}</select></div>
                      <div className="lead_form_group"><label>Account*</label><select name="accntId" value={formData.accntId} onChange={handleFormChange} required><option value="">Select Account</option>{accounts.map(a => <option key={a.ACCNT_ID} value={a.ACCNT_ID}>{a.ALIAS_NAME}</option>)}</select></div>
                      <div className="lead_form_group"><label>Client*</label><select name="clientId" value={formData.clientId} onChange={handleFormChange} required><option value="">Select Client</option>{accounts.map(a => <option key={a.ACCNT_ID} value={a.ACCNT_ID}>{a.ALIAS_NAME}</option>)}</select></div>
                      <div className="lead_form_group"><label>Organization</label><input type="text" value={formData.suborgname || ''} disabled /></div>
                      <div className="lead_form_group"><label>Start Date</label><input type="date" name="startDt" value={formData.startDt} onChange={handleFormChange} /></div>
                      <div className="lead_form_group"><label>End Date</label><input type="date" name="endDt" value={formData.endDt} onChange={handleFormChange} /></div>
                      <div className="lead_form_group"><label>Description</label><textarea name="leadDesc" value={formData.leadDesc} onChange={handleFormChange} className="lead_textarea" /></div>
                    </div>
                    <div className="lead_form_buttons">
                      <button type="submit" className="lead_submit_button" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save'}</button>
                      <button type="button" className="lead_cancel_button" onClick={handleCancelBasic} disabled={isLoading}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                  <div className="lead_view_grid">
                    <div className="lead_view_group"><label>Lead Name</label><p>{formData.leadName}</p></div>
                    <div className="lead_view_group"><label>Industry</label><p>{getIndustryName(formData.industries)}</p></div>
                    <div className="lead_view_group"><label>Account</label><p>{getAccountName(formData.accntId)}</p></div>
                    <div className="lead_view_group"><label>Client</label><p>{getAccountName(formData.clientId)}</p></div>
                    <div className="lead_view_group"><label>Organization</label><p>{formData.suborgname || '-'}</p></div>
                    <div className="lead_view_group"><label>Start Date</label><p>{formData.startDt || '-'}</p></div>
                    <div className="lead_view_group"><label>End Date</label><p>{formData.endDt || '-'}</p></div>
                    <div className="lead_view_group"><label>Description</label><p>{formData.leadDesc || '-'}</p></div>
                    <div className="lead_view_group"><label>Updated By</label><p>{formData.updatedBy || '-'}</p></div>
                  </div>
                  {canEditLeads && <div className="lead_form_buttons"><button className="lead_edit_button" onClick={() => handleEdit('basic')}>Edit</button></div>}
                  </>
                )}
              </div>
            )}
            
            {additionaldetailsdisplay && (
              <div className="lead_details_block">
                <h3>Additional Details</h3>
                {editingAdditional && canEditLeads ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave('additional'); }}>
                    <div className="lead_form_grid">
                      <div className="lead_form_group"><label>Cost</label><input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleFormChange} /></div>
                      
                      {/* UPDATED: Added Bill Type to Edit Form */}
                      <div className="lead_form_group">
                        <label>Bill Type</label>
                        <select name="billType" value={formData.billType} onChange={handleFormChange}>
                          <option value="">Select Bill Type</option>
                          {billTypes?.map(type => (
                            <option key={type.id} value={type.id}>{type.Name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="lead_form_group"><label>OT Cost</label><input type="number" step="0.01" name="otCost" value={formData.otCost} onChange={handleFormChange} /></div>
                      
                      {/* UPDATED: Added OT Bill Type to Edit Form */}
                      <div className="lead_form_group">
                        <label>OT Bill Type</label>
                        <select name="otBillType" value={formData.otBillType} onChange={handleFormChange}>
                          <option value="">Select OT Bill Type</option>
                          {otBillTypes?.map(type => (
                            <option key={type.id} value={type.id}>{type.Name}</option>
                          ))}
                        </select>
                      </div>

                      {/* UPDATED: Added Billable to Edit Form */}
                      <div className="lead_form_group">
                        <label>Billable</label>
                        <select name="billableFlag" value={formData.billableFlag} onChange={handleFormChange}>
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </div>

                      <div className="lead_form_group"><label>Payment Term</label><select name="payTerm" value={formData.payTerm} onChange={handleFormChange}><option value="">Select Term</option>{payTerms.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}</select></div>
                    </div>
                    <div className="lead_form_buttons">
                      <button type="submit" className="lead_submit_button" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save'}</button>
                      <button type="button" className="lead_cancel_button" onClick={handleCancelAdditional} disabled={isLoading}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                  {/* UPDATED: Added View Fields */}
                  <div className="lead_view_grid">
                    <div className="lead_view_group"><label>Cost:</label><p>${parseFloat(formData.cost || 0).toFixed(2)}</p></div>
                    <div className="lead_view_group"><label>Bill Type:</label><p>{getBillTypeName(formData.billType)}</p></div>
                    <div className="lead_view_group"><label>OT Cost:</label><p>{formData.otCost ? `$${parseFloat(formData.otCost).toFixed(2)}` : 'Not set'}</p></div>
                    <div className="lead_view_group"><label>OT Bill Type:</label><p>{getOtBillTypeName(formData.otBillType)}</p></div>
                    <div className="lead_view_group"><label>Billable:</label><p>{formData.billableFlag}</p></div>
                    <div className="lead_view_group"><label>Payment Term</label><p>{getPayTermName(formData.payTerm)}</p></div>
                  </div>
                  {canEditLeads && <div className="lead_form_buttons"><button className="lead_edit_button" onClick={() => handleEdit('additional')}>Edit</button></div>}
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
'use client';

import { useState, useEffect } from 'react';
import { 
  addLeadAssignment, 
  updateLeadAssignment, 
  updateLeadAssignmentDecision,
  fetchEmployeesByOrgId, 
  fetchLeadsByOrgId, 
  fetchLeadAssignmentDetails
} from '@/app/serverActions/leads/AddLeadAssignmentAction';
import './leads.css';

export default function LeadAssignmentOverview({ orgId, billTypes: propBillTypes, otBillTypes: propOtBillTypes, payTerms: propPayTerms }) {
  
  // View & State
  const [view, setView] = useState('list'); // 'list', 'add', 'details'
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [billTypes, setBillTypes] = useState([]);
  const [otBillTypes, setOtBillTypes] = useState([]);
  const [payTerms, setPayTerms] = useState([]);

  // Form State
  const [editRowId, setEditRowId] = useState(null);
  const [selectedLead, setSelectedLead] = useState('');
  const [isExistingEmp, setIsExistingEmp] = useState(true);
  const [empId, setEmpId] = useState('');
  const [empName, setEmpName] = useState('');
  const [skills, setSkills] = useState('');
  const [cost, setCost] = useState('');
  const [billType, setBillType] = useState('');
  const [otCost, setOtCost] = useState('');
  const [otBillType, setOtBillType] = useState('');
  const [billableFlag, setBillableFlag] = useState('No');
  const [otBillableFlag, setOtBillableFlag] = useState('No');
  const [payTerm, setPayTerm] = useState('');
  const [startDt, setStartDt] = useState('');
  const [endDt, setEndDt] = useState('');
  const [resumeFile, setResumeFile] = useState(null);

  // Approval Modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalData, setApprovalData] = useState(null);
  const [empPayRate, setEmpPayRate] = useState('');
  const [empOtPayRate, setEmpOtPayRate] = useState('');

  // Selected for Details
  const [assignmentDetails, setAssignmentDetails] = useState(null);

  // --- Init ---
  useEffect(() => { loadData(); }, [orgId]);
  useEffect(() => {
    if (propBillTypes) setBillTypes(propBillTypes);
    if (propOtBillTypes) setOtBillTypes(propOtBillTypes);
    if (propPayTerms) setPayTerms(propPayTerms);
  }, [propBillTypes, propOtBillTypes, propPayTerms]);

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [leadsData, employeesData] = await Promise.all([
        fetchLeadsByOrgId(orgId),
        fetchEmployeesByOrgId(orgId)
      ]);
      setLeads(leadsData || []);
      setEmployees(employeesData || []);
      if (leadsData?.length) refreshAssignmentsList(leadsData);
    } catch (err) { setError(err.message); } 
    finally { setLoading(false); }
  };

  const refreshAssignmentsList = async (currentLeads) => {
    const leadsToFetch = currentLeads || leads;
    const allAssignments = [];
    for (const lead of leadsToFetch) {
      const details = await fetchLeadAssignmentDetails(lead.LEAD_ID);
      allAssignments.push(...(details || []));
    }
    setAssignments(allAssignments);
  };

  // --- Handlers ---
  const handleEdit = (assignment) => {
    setEditRowId(assignment.ROW_ID);
    setSelectedLead(assignment.LEAD_ID);
    setIsExistingEmp(assignment.IS_EXISTING_EMP === 1);
    setEmpId(assignment.EMP_ID || '');
    setEmpName(assignment.EMP_NAME || '');
    setSkills(assignment.SKILLS || '');
    setCost(assignment.COST || '');
    setBillType(assignment.BILL_TYPE || '');
    setOtCost(assignment.OT_COST || '');
    setOtBillType(assignment.OT_BILL_TYPE || '');
    setBillableFlag(assignment.BILLABLE_FLAG === 1 ? 'Yes' : 'No');
    setOtBillableFlag(assignment.OT_BILLABLE_FLAG === 1 ? 'Yes' : 'No');
    setPayTerm(assignment.PAY_TERM || '');
    setStartDt(assignment.START_DT || '');
    setEndDt(assignment.END_DT || '');
    setResumeFile(null); 
    
    setView('add');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);

    const formData = new FormData();
    if (editRowId) formData.append('rowId', editRowId);
    
    formData.append('leadId', selectedLead);
    formData.append('isExistingEmp', isExistingEmp);
    formData.append('empId', isExistingEmp ? empId : '');
    formData.append('empName', isExistingEmp ? 
      employees.find(e => e.empid === empId)?.emp_fst_name + ' ' + employees.find(e => e.empid === empId)?.emp_last_name 
      : empName);
    formData.append('skills', skills);
    formData.append('cost', cost);
    formData.append('billType', billType);
    formData.append('otCost', otCost);
    formData.append('otBillType', otBillType);
    formData.append('billableFlag', billableFlag);
    formData.append('otBillableFlag', otBillableFlag);
    formData.append('payTerm', payTerm);
    formData.append('startDt', startDt);
    formData.append('endDt', endDt);
    
    if (resumeFile) {
      formData.append('resume', resumeFile);
    }

    let result;
    if (editRowId) {
      result = await updateLeadAssignment(null, formData);
    } else {
      result = await addLeadAssignment(null, formData);
    }

    if (result.success) {
      setSuccess(editRowId ? 'Assignment updated successfully!' : 'Assignment created successfully!');
      if (!editRowId) resetForm();
      else setTimeout(() => { setView('list'); resetForm(); }, 1000);
      
      await loadData();
      if (!editRowId) setTimeout(() => setView('list'), 1500);
    } else {
      setError(result.error || 'Operation failed');
    }
    setLoading(false);
  };

  const handleApprovalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData();
    formData.append('leadId', approvalData.LEAD_ID);
    formData.append('assignmentRowId', approvalData.ROW_ID);
    formData.append('createdDecision', 'Yes');
    formData.append('empPayRate', empPayRate);
    formData.append('empOtPayRate', empOtPayRate);

    const result = await updateLeadAssignmentDecision(formData);
    if (result.success) {
      setSuccess('Approved & Project Created!');
      setShowApprovalModal(false);
      await loadData();
      const details = await fetchLeadAssignmentDetails(approvalData.LEAD_ID);
      const updated = details.find(d => d.ROW_ID === approvalData.ROW_ID);
      setAssignmentDetails(updated);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditRowId(null);
    setSelectedLead(''); setIsExistingEmp(true); setEmpId(''); setEmpName('');
    setSkills(''); setCost(''); setBillType(''); setOtCost(''); setOtBillType('');
    setBillableFlag('No'); setOtBillableFlag('No'); setPayTerm('');
    setStartDt(''); setEndDt(''); setResumeFile(null);
  };

  // --- Render Helpers ---
  const getBillTypeName = (id) => billTypes.find(t => String(t.id) === String(id))?.Name || '-';
  const getOtBillTypeName = (id) => otBillTypes.find(t => String(t.id) === String(id))?.Name || '-';
  const getPayTermName = (id) => payTerms.find(t => String(t.id) === String(id))?.Name || '-';

  if (loading && assignments.length === 0) return <div>Loading...</div>;

  return (
    <div className="lead_overview_container">
      <div className="lead_header_section">
        <h1 className="lead_title">
          {view === 'add' ? (editRowId ? 'Edit Assignment' : 'Add Assignment') : 
           view === 'details' ? 'Assignment Details' : 'Lead Assignments'}
        </h1>
        {view !== 'list' && (
          <button className="lead_back_button" onClick={() => { setView('list'); resetForm(); }}></button>
        )}
        {view === 'list' && (
          <button className="lead_button" onClick={() => { setView('add'); resetForm(); }}>Add New Assignment</button>
        )}
      </div>

      {error && <div className="lead_error_message">{error}</div>}
      {success && <div className="lead_success_message">{success}</div>}

      {/* --- FORM VIEW (ADD & EDIT) --- */}
      {view === 'add' && (
        <div className="lead_details_block">
          <h3>{editRowId ? 'Update details' : 'Enter details'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="lead_form_grid">
              <div className="lead_form_group">
                <label>Lead *</label>
                <select value={selectedLead} onChange={e => setSelectedLead(e.target.value)} required disabled={!!editRowId}>
                  <option value="">Select Lead</option>
                  {leads.map(l => <option key={l.LEAD_ID} value={l.LEAD_ID}>{l.LEAD_NAME}</option>)}
                </select>
              </div>

              {/* FIXED RADIO BUTTON ALIGNMENT */}
              <div className="lead_form_group">
                <label>Employee Type *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'normal' }}>
                    <input 
                      type="radio" 
                      checked={isExistingEmp} 
                      onChange={() => setIsExistingEmp(true)} 
                      style={{ marginRight: '8px', cursor: 'pointer' }}
                    /> 
                    Existing
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'normal' }}>
                    <input 
                      type="radio" 
                      checked={!isExistingEmp} 
                      onChange={() => setIsExistingEmp(false)} 
                      style={{ marginRight: '8px', cursor: 'pointer' }}
                    /> 
                    Manual
                  </label>
                </div>
              </div>

              {isExistingEmp ? (
                <div className="lead_form_group">
                  <label>Select Employee *</label>
                  <select value={empId} onChange={e => setEmpId(e.target.value)} required>
                    <option value="">Select...</option>
                    {employees.map(e => <option key={e.empid} value={e.empid}>{e.emp_fst_name} {e.emp_last_name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="lead_form_group"><label>Name *</label><input value={empName} onChange={e => setEmpName(e.target.value)} required /></div>
              )}

              <div className="lead_form_group">
                <label>{editRowId ? 'Update Resume (Optional)' : 'Resume (PDF/Word)'}</label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={e => setResumeFile(e.target.files[0])} />
              </div>

              <div className="lead_form_group"><label>Skills</label><input value={skills} onChange={e => setSkills(e.target.value)} /></div>
              <div className="lead_form_group"><label>Start Date *</label><input type="date" value={startDt} onChange={e => setStartDt(e.target.value)} required /></div>
              <div className="lead_form_group"><label>End Date</label><input type="date" value={endDt} onChange={e => setEndDt(e.target.value)} /></div>
              <div className="lead_form_group"><label>Cost *</label><input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} required /></div>
              <div className="lead_form_group"><label>Bill Type *</label><select value={billType} onChange={e => setBillType(e.target.value)} required><option value="">Select...</option>{billTypes.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}</select></div>
              <div className="lead_form_group"><label>OT Cost</label><input type="number" step="0.01" value={otCost} onChange={e => setOtCost(e.target.value)} /></div>
              <div className="lead_form_group"><label>OT Bill Type</label><select value={otBillType} onChange={e => setOtBillType(e.target.value)}><option value="">Select...</option>{otBillTypes.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}</select></div>
              <div className="lead_form_group"><label>Pay Term *</label><select value={payTerm} onChange={e => setPayTerm(e.target.value)} required><option value="">Select...</option>{payTerms.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}</select></div>
              <div className="lead_form_group"><label>Billable</label><select value={billableFlag} onChange={e => setBillableFlag(e.target.value)}><option value="No">No</option><option value="Yes">Yes</option></select></div>
              <div className="lead_form_group"><label>OT Billable</label><select value={otBillableFlag} onChange={e => setOtBillableFlag(e.target.value)}><option value="No">No</option><option value="Yes">Yes</option></select></div>
            </div>
            
            <div className="lead_form_buttons">
              <button type="submit" className="lead_submit_button" disabled={loading}>
                {loading ? 'Saving...' : (editRowId ? 'Update Assignment' : 'Add Assignment')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- DETAILS VIEW --- */}
      {view === 'details' && assignmentDetails && (
        <div className="lead_details_container">
          <div className="lead_submenu_bar">
            <button className={activeTab === 'basic' ? 'lead_active_tab' : ''} onClick={() => setActiveTab('basic')}>Basic Details</button>
            <button className={activeTab === 'additional' ? 'lead_active_tab' : ''} onClick={() => setActiveTab('additional')}>Additional Details</button>
          </div>
          
          <div className="lead_details_content">
            {activeTab === 'basic' && (
              <div className="lead_details_block">
                <h3>Basic Information</h3>
                <div className="lead_view_grid">
                  <div className="lead_view_group"><label>Lead Name</label><p>{assignmentDetails.LEAD_NAME}</p></div>
                  <div className="lead_view_group"><label>Employee</label><p>{assignmentDetails.EMP_NAME}</p></div>
                  <div className="lead_view_group"><label>Status</label><span className={`lead_status_badge ${assignmentDetails.CREATED_DECISION === 'Yes' ? 'lead_active' : 'lead_inactive'}`}>{assignmentDetails.CREATED_DECISION}</span></div>
                  <div className="lead_view_group"><label>Skills</label><p>{assignmentDetails.SKILLS || '-'}</p></div>
                  <div className="lead_view_group"><label>Start Date</label><p>{assignmentDetails.START_DT || '-'}</p></div>
                  <div className="lead_view_group"><label>End Date</label><p>{assignmentDetails.END_DT || '-'}</p></div>
                  <div className="lead_view_group"><label>Resume</label>
                     <p>{assignmentDetails.RESUME_PATH ? <a href={assignmentDetails.RESUME_PATH} target="_blank" className="lead_link">View Resume</a> : 'No Resume'}</p>
                  </div>
                </div>

                {/* APPROVE & EDIT BUTTONS */}
                {assignmentDetails.CREATED_DECISION === 'No' && (
                  <div className="lead_form_buttons" style={{marginTop: '20px', display:'flex', gap:'10px'}}>
                    <button className="lead_submit_button" onClick={() => { setApprovalData(assignmentDetails); setShowApprovalModal(true); }}>Approve</button>
                    <button 
                      type="button"
                      onClick={() => handleEdit(assignmentDetails)} 
                      style={{backgroundColor: '#6c757d', color:'white', border:'none', padding:'10px 20px', borderRadius:'4px', cursor:'pointer', fontSize: '14px'}}>
                      Edit Details
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'additional' && (
              <div className="lead_details_block">
                <h3>Billing & Project Information</h3>
                <div className="lead_view_grid">
                  <div className="lead_view_group"><label>Cost</label><p>${parseFloat(assignmentDetails.COST || 0).toFixed(2)}</p></div>
                  <div className="lead_view_group"><label>Bill Type</label><p>{getBillTypeName(assignmentDetails.BILL_TYPE)}</p></div>
                  <div className="lead_view_group"><label>OT Cost</label><p>${parseFloat(assignmentDetails.OT_COST || 0).toFixed(2)}</p></div>
                  <div className="lead_view_group"><label>OT Bill Type</label><p>{getOtBillTypeName(assignmentDetails.OT_BILL_TYPE)}</p></div>
                  <div className="lead_view_group"><label>Billable</label><p>{assignmentDetails.BILLABLE_FLAG ? 'Yes' : 'No'}</p></div>
                  <div className="lead_view_group"><label>Pay Term</label><p>{getPayTermName(assignmentDetails.PAY_TERM)}</p></div>
                  
                  {assignmentDetails.CREATED_DECISION === 'Yes' && (
                    <>
                      <div className="lead_view_group"><label>Emp Pay Rate</label><p>${parseFloat(assignmentDetails.EMP_PAY_RATE || 0).toFixed(2)}</p></div>
                      <div className="lead_view_group"><label>Created Project</label>
                        <p><a href={`/projects/${assignmentDetails.CREATED_PRJ_ID}`} className="lead_link">View Project ({assignmentDetails.CREATED_PRJ_ID})</a></p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- LIST VIEW --- */}
      {view === 'list' && (
        <div className="lead_table_wrapper">
           <table className="lead_table">
             <thead>
               <tr>
                 <th>Lead Name</th>
                 <th>Employee</th>
                 <th>Type</th>
                 <th>Start Date</th>
                 <th>Cost</th>
                 <th>Resume</th>
                 <th>Status</th>
                 <th>Actions</th>
               </tr>
             </thead>
             <tbody>
               {assignments.length === 0 ? <tr><td colSpan="8" style={{textAlign:'center'}}>No assignments found</td></tr> : 
               assignments.map(a => (
                 <tr key={a.ROW_ID} onClick={() => { setAssignmentDetails(a); setView('details'); }} className="lead_clickable_row">
                   <td>{a.LEAD_NAME}</td>
                   <td>{a.EMP_NAME}</td>
                   <td>{a.IS_EXISTING_EMP ? 'Exist' : 'Manual'}</td>
                   <td>{a.START_DT || '-'}</td>
                   <td>${parseFloat(a.COST || 0).toFixed(2)}</td>
                   <td>{a.RESUME_PATH ? <span className="lead_link" onClick={(e)=>{e.stopPropagation(); window.open(a.RESUME_PATH)}}>View</span> : '-'}</td>
                   <td><span className={`lead_status_badge ${a.CREATED_DECISION === 'Yes' ? 'lead_active' : 'lead_inactive'}`}>{a.CREATED_DECISION}</span></td>
                   <td><button className="lead_button_small">Details</button></td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      )}
      
      {/* Approval Modal */}
      {showApprovalModal && approvalData && (
        <div className="lead_modal_overlay">
          <div className="lead_modal_content">
            <h3>Approve Assignment</h3>
            <p><strong>Lead:</strong> {approvalData.LEAD_NAME}</p>
            <p><strong>Cost:</strong> ${parseFloat(approvalData.COST).toFixed(2)}</p>
            <form onSubmit={handleApprovalSubmit} style={{marginTop:'15px'}}>
              <div className="lead_form_group">
                <label>Employee Pay Rate *</label>
                <input type="number" step="0.01" value={empPayRate} onChange={e => setEmpPayRate(e.target.value)} required />
              </div>
              <div className="lead_form_group">
                <label>OT Pay Rate</label>
                <input type="number" step="0.01" value={empOtPayRate} onChange={e => setEmpOtPayRate(e.target.value)} />
              </div>
              <div className="lead_form_buttons">
                <button type="submit" className="lead_submit_button" disabled={loading}>Approve & Create</button>
                <button type="button" className="lead_cancel_button" onClick={() => setShowApprovalModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
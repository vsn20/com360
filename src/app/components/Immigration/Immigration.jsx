'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  addGlobalImmigrationRecord,
  fetchGlobalImmigrationRecords 
} from '@/app/serverActions/Immigration/ImmigrationFeature';
import styles from '../Employee/immigration.module.css'; 

const APPROVED_STATUS_ID = 582; 
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

const Immigration = ({
  initialRecords = [],
  employees = [],
  suborgs = [],
  document_types = [],
  document_subtypes = [],
  immigrationStatuses = [],
  isAdmin = false,
  userSuborgId = null
}) => {
  const [records, setRecords] = useState(initialRecords);
  const [syncingMap, setSyncingMap] = useState({});
  const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filterDocType, setFilterDocType] = useState('all');

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rowsPerPageInput, setRowsPerPageInput] = useState('10');

  // Form State
  const [formData, setFormData] = useState(initialFormState());
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  function initialFormState() {
    return {
      employeeSelection: '',
      beneficiaryNameCustom: '',
      companySelection: '',
      petitionerName: '',
      documentName: '',
      documentType: '',
      subtype: '',
      documentNumber: '',
      immigrationStatus: '',
      issueDate: '',
      expiryDate: '',
      eligibleReviewDate: '',
      comments: ''
    };
  }

  // Reload data helper
  const refreshData = async () => {
    setLoading(true);
    try {
      const data = await fetchGlobalImmigrationRecords();
      setRecords(data.records);
    } catch (err) {
      console.error("Failed to refresh records", err);
    } finally {
      setLoading(false);
    }
  };

  // --- FILTERING & PAGINATION LOGIC ---
  const { filteredRecords, totalPages, paginatedRecords } = useMemo(() => {
    // 1. Filter
    const filtered = records.filter(r => {
        if (filterDocType !== 'all' && String(r.document_type) !== filterDocType) return false;
        return true;
    });

    // 2. Paginate
    const pages = Math.ceil(filtered.length / rowsPerPage);
    const start = (currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);

    return { 
        filteredRecords: filtered, // Contains ALL matching rows (for Global Sync)
        totalPages: pages, 
        paginatedRecords: paginated // Contains ONLY current page rows (for Display)
    };
  }, [records, filterDocType, currentPage, rowsPerPage]);

  // --- PAGINATION HANDLERS ---
  const handleNextPage = () => { if (currentPage < totalPages) { setCurrentPage(prev => prev + 1); setPageInputValue(String(currentPage + 1)); }};
  const handlePrevPage = () => { if (currentPage > 1) { setCurrentPage(prev => prev - 1); setPageInputValue(String(currentPage - 1)); }};
  
  const handlePageInputChange = (e) => setPageInputValue(e.target.value);
  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(pageInputValue, 10);
      if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
      else setPageInputValue(String(currentPage));
    }
  };

  const handleRowsPerPageChange = (e) => setRowsPerPageInput(e.target.value);
  const handleRowsPerPageKeyPress = (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(rowsPerPageInput, 10);
      if (!isNaN(val) && val > 0) { setRowsPerPage(val); setCurrentPage(1); }
      else setRowsPerPageInput(String(rowsPerPage));
    }
  };

  // --- SYNC LOGIC ---
  const handleSingleSync = async (receiptNumber) => {
    if (!receiptNumber) return;
    setSyncingMap(prev => ({ ...prev, [receiptNumber]: true }));
    try {
      const res = await fetch('/api/sync-uscis-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptNumber }),
      });
      const data = await res.json();
      if(data.success) {
         await refreshData();
      }
    } catch (e) {
      alert("Sync failed");
    } finally {
      setSyncingMap(prev => ({ ...prev, [receiptNumber]: false }));
    }
  };

  const handleGlobalSync = async () => {
    setIsGlobalSyncing(true);
    
    // 1. Sync ALL filtered records (ignoring pagination), excluding Approved
    const recordsToSync = filteredRecords.filter(r => 
        Number(r.immigration_status) !== APPROVED_STATUS_ID && 
        r.document_number
    );

    if (recordsToSync.length === 0) {
        alert("No visible records need syncing.");
        setIsGlobalSyncing(false);
        return;
    }

    // 2. Sequential Sync
    let successCount = 0;
    for (const rec of recordsToSync) {
        setSyncingMap(prev => ({ ...prev, [rec.document_number]: true }));
        try {
            await fetch('/api/sync-uscis-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiptNumber: rec.document_number }),
            });
            successCount++;
        } catch(e) { console.error(e); }
        setSyncingMap(prev => ({ ...prev, [rec.document_number]: false }));
    }

    await refreshData();
    setIsGlobalSyncing(false);
    alert(`Global Sync Completed. Synced ${successCount} records.`);
  };

  // --- FORM HANDLERS ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'companySelection') {
        if (value === 'other') {
            setFormData(prev => ({ ...prev, companySelection: value, petitionerName: '' }));
        } else {
            const sub = suborgs.find(s => String(s.suborgid) === String(value));
            setFormData(prev => ({ 
                ...prev, 
                companySelection: value, 
                petitionerName: sub ? sub.suborgname : '' 
            }));
        }
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        alert('File size cannot exceed 1 MB.');
        e.target.value = null;
        return;
      }
      setFile(selectedFile);
      if (!formData.documentName) {
        setFormData(prev => ({...prev, documentName: selectedFile.name}));
      }
    }
  };

  const openAddModal = () => {
    let defaultCompany = '';
    let defaultPetitioner = '';

    if (!isAdmin && userSuborgId) {
        defaultCompany = userSuborgId;
        const sub = suborgs.find(s => String(s.suborgid) === String(userSuborgId));
        defaultPetitioner = sub ? sub.suborgname : '';
    }

    setFormData({
        ...initialFormState(),
        companySelection: defaultCompany,
        petitionerName: defaultPetitioner,
    });
    setFile(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.keys(formData).forEach(k => data.append(k, formData[k]));
    if (file) data.append('file', file);
    
    const res = await addGlobalImmigrationRecord(data);
    if (res.success) {
        setShowModal(false);
        refreshData();
    } else {
        alert("Error: " + res.error);
    }
  };

  return (
    <div className={styles.employee_immigration_container}>
      {/* HEADER */}
      <div className={styles.employee_immigration_titleContainer}>
        <h2 className={styles.employee_immigration_title}>Immigration Dashboard</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
            <button 
                onClick={handleGlobalSync} 
                disabled={isGlobalSyncing}
                className={styles.employee_immigration_button}
                style={{ backgroundColor: isGlobalSyncing ? '#6c757d' : '#007bff' }}
            >
                {isGlobalSyncing ? 'Syncing...' : 'Global Sync'}
            </button>
            <button 
                onClick={openAddModal} 
                className={`${styles.employee_immigration_button} ${styles.employee_immigration_addButton}`}
            >
                Add Record
            </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className={styles.employee_immigration_searchFilterContainer}>
         <select 
            value={filterDocType} 
            onChange={(e) => { setFilterDocType(e.target.value); setCurrentPage(1); }} // Reset page on filter
            className={styles.employee_immigration_filterSelect}
         >
            <option value="all">All Document Types</option>
            {document_types?.map(t => (
                <option key={t.id} value={t.id}>{t.Name}</option>
            ))}
         </select>
      </div>

      {/* TABLE */}
      <div className={styles.employee_immigration_tableWrapper}>
        <table className={styles.employee_immigration_table}>
            <thead>
                <tr>
                    <th className={styles.employee_immigration_tableHeader}>Receipt #</th>
                    <th className={styles.employee_immigration_tableHeader}>Petitioner</th>
                    <th className={styles.employee_immigration_tableHeader}>Beneficiary</th>
                    <th className={styles.employee_immigration_tableHeader}>Type</th>
                    <th className={styles.employee_immigration_tableHeader}>Subtype</th>
                    <th className={styles.employee_immigration_tableHeader}>Status</th>
                    <th className={styles.employee_immigration_tableHeader}>Issue Date</th>
                    <th className={styles.employee_immigration_tableHeader}>Action</th>
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    <tr><td colSpan="8" style={{padding:'20px', textAlign:'center'}}>Loading...</td></tr>
                ) : paginatedRecords.length === 0 ? (
                    <tr><td colSpan="8" style={{padding:'20px', textAlign:'center'}}>No records found.</td></tr>
                ) : paginatedRecords.map(row => (
                    <tr key={row.id} className={styles.employee_immigration_tableRow}>
                        <td className={styles.employee_immigration_tableCell} style={{fontFamily:'monospace', color:'#0056b3'}}>
                            {row.document_number}
                        </td>
                        <td className={styles.employee_immigration_tableCell}>{row.petitioner_name || '-'}</td>
                        <td className={styles.employee_immigration_tableCell}>{row.beneficiary_display_name || '-'}</td>
                        <td className={styles.employee_immigration_tableCell}>{row.type_name || '-'}</td>
                        <td className={styles.employee_immigration_tableCell}>{row.subtype_name || '-'}</td>
                        <td className={styles.employee_immigration_tableCell}>{row.status_name || 'Pending'}</td>
                        <td className={styles.employee_immigration_tableCell}>{row.issue_date || '-'}</td>
                        <td className={styles.employee_immigration_tableCell}>
                           {Number(row.immigration_status) === APPROVED_STATUS_ID ? (
                             <span style={{ color: 'green', fontSize: '12px', fontWeight: 'bold' }}>✓ Synced</span>
                           ) : (
                             <button 
                               onClick={(e) => handleSingleSync(row.document_number)}
                               disabled={syncingMap[row.document_number] || isGlobalSyncing}
                               className={styles.employee_immigration_button}
                               style={{ 
                                   fontSize:'11px', padding:'4px 8px', minWidth:'60px',
                                   backgroundColor: syncingMap[row.document_number] ? '#ccc' : '#28a745' 
                               }}
                             >
                               {syncingMap[row.document_number] ? '...' : 'Sync'}
                             </button>
                           )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* PAGINATION CONTROLS */}
      {filteredRecords.length > rowsPerPage && (
        <div className={styles.employee_immigration_paginationContainer}>
            <button 
            className={styles.employee_immigration_paginationButton} 
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            >
            ← Previous
            </button>
            <span className={styles.employee_immigration_paginationText}>
            Page {' '}
            <input 
                type="text" 
                value={pageInputValue}
                onChange={handlePageInputChange}
                onKeyPress={handlePageInputKeyPress}
                className={styles.employee_immigration_paginationInput}
            /> {' '}
            of {totalPages}
            </span>
            <button 
            className={styles.employee_immigration_paginationButton} 
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            >
            Next →
            </button>
        </div>
      )}

      {/* ROWS PER PAGE INPUT */}
      <div 
        className={styles.employee_immigration_rowsPerPageContainer} 
        style={{ marginTop: '16px' }}
      >
        <label className={styles.employee_immigration_rowsPerPageLabel}>Rows per Page:</label>
        <input 
            type="text" 
            value={rowsPerPageInput}
            onChange={handleRowsPerPageChange}
            onKeyPress={handleRowsPerPageKeyPress}
            placeholder="Rows per page"
            className={styles.employee_immigration_rowsPerPageInput}
        />
      </div>

      {/* ADD MODAL */}
      {showModal && (
        <div style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, 
            backgroundColor:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000
        }}>
            <div className={styles.employee_immigration_form} style={{ width: '800px', maxHeight:'90vh', overflowY:'auto' }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                    <h3 className={styles.employee_immigration_title}>Add Immigration Record</h3>
                    <button onClick={()=>setShowModal(false)} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer'}}>&times;</button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    {/* ROW 1: Employee & Beneficiary */}
                    <div className={styles.employee_immigration_formRow}>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Employee Name</label>
                            <select 
                                name="employeeSelection"
                                value={formData.employeeSelection}
                                onChange={(e) => setFormData(prev => ({ ...prev, employeeSelection: e.target.value }))}
                                className={styles.employee_immigration_formInput}
                                required
                            >
                                <option value="">Select Employee</option>
                                {employees.map(e => (
                                    <option key={e.empid} value={e.empid}>{e.EMP_FST_NAME} {e.EMP_LAST_NAME}</option>
                                ))}
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Beneficiary Name</label>
                            {formData.employeeSelection === 'OTHER' ? (
                                <input 
                                    type="text"
                                    name="beneficiaryNameCustom"
                                    value={formData.beneficiaryNameCustom}
                                    onChange={handleInputChange}
                                    className={styles.employee_immigration_formInput}
                                    placeholder="Enter Beneficiary Name"
                                    required
                                />
                            ) : (
                                <input 
                                    type="text"
                                    value={employees.find(e=>e.empid === formData.employeeSelection)?.EMP_FST_NAME || ''}
                                    disabled
                                    className={styles.employee_immigration_formInput}
                                    style={{ backgroundColor: '#f0f0f0', color: '#666' }}
                                />
                            )}
                        </div>
                    </div>

                    {/* ROW 2: Company & Petitioner */}
                    <div className={styles.employee_immigration_formRow}>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Company Name</label>
                            <select
                                name="companySelection"
                                value={formData.companySelection}
                                onChange={handleInputChange}
                                className={styles.employee_immigration_formInput}
                                disabled={!isAdmin} 
                            >
                                <option value="">Select Company</option>
                                {suborgs.map(s => (
                                    <option key={s.suborgid} value={s.suborgid}>{s.suborgname}</option>
                                ))}
                                {/* {isAdmin && <option value="other">Others</option>} */}
                            </select>
                        </div>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Petitioner Name</label>
                            <input
                                type="text"
                                name="petitionerName"
                                value={formData.petitionerName}
                                onChange={handleInputChange}
                                disabled={formData.companySelection !== 'other'}
                                className={styles.employee_immigration_formInput}
                                style={formData.companySelection !== 'other' ? { backgroundColor: '#f0f0f0', color:'#666' } : {}}
                            />
                        </div>
                    </div>

                    {/* ROW 3: Document Details */}
                    <div className={styles.employee_immigration_formRow}>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Document Name</label>
                            <input type="text" name="documentName" value={formData.documentName} onChange={handleInputChange} className={styles.employee_immigration_formInput} />
                        </div>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Document Type</label>
                            <select name="documentType" value={formData.documentType} onChange={handleInputChange} className={styles.employee_immigration_formInput} required>
                                <option value="">Select Type</option>
                                {document_types?.map(t=><option key={t.id} value={t.id}>{t.Name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* ROW 4: Subtype & Number */}
                    <div className={styles.employee_immigration_formRow}>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Subtype</label>
                            <select name="subtype" value={formData.subtype} onChange={handleInputChange} className={styles.employee_immigration_formInput}>
                                <option value="">Select Subtype</option>
                                {document_subtypes?.map(t=><option key={t.id} value={t.id}>{t.Name}</option>)}
                            </select>
                        </div>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Receipt Number</label>
                            <input type="text" name="documentNumber" value={formData.documentNumber} onChange={handleInputChange} className={styles.employee_immigration_formInput} required />
                        </div>
                    </div>

                    {/* ROW 5: Status & Issue Date */}
                    <div className={styles.employee_immigration_formRow}>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Status</label>
                            <select name="immigrationStatus" value={formData.immigrationStatus} onChange={handleInputChange} className={styles.employee_immigration_formInput}>
                                <option value="">Select Status</option>
                                {immigrationStatuses?.map(s=><option key={s.id} value={s.id}>{s.Name}</option>)}
                            </select>
                        </div>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Issue Date</label>
                            <input type="date" name="issueDate" value={formData.issueDate} onChange={handleInputChange} className={styles.employee_immigration_formInput} />
                        </div>
                    </div>

                    {/* ROW 6: Expiry & Review Date */}
                    <div className={styles.employee_immigration_formRow}>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Expiry Date</label>
                            <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleInputChange} className={styles.employee_immigration_formInput} />
                        </div>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Eligible Review Date</label>
                            <input type="date" name="eligibleReviewDate" value={formData.eligibleReviewDate} onChange={handleInputChange} className={styles.employee_immigration_formInput} />
                        </div>
                    </div>

                    {/* ROW 7: File Upload */}
                    <div className={styles.employee_immigration_formRow}>
                        <div className={styles.employee_immigration_formGroup}>
                            <label className={styles.employee_immigration_formLabel}>Attachment (PDF/JPG/JPEG, max 1MB)</label>
                            <input type="file" accept=".pdf,.jpg,.jpeg" onChange={handleFileChange} className={styles.employee_immigration_fileInput} />
                            {file && <div style={{ fontSize: '12px', color: 'green', marginTop: '4px' }}>Selected: {file.name}</div>}
                        </div>
                    </div>

                    {/* ROW 8: Comments */}
                    <div className={styles.employee_immigration_formRow}>
                        <div className={`${styles.employee_immigration_formGroup} ${styles.employee_immigration_fullWidth}`}>
                            <label className={styles.employee_immigration_formLabel}>Comments</label>
                            <textarea name="comments" value={formData.comments} onChange={handleInputChange} className={styles.employee_immigration_textarea} rows="3" />
                        </div>
                    </div>

                    <div className={styles.employee_immigration_formButtons}>
                        <button type="submit" className={`${styles.employee_immigration_button} ${styles.employee_immigration_saveButton}`}>Save Record</button>
                        <button type="button" onClick={()=>setShowModal(false)} className={`${styles.employee_immigration_button} ${styles.employee_immigration_cancelButton}`}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Immigration;
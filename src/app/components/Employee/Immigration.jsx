'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  addImmigrationData, 
  updateImmigrationData, 
  deleteImmigrationData 
} from '@/app/serverActions/Employee/Immigration';
import styles from './immigration.module.css';

// ID for "Case Approved" (Must match your DB/Generic Values)
const APPROVED_STATUS_ID = 582; 

const Immigration = ({ 
  empid, 
  immigrationData: initialData, 
  immigrationStatuses,
  documentTypes,    
  documentSubtypes, 
  onUpdate, 
  employeeName,
  suborgs, // Recieve suborgs prop for Company Name dropdown
  employeeSuborgId // Recieve current employee's suborg ID to filter options
}) => {
  // Sync prop data to local state
  const [data, setData] = useState(initialData || []);
  const [editing, setEditing] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [currentRecord, setCurrentRecord] = useState(null);
  const [originalRecord, setOriginalRecord] = useState(null);
  const [formData, setFormData] = useState(initialFormState());
  const [file, setFile] = useState(null); 
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- USCIS Sync State ---
  const [syncLoadingMap, setSyncLoadingMap] = useState({});

  // --- Pagination, Search & Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSubtype, setFilterSubtype] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rowsPerPageInput, setRowsPerPageInput] = useState('10');

  const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

  function initialFormState() {
    return {
      documentName: '', 
      documentType: '',
      subtype: '',
      documentNumber: '',
      immigrationStatus: '',
      issueDate: '',
      expiryDate: '',
      eligibleReviewDate: '',
      comments: '',
      document_path: '',
      // New Fields
      beneficiaryEmpid: empid || '', 
      suborgid: '',
      petitionerName: ''
    };
  }

  // Effect to update local state when prop changes
  useEffect(() => {
    setData(initialData || []);
  }, [initialData]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setRowsPerPageInput(rowsPerPage.toString());
  }, [rowsPerPage]);

  const getNameById = (list, id) => {
    const item = list?.find(x => String(x.id) === String(id));
    return item ? item.Name : 'N/A';
  };

  // --- HANDLE SUBORG CHANGE (Auto-populate Petitioner) ---
  const handleSuborgChange = (e) => {
    const selectedId = e.target.value;
    let newPetitionerName = '';

    if (selectedId === 'other') {
        newPetitionerName = ''; // Allow typing
    } else if (selectedId) {
        // Find suborg name
        const sub = suborgs?.find(s => String(s.suborgid) === String(selectedId));
        newPetitionerName = sub ? sub.suborgname : '';
    }

    setFormData(prev => ({
        ...prev,
        suborgid: selectedId,
        petitionerName: newPetitionerName
    }));
  };

  // --- USCIS Sync Function ---
  const handleSync = async (e, receiptNumber) => {
    e.stopPropagation(); // Prevent row click
    if (!receiptNumber) return alert("No Receipt Number available for this record.");

    setSyncLoadingMap(prev => ({ ...prev, [receiptNumber]: true }));

    try {
      const res = await fetch('/api/sync-uscis-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptNumber }),
      });

      const result = await res.json();

      if (result.success) {
        if (result.skipped) {
            alert(result.message); // "Already Approved" message
        } else {
            alert(result.message); // Success message
        }
        if (onUpdate) onUpdate(); // Refresh data to show new status
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("System Error during sync.");
    } finally {
      setSyncLoadingMap(prev => ({ ...prev, [receiptNumber]: false }));
    }
  };

  // Single filtered and paginated data calculation
  const { filteredRecords, totalPages, paginatedRecords } = useMemo(() => {
    const filtered = data.filter(item => {
      const typeName = getNameById(documentTypes, item.document_type).toLowerCase();
      const subtypeName = getNameById(documentSubtypes, item.subtype).toLowerCase();
      const docName = (item.document_name || '').toLowerCase();
      const docNumber = (item.document_number || '').toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch = 
        docName.includes(query) || 
        docNumber.includes(query) ||
        typeName.includes(query) ||
        subtypeName.includes(query);

      const matchesType = filterType === 'all' || String(item.document_type) === filterType;
      const matchesSubtype = filterSubtype === 'all' || String(item.subtype) === filterSubtype;

      return matchesSearch && matchesType && matchesSubtype;
    });

    const pages = Math.ceil(filtered.length / rowsPerPage);
    const start = (currentPage - 1) * rowsPerPage;
    const paginated = filtered.slice(start, start + rowsPerPage);

    return {
      filteredRecords: filtered,
      totalPages: pages,
      paginatedRecords: paginated
    };
  }, [data, searchQuery, filterType, filterSubtype, documentTypes, documentSubtypes, currentPage, rowsPerPage]);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const handlePageInputChange = (e) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(pageInputValue, 10);
      if (!isNaN(val) && val >= 1 && val <= totalPages) {
        setCurrentPage(val);
      } else {
        setPageInputValue(currentPage.toString());
      }
    }
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPageInput(e.target.value);
  };

  const handleRowsPerPageKeyPress = (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(rowsPerPageInput, 10);
      if (!isNaN(val) && val > 0) {
        setRowsPerPage(val);
        setCurrentPage(1);
      } else {
        setRowsPerPageInput(rowsPerPage.toString());
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        setError('File size cannot exceed 1 MB.');
        e.target.value = null;
        return;
      }
      setError(null);
      setFile(selectedFile);
      if (!formData.documentName) {
        setFormData(prev => ({...prev, documentName: selectedFile.name}));
      }
    }
  };

  const handleRowClick = (record) => {
    setOriginalRecord({ ...record });
    setCurrentRecord(record);
    setFormData({
      documentName: record.document_name || '',
      documentType: record.document_type || '', 
      subtype: record.subtype || '',            
      documentNumber: record.document_number || '',
      immigrationStatus: record.immigration_status || '',
      issueDate: record.issue_date || '',
      expiryDate: record.expiry_date || '',
      eligibleReviewDate: record.eligible_review_date || '',
      comments: record.comments || '',
      document_path: record.document_path || '',
      beneficiaryEmpid: record.beneficiary_empid || empid,
      suborgid: record.suborgid || '',
      petitionerName: record.petitioner_name || ''
    });
    setFile(null); 
    setEditing(true);
    setIsViewOnly(true); 
    setError(null);
  };

  const handleEditMode = () => {
    setIsViewOnly(false);
    setError(null);
  };

  const handleAddClick = () => {
    setCurrentRecord(null);
    setOriginalRecord(null);
    setFormData(initialFormState());
    setFile(null);
    setEditing(true);
    setIsViewOnly(false); 
    setError(null);
  };

  const handleCancel = () => {
    if (currentRecord && !isViewOnly) {
      // Cancel editing: revert to original and go to view mode
      setFormData({
        documentName: originalRecord.document_name || '',
        documentType: originalRecord.document_type || '', 
        subtype: originalRecord.subtype || '',            
        documentNumber: originalRecord.document_number || '',
        immigrationStatus: originalRecord.immigration_status || '',
        issueDate: originalRecord.issue_date || '',
        expiryDate: originalRecord.expiry_date || '',
        eligibleReviewDate: originalRecord.eligible_review_date || '',
        comments: originalRecord.comments || '',
        document_path: originalRecord.document_path || '',
        beneficiaryEmpid: originalRecord.beneficiary_empid || empid,
        suborgid: originalRecord.suborgid || '',
        petitionerName: originalRecord.petitioner_name || ''
      });
      setFile(null);
      setIsViewOnly(true);
      setError(null);
    } else if (currentRecord && isViewOnly) {
      // Back to list from view mode
      setEditing(false);
      setCurrentRecord(null);
      setOriginalRecord(null);
      setFile(null);
      setError(null);
      setIsViewOnly(false);
    } else {
      // Cancel adding new document
      setEditing(false);
      setCurrentRecord(null);
      setOriginalRecord(null);
      setFile(null);
      setError(null);
      setIsViewOnly(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const submitData = new FormData();
    submitData.append('empid', empid);
    submitData.append('documentName', formData.documentName);
    submitData.append('documentType', formData.documentType);
    submitData.append('subtype', formData.subtype);
    submitData.append('documentNumber', formData.documentNumber);
    submitData.append('immigrationStatus', formData.immigrationStatus);
    submitData.append('issueDate', formData.issueDate);
    submitData.append('expiryDate', formData.expiryDate);
    submitData.append('eligibleReviewDate', formData.eligibleReviewDate);
    submitData.append('comments', formData.comments);
    
    // New Fields
    submitData.append('beneficiaryEmpid', formData.beneficiaryEmpid);
    submitData.append('suborgid', formData.suborgid);
    submitData.append('petitionerName', formData.petitionerName);

    if (file) {
      submitData.append('file', file);
    }

    let result;
    if (currentRecord) {
      submitData.append('id', currentRecord.id);
      if (file) {
        submitData.append('oldDocumentPath', currentRecord.document_path);
      }
      result = await updateImmigrationData(submitData);
    } else {
      result = await addImmigrationData(submitData);
    }

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
    } else {
      setEditing(false);
      setCurrentRecord(null);
      setOriginalRecord(null);
      setFile(null);
      setIsSubmitting(false);
      setIsViewOnly(false);
      // Trigger update in parent component
      if (onUpdate) onUpdate();
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); 
    if (window.confirm('Are you sure you want to delete this record? This will also delete the attached file.')) {
      const result = await deleteImmigrationData(id);
      if (result.error) {
        setError(result.error);
      } else {
        // Trigger update in parent component
        if (onUpdate) onUpdate();
      }
    }
  };

  const handleAttachmentClick = (e) => {
    e.stopPropagation(); 
  };

  return (
    <div> 
      <div className={styles.employee_immigration_titleContainer}>
        <h3 className={styles.employee_immigration_title}>
          {editing ? (isViewOnly ? 'Immigration Details' : (currentRecord ? 'Edit Immigration Record' : 'Add Immigration Record')) : 'Immigration Details'}
        </h3>
        {!editing && (
          <button className={`${styles.employee_immigration_button} ${styles.employee_immigration_addButton}`} onClick={handleAddClick}>
            Add Record
          </button>
        )}
      </div>

      {error && <div className={styles.employee_immigration_errorMessage}>{error}</div>}

      {editing ? (
        <form onSubmit={handleSubmit} className={styles.employee_immigration_form}>
          
          {/* ROW 1: Employee Name & Beneficiary Name */}
          <div className={styles.employee_immigration_formRow}>
             <div className={styles.employee_immigration_formGroup}>
                <label className={styles.employee_immigration_formLabel}>Employee Name</label>
                <input 
                  type="text" 
                  value={employeeName} 
                  disabled 
                  className={styles.employee_immigration_formInput} 
                  style={{ backgroundColor: '#f0f0f0', color: '#666' }}
                />
             </div>
             {/* Beneficiary Name (Displays Employee Name, saves empid) */}
             <div className={styles.employee_immigration_formGroup}>
                <label className={styles.employee_immigration_formLabel}>Beneficiary Name</label>
                <input 
                  type="text" 
                  value={employeeName} 
                  disabled 
                  className={styles.employee_immigration_formInput} 
                  style={{ backgroundColor: '#f0f0f0', color: '#666' }}
                />
             </div>
          </div>

          {/* ROW 2: Company Name (Dropdown) & Petitioner Name */}
          <div className={styles.employee_immigration_formRow}>
            <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Company Name</label>
              <select
                name="suborgid"
                value={formData.suborgid}
                onChange={handleSuborgChange}
                className={styles.employee_immigration_formInput}
                disabled={isSubmitting || isViewOnly}
              >
                <option value="">Select Company</option>
                {/* 🔹 FILTERED SUBORGS: Only show the employee's assigned suborg */}
                {suborgs
                    ?.filter(sub => String(sub.suborgid) === String(employeeSuborgId))
                    .map(sub => (
                    <option key={sub.suborgid} value={sub.suborgid}>{sub.suborgname}</option>
                ))}
                <option value="other">Others</option>
              </select>
            </div>
            <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Petitioner Name</label>
              <input
                type="text"
                name="petitionerName"
                value={formData.petitionerName}
                onChange={handleInputChange}
                // Disabled if not "other"
                disabled={isSubmitting || isViewOnly || (formData.suborgid !== 'other' && formData.suborgid !== '')}
                className={styles.employee_immigration_formInput}
                style={ (formData.suborgid !== 'other' && formData.suborgid !== '') ? { backgroundColor: '#f0f0f0', color: '#666' } : {}}
              />
            </div>
          </div>

          <div className={styles.employee_immigration_formRow}>
             <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Document Name</label>
              <input 
                type="text" 
                name="documentName" 
                value={formData.documentName} 
                onChange={handleInputChange} 
                placeholder="e.g. H1B Approval Notice"
                className={styles.employee_immigration_formInput}
                disabled={isSubmitting || isViewOnly}
              />
            </div>
            <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Document Type*</label>
              <select 
                name="documentType" 
                value={formData.documentType} 
                onChange={handleInputChange} 
                required 
                className={styles.employee_immigration_formInput}
                disabled={isSubmitting || isViewOnly}
              >
                <option value="">Select Type</option>
                {documentTypes?.map(type => (
                  <option key={type.id} value={type.id}>{type.Name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.employee_immigration_formRow}>
            <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Document Subtype</label>
              <select 
                name="subtype" 
                value={formData.subtype} 
                onChange={handleInputChange} 
                className={styles.employee_immigration_formInput}
                disabled={isSubmitting || isViewOnly}
              >
                <option value="">Select Subtype</option>
                {documentSubtypes?.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.Name}</option>
                ))}
              </select>
            </div>
            <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Document/Receipt Number</label>
              <input 
                type="text" 
                name="documentNumber" 
                value={formData.documentNumber} 
                onChange={handleInputChange} 
                className={styles.employee_immigration_formInput}
                disabled={isSubmitting || isViewOnly}
              />
            </div>
          </div>

          <div className={styles.employee_immigration_formRow}>
            <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Immigration Status</label>
              <select 
                name="immigrationStatus" 
                value={formData.immigrationStatus} 
                onChange={handleInputChange} 
                className={styles.employee_immigration_formInput}
                disabled={isSubmitting || isViewOnly}
              >
                <option value="">Select Status</option>
                {immigrationStatuses?.map(status => (
                  <option key={status.id} value={status.id}>{status.Name}</option>
                ))}
              </select>
            </div>
            <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Issue Date</label>
              <input 
                type="date" 
                name="issueDate" 
                value={formData.issueDate} 
                onChange={handleInputChange} 
                className={styles.employee_immigration_formInput}
                disabled={isSubmitting || isViewOnly}
              />
            </div>
          </div>

          <div className={styles.employee_immigration_formRow}>
            <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Expiry Date</label>
              <input 
                type="date" 
                name="expiryDate" 
                value={formData.expiryDate} 
                onChange={handleInputChange} 
                className={styles.employee_immigration_formInput}
                disabled={isSubmitting || isViewOnly}
              />
            </div>
            <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Eligible Review Date</label>
              <input 
                type="date" 
                name="eligibleReviewDate" 
                value={formData.eligibleReviewDate} 
                onChange={handleInputChange} 
                className={styles.employee_immigration_formInput}
                disabled={isSubmitting || isViewOnly}
              />
            </div>
          </div>
          
          <div className={styles.employee_immigration_formRow}>
            <div className={styles.employee_immigration_formGroup}>
              <label className={styles.employee_immigration_formLabel}>Attachment (PDF/JPG/JPEG, max 1MB)</label>
              {currentRecord && currentRecord.document_path ? (
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                  Current: <a href={currentRecord.document_path} target="_blank" rel="noopener noreferrer" style={{color: '#0fd46c'}}>View File</a>
                </div>
              ) : null}
              
              {!isViewOnly && (
                <>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className={styles.employee_immigration_fileInput}
                    disabled={isSubmitting}
                  />
                  {file && <div style={{ fontSize: '12px', color: 'green', marginTop: '4px' }}>Selected: {file.name}</div>}
                  {file && currentRecord && (
                    <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                      ⚠️ Warning: Saving will permanently replace the original file.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={styles.employee_immigration_formRow}>
            <div className={`${styles.employee_immigration_formGroup} ${styles.employee_immigration_fullWidth}`}>
              <label className={styles.employee_immigration_formLabel}>Comments</label>
              <textarea 
                name="comments" 
                value={formData.comments} 
                onChange={handleInputChange} 
                className={styles.employee_immigration_textarea}
                rows="3"
                disabled={isSubmitting || isViewOnly}
              />
            </div>
          </div>

          <div className={styles.employee_immigration_formButtons}>
            {isViewOnly ? (
              <>
                <button 
                  type="button" 
                  className={`${styles.employee_immigration_button} ${styles.employee_immigration_editButton}`} 
                  onClick={handleEditMode}
                >
                  Edit
                </button>
                <button 
                  type="button" 
                  className={`${styles.employee_immigration_button} ${styles.employee_immigration_deleteButton}`} 
                  onClick={(e) => {
                    e.preventDefault();
                    if (window.confirm('Are you sure you want to delete this record? This will also delete the attached file.')) {
                      handleDelete(e, currentRecord.id);
                    }
                  }}
                >
                  Delete
                </button>
              </>
            ) : (
              <button 
                  type="submit" 
                  className={`${styles.employee_immigration_button} ${styles.employee_immigration_saveButton}`}
                  disabled={isSubmitting}
              >
                  {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            )}
            <button 
                type="button" 
                className={`${styles.employee_immigration_button} ${styles.employee_immigration_cancelButton}`} 
                onClick={handleCancel}
                disabled={isSubmitting}
            >
                {isViewOnly ? 'Back to List' : 'Cancel'}
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* SEARCH AND FILTERS */}
          <div className={styles.employee_immigration_searchFilterContainer}>
            <input 
              type="text" 
              placeholder="Search by Name, Number..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className={styles.employee_immigration_searchInput}
            />
            
            <select 
              value={filterType} 
              onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
              className={styles.employee_immigration_filterSelect}
            >
              <option value="all">All Types</option>
              {documentTypes?.map(t => (
                <option key={t.id} value={t.id}>{t.Name}</option>
              ))}
            </select>

            <select 
              value={filterSubtype} 
              onChange={(e) => { setFilterSubtype(e.target.value); setCurrentPage(1); }}
              className={styles.employee_immigration_filterSelect}
            >
              <option value="all">All Subtypes</option>
              {documentSubtypes?.map(st => (
                <option key={st.id} value={st.id}>{st.Name}</option>
              ))}
            </select>
          </div>

          {paginatedRecords.length === 0 ? (
            <p className={styles.employee_immigration_emptyState}>No immigration records found.</p>
          ) : (
            <>
              <div className={styles.employee_immigration_tableWrapper}>
                <table className={styles.employee_immigration_table}>
                  <thead>
                    <tr>
                      <th className={styles.employee_immigration_tableHeader}>Doc Name</th>
                      <th className={styles.employee_immigration_tableHeader}>Receipt #</th>
                      <th className={styles.employee_immigration_tableHeader}>Status</th>
                      <th className={styles.employee_immigration_tableHeader}>Attachment</th>
                      <th className={styles.employee_immigration_tableHeader}>Sync</th>
                      <th className={styles.employee_immigration_tableHeader}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((row, index) => (
                      <tr 
                        key={`${row.id}-${index}`} 
                        className={styles.employee_immigration_tableRow}
                        onClick={() => handleRowClick(row)}
                      >
                        <td className={styles.employee_immigration_tableCell}>{row.document_name || '-'}</td>
                        <td className={styles.employee_immigration_tableCell} style={{ fontFamily: 'monospace', color: '#0056b3' }}>
                           {row.document_number || '-'}
                        </td>
                        <td className={styles.employee_immigration_tableCell}>{row.status_name || getNameById(immigrationStatuses, row.immigration_status)}</td>
                        
                        <td className={styles.employee_immigration_tableCell}>
                          {row.document_path ? (
                            <a 
                              href={row.document_path} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={styles.employee_immigration_clickableCell}
                              onClick={handleAttachmentClick}
                            >
                              View
                            </a>
                          ) : 'No File'}
                        </td>

                        {/* Sync Button Column - Hidden if Status is Approved (582) */}
                        <td className={styles.employee_immigration_tableCell}>
                           {Number(row.immigration_status) === APPROVED_STATUS_ID ? (
                             <span style={{ color: 'green', fontSize: '12px', fontWeight: 'bold' }}>✓ Synced</span>
                           ) : (
                             <button 
                               onClick={(e) => handleSync(e, row.document_number)}
                               disabled={syncLoadingMap[row.document_number] || !row.document_number}
                               className={`${styles.employee_immigration_button}`}
                               style={{
                                 backgroundColor: syncLoadingMap[row.document_number] ? '#ccc' : '#007bff',
                                 color: 'white',
                                 fontSize: '11px',
                                 padding: '4px 8px',
                                 minWidth: '60px'
                               }}
                             >
                               {syncLoadingMap[row.document_number] ? '...' : 'Sync'}
                             </button>
                           )}
                        </td>

                        <td className={styles.employee_immigration_actionsCell}>
                          <button 
                            className={`${styles.employee_immigration_button} ${styles.employee_immigration_deleteButton}`} 
                            onClick={(e) => handleDelete(e, row.id)}
                          >
                            Delete
                          </button>
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
                  placeholder="Employees per page"
                  className={styles.employee_immigration_rowsPerPageInput}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Immigration;
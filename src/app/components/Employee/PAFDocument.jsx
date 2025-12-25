'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { addPafDocument, updatePafDocument, deletePafDocument } from '@/app/serverActions/Employee/EmployeePafDocument';
import styles from './document.module.css';

const PAFDocument = ({ id, documents: initialDocuments, onDocumentsUpdate, document_types, document_purposes, document_subtypes }) => {
  const [editing, setEditing] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newDocument, setNewDocument] = useState({
    documentName: '',
    documentType: '',
    subtype: '',
    documentPurpose: '',
    startdate: '',
    enddate: '',
    comments: '',
    file: null,
  });
  const [editDocument, setEditDocument] = useState(null);
  const [originalDocument, setOriginalDocument] = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [allDocuments, setAllDocuments] = useState(Array.isArray(initialDocuments) ? initialDocuments : []);
  const [sortConfig, setSortConfig] = useState({ column: 'document_name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [documentsPerPage, setDocumentsPerPage] = useState(5);
  const [documentsPerPageInput, setDocumentsPerPageInput] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSubtype, setFilterSubtype] = useState('all');
  const [filterPurpose, setFilterPurpose] = useState('all');

  const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

  // Helper to look up names from IDs
  const getNameById = (list, id) => {
    if (!id || !list) return id || 'N/A'; // Return ID if list missing, or N/A if ID missing
    // Handle cases where id might be a string or number
    const item = list.find(i => String(i.id) === String(id));
    return item ? item.Name : id;
  };

  const formatDate = (dateStr, formatType = 'input') => {
    if (!dateStr) {
      return formatType === 'display' ? 'N/A' : '';
    }
    let datePart;
    if (dateStr instanceof Date) {
      datePart = dateStr.toISOString().split('T')[0];
    } else if (typeof dateStr === 'string') {
      datePart = dateStr;
    } else {
      return formatType === 'display' ? 'N/A' : '';
    }
    const parts = datePart.split(/[-/]/);
    if (parts.length !== 3) {
      return formatType === 'display' ? 'N/A' : '';
    }
    let year, month, day;
    if (datePart.includes('-')) {
      [year, month, day] = parts;
    } else {
      [month, day, year] = parts;
    }
    if (formatType === 'display') {
      return `${month}/${day}/${year}`;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  useEffect(() => {
    setAllDocuments(Array.isArray(initialDocuments) ? initialDocuments : []);
  }, [initialDocuments]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const handleCancel = () => {
    if (editDocument && !isViewOnly) {
      setEditDocument({ ...originalDocument });
      setEditFile(null);
      setIsViewOnly(true);
      setError(null);
    } else if (editDocument && isViewOnly) {
      setEditing(false);
      setEditDocument(null);
      setOriginalDocument(null);
      setIsViewOnly(false);
      setEditFile(null);
      setError(null);
    } else {
      setNewDocument({
        documentName: '',
        documentType: '',
        subtype: '',
        documentPurpose: '',
        startdate: '',
        enddate: '',
        comments: '',
        file: null,
      });
      setEditing(false);
      setError(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError('File size cannot exceed 1 MB.');
        e.target.value = null;
        return;
      }
      setError(null);
      setNewDocument({ ...newDocument, file });
    }
  };

  const handleEditFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError('File size cannot exceed 1 MB.');
        e.target.value = null;
        return;
      }
      setError(null);
      setEditFile(file);
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!newDocument.file || !newDocument.documentType || !newDocument.subtype) {
      setError('Please fill required fields: Type, Subtype, and select a file.');
      return;
    }
    setIsSaving(true);
    const formData = new FormData();
    formData.append('empid', id);
    formData.append('documentName', newDocument.documentName);
    formData.append('documentType', newDocument.documentType);
    formData.append('subtype', newDocument.subtype);
    formData.append('documentPurpose', newDocument.documentPurpose);
    formData.append('startdate', newDocument.startdate ? `${newDocument.startdate} 00:00:00` : null);
    formData.append('enddate', newDocument.enddate ? `${newDocument.enddate} 00:00:00` : null);
    formData.append('comments', newDocument.comments);
    formData.append('file', newDocument.file);

    try {
      await addPafDocument(formData);
      setIsSaving(false);
      setNewDocument({ 
        documentName: '',
        documentType: '',
        subtype: '',
        documentPurpose: '',
        startdate: '',
        enddate: '',
        comments: '',
        file: null 
      });
      setEditing(false);
      if (onDocumentsUpdate) onDocumentsUpdate();
      setError(null);
    } catch (err) {
      setIsSaving(false);
      setError(`Failed to add PAF document: ${err.message}`);
    }
  };

  const handleUpdateDocument = async (e) => {
    e.preventDefault();
    if (!editDocument || !editDocument.subtype_id) return;
    setIsSaving(true);
    const formData = new FormData();
    formData.append('id', editDocument.id);
    formData.append('empid', id);
    formData.append('documentName', editDocument.document_name);
    formData.append('documentType', editDocument.document_type_id);
    formData.append('subtype', editDocument.subtype_id);
    formData.append('documentPurpose', editDocument.document_purpose_id);
    formData.append('startdate', editDocument.startdate ? `${formatDate(editDocument.startdate)} 00:00:00` : null);
    formData.append('enddate', editDocument.enddate ? `${formatDate(editDocument.enddate)} 00:00:00` : null);
    formData.append('comments', editDocument.comments);

    if (editFile) {
      formData.append('file', editFile);
      formData.append('oldDocumentPath', editDocument.document_path);
    }

    try {
      await updatePafDocument(formData);
      setIsSaving(false);
      setEditDocument(null);
      setOriginalDocument(null);
      setEditFile(null);
      setEditing(false);
      setIsViewOnly(false);
      if (onDocumentsUpdate) onDocumentsUpdate();
      setError(null);
    } catch (err) {
      setIsSaving(false);
      setError(`Failed to update PAF document: ${err.message}`);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this PAF document? This action cannot be undone.")) {
      return;
    }
    try {
      await deletePafDocument(docId);
      setEditing(false);
      setEditDocument(null);
      setOriginalDocument(null);
      setIsViewOnly(false);
      if (onDocumentsUpdate) onDocumentsUpdate();
      setError(null);
    } catch (err) {
      setError(`Failed to delete PAF document: ${err.message}`);
    }
  };

  const handleDocumentClick = (path) => {
    if (path) {
      window.open(path, '_blank', 'noopener,noreferrer');
    }
  };

  const sortDocuments = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'document_name':
        aValue = (a.document_name || '').toLowerCase();
        bValue = (b.document_name || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'document_type':
        // Sort by the Name found in the list, not the ID
        aValue = getNameById(document_types, a.document_type || a.document_type_id).toLowerCase();
        bValue = getNameById(document_types, b.document_type || b.document_type_id).toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'subtype':
        aValue = getNameById(document_subtypes, a.subtype || a.subtype_id).toLowerCase();
        bValue = getNameById(document_subtypes, b.subtype || b.subtype_id).toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'document_purpose':
        aValue = getNameById(document_purposes, a.document_purpose || a.document_purpose_id).toLowerCase();
        bValue = getNameById(document_purposes, b.document_purpose || b.document_purpose_id).toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'startdate':
        aValue = a.startdate ? new Date(formatDate(a.startdate)) : new Date(0);
        bValue = b.startdate ? new Date(formatDate(b.startdate)) : new Date(0);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'enddate':
        aValue = a.enddate ? new Date(formatDate(a.enddate)) : new Date(0);
        bValue = b.enddate ? new Date(formatDate(b.enddate)) : new Date(0);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      default:
        return 0;
    }
  };

  const requestSort = (column) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
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
      } else {
        setPageInputValue(currentPage.toString());
      }
    }
  };

  const handleDocumentsPerPageInputChange = (e) => {
    setDocumentsPerPageInput(e.target.value);
  };

  const handleDocumentsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setDocumentsPerPage(value);
        setCurrentPage(1);
      } else {
        setDocumentsPerPageInput(documentsPerPage.toString());
      }
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (e) => {
    setFilterType(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterSubtypeChange = (e) => {
    setFilterSubtype(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterPurposeChange = (e) => {
    setFilterPurpose(e.target.value);
    setCurrentPage(1);
  };

  const filteredDocuments = useMemo(() => {
    return (Array.isArray(allDocuments) ? allDocuments : []).filter((doc) => {
      // Use the ID from the document object directly for filtering
      const typeId = String(doc.document_type || doc.document_type_id);
      const subtypeId = String(doc.subtype || doc.subtype_id);
      const purposeId = String(doc.document_purpose || doc.document_purpose_id);

      const matchesSearch = doc.document_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || typeId === filterType;
      const matchesSubtype = filterSubtype === 'all' || subtypeId === filterSubtype;
      const matchesPurpose = filterPurpose === 'all' || purposeId === filterPurpose;
      
      return matchesSearch && matchesType && matchesSubtype && matchesPurpose;
    });
  }, [allDocuments, searchQuery, filterType, filterSubtype, filterPurpose]);

  const sortedDocuments = useMemo(() => {
    return [...filteredDocuments].sort((a, b) => sortDocuments(a, b, sortConfig.column, sortConfig.direction));
  }, [filteredDocuments, sortConfig]);

  const totalPages = Math.ceil(sortedDocuments.length / documentsPerPage);
  const indexOfLastDocument = currentPage * documentsPerPage;
  const indexOfFirstDocument = indexOfLastDocument - documentsPerPage;
  const currentDocuments = sortedDocuments.slice(indexOfFirstDocument, indexOfLastDocument);

  return (
    <div>
      <div className={styles.titleContainer}>
        <h3 className={styles.title}>
          {editing ? (isViewOnly ? 'PAF Document Details' : (editDocument ? 'Edit PAF Document' : 'Add New PAF Document')) : 'PAF Documents'}
        </h3>
        {!editing && (
          <button className={`${styles.button} ${styles.addButton}`} onClick={() => setEditing(true)}>
            Add PAF Document
          </button>
        )}
      </div>
      {error && <div className={styles.errorMessage}>{error}</div>}

      {editing ? (
        <form onSubmit={editDocument ? handleUpdateDocument : handleAddDocument} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Name</label>
              <input
                type="text"
                value={editDocument ? editDocument.document_name : newDocument.documentName}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, document_name: e.target.value })
                    : setNewDocument({ ...newDocument, documentName: e.target.value })
                }
                className={styles.formInput}
                disabled={isViewOnly}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Type*</label>
              <select
                value={editDocument ? String(editDocument.document_type_id) : newDocument.documentType}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, document_type_id: e.target.value })
                    : setNewDocument({ ...newDocument, documentType: e.target.value })
                }
                required
                className={styles.formInput}
                disabled={isViewOnly}
              >
                <option value="">Select Type</option>
                {document_types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Subtype*</label>
              <select
                value={editDocument ? String(editDocument.subtype_id) : newDocument.subtype}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, subtype_id: e.target.value })
                    : setNewDocument({ ...newDocument, subtype: e.target.value })
                }
                required
                className={styles.formInput}
                disabled={isViewOnly}
              >
                <option value="">Select Subtype</option>
                {document_subtypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.Name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Purpose</label>
              <select
                value={editDocument ? String(editDocument.document_purpose_id) : newDocument.documentPurpose}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, document_purpose_id: e.target.value })
                    : setNewDocument({ ...newDocument, documentPurpose: e.target.value })
                }
                className={styles.formInput}
                disabled={isViewOnly}
              >
                <option value="">Select Purpose</option>
                {document_purposes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Start Date</label>
              <input
                type="date"
                value={editDocument ? formatDate(editDocument.startdate) : newDocument.startdate}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, startdate: e.target.value })
                    : setNewDocument({ ...newDocument, startdate: e.target.value })
                }
                className={styles.formInput}
                disabled={isViewOnly}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>End Date</label>
              <input
                type="date"
                value={editDocument ? formatDate(editDocument.enddate) : newDocument.enddate}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, enddate: e.target.value })
                    : setNewDocument({ ...newDocument, enddate: e.target.value })
                }
                className={styles.formInput}
                disabled={isViewOnly}
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.formLabel}>Comments</label>
              <textarea
                value={editDocument ? (editDocument.comments || '') : newDocument.comments}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, comments: e.target.value })
                    : setNewDocument({ ...newDocument, comments: e.target.value })
                }
                className={styles.textarea}
                disabled={isViewOnly}
              />
            </div>
          </div>
          {editDocument && isViewOnly && (
            <>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Created By</label>
                  <input
                    type="text"
                    value={editDocument.created_by || 'N/A'}
                    disabled
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Created Date</label>
                  <input
                    type="text"
                    value={formatDate(editDocument.created_date, 'display')}
                    disabled
                    className={styles.formInput}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Last Updated By</label>
                  <input
                    type="text"
                    value={editDocument.updated_by || 'N/A'}
                    disabled
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Last Updated Date</label>
                  <input
                    type="text"
                    value={formatDate(editDocument.last_updated_date, 'display')}
                    disabled
                    className={styles.formInput}
                  />
                </div>
              </div>
            </>
          )}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>File</label>
              {editDocument ? (
                <div>
                  <div className={styles.fileName}>
                    Current:{' '}
                    <a
                      href={editDocument.document_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.attachmentLink}
                    >
                      {editDocument.document_path.split('/').pop()}
                    </a>
                  </div>
                  {!isViewOnly && (
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg"
                      onChange={handleEditFileChange}
                      className={styles.fileInput}
                    />
                  )}
                  {editFile && <div className={styles.fileName}>New: {editFile.name}</div>}
                  {editFile && (
                    <p className={styles.warningMessage}>
                      ⚠️ Warning: Saving will permanently replace the original file.
                    </p>
                  )}
                </div>
              ) : (
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg"
                  onChange={handleFileChange}
                  required
                  className={styles.fileInput}
                />
              )}
            </div>
          </div>
          <div className={styles.formButtons}>
            {isViewOnly ? (
              <>
                <button
                  type="button"
                  className={`${styles.button} ${styles.editButton}`}
                  onClick={() => setIsViewOnly(false)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.deleteButton}`}
                  onClick={() => handleDeleteDocument(editDocument.id)}
                >
                  Delete
                </button>
              </>
            ) : (
              <button type="submit" className={`${styles.button} ${styles.saveButton}`} disabled={isSaving}>
                {isSaving ? 'Saving...' : (editDocument ? 'Save' : 'Add Document')}
              </button>
            )}
            <button
              type="button"
              className={`${styles.button} ${styles.cancelButton}`}
              onClick={handleCancel}
            >
              {isViewOnly ? 'Back to List' : 'Cancel'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.searchFilterContainer}>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              className={styles.searchInput}
              placeholder="Search by name..."
            />
            <select value={filterType} onChange={handleFilterChange} className={styles.filterSelect}>
              <option value="all">All Types</option>
              {document_types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.Name}
                </option>
              ))}
            </select>
            <select value={filterSubtype} onChange={handleFilterSubtypeChange} className={styles.filterSelect}>
              <option value="all">All Subtypes</option>
              {document_subtypes.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.Name}
                </option>
              ))}
            </select>
            <select value={filterPurpose} onChange={handleFilterPurposeChange} className={styles.filterSelect}>
              <option value="all">All Purposes</option>
              {document_purposes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.Name}
                </option>
              ))}
            </select>
          </div>

          {filteredDocuments.length === 0 ? (
            <p className={styles.emptyState}>No PAF documents available.</p>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th
                        className={`${styles.tableHeader} ${styles.sortable} ${sortConfig.column === 'document_name' ? (sortConfig.direction === 'asc' ? styles.sortAsc : styles.sortDesc) : ''}`}
                        onClick={() => requestSort('document_name')}
                      >
                        Name
                      </th>
                      <th
                        className={`${styles.tableHeader} ${styles.sortable} ${sortConfig.column === 'document_type' ? (sortConfig.direction === 'asc' ? styles.sortAsc : styles.sortDesc) : ''}`}
                        onClick={() => requestSort('document_type')}
                      >
                        Type
                      </th>
                      <th
                        className={`${styles.tableHeader} ${styles.sortable} ${sortConfig.column === 'subtype' ? (sortConfig.direction === 'asc' ? styles.sortAsc : styles.sortDesc) : ''}`}
                        onClick={() => requestSort('subtype')}
                      >
                        Subtype
                      </th>
                      <th className={styles.tableHeader}>Attachment</th>
                      <th
                        className={`${styles.tableHeader} ${styles.sortable} ${sortConfig.column === 'document_purpose' ? (sortConfig.direction === 'asc' ? styles.sortAsc : styles.sortDesc) : ''}`}
                        onClick={() => requestSort('document_purpose')}
                      >
                        Purpose
                      </th>
                      <th
                        className={`${styles.tableHeader} ${styles.sortable} ${sortConfig.column === 'startdate' ? (sortConfig.direction === 'asc' ? styles.sortAsc : styles.sortDesc) : ''}`}
                        onClick={() => requestSort('startdate')}
                      >
                        Start Date
                      </th>
                      <th
                        className={`${styles.tableHeader} ${styles.sortable} ${sortConfig.column === 'enddate' ? (sortConfig.direction === 'asc' ? styles.sortAsc : styles.sortDesc) : ''}`}
                        onClick={() => requestSort('enddate')}
                      >
                        End Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDocuments.map((d) => (
                      <tr key={d.id} className={styles.tableRow} onClick={() => { 
                        setOriginalDocument({ ...d }); 
                        setEditDocument({ ...d }); 
                        setEditing(true); 
                        setIsViewOnly(true); 
                      }} style={{ cursor: 'pointer' }}>
                        <td className={styles.tableCell}>{d.document_name || 'N/A'}</td>
                        <td className={styles.tableCell}>
                          {getNameById(document_types, d.document_type || d.document_type_id)}
                        </td>
                        <td className={styles.tableCell}>
                          {getNameById(document_subtypes, d.subtype || d.subtype_id)}
                        </td>
                        <td
                          className={styles.tableCell}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDocumentClick(d.document_path);
                          }}
                        >
                          {d.document_path ? (
                            <a href={d.document_path} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              View Attachment
                            </a>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className={styles.tableCell}>
                          {getNameById(document_purposes, d.document_purpose || d.document_purpose_id)}
                        </td>
                        <td className={styles.tableCell}>{formatDate(d.startdate, 'display')}</td>
                        <td className={styles.tableCell}>{formatDate(d.enddate, 'display')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredDocuments.length > documentsPerPage && (
                <div className={styles.paginationContainer}>
                  <button className={styles.paginationButton} onClick={handlePrevPage} disabled={currentPage === 1}>
                    ← Previous
                  </button>
                  <span className={styles.paginationText}>
                    Page{' '}
                    <input
                      type="text"
                      value={pageInputValue}
                      onChange={handlePageInputChange}
                      onKeyPress={handlePageInputKeyPress}
                      className={styles.paginationInput}
                    />{' '}
                    of {totalPages}
                  </span>
                  <button className={styles.paginationButton} onClick={handleNextPage} disabled={currentPage === totalPages}>
                    Next →
                  </button>
                </div>
              )}

              {filteredDocuments.length > 0 && (
                <div className={styles.rowsPerPageContainer}>
                  <label className={styles.rowsPerPageLabel}>Rows/ Page</label>
                  <input
                    type="text"
                    value={documentsPerPageInput}
                    onChange={handleDocumentsPerPageInputChange}
                    onKeyPress={handleDocumentsPerPageInputKeyPress}
                    className={styles.rowsPerPageInput}
                    aria-label="Number of rows per page"
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default PAFDocument;
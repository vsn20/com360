'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { addSubOrgDocument, updateSubOrgDocument, deleteSubOrgDocument } from '@/app/serverActions/Organizations/documents';
import styles from './suborgdocument.module.css';

const SubOrgDocument = ({ suborgid, documents: initialDocuments, onDocumentsUpdate, documenttypes }) => {
  // View States: 'list', 'add', 'detail'
  const [viewState, setViewState] = useState('list');
  const [editingDetail, setEditingDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [error, setError] = useState(null);
  const [allDocuments, setAllDocuments] = useState(Array.isArray(initialDocuments) ? initialDocuments : []);
  
  // Selection State
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  // Form States
  const [form, setForm] = useState({
    id: '',
    documentName: '',
    documentType: '',
    documentPurpose: '',
    file: null,
    existingPath: ''
  });

  // Filter/Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortConfig, setSortConfig] = useState({ column: 'document_name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [documentsPerPage] = useState(5);

  const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

  // Helper to get document type name from ID
  const getTypeName = (typeId) => {
    if (!typeId || !documenttypes) return 'N/A';
    const type = documenttypes.find(t => String(t.id) === String(typeId));
    return type ? type.Name : typeId;
  };

  // Helper to check if document type is locked (W-9 with isDefault=true)
  const isDocumentLocked = (typeId) => {
    if (!typeId || !documenttypes) return false;
    const type = documenttypes.find(t => String(t.id) === String(typeId));
    return type?.isDefault === true;
  };

  useEffect(() => {
    setAllDocuments(Array.isArray(initialDocuments) ? initialDocuments : []);
  }, [initialDocuments]);

  // --- Handlers ---

  const handleBackClick = () => {
    setViewState('list');
    setSelectedDoc(null);
    setEditingDetail(false);
    setError(null);
    setForm({
      id: '',
      documentName: '',
      documentType: '',
      documentPurpose: '',
      file: null,
      existingPath: ''
    });
  };

  const handleAddClick = () => {
    setViewState('add');
    setEditingDetail(false);
    setError(null);
    setForm({
      id: '',
      documentName: '',
      documentType: '',
      documentPurpose: '',
      file: null,
      existingPath: ''
    });
  };

  const handleRowClick = (doc) => {
    setSelectedDoc(doc);
    setViewState('detail');
    setEditingDetail(false);
    setError(null);
    // Pre-populate form in case user clicks edit immediately
    setForm({
      id: doc.id,
      documentName: doc.document_name || '',
      documentType: doc.document_type || '',
      documentPurpose: doc.document_purpose || '',
      existingPath: doc.document_path || '',
      file: null
    });
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
      setForm(prev => ({ ...prev, file }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Cancel handler to reset form data to original values
  const handleCancelDetail = () => {
    setEditingDetail(false);
    if (selectedDoc) {
      setForm({
        id: selectedDoc.id,
        documentName: selectedDoc.document_name || '',
        documentType: selectedDoc.document_type || '',
        documentPurpose: selectedDoc.document_purpose || '',
        existingPath: selectedDoc.document_path || '',
        file: null
      });
    }
    setError(null);
  };

  const handleFileLinkClick = (e, path) => {
    e.stopPropagation();
    if (path) window.open(path, '_blank');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append('suborgid', suborgid);
    formData.append('documentName', form.documentName || (form.file ? form.file.name.replace(/\.[^/.]+$/, '') : ''));
    formData.append('documentType', form.documentType);
    formData.append('documentPurpose', form.documentPurpose);

    try {
      if (viewState === 'add') {
        if (!form.file) {
          setError('Please select a file to upload.');
          return;
        }
        if (!form.documentType) {
          setError('Please select a document type.');
          return;
        }
        formData.append('file', form.file);
        
        await addSubOrgDocument(formData);
        if (onDocumentsUpdate) onDocumentsUpdate();
        handleBackClick(); // Return to list
      } 
      else if (viewState === 'detail' && editingDetail) {
        formData.append('id', form.id);
        if (form.file) {
          formData.append('file', form.file);
          formData.append('oldDocumentPath', form.existingPath);
        }
        
        await updateSubOrgDocument(formData);
        if (onDocumentsUpdate) onDocumentsUpdate();
        
        // Update local state to reflect changes immediately
        const updatedDoc = {
            ...selectedDoc,
            document_name: form.documentName,
            document_type: form.documentType,
            document_purpose: form.documentPurpose,
            // Note: path updates might require a refresh or refetch return from server action
        };
        setSelectedDoc(updatedDoc);
        setEditingDetail(false);
        setIsLoading(false);
      }
    } catch (err) {
      setError(`Failed to save document: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleDelete = async (e, docId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteSubOrgDocument(docId);
      if (onDocumentsUpdate) onDocumentsUpdate();
      if (viewState === 'detail') handleBackClick();
    } catch (err) {
      setError(`Failed to delete: ${err.message}`);
    }
  };

  // --- Sorting & Filtering ---
  const filteredDocuments = useMemo(() => {
    return allDocuments.filter((doc) => {
      const docName = doc.document_name || '';
      const matchesSearch = docName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || doc.document_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [allDocuments, searchQuery, filterType]);

  const sortedDocuments = useMemo(() => {
    const { column, direction } = sortConfig;
    return [...filteredDocuments].sort((a, b) => {
      let aVal = a[column] || '';
      let bVal = b[column] || '';
      if (column === 'last_updated_date') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [filteredDocuments, sortConfig]);

  const currentDocuments = sortedDocuments.slice((currentPage - 1) * documentsPerPage, currentPage * documentsPerPage);

  const requestSort = (column) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getFileName = (path) => path ? path.split('/').pop() : '';

  // --- Render Views ---

  // 1. ADD DOCUMENT VIEW
  if (viewState === 'add') {
    return (
      <div className={styles.container}>
        <div className={styles.headerSection}>
          <h2 className={styles.title}>Add Document</h2>
          <button className={styles.backButton} onClick={handleBackClick}></button>
        </div>
        {error && <div className={styles.errorMessage}>{error}</div>}
        
        <form onSubmit={handleSubmit} className={styles.detailsBlock}>
          <h3>Basic Details</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Name*</label>
              <input
                type="text"
                name="documentName"
                value={form.documentName}
                onChange={handleInputChange}
                className={styles.formInput}
                placeholder="Enter Document Name"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Type*</label>
              <select
                name="documentType"
                value={form.documentType}
                onChange={handleInputChange}
                className={styles.formInput}
                required
              >
                <option value="">Select Type</option>
                {documenttypes && documenttypes.map((type) => (
                  <option key={type.id} value={type.Name}>{type.Name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Purpose*</label>
              <input
                type="text"
                name="documentPurpose"
                value={form.documentPurpose}
                onChange={handleInputChange}
                className={styles.formInput}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>File*</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg"
                onChange={handleFileChange}
                className={styles.formInput}
                required
              />
            </div>
          </div>
          <div className={styles.formButtons}>
            {isLoading && <p style={{ color: '#007bff', marginBottom: '10px' }}>Adding document, please wait...</p>}
            <button type="submit" className={styles.saveButton} disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Document'}
            </button>
            <button type="button" className={styles.cancelButton} onClick={handleBackClick} disabled={isLoading}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  // 2. DETAIL / EDIT VIEW
  if (viewState === 'detail' && selectedDoc) {
    return (
      <div className={styles.container}>
        <div className={styles.headerSection}>
          <h2 className={styles.title}>Document Details</h2>
          <button className={styles.backButton} onClick={handleBackClick}></button>
        </div>
        {error && <div className={styles.errorMessage}>{error}</div>}

        <div className={styles.detailsBlock}>
          <h3>Basic Details</h3>
          
          {editingDetail ? (
            // --- EDIT FORM ---
            <form onSubmit={handleSubmit}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Name</label>
                  <input
                    type="text"
                    name="documentName"
                    value={form.documentName}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Type</label>
                  <select
                    name="documentType"
                    value={form.documentType}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    required
                  >
                    <option value="">Select Type</option>
                    {documenttypes && documenttypes.map((type) => (
                      <option key={type.id} value={type.Name}>{type.Name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Purpose</label>
                  <input
                    type="text"
                    name="documentPurpose"
                    value={form.documentPurpose}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>File</label>
                  <div className={styles.fileName}>
                     Current: {getFileName(form.existingPath)}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className={styles.formInput}
                  />
                  {form.file && <div className={styles.fileName} style={{color: 'orange'}}>New file selected (will replace current)</div>}
                </div>
              </div>
              <div className={styles.formButtons}>
                {isLoading && <p style={{ color: '#007bff', marginBottom: '10px' }}>Saving changes, please wait...</p>}
                <button type="submit" className={styles.saveButton} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className={styles.cancelButton} onClick={handleCancelDetail} disabled={isLoading}>Cancel</button>
              </div>
            </form>
          ) : (
            // --- READ ONLY VIEW ---
            <div className={styles.detailsView}>
               <div className={styles.detailsButtons}>
                  <button className={styles.button} onClick={() => setEditingDetail(true)}>Edit</button>
               </div>
               
               <div className={styles.detailsRow}>
                 <div className={styles.detailsGroup}>
                   <label>Name</label>
                   <p>{selectedDoc.document_name}</p>
                 </div>
                 <div className={styles.detailsGroup}>
                   <label>Type</label>
                   <p>{getTypeName(selectedDoc.document_type)}</p>
                 </div>
               </div>
               <div className={styles.detailsRow}>
                 <div className={styles.detailsGroup}>
                   <label>Purpose</label>
                   <p>{selectedDoc.document_purpose}</p>
                 </div>
                 <div className={styles.detailsGroup}>
                   <label>File</label>
                   <p>
                     <span 
                        className={styles.clickableLink}
                        onClick={(e) => handleFileLinkClick(e, selectedDoc.document_path)}
                     >
                       {getFileName(selectedDoc.document_path)}
                     </span>
                   </p>
                 </div>
               </div>
               <div className={styles.detailsRow}>
                 <div className={styles.detailsGroup}>
                   <label>Created By</label>
                   <p>{selectedDoc.created_by || '-'}</p>
                 </div>
                 <div className={styles.detailsGroup}>
                   <label>Last Updated</label>
                   <p>{selectedDoc.last_updated_date || '-'}</p>
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. LIST VIEW (Default)
  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <h3 className={styles.title}>Sub-Organization Documents</h3>
        <button className={styles.button} onClick={handleAddClick}>
          Add Document
        </button>
      </div>

      <div className={styles.searchFilterContainer}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
          placeholder="Search by name..."
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={styles.filterSelect}>
          <option value="all">All Types</option>
          {documenttypes && documenttypes.map((type) => (
            <option key={type.id} value={type.Name}>{type.Name}</option>
          ))}
        </select>
      </div>

      {filteredDocuments.length === 0 ? (
        <p className={styles.emptyState}>No documents available.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.tableHeader} onClick={() => requestSort('document_name')}>Name</th>
                <th className={styles.tableHeader}>Attachment</th>
                <th className={styles.tableHeader} onClick={() => requestSort('document_type')}>Type</th>
                {/* <th className={styles.tableHeader} onClick={() => requestSort('last_updated_date')}>Last Updated</th> */}
                <th className={styles.tableHeader}>Purpose</th>
                <th className={styles.tableHeader}>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentDocuments.map((d) => {
                const isLocked = isDocumentLocked(d.document_type);
                return (
                <tr 
                  key={d.id} 
                  className={`${styles.tableRow} ${isLocked ? styles.lockedRow : ''}`} 
                  onClick={() => handleRowClick(d)}
                >
                  <td className={styles.tableCell}>{d.document_name || 'N/A'}</td>
                  <td className={styles.tableCell}>
                    {d.document_path ? (
                      <span 
                        className={styles.clickableLink}
                        onClick={(e) => handleFileLinkClick(e, d.document_path)}
                      >
                        View Attachment
                      </span>
                    ) : 'No File'}
                  </td>
                  <td className={styles.tableCell}>
                    {getTypeName(d.document_type)}
                    {isLocked && <span className={styles.defaultBadge} title="Auto-generated from W-9 form">Auto</span>}
                  </td>
                  {/* <td className={styles.tableCell}>{d.last_updated_date || 'N/A'}</td> */}
                  <td className={styles.tableCell}>{d.document_purpose || 'N/A'}</td>
                  <td className={styles.tableCell}>
                     {!isLocked && (
                       <button className={styles.deleteButton} onClick={(e) => handleDelete(e, d.id)}>Delete</button>
                     )}
                     {isLocked && (
                       <span className={styles.lockedText} title="Cannot delete auto-generated documents">Locked</span>
                     )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SubOrgDocument;
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { addSubOrgDocument, updateSubOrgDocument, deleteSubOrgDocument } from '@/app/serverActions/Organizations/documents';
import styles from './suborgdocument.module.css'; // Reusing the employee document styles

const SubOrgDocument = ({ suborgid, documents: initialDocuments, onDocumentsUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [newDocument, setNewDocument] = useState({
    documentName: '',
    documentType: '',
    documentPurpose: '',
    file: null,
  });
  const [editDocument, setEditDocument] = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [allDocuments, setAllDocuments] = useState(Array.isArray(initialDocuments) ? initialDocuments : []);
  const [sortConfig, setSortConfig] = useState({ column: 'document_name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [documentsPerPage, setDocumentsPerPage] = useState(5);
  const [documentsPerPageInput, setDocumentsPerPageInput] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

  useEffect(() => {
    setAllDocuments(Array.isArray(initialDocuments) ? initialDocuments : []);
  }, [initialDocuments]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError('File size cannot exceed 1 MB.');
        e.target.value = null;
        return;
      }
      setError(null);
      const extension = file.name.split('.').pop().toLowerCase();
      const type = extension === 'pdf' ? 'pdf' : ['jpg', 'jpeg'].includes(extension) ? extension : 'unknown';
      setNewDocument({ ...newDocument, file, documentType: type });
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
      const extension = file.name.split('.').pop().toLowerCase();
      const type = extension === 'pdf' ? 'pdf' : ['jpg', 'jpeg'].includes(extension) ? extension : 'unknown';
      setEditDocument({ ...editDocument, document_type: type });
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!newDocument.file) {
      setError('Please select a file to upload.');
      return;
    }
    const formData = new FormData();
    formData.append('suborgid', suborgid);
    formData.append('documentName', newDocument.documentName || newDocument.file.name.replace(/\.[^/.]+$/, ''));
    formData.append('documentPurpose', newDocument.documentPurpose);
    formData.append('file', newDocument.file);

    try {
      await addSubOrgDocument(formData);
      setNewDocument({ documentName: '', documentType: '', documentPurpose: '', file: null });
      setEditing(false);
      if (onDocumentsUpdate) onDocumentsUpdate();
      setError(null);
    } catch (err) {
      setError(`Failed to add document: ${err.message}`);
    }
  };

  const handleUpdateDocument = async (e) => {
    e.preventDefault();
    if (!editDocument) return;
    const formData = new FormData();
    formData.append('id', editDocument.id);
    formData.append('suborgid', suborgid);
    formData.append('documentName', editDocument.document_name);
    formData.append('documentPurpose', editDocument.document_purpose);

    if (editFile) {
      formData.append('file', editFile);
      formData.append('oldDocumentPath', editDocument.document_path);
    }

    try {
      await updateSubOrgDocument(formData);
      setEditDocument(null);
      setEditFile(null);
      setEditing(false);
      if (onDocumentsUpdate) onDocumentsUpdate();
      setError(null);
    } catch (err) {
      setError(`Failed to update document: ${err.message}`);
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await deleteSubOrgDocument(docId);
      if (onDocumentsUpdate) onDocumentsUpdate();
      setError(null);
    } catch (err) {
      setError(`Failed to delete document: ${err.message}`);
    }
  };

  const handleDocumentClick = (path) => {
    if (path) {
      window.open(path, '_blank');
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
        aValue = (a.document_type || '').toLowerCase();
        bValue = (b.document_type || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'last_updated_date':
        aValue = a.last_updated_date ? new Date(a.last_updated_date) : new Date(0);
        bValue = b.last_updated_date ? new Date(b.last_updated_date) : new Date(0);
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

  const filteredDocuments = useMemo(() => {
    return (Array.isArray(allDocuments) ? allDocuments : []).filter((doc) => {
      const docName = doc.document_name || '';
      const matchesSearch = docName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || doc.document_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [allDocuments, searchQuery, filterType]);

  const sortedDocuments = useMemo(() => {
    return [...filteredDocuments].sort((a, b) => sortDocuments(a, b, sortConfig.column, sortConfig.direction));
  }, [filteredDocuments, sortConfig]);
  
  const totalPages = Math.ceil(sortedDocuments.length / documentsPerPage);
  const currentDocuments = sortedDocuments.slice((currentPage - 1) * documentsPerPage, currentPage * documentsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h3 className={styles.title}>Sub-Organization Documents</h3>
        {!editing && (
          <button className={`${styles.button} ${styles.addButton}`} onClick={() => setEditing(true)}>
            Add Document
          </button>
        )}
      </div>
      {error && <div className={styles.errorMessage}>{error}</div>}

      {editing ? (
        <form onSubmit={editDocument ? handleUpdateDocument : handleAddDocument} className={styles.form}>
           <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Name*</label>
              <input
                type="text"
                value={editDocument ? editDocument.document_name : newDocument.documentName}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, document_name: e.target.value })
                    : setNewDocument({ ...newDocument, documentName: e.target.value })
                }
                required
                className={styles.formInput}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Type*</label>
              <input
                type="text"
                value={editDocument ? editDocument.document_type : newDocument.documentType}
                disabled
                className={`${styles.formInput} ${styles.formInput}:disabled`}
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Purpose*</label>
              <input
                type="text"
                value={editDocument ? editDocument.document_purpose : newDocument.documentPurpose}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, document_purpose: e.target.value })
                    : setNewDocument({ ...newDocument, documentPurpose: e.target.value })
                }
                required
                className={styles.formInput}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>File</label>
              {editDocument ? (
                <div>
                  <div className={styles.fileName}>
                    Current: {editDocument.document_path.split('/').pop()}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg"
                    onChange={handleEditFileChange}
                    className={styles.fileInput}
                  />
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
            <button type="submit" className={`${styles.button} ${styles.saveButton}`}>
              {editDocument ? 'Save' : 'Add Document'}
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.cancelButton}`}
              onClick={() => {
                setEditing(false);
                setEditDocument(null);
                setEditFile(null);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
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
              <option value="pdf">PDF</option>
              <option value="jpg">JPG</option>
              <option value="jpeg">JPEG</option>
              <option value="unknown">Unknown</option>
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
                      <th className={styles.tableHeader} onClick={() => requestSort('document_type')}>Type</th>
                      <th className={styles.tableHeader} onClick={() => requestSort('last_updated_date')}>Last Updated</th>
                      <th className={styles.tableHeader}>Purpose</th>
                      <th className={styles.tableHeader}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDocuments.map((d) => (
                      <tr key={d.id} className={styles.tableRow}>
                        <td className={`${styles.tableCell} ${styles.clickableCell}`} onClick={() => handleDocumentClick(d.document_path)}>
                          {d.document_name || 'N/A'}
                        </td>
                        <td className={styles.tableCell}>{d.document_type || 'N/A'}</td>
                        <td className={styles.tableCell}>{d.last_updated_date || 'N/A'}</td>
                        <td className={styles.tableCell}>{d.document_purpose || 'N/A'}</td>
                        <td className={`${styles.tableCell} ${styles.actionsCell}`}>
                          <button
                            className={styles.editButton}
                            onClick={() => {
                              setEditing(true);
                              setEditDocument({ ...d });
                            }}
                          >
                            Edit
                          </button>
                          <button className={styles.deleteButton} onClick={() => handleDeleteDocument(d.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          )}
        </>
      )}
    </div>
  );
};

export default SubOrgDocument;


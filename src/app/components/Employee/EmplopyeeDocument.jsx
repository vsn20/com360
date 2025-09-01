'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { addDocument, updateDocument, deleteDocument } from '@/app/serverActions/Employee/employeedocuments';
import styles from './document.module.css';

const EmplopyeeDocument = ({ id, documents: initialDocuments, onDocumentsUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [newDocument, setNewDocument] = useState({
    documentName: '',
    documentType: '',
    documentPurpose: '',
    file: null,
  });
  const [editDocument, setEditDocument] = useState(null);
  const [allDocuments, setAllDocuments] = useState(Array.isArray(initialDocuments) ? initialDocuments : []);
  const [sortConfig, setSortConfig] = useState({ column: 'document_name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [documentsPerPage, setDocumentsPerPage] = useState(5);
  const [documentsPerPageInput, setDocumentsPerPageInput] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    setAllDocuments(Array.isArray(initialDocuments) ? initialDocuments : []);
  }, [initialDocuments]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const extension = file.name.split('.').pop().toLowerCase();
      const type = extension === 'pdf' ? 'pdf' : extension === 'jpg' ? 'jpg' : extension === 'jpeg' ? 'jpeg' : 'unknown';
      const filename = `${id}_${newDocument.documentName || file.name.replace(/\.[^/.]+$/, '')}.${extension}`;
      setNewDocument({
        ...newDocument,
        file,
        documentType: type,
        documentPath: `public/uploads/documents/${filename}`,
      });
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!newDocument.file) {
      setError('Please select a file to upload.');
      return;
    }
    const formData = new FormData();
    formData.append('empid', id);
    formData.append('documentName', newDocument.documentName || newDocument.file.name.replace(/\.[^/.]+$/, ''));
    formData.append('documentType', newDocument.documentType);
    formData.append('documentPurpose', newDocument.documentPurpose);
    formData.append('file', newDocument.file);

    try {
      const result = await addDocument(formData);
      setNewDocument({ documentName: '', documentType: '', documentPurpose: '', file: null });
      setEditing(false); // Redirect back to list view
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
    formData.append('empid', id);
    formData.append('documentName', editDocument.document_name);
    formData.append('documentPurpose', editDocument.document_purpose);

    try {
      await updateDocument(formData);
      setEditDocument(null);
      setEditing(false);
      if (onDocumentsUpdate) onDocumentsUpdate();
      setError(null);
    } catch (err) {
      setError(`Failed to update document: ${err.message}`);
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await deleteDocument(docId);
      if (onDocumentsUpdate) onDocumentsUpdate();
      setError(null);
    } catch (err) {
      setError(`Failed to delete document: ${err.message}`);
    }
  };

  const handleDocumentClick = (path) => {
    if (path && path.toLowerCase().endsWith('.pdf')) {
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

  const handleDocumentsPerPageInputChange = (e) => {
    setDocumentsPerPageInput(e.target.value);
  };

  const handleDocumentsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setDocumentsPerPage(value);
        setDocumentsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setDocumentsPerPageInput(documentsPerPage.toString());
      }
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleFilterChange = (e) => {
    setFilterType(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const filteredDocuments = useMemo(() => {
    return (Array.isArray(allDocuments) ? allDocuments : []).filter((doc) => {
      const matchesSearch = doc.document_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || doc.document_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [allDocuments, searchQuery, filterType]);

  const sortedDocuments = useMemo(() => {
    return [...filteredDocuments].sort((a, b) => sortDocuments(a, b, sortConfig.column, sortConfig.direction));
  }, [filteredDocuments, sortConfig]);

  const totalPages = Math.ceil(sortedDocuments.length / documentsPerPage);
  const indexOfLastDocument = currentPage * documentsPerPage;
  const indexOfFirstDocument = indexOfLastDocument - documentsPerPage;
  const currentDocuments = sortedDocuments.slice(indexOfFirstDocument, indexOfLastDocument);

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h3 className={styles.title}>Employee Documents</h3>
        {!editing && (
          <button
            className={`${styles.button} ${styles.addButton}`}
            onClick={() => setEditing(true)}
          >
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
              {editDocument && editDocument.document_path ? (
                <div className={styles.fileName}>{editDocument.document_path.split('/').pop()}</div>
              ) : (
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg"
                  onChange={handleFileChange}
                  disabled={!!editDocument}
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
              onChange={handleSearchChange}
              className={styles.searchInput}
              placeholder="Search by name..."
            />
            <select
              value={filterType}
              onChange={handleFilterChange}
              className={styles.filterSelect}
            >
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
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th
                        className={`${styles.tableHeader} ${styles.sortable} ${
                          sortConfig.column === 'document_name' 
                            ? sortConfig.direction === 'asc' ? styles.sortAsc : styles.sortDesc
                            : ''
                        }`}
                        onClick={() => requestSort('document_name')}
                      >
                        Name
                      </th>
                      <th
                        className={`${styles.tableHeader} ${styles.sortable} ${
                          sortConfig.column === 'document_type' 
                            ? sortConfig.direction === 'asc' ? styles.sortAsc : styles.sortDesc
                            : ''
                        }`}
                        onClick={() => requestSort('document_type')}
                      >
                        Type
                      </th>
                      <th
                        className={`${styles.tableHeader} ${styles.sortable} ${
                          sortConfig.column === 'last_updated_date' 
                            ? sortConfig.direction === 'asc' ? styles.sortAsc : styles.sortDesc
                            : ''
                        }`}
                        onClick={() => requestSort('last_updated_date')}
                      >
                        Last Updated
                      </th>
                      <th className={styles.tableHeader}>Purpose</th>
                      <th className={styles.tableHeader}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDocuments.map((d) => (
                      <tr key={d.id} className={styles.tableRow}>
                        <td
                          className={`${styles.tableCell} ${
                            d.document_path && d.document_path.toLowerCase().endsWith('.pdf') 
                              ? styles.clickableCell 
                              : ''
                          }`}
                          onClick={() => handleDocumentClick(d.document_path)}
                        >
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
                          <button
                            className={styles.deleteButton}
                            onClick={() => handleDeleteDocument(d.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredDocuments.length > documentsPerPage && (
                <div className={styles.paginationContainer}>
                  <button
                    className={styles.paginationButton}
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
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
                  <button
                    className={styles.paginationButton}
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
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

export default EmplopyeeDocument;
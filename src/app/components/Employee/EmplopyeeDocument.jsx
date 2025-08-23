'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { addDocument, updateDocument, deleteDocument } from '@/app/serverActions/Employee/employeedocuments';

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
  const [openDropdownId, setOpenDropdownId] = useState(null); // Track open dropdown
  const dropdownRef = useRef(null); // Ref for handling outside clicks

  useEffect(() => {
    setAllDocuments(Array.isArray(initialDocuments) ? initialDocuments : []);
  }, [initialDocuments]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      setOpenDropdownId(null); // Close dropdown after delete
    } catch (err) {
      setError(`Failed to delete document: ${err.message}`);
    }
  };

  const handleDocumentClick = (path) => {
    if (path && path.toLowerCase().endsWith('.pdf')) {
      window.open(path, '_blank');
    }
  };

  const toggleDropdown = (docId) => {
    setOpenDropdownId((prev) => (prev === docId ? null : docId));
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
    <div className="relative">
      <h2>Employee Documents</h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {editing ? (
        <form onSubmit={editDocument ? handleUpdateDocument : handleAddDocument} className="space-y-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium">Name*</label>
              <input
                type="text"
                value={editDocument ? editDocument.document_name : newDocument.documentName}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, document_name: e.target.value })
                    : setNewDocument({ ...newDocument, documentName: e.target.value })
                }
                required
                className="w-full border rounded p-2"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium">Type*</label>
              <input
                type="text"
                value={editDocument ? editDocument.document_type : newDocument.documentType}
                disabled
                className="w-full border rounded p-2 bg-gray-100"
              />
            </div>
          </div>
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium">Purpose*</label>
              <input
                type="text"
                value={editDocument ? editDocument.document_purpose : newDocument.documentPurpose}
                onChange={(e) =>
                  editDocument
                    ? setEditDocument({ ...editDocument, document_purpose: e.target.value })
                    : setNewDocument({ ...newDocument, documentPurpose: e.target.value })
                }
                required
                className="w-full border rounded p-2"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium">File</label>
              {editDocument && editDocument.document_path ? (
                <div className="text-sm">{editDocument.document_path.split('/').pop()}</div>
              ) : (
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg"
                  onChange={handleFileChange}
                  disabled={!!editDocument}
                  className="w-full border rounded p-2"
                />
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              {editDocument ? 'Save' : 'Add Document'}
            </button>
            <button
              type="button"
              className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400"
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
          <div className="flex space-x-4 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              className="border rounded p-2 flex-1"
              placeholder="Search by name..."
            />
            <select
              value={filterType}
              onChange={handleFilterChange}
              className="border rounded p-2"
            >
              <option value="all">All Types</option>
              <option value="pdf">PDF</option>
              <option value="jpg">JPG</option>
              <option value="jpeg">JPEG</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          {filteredDocuments.length === 0 ? (
            <p>No documents available.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th
                        className={`p-2 text-left cursor-pointer ${sortConfig.column === 'document_name' ? `sort-${sortConfig.direction}` : ''}`}
                        onClick={() => requestSort('document_name')}
                      >
                        Name
                      </th>
                      <th
                        className={`p-2 text-left cursor-pointer ${sortConfig.column === 'document_type' ? `sort-${sortConfig.direction}` : ''}`}
                        onClick={() => requestSort('document_type')}
                      >
                        Type
                      </th>
                      <th
                        className={`p-2 text-left cursor-pointer ${sortConfig.column === 'last_updated_date' ? `sort-${sortConfig.direction}` : ''}`}
                        onClick={() => requestSort('last_updated_date')}
                      >
                        Last Updated
                      </th>
                      <th className="p-2 text-left">Purpose</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDocuments.map((d) => (
                      <tr key={d.id} className="border-b">
                        <td
                          className="p-2"
                          style={{ cursor: d.document_path && d.document_path.toLowerCase().endsWith('.pdf') ? 'pointer' : 'default' }}
                          onClick={() => handleDocumentClick(d.document_path)}
                        >
                          {d.document_name || 'N/A'}
                        </td>
                        <td className="p-2">{d.document_type || 'N/A'}</td>
                        <td className="p-2">{d.last_updated_date || 'N/A'}</td>
                        <td className="p-2">{d.document_purpose || 'N/A'}</td>
                        <td className="p-2 relative">
                          <button
                            className="text-gray-600 hover:text-gray-800"
                            onClick={() => toggleDropdown(d.id)}
                            aria-label="More options"
                          >
                            ⋮
                          </button>
                          {openDropdownId === d.id && (
                            <div
                              ref={dropdownRef}
                              className="absolute right-0 mt-2 w-32 bg-white border rounded shadow-lg z-10"
                            >
                              <button
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={() => {
                                  setEditing(true);
                                  setEditDocument({ ...d });
                                  setOpenDropdownId(null);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                onClick={() => handleDeleteDocument(d.id)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredDocuments.length > documentsPerPage && (
                <div className="flex items-center space-x-4 mt-4">
                  <button
                    className="bg-gray-300 text-black px-4 py-2 rounded disabled:opacity-50"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  <span>
                    Page{' '}
                    <input
                      type="text"
                      value={pageInputValue}
                      onChange={handlePageInputChange}
                      onKeyPress={handlePageInputKeyPress}
                      className="w-12 border rounded p-1 text-center"
                    />{' '}
                    of {totalPages}
                  </span>
                  <button
                    className="bg-gray-300 text-black px-4 py-2 rounded disabled:opacity-50"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
              {filteredDocuments.length > 0 && (
                <div className="flex items-center space-x-2 mt-4">
                  <label className="text-sm">Rows/ Page</label>
                  <input
                    type="text"
                    value={documentsPerPageInput}
                    onChange={handleDocumentsPerPageInputChange}
                    onKeyPress={handleDocumentsPerPageInputKeyPress}
                    className="w-12 border rounded p-1 text-center"
                    aria-label="Number of rows per page"
                  />
                </div>
              )}
            </>
          )}
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-4"
            onClick={() => setEditing(true)}
          >
            Add Document
          </button>
        </>
      )}
    </div>
  );
};

export default EmplopyeeDocument;
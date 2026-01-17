'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { addSubOrgDocument, updateSubOrgDocument, deleteSubOrgDocument } from '@/app/serverActions/Organizations/documents';
import { saveW9FormForSubOrg, submitW9FormForSubOrg } from '@/app/serverActions/forms/w9form/subOrgW9Actions';
import SignatureCanvas from 'react-signature-canvas';
import styles from './suborgdocument.module.css';

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; // Format: YYYY-MM-DD
};

const SubOrgDocument = ({ suborgid, orgid, documents: initialDocuments, onDocumentsUpdate, documenttypes, states }) => {
  // View States: 'list', 'add', 'detail', 'w9form'
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

  // W-9 Form States
  const [w9FormData, setW9FormData] = useState({
    name: '',
    business_name: '',
    tax_classification: 'INDIVIDUAL',
    llc_classification_code: '',
    exempt_payee_code: '',
    exemption_from_fatca_code: '',
    address_street: '',
    city: '',
    state: '',
    zip_code: '',
    taxpayer_identification_number: '',
    signature_date: new Date().toISOString().split('T')[0],
  });
  const [formattedTin, setFormattedTin] = useState('');
  
  // ✅ UPDATED: Only canvas and image upload (removed PDF)
  const [signatureType, setSignatureType] = useState('canvas');
  const w9SigCanvas = React.useRef(null);
  const imageFileInputRef = React.useRef(null);
  const [imageSignatureFile, setImageSignatureFile] = useState(null);
  const [imageSignaturePreview, setImageSignaturePreview] = useState(null);

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

  const handleW9FormClick = () => {
  setViewState('w9form');
  setError(null);
  // Reset W-9 form data with TODAY'S date
  setW9FormData({
    name: '',
    business_name: '',
    tax_classification: 'INDIVIDUAL',
    llc_classification_code: '',
    exempt_payee_code: '',
    exemption_from_fatca_code: '',
    address_street: '',
    city: '',
    state: '',
    zip_code: '',
    taxpayer_identification_number: '',
    signature_date: getTodayDate(), // ✅ Use today's date
  });
  setFormattedTin('');
  setSignatureType('canvas');
  setImageSignatureFile(null);
  setImageSignaturePreview(null);
  if (w9SigCanvas.current) {
    w9SigCanvas.current.clear();
  }
  if (imageFileInputRef.current) {
    imageFileInputRef.current.value = '';
  }
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

  // W-9 Form Handlers
  const formatTin = (value, taxClass) => {
  if (!value) return '';
  const digitsOnly = value.replace(/\D/g, '');
  
  // ✅ STRICT: Limit to 9 digits maximum
  const limitedDigits = digitsOnly.slice(0, 9);
  
  if (taxClass === 'INDIVIDUAL') {
    // SSN: XXX-XX-XXXX
    if (limitedDigits.length <= 3) return limitedDigits;
    if (limitedDigits.length <= 5) return `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3)}`;
    return `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3, 5)}-${limitedDigits.slice(5, 9)}`;
  } else {
    // EIN: XX-XXXXXXX
    if (limitedDigits.length <= 2) return limitedDigits;
    return `${limitedDigits.slice(0, 2)}-${limitedDigits.slice(2, 9)}`;
  }
};

  const handleW9InputChange = (e) => {
    const { name, value } = e.target;
    setW9FormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'taxpayer_identification_number') {
        const formatted = formatTin(value, prev.tax_classification);
        setFormattedTin(formatted);
        // Store unformatted digits
        updated[name] = value.replace(/\D/g, '');
      }
      if (name === 'tax_classification') {
        const formatted = formatTin(prev.taxpayer_identification_number, value);
        setFormattedTin(formatted);
        if (value !== 'LLC') updated.llc_classification_code = '';
      }
      return updated;
    });
  };

  const clearW9Signature = () => {
    if (w9SigCanvas.current) {
      w9SigCanvas.current.clear();
    }
  };

  // ✅ NEW: Handle image signature upload (PNG, JPG, JPEG only)
  const handleImageSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setImageSignatureFile(null);
      setImageSignaturePreview(null);
      return;
    }

    // ✅ Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PNG, JPG, or JPEG image file');
      if (imageFileInputRef.current) imageFileInputRef.current.value = '';
      return;
    }

    // ✅ Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setError(`Image size must be less than 2MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      if (imageFileInputRef.current) imageFileInputRef.current.value = '';
      return;
    }

    setError(null);
    setImageSignatureFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSignaturePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const clearImageSignature = () => {
    setImageSignatureFile(null);
    setImageSignaturePreview(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
    }
  };

  // ✅ UPDATED: W-9 Submit handler - only handle image signatures
  const handleW9Submit = async (e) => {
  e.preventDefault();
  setError(null);
  setIsLoading(true);

  try {
    // ✅ Validate TIN length (must be exactly 9 digits)
    const tinDigits = (w9FormData.taxpayer_identification_number || '').replace(/\D/g, '');
    if (tinDigits.length !== 9) {
      throw new Error(`Taxpayer Identification Number must be exactly 9 digits. You entered ${tinDigits.length} digit${tinDigits.length !== 1 ? 's' : ''}.`);
    }

    // Validate signature based on type
    let signatureData = null;
    
    if (signatureType === 'canvas') {
      if (w9SigCanvas.current?.isEmpty()) {
        throw new Error('Please provide a signature');
      }
      signatureData = w9SigCanvas.current.toDataURL('image/png');
    } else if (signatureType === 'image') {
      if (!imageSignaturePreview) {
        throw new Error('Please upload a signature image');
      }
      signatureData = imageSignaturePreview;
    }

    if (!signatureData) {
      throw new Error('Signature is required');
    }

    // ✅ Validate it's an image format
    if (!signatureData.startsWith('data:image/')) {
      throw new Error('Invalid signature format. Only images are accepted.');
    }

    // Prepare form data
    const submitData = {
      suborgid,
      orgid,
      signature_data: signatureData,
      ...w9FormData,
    };

    // Submit the form
    const result = await submitW9FormForSubOrg(submitData);

    if (result.success) {
      if (onDocumentsUpdate) await onDocumentsUpdate();
      handleBackClick();
    } else {
      throw new Error(result.error || 'Failed to submit form');
    }
  } catch (err) {
    setError(err.message || 'Failed to submit W-9 form');
  } finally {
    setIsLoading(false);
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

  // 0. W-9 FORM VIEW
  if (viewState === 'w9form') {
    return (
      <div className={styles.container}>
        <div className={styles.headerSection}>
          <h2 className={styles.title}>Fill W-9 Form</h2>
          <button className={styles.backButton} onClick={handleBackClick}></button>
        </div>
        {error && <div className={styles.errorMessage}>{error}</div>}
        
        <form onSubmit={handleW9Submit} className={styles.detailsBlock}>
          <h3>Basic Information</h3>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Name (as shown on tax return)*</label>
              <input
                type="text"
                name="name"
                value={w9FormData.name}
                onChange={handleW9InputChange}
                className={styles.formInput}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Business Name (if different)</label>
              <input
                type="text"
                name="business_name"
                value={w9FormData.business_name}
                onChange={handleW9InputChange}
                className={styles.formInput}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Federal Tax Classification*</label>
              <select
                name="tax_classification"
                value={w9FormData.tax_classification}
                onChange={handleW9InputChange}
                className={styles.formInput}
                required
              >
                <option value="INDIVIDUAL">Individual/Sole Proprietor</option>
                <option value="C_CORPORATION">C Corporation</option>
                <option value="S_CORPORATION">S Corporation</option>
                <option value="PARTNERSHIP">Partnership</option>
                <option value="TRUST_ESTATE">Trust/Estate</option>
                <option value="LLC">Limited Liability Company (LLC)</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            {w9FormData.tax_classification === 'LLC' && (
              <div className={styles.formGroup}>
                <label>LLC Tax Classification*</label>
                <input
                  type="text"
                  name="llc_classification_code"
                  value={w9FormData.llc_classification_code}
                  onChange={handleW9InputChange}
                  className={styles.formInput}
                  placeholder="C=Corp, S=S Corp, P=Partnership"
                  required
                />
              </div>
            )}
          </div>

          <h3>Address</h3>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Street Address*</label>
              <input
                type="text"
                name="address_street"
                value={w9FormData.address_street}
                onChange={handleW9InputChange}
                className={styles.formInput}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>City*</label>
              <input
                type="text"
                name="city"
                value={w9FormData.city}
                onChange={handleW9InputChange}
                className={styles.formInput}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>State*</label>
              <select
                name="state"
                value={w9FormData.state}
                onChange={handleW9InputChange}
                className={styles.formInput}
                required
              >
                <option value="">Select State</option>
                {states && states.map((s) => (
                  <option key={s.ID} value={s.VALUE}>{s.VALUE}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>ZIP Code*</label>
              <input
                type="text"
                name="zip_code"
                value={w9FormData.zip_code}
                onChange={handleW9InputChange}
                className={styles.formInput}
                maxLength="5"
                pattern="[0-9]{5}"
                required
              />
            </div>
          </div>

          <h3>Tax Information</h3>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
  <label>
    Taxpayer Identification Number (SSN or EIN)*
    <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
      (Must be exactly 9 digits)
    </span>
  </label>
  <input
    type="text"
    name="taxpayer_identification_number"
    value={formattedTin}
    onChange={handleW9InputChange}
    className={styles.formInput}
    placeholder={w9FormData.tax_classification === 'INDIVIDUAL' ? '###-##-####' : '##-#######'}
    maxLength={w9FormData.tax_classification === 'INDIVIDUAL' ? 11 : 10} // ✅ Limit input length
    required
  />
  {formattedTin && (
    <span style={{ 
      fontSize: '12px', 
      color: (w9FormData.taxpayer_identification_number || '').replace(/\D/g, '').length === 9 ? '#28a745' : '#dc3545',
      marginTop: '4px',
      display: 'block'
    }}>
      {(w9FormData.taxpayer_identification_number || '').replace(/\D/g, '').length} of 9 digits entered
      {(w9FormData.taxpayer_identification_number || '').replace(/\D/g, '').length === 9 && ' ✓'}
    </span>
  )}
</div>

            <div className={styles.formGroup}>
              <label>Exempt Payee Code (if applicable)</label>
              <input
                type="text"
                name="exempt_payee_code"
                value={w9FormData.exempt_payee_code}
                onChange={handleW9InputChange}
                className={styles.formInput}
                maxLength="2"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Exemption from FATCA Code (if applicable)</label>
              <input
                type="text"
                name="exemption_from_fatca_code"
                value={w9FormData.exemption_from_fatca_code}
                onChange={handleW9InputChange}
                className={styles.formInput}
                maxLength="1"
              />
            </div>
          </div>

          <h3>Signature</h3>
          
          <div className={styles.formGroup}>
            <label>Signature Date*</label>
            <input
              type="date"
              name="signature_date"
              value={w9FormData.signature_date}
              onChange={handleW9InputChange}
              className={styles.formInput}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Signature Type*</label>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="signatureType"
                  value="canvas"
                  checked={signatureType === 'canvas'}
                  onChange={(e) => setSignatureType(e.target.value)}
                />
                <span>Draw Signature</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="signatureType"
                  value="image"
                  checked={signatureType === 'image'}
                  onChange={(e) => setSignatureType(e.target.value)}
                />
                <span>Upload Signature Image</span>
              </label>
            </div>

            {signatureType === 'canvas' ? (
              <>
                <label style={{ marginTop: '10px', display: 'block' }}>Draw Your Signature*</label>
                <div style={{ border: '1px solid #ccc', marginTop: '10px', backgroundColor: '#fff' }}>
                  <SignatureCanvas
                    ref={w9SigCanvas}
                    canvasProps={{
                      width: 500,
                      height: 150,
                      className: 'signature-canvas'
                    }}
                  />
                </div>
                <button 
                  type="button" 
                  onClick={clearW9Signature}
                  className={styles.cancelButton}
                  style={{ marginTop: '10px' }}
                >
                  Clear Signature
                </button>
              </>
            ) : (
              <>
                <label style={{ marginTop: '10px', display: 'block' }}>Upload Signature Image*</label>
                <p style={{ fontSize: '13px', color: '#666', marginTop: '5px', marginBottom: '10px' }}>
                  Upload a PNG, JPG, or JPEG image of your signature (Max size: 2MB)
                </p>
                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleImageSignatureUpload}
                  className={styles.formInput}
                  style={{ marginTop: '10px' }}
                />
                
                {imageSignaturePreview && (
                  <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>
                      ✓ Signature preview:
                    </p>
                    <img
                      src={imageSignaturePreview}
                      alt="Signature Preview"
                      style={{ 
                        maxWidth: '400px', 
                        maxHeight: '150px', 
                        border: '1px solid #ccc', 
                        borderRadius: '4px', 
                        backgroundColor: '#fff',
                        display: 'block'
                      }}
                    />
                    <button 
                      type="button" 
                      onClick={clearImageSignature}
                      className={styles.cancelButton}
                      style={{ marginTop: '10px' }}
                    >
                      Remove & Upload Different Image
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.formButtons}>
            {isLoading && <p style={{ color: '#007bff', marginBottom: '10px' }}>Submitting form, please wait...</p>}
            <button type="submit" className={styles.saveButton} disabled={isLoading}>
              {isLoading ? 'Submitting...' : 'Submit W-9 Form'}
            </button>
            <button type="button" className={styles.cancelButton} onClick={handleBackClick} disabled={isLoading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

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
        <h3 className={styles.title}>Organization Documents</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className={styles.button} onClick={handleW9FormClick}>
            Fill Digital W-9 Form
          </button>
          <button className={styles.button} onClick={handleAddClick}>
            Add Document
          </button>
        </div>
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
                <th className={styles.tableHeader}>Purpose</th>
                <th className={styles.tableHeader}>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentDocuments.map((d) => (
                <tr 
                  key={d.id} 
                  className={styles.tableRow} 
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
                  <td className={styles.tableCell}>{getTypeName(d.document_type)}</td>
                  <td className={styles.tableCell}>{d.document_purpose || 'N/A'}</td>
                  <td className={styles.tableCell}>
                    <button className={styles.deleteButton} onClick={(e) => handleDelete(e, d.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SubOrgDocument;
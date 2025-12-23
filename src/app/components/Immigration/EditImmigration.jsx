'use client';

import React, { useState } from 'react';
import styles from '../Employee/immigration.module.css'; 

const EditImmigration = ({
  record,
  employees,
  suborgs,
  document_types,
  document_subtypes,
  immigrationStatuses,
  isAdmin,
  userSuborgId,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    id: record.id,
    employeeSelection: record.beneficiary_empid || '',
    beneficiaryNameCustom: record.beneficiary_custom_name || '',
    companySelection: record.suborgid || '',
    petitionerName: record.petitioner_name || '',
    documentName: record.document_name || '',
    documentType: record.document_type || '',
    subtype: record.subtype || '',
    documentNumber: record.document_number || '',
    immigrationStatus: record.immigration_status || '',
    issueDate: record.issue_date || '',
    expiryDate: record.expiry_date || '',
    eligibleReviewDate: record.eligible_review_date || '',
    comments: record.comments || '',
    oldDocumentPath: record.document_path || ''
  });
  
  const [file, setFile] = useState(null);

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

  const handleEmployeeChange = (e) => {
      const val = e.target.value;
      setFormData(prev => ({ ...prev, employeeSelection: val }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.keys(formData).forEach(k => data.append(k, formData[k]));
    if (file) data.append('file', file);
    onSave(data);
  };

  return (
    <div style={{
        position:'fixed', top:0, left:0, right:0, bottom:0, 
        backgroundColor:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000
    }}>
        <div className={styles.employee_immigration_form} style={{ width: '800px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                <h3 className={styles.employee_immigration_title}>Edit Immigration Record</h3>
                <button onClick={onClose} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer'}}>&times;</button>
            </div>
            
            <form onSubmit={handleSubmit}>
                {/* ROW 1: Employee & Beneficiary */}
                <div className={styles.employee_immigration_formRow}>
                    <div className={styles.employee_immigration_formGroup}>
                        <label className={styles.employee_immigration_formLabel}>Employee Name</label>
                        <select 
                            name="employeeSelection"
                            value={formData.employeeSelection}
                            onChange={handleEmployeeChange}
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
                                value={employees.find(e=>e.empid === formData.employeeSelection) 
                                    ? `${employees.find(e=>e.empid === formData.employeeSelection).EMP_FST_NAME} ${employees.find(e=>e.empid === formData.employeeSelection).EMP_LAST_NAME}`
                                    : ''}
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
                            {isAdmin && <option value="other">Others</option>}
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
                    <button type="submit" className={`${styles.employee_immigration_button} ${styles.employee_immigration_saveButton}`}>Save Changes</button>
                    <button type="button" onClick={onClose} className={`${styles.employee_immigration_button} ${styles.employee_immigration_cancelButton}`}>Cancel</button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default EditImmigration;
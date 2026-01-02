'use client';
import React, { useState } from 'react';
import { addServiceRequest } from '@/app/serverActions/ServiceRequests/AddServicereq';
import './overview.css';

const AddServiceReq = ({ orgid, empid, employees, type, subtype, priority, previousServiceRequests, onBack, accountRows, empname }) => {
  const [formData, setFormData] = useState({
    serviceName: '',
    statusCd: 'Open',
    priorityCd: '',
    typeCd: '',
    subTypeCd: '',
    assignedTo: '',
    dueDate: '',
    escalatedFlag: false,
    escalatedTo: '',
    escalatedDate: '',
    description: '',
    comments: '',
    contactId: '',
    accountId: '',
    assetId: '',
    parRowId: '',
  });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset form after success message
  const resetForm = () => {
    setFormData({
      serviceName: '',
      statusCd: 'Open',
      priorityCd: '',
      typeCd: '',
      subTypeCd: '',
      assignedTo: '',
      dueDate: '',
      escalatedFlag: false,
      escalatedTo: '',
      escalatedDate: '',
      description: '',
      comments: '',
      contactId: '',
      accountId: '',
      assetId: '',
      parRowId: '',
    });
    setFiles([]);
    setError(null);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // If unchecking Escalated flag, clear the Escalated To and Date fields automatically
    if (name === 'escalatedFlag' && !checked) {
        setFormData((prev) => ({
            ...prev,
            [name]: checked,
            escalatedTo: '',
            escalatedDate: ''
        }));
    } else {
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    }
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []).map((file) => ({
      file,
      name: file.name,
      type: file.type,
      comments: '',
      attachmentStatus: '',
    }));
    console.log('Files selected:', newFiles);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileCommentChange = (index, value) => {
    setFiles((prev) => {
      const updatedFiles = [...prev];
      updatedFiles[index].comments = value;
      return updatedFiles;
    });
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    if (!formData.serviceName) {
      setError('Service Name is required.');
      setIsLoading(false);
      return;
    }
    if (!formData.priorityCd) {
      setError('Priority is required.');
      setIsLoading(false);
      return;
    }
    if (!formData.typeCd) {
      setError('Type is required.');
      setIsLoading(false);
      return;
    }
    if (!formData.assignedTo) {
      setError('Assigned To is required.');
      setIsLoading(false);
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('orgid', orgid || '');
    formDataToSend.append('empid', empid || '');
    formDataToSend.append('serviceName', formData.serviceName);
    formDataToSend.append('statusCd', formData.statusCd);
    formDataToSend.append('priorityCd', formData.priorityCd);
    formDataToSend.append('typeCd', formData.typeCd);
    formDataToSend.append('subTypeCd', formData.subTypeCd);
    formDataToSend.append('assignedTo', formData.assignedTo);
    formDataToSend.append('dueDate', formData.dueDate);
    formDataToSend.append('escalatedFlag', formData.escalatedFlag.toString());
    formDataToSend.append('escalatedTo', formData.escalatedTo);
    formDataToSend.append('escalatedDate', formData.escalatedDate);
    formDataToSend.append('description', formData.description);
    formDataToSend.append('comments', formData.comments);
    formDataToSend.append('contactId', formData.contactId);
    formDataToSend.append('accountId', formData.accountId);
    formDataToSend.append('assetId', formData.assetId);
    formDataToSend.append('parRowId', formData.parRowId);

    files.forEach((fileObj, index) => {
      formDataToSend.append(`attachment[${index}]`, fileObj.file);
      formDataToSend.append(`fileComments[${index}]`, fileObj.comments);
      formDataToSend.append(`fileStatuses[${index}]`, fileObj.attachmentStatus);
    });

    try {
      const result = await addServiceRequest(formDataToSend);
      if (result && result.success) {
        console.log('Uploaded attachment paths:', result.attachmentPaths || 'No attachments uploaded');
        setSuccessMessage(`Service Request ${result.srNum} added successfully.`);
        setTimeout(() => {
          setSuccessMessage(null);
          resetForm();
          onBack();
        }, 4000);
      } else {
        setError(result.error || 'Failed to create service request');
      }
    } catch (err) {
      console.error('Error creating service request:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="service-requests-overview-container">
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      {isLoading && <div className="loading-message">Creating...</div>}
      <div className="header-section">
        <div className="title">Create New Service Request</div>
        <button className="back-button" onClick={onBack} disabled={isLoading}></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="details-block">
          <div className="section-header">
            <div>Basic Details</div>
          </div>
          <div className="form-row">
            {/* <div className="form-group">
              <label>Organization ID</label>
              <input type="text" value={orgid || ''} readOnly className="bg-gray-100" />
            </div> */}
            <div className="form-group">
              <label>Service Name*</label>
              <input
                type="text"
                name="serviceName"
                value={formData.serviceName}
                onChange={handleFormChange}
                placeholder="Enter Service Name"
                required
              />
            </div>
            <div className="form-group">
              <label>Created By</label>
              <input type="text" value={empname || ''} readOnly className="bg-gray-100" />
            </div>
          </div>
          <div className="form-row">
            
            <div className="form-group">
              <label>Status*</label>
              <input
                type="text"
                name="statusCd"
                value={formData.statusCd}
                readOnly
                className="bg-gray-100"
              />
            </div>
             <div className="form-group">
              <label>Due Date</label>
              <input type="date" name="dueDate" value={formData.dueDate} onChange={handleFormChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Priority*</label>
              <select name="priorityCd" value={formData.priorityCd} onChange={handleFormChange} required>
                <option value="">Select Priority</option>
                {priority.map((p) => (
                  <option key={p.id} value={p.Name}>{p.Name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Type*</label>
              <select name="typeCd" value={formData.typeCd} onChange={handleFormChange} required>
                <option value="">Select Type</option>
                {type.map((t) => (
                  <option key={t.id} value={t.Name}>{t.Name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Sub-Type</label>
              <select name="subTypeCd" value={formData.subTypeCd} onChange={handleFormChange}>
                <option value="">Select Sub-Type</option>
                {subtype.map((s) => (
                  <option key={s.id} value={s.Name}>{s.Name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Assigned To*</label>
              <select name="assignedTo" value={formData.assignedTo} onChange={handleFormChange} required>
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.empid} value={emp.empid}>
                    {emp.EMP_FST_NAME} {emp.EMP_LAST_NAME}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="details-block">
          <div className="section-header">
            <div>Additional Details</div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Escalated</label>
              <input
                type="checkbox"
                name="escalatedFlag"
                checked={formData.escalatedFlag}
                onChange={handleFormChange}
              />
            </div>
            <div className="form-group">
              <label>Escalated To</label>
              {/* FIXED: Changed from input to select to prevent foreign key errors */}
              <select 
                name="escalatedTo" 
                value={formData.escalatedTo} 
                onChange={handleFormChange}
                disabled={!formData.escalatedFlag} // Optional UX: disable if flag is unchecked
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.empid} value={emp.empid}>
                    {emp.EMP_FST_NAME} {emp.EMP_LAST_NAME}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Escalated Date</label>
              <input
                type="date"
                name="escalatedDate"
                value={formData.escalatedDate}
                onChange={handleFormChange}
                disabled={!formData.escalatedFlag} // Optional UX: disable if flag is unchecked
              />
            </div>
            <div className="form-group">
              <label>Parent SR ID</label>
              <select name="parRowId" value={formData.parRowId} onChange={handleFormChange}>
                <option value="">Select Parent Service Request</option>
                {previousServiceRequests.map((sr) => (
                  <option key={sr.SR_NUM} value={sr.SR_NUM}>
                    SR-{sr.SR_NUM}: {sr.SERVICE_NAME}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Contact ID</label>
              <input
                type="text"
                name="contactId"
                value={formData.contactId}
                onChange={handleFormChange}
                placeholder="Enter Contact ID"
              />
            </div>
            <div className="form-group">
              <label>Account ID</label>
              <select name="accountId" value={formData.accountId} onChange={handleFormChange}>
                <option value="">Select Account</option>
                {accountRows.map((details) => (
                  <option key={details.ACCNT_ID} value={details.ACCNT_ID}>
                    {details.ALIAS_NAME}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Asset ID</label>
              <input
                type="text"
                name="assetId"
                value={formData.assetId}
                onChange={handleFormChange}
                placeholder="Enter Asset ID"
              />
            </div>
          </div>
        </div>

        <div className="details-block">
          <div className="section-header">
            <div>Description and Comments</div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                placeholder="Enter Description"
                rows={4}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Comments</label>
              <textarea
                name="comments"
                value={formData.comments}
                onChange={handleFormChange}
                placeholder="Enter Comments"
                rows={4}
              />
            </div>
          </div>
        </div>

        <div className="details-block">
          <div className="section-header">
            <div>Attachments</div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Upload Files</label>
              <input type="file" multiple onChange={handleFileChange} accept="*/*" />
            </div>
          </div>
          {files.length > 0 && (
            <div className="form-row">
              <div className="form-group">
                <div>Attached Files</div>
                <div className="table-wrapper">
                  <table className="attachment-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Comments</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((fileObj, index) => (
                        <tr key={index}>
                          <td>{fileObj.name}</td>
                          <td>
                            <input
                              type="text"
                              value={fileObj.comments}
                              onChange={(e) => handleFileCommentChange(index, e.target.value)}
                              placeholder="Add comments"
                            />
                          </td>
                          <td>
                            <button type="button" className="cancel" onClick={() => handleRemoveFile(index)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="form-buttons">
          {isLoading && <p style={{ color: '#007bff', marginBottom: '10px' }}>Creating service request, please wait...</p>}
          <button type="submit" className="save" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create'}
          </button>
          <button type="button" className="cancel" onClick={onBack} disabled={isLoading}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddServiceReq;
'use client';

import React, { useState, useEffect } from 'react';
import AddServiceReq from './AddServiceReq';
import { fetchServiceRequestById, getemployeename, updateServiceRequest, getparentsr } from '@/app/serverActions/ServiceRequests/Overview';
import './overview.css';
import { useRouter, useSearchParams } from 'next/navigation';
import Requests from './Requests';

const Overview = ({
  orgid,
  empid,
  employees,
  type,
  subtype,
  priority,
  serviceRequests,
  previousServiceRequests,
}) => {
  const searchparams = useSearchParams();
  const router = useRouter();
  const [selectedSrNum, setSelectedSrNum] = useState(null);
  const [serviceRequestDetails, setServiceRequestDetails] = useState(null);
  const [isAdd, setIsAdd] = useState(false);
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [isEditingAdditional, setIsEditingAdditional] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingAttachments, setIsEditingAttachments] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allServiceRequests, setAllServiceRequests] = useState(serviceRequests || []);
  const [req, setreq] = useState(false);
  const [parentServiceRequests, setParentServiceRequests] = useState([]);
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
    emp1stname: '',
    emplastname: '',
  });
  const [existingFiles, setExistingFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  // Determine if the service request is resolved
  const isResolved = formData.statusCd === 'Resolved';

  // Utility function to format dates for display and form input
  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      // Use local date components to preserve YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      // If it's already a date string (YYYY-MM-DD), return it as is
      return date.split('T')[0];
    }
    return ''; // Fallback for invalid dates
  };

  useEffect(() => {
    handleBack();
  }, [searchparams.get('refresh')]);

  useEffect(() => {
    setAllServiceRequests(serviceRequests); // Initialize with serviceRequests prop
  }, [serviceRequests]);

  useEffect(() => {
    const loadServiceRequestDetails = async () => {
      if (!selectedSrNum) {
        console.log('No selectedSrNum, resetting details');
        setServiceRequestDetails(null);
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
          emp1stname: '',
          emplastname: '',
        });
        setExistingFiles([]);
        setNewFiles([]);
        setParentServiceRequests([]);
        return;
      }
      try {
        setIsLoading(true);
        const serviceRequest = await fetchServiceRequestById(selectedSrNum, orgid, empid);
        const employeeRequest = await getemployeename(serviceRequest.ASSIGNED_TO);
        const parentRequests = await getparentsr(selectedSrNum);
        setServiceRequestDetails(serviceRequest);
        setFormData({
          serviceName: serviceRequest.SERVICE_NAME || '',
          statusCd: serviceRequest.STATUS_CD || 'Open',
          priorityCd: serviceRequest.PRIORITY_CD || '',
          typeCd: serviceRequest.TYPE_CD || '',
          subTypeCd: serviceRequest.SUB_TYPE_CD || '',
          assignedTo: serviceRequest.ASSIGNED_TO || '',
          dueDate: formatDate(serviceRequest.DUE_DATE),
          escalatedFlag: !!serviceRequest.ESCALATED_FLAG,
          escalatedTo: serviceRequest.ESCALATED_TO || '',
          escalatedDate: formatDate(serviceRequest.ESCALATED_DATE),
          description: serviceRequest.DESCRIPTION || '',
          comments: serviceRequest.COMMENTS || '',
          contactId: serviceRequest.CONTACT_ID || '',
          accountId: serviceRequest.ACCOUNT_ID || '',
          assetId: serviceRequest.ASSET_ID || '',
          parRowId: serviceRequest.PAR_ROW_ID || '',
          emp1stname: employeeRequest.employees[0]?.EMP_FST_NAME || '',
          emplastname: employeeRequest.employees[0]?.EMP_LAST_NAME || '',
        });
        setExistingFiles(
          serviceRequest.attachments.map((att) => ({
            sr_att_id: att.SR_ATT_ID,
            name: att.FILE_NAME,
            file_path: att.FILE_PATH,
            type: att.TYPE_CD || '',
            comments: att.COMMENTS || '',
            attachmentStatus: att.ATTACHMENT_STATUS || '',
          })) || []
        );
        setNewFiles([]);
        setParentServiceRequests(parentRequests.success ? parentRequests.serviceRequests : []);
        setError(null);
      } catch (err) {
        console.error('Error loading service request details:', err);
        setError(err.message || 'Failed to load service request details');
        setServiceRequestDetails(null);
        setParentServiceRequests([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadServiceRequestDetails();
  }, [selectedSrNum, orgid, empid]);

  const handleRowClick = (srNum) => {
    setSelectedSrNum(srNum);
    setIsEditingBasic(false);
    setIsEditingAdditional(false);
    setIsEditingDescription(false);
    setIsEditingAttachments(false);
    setError(null);
    setIsAdd(false);
    setreq(false);
  };

  const handleBack = () => {
    router.refresh();
    setSelectedSrNum(null);
    setIsEditingBasic(false);
    setIsEditingAdditional(false);
    setIsEditingDescription(false);
    setIsEditingAttachments(false);
    setError(null);
    setIsAdd(false);
    setreq(false);
    setParentServiceRequests([]);
  };

  const handlerequest = () => {
    router.refresh();
    setSelectedSrNum(null);
    setIsEditingBasic(false);
    setIsEditingAdditional(false);
    setIsEditingDescription(false);
    setIsEditingAttachments(false);
    setError(null);
    setIsAdd(false);
    setreq(true);
    setParentServiceRequests([]);
  };

  const handleAddServiceRequest = () => {
    setSelectedSrNum(null);
    setIsEditingBasic(false);
    setIsEditingAdditional(false);
    setIsEditingDescription(false);
    setIsEditingAttachments(false);
    setError(null);
    setIsAdd(true);
    setreq(false);
    setParentServiceRequests([]);
  };

  const handleEdit = (section) => {
    if (isResolved) return; // Prevent editing if status is Resolved
    if (section === 'basic') setIsEditingBasic(true);
    if (section === 'additional') setIsEditingAdditional(true);
    if (section === 'description') setIsEditingDescription(true);
    if (section === 'attachments') setIsEditingAttachments(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []).map((file) => ({
      file,
      name: file.name,
      type: file.type || 'application/octet-stream',
      comments: '',
      attachmentStatus: '',
    }));
    console.log('New files selected:', newFiles);
    setNewFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileCommentChange = (index, value, isExisting = false) => {
    if (isExisting) {
      setExistingFiles((prev) =>
        prev.map((file, i) => (i === index ? { ...file, comments: value } : file))
      );
    } else {
      setNewFiles((prev) =>
        prev.map((file, i) => (i === index ? { ...file, comments: value } : file))
      );
    }
  };

  const handleFileStatusChange = (index, value, isExisting = false) => {
    if (isExisting) {
      setExistingFiles((prev) =>
        prev.map((file, i) => (i === index ? { ...file, attachmentStatus: value } : file))
      );
    } else {
      setNewFiles((prev) =>
        prev.map((file, i) => (i === index ? { ...file, attachmentStatus: value } : file))
      );
    }
  };

  const handleRemoveFile = (index, isExisting = false) => {
    if (isExisting) {
      setExistingFiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      setNewFiles((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSave = async (section) => {
    setError(null);
    setIsLoading(true);

    if (section === 'basic') {
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
    }

    const formDataToSend = new FormData();
    formDataToSend.append('SR_NUM', selectedSrNum || '');
    formDataToSend.append('orgid', orgid || '');
    formDataToSend.append('empid', empid || '');
    formDataToSend.append('section', section);

    if (section === 'basic') {
      formDataToSend.append('serviceName', formData.serviceName);
      formDataToSend.append('statusCd', formData.statusCd);
      formDataToSend.append('priorityCd', formData.priorityCd);
      formDataToSend.append('typeCd', formData.typeCd);
      formDataToSend.append('subTypeCd', formData.subTypeCd);
      formDataToSend.append('assignedTo', formData.assignedTo);
      formDataToSend.append('dueDate', formData.dueDate);
    } else if (section === 'additional') {
      formDataToSend.append('escalatedFlag', formData.escalatedFlag.toString());
      formDataToSend.append('escalatedTo', formData.escalatedTo);
      formDataToSend.append('escalatedDate', formData.escalatedDate);
      formDataToSend.append('contactId', formData.contactId);
      formDataToSend.append('accountId', formData.accountId);
      formDataToSend.append('assetId', formData.assetId);
      formDataToSend.append('parRowId', formData.parRowId);
    } else if (section === 'description') {
      formDataToSend.append('description', formData.description);
      formDataToSend.append('comments', formData.comments);
    } else if (section === 'attachments') {
      newFiles.forEach((fileObj, index) => {
        formDataToSend.append(`attachment[${index}]`, fileObj.file);
        formDataToSend.append(`fileComments[${index}]`, fileObj.comments);
        formDataToSend.append(`fileStatuses[${index}]`, fileObj.attachmentStatus);
        formDataToSend.append(`fileTypes[${index}]`, fileObj.type);
      });
      existingFiles.forEach((fileObj, index) => {
        formDataToSend.append(`existingFiles[${index}]`, JSON.stringify(fileObj));
      });
    }

    try {
      const result = await updateServiceRequest(formDataToSend);
      if (result && result.success) {
        const updatedRequest = await fetchServiceRequestById(selectedSrNum, orgid, empid);
        const employeeRequest = await getemployeename(updatedRequest.ASSIGNED_TO);
        setServiceRequestDetails(updatedRequest);
        setFormData({
          serviceName: updatedRequest.SERVICE_NAME || '',
          statusCd: updatedRequest.STATUS_CD || 'Open',
          priorityCd: updatedRequest.PRIORITY_CD || '',
          typeCd: updatedRequest.TYPE_CD || '',
          subTypeCd: updatedRequest.SUB_TYPE_CD || '',
          assignedTo: updatedRequest.ASSIGNED_TO || '',
          dueDate: formatDate(updatedRequest.DUE_DATE),
          escalatedFlag: !!updatedRequest.ESCALATED_FLAG,
          escalatedTo: updatedRequest.ESCALATED_TO || '',
          escalatedDate: formatDate(updatedRequest.ESCALATED_DATE),
          description: updatedRequest.DESCRIPTION || '',
          comments: updatedRequest.COMMENTS || '',
          contactId: updatedRequest.CONTACT_ID || '',
          accountId: updatedRequest.ACCOUNT_ID || '',
          assetId: updatedRequest.ASSET_ID || '',
          parRowId: updatedRequest.PAR_ROW_ID || '',
          emp1stname: employeeRequest.employees[0]?.EMP_FST_NAME || '',
          emplastname: employeeRequest.employees[0]?.EMP_LAST_NAME || '',
        });
        setExistingFiles(
          updatedRequest.attachments.map((att) => ({
            sr_att_id: att.SR_ATT_ID,
            name: att.FILE_NAME,
            file_path: att.FILE_PATH,
            type: att.TYPE_CD || '',
            comments: att.COMMENTS || '',
            attachmentStatus: att.ATTACHMENT_STATUS || '',
          })) || []
        );
        setNewFiles([]);
        setAllServiceRequests((prev) =>
          prev.map((req) =>
            req.SR_NUM === selectedSrNum ? { ...req, ...updatedRequest } : req
          )
        );
        if (section === 'basic') setIsEditingBasic(false);
        if (section === 'additional') setIsEditingAdditional(false);
        if (section === 'description') setIsEditingDescription(false);
        if (section === 'attachments') setIsEditingAttachments(false);
        setError(null);
      } else {
        setError(result.error || 'Failed to save: Invalid response from server');
      }
    } catch (err) {
      console.error('Error saving service request:', err);
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsLoading(false);
    }
  };

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };
  const getdisplayemployeeid = (prjid) => {
    return prjid.split('_')[1] || prjid;
  };

  return (
    <div className="employee-overview-container">
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading-message">Loading...</div>}
      {req && !isAdd ? (
        <>
          <Requests
            orgid={orgid}
            empid={empid}
            type={type}
            subtype={subtype}
            priority={priority}
            previousServiceRequests={previousServiceRequests}
            onBack={handleBack}
          />
        </>
      ) : isAdd && !req ? (
        <AddServiceReq
          orgid={orgid}
          empid={empid}
          employees={employees}
          type={type}
          subtype={subtype}
          priority={priority}
          previousServiceRequests={previousServiceRequests}
          onBack={handleBack}
        />
      ) : !selectedSrNum ? (
        <div className="employee-list">
          <button onClick={handleAddServiceRequest} className="save-button">
            Add Service Request
          </button>
          <button onClick={handlerequest} className="save-button">
            Requests
          </button>
          {allServiceRequests.length === 0 && !error ? (
            <p>No service requests found.</p>
          ) : (
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Service Request ID</th>
                  <th>Service Name</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {allServiceRequests.map((request) => (
                  <tr
                    key={request.SR_NUM}
                    onClick={() => handleRowClick(request.SR_NUM)}
                    className={selectedSrNum === request.SR_NUM ? 'selected-row' : ''}
                  >
                    <td>SR-{getdisplayprojectid(request.SR_NUM)}</td>
                    <td>{request.SERVICE_NAME || '-'}</td>
                    <td>{request.STATUS_CD || '-'}</td>
                    <td>{request.PRIORITY_CD||'-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        serviceRequestDetails && (
          <div className="employee-details-container">
            <button className="back-button" onClick={handleBack}>
              x
            </button>

            <div className="details-block">
              <h3>Basic Details</h3>
              {isEditingBasic ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave('basic');
                  }}
                >
                  <div className="form-row">
                    {/* <div className="form-group">
                      <label>Service Request ID</label>
                      <input
                        type="text"
                        value={`SR-${selectedSrNum}`}
                        readOnly
                        className="bg-gray-100"
                      />
                    </div> */}
                    <div className="form-group">
                      <label>Organization ID</label>
                      <input
                        type="text"
                        value={orgid || ''}
                        readOnly
                        className="bg-gray-100"
                      />
                    </div>
                  </div>
                  <div className="form-row">
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
                      <label>Status*</label>
                      <input
                        type="text"
                        name="statusCd"
                        value={formData.statusCd}
                        readOnly
                        className="bg-gray-100"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Priority*</label>
                      <select
                        name="priorityCd"
                        value={formData.priorityCd}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="">Select Priority</option>
                        {priority.map((p) => (
                          <option key={p.id} value={p.Name}>
                            {p.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Type*</label>
                      <select
                        name="typeCd"
                        value={formData.typeCd}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="">Select Type</option>
                        {type.map((t) => (
                          <option key={t.id} value={t.Name}>
                            {t.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Sub-Type</label>
                      <select
                        name="subTypeCd"
                        value={formData.subTypeCd}
                        onChange={handleFormChange}
                      >
                        <option value="">Select Sub-Type</option>
                        {subtype.map((s) => (
                          <option key={s.id} value={s.Name}>
                            {s.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Assigned To</label>
                      <input
                        type="text"
                        name="assignedTo"
                        value={getdisplayemployeeid(formData.assignedTo)}
                        readOnly
                        className="bg-gray-100"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Due Date</label>
                      <input
                        type="date"
                        name="dueDate"
                        value={formData.dueDate}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button
                      type="submit"
                      className="save-button"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => setIsEditingBasic(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Service Request ID</label>
                      <p>SR-{getdisplayprojectid(serviceRequestDetails.SR_NUM)}</p>
                    </div>
                    <div className="details-group">
                      <label>Organization ID</label>
                      <p>{serviceRequestDetails.ORG_ID || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Service Name</label>
                      <p>{serviceRequestDetails.SERVICE_NAME || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Status</label>
                      <p>{serviceRequestDetails.STATUS_CD || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Priority</label>
                      <p>{serviceRequestDetails.PRIORITY_CD || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Type</label>
                      <p>{serviceRequestDetails.TYPE_CD || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Sub-Type</label>
                      <p>{serviceRequestDetails.SUB_TYPE_CD || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Assigned To</label>
                      <p>{getdisplayemployeeid(serviceRequestDetails.ASSIGNED_TO) || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Due Date</label>
                      <p>{formatDate(serviceRequestDetails.DUE_DATE)}</p>
                    </div>
                  </div>
                  {!isResolved && (
                    <div className="details-buttons">
                      <button
                        className="edit-button"
                        onClick={() => handleEdit('basic')}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="details-block">
              <h3>Additional Details</h3>
              {isEditingAdditional ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave('additional');
                  }}
                >
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
                      <input
                        type="text"
                        name="escalatedTo"
                        value={formData.escalatedTo}
                        onChange={handleFormChange}
                        placeholder="Enter Escalated To"
                      />
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
                      />
                    </div>
                    <div className="form-group">
                      <label>Parent SR ID</label>
                      <select
                        name="parRowId"
                        value={formData.parRowId}
                        onChange={handleFormChange}
                        disabled={isResolved}
                      >
                        <option value="">Select Parent SR</option>
                        {parentServiceRequests.map((sr) => (
                          <option key={sr.SR_NUM} value={sr.SR_NUM}>
                            SR-{getdisplayprojectid(sr.SR_NUM)} ({sr.SERVICE_NAME || '-'})
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
                      <input
                        type="text"
                        name="accountId"
                        value={formData.accountId}
                        onChange={handleFormChange}
                        placeholder="Enter Account ID"
                      />
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
                  <div className="form-buttons">
                    <button
                      type="submit"
                      className="save-button"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => setIsEditingAdditional(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Escalated</label>
                      <p>{serviceRequestDetails.ESCALATED_FLAG ? 'Yes' : 'No'}</p>
                    </div>
                    <div className="details-group">
                      <label>Escalated To</label>
                      <p>{serviceRequestDetails.ESCALATED_TO || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Escalated Date</label>
                      <p>{formatDate(serviceRequestDetails.ESCALATED_DATE)}</p>
                    </div>
                    <div className="details-group">
                      <label>Parent SR ID</label>
                      <p>
                        {serviceRequestDetails.PAR_ROW_ID
                          ? `SR-${getdisplayprojectid(serviceRequestDetails.PAR_ROW_ID)}`
                          : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Contact ID</label>
                      <p>{serviceRequestDetails.CONTACT_ID || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Account ID</label>
                      <p>{serviceRequestDetails.ACCOUNT_ID || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Asset ID</label>
                      <p>{serviceRequestDetails.ASSET_ID || '-'}</p>
                    </div>
                  </div>
                  {!isResolved && (
                    <div className="details-buttons">
                      <button
                        className="edit-button"
                        onClick={() => handleEdit('additional')}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="details-block">
              <h3>Description and Comments</h3>
              {isEditingDescription ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave('description');
                  }}
                >
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
                  <div className="form-buttons">
                    <button
                      type="submit"
                      className="save-button"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => setIsEditingDescription(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Description</label>
                      <p>{serviceRequestDetails.DESCRIPTION || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Comments</label>
                      <p>{serviceRequestDetails.COMMENTS || '-'}</p>
                    </div>
                  </div>
                  {!isResolved && (
                    <div className="details-buttons">
                      <button
                        className="edit-button"
                        onClick={() => handleEdit('description')}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="details-block">
              <h3>Attachments</h3>
              {isEditingAttachments ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave('attachments');
                  }}
                >
                  <div className="form-row">
                    <div className="form-group">
                      <label>Upload New Files</label>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        accept="*/*"
                      />
                    </div>
                  </div>
                  {(existingFiles.length > 0 || newFiles.length > 0) && (
                    <div className="form-row">
                      <div className="form-group">
                        <h4>Attached Files</h4>
                        <table className="attachment-table">
                          <thead>
                            <tr>
                              <th>File Name</th>
                              <th>Type</th>
                              <th>Comments</th>
                              {/* <th>Status</th> */}
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {existingFiles.map((fileObj, index) => (
                              <tr key={`existing-${index}`}>
                                <td>
                                  <a
                                    href={`/Uploads/${fileObj.file_path}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {fileObj.name}
                                  </a>
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    value={fileObj.type}
                                    onChange={(e) =>
                                      handleFileCommentChange(
                                        index,
                                        e.target.value,
                                        true
                                      )
                                    }
                                    placeholder="Enter file type"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    value={fileObj.comments}
                                    onChange={(e) =>
                                      handleFileCommentChange(
                                        index,
                                        e.target.value,
                                        true
                                      )
                                    }
                                    placeholder="Add comments"
                                  />
                                </td>
                                {/* <td>
                                  <input
                                    type="text"
                                    value={fileObj.attachmentStatus}
                                    onChange={(e) =>
                                      handleFileStatusChange(
                                        index,
                                        e.target.value,
                                        true
                                      )
                                    }
                                    placeholder="Enter status"
                                  />
                                </td> */}
                                <td>
                                  <button
                                    type="button"
                                    className="cancel-button"
                                    onClick={() => handleRemoveFile(index, true)}
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {newFiles.map((fileObj, index) => (
                              <tr key={`new-${index}`}>
                                <td>{fileObj.name}</td>
                                <td>
                                  <input
                                    type="text"
                                    value={fileObj.type}
                                    onChange={(e) =>
                                      handleFileCommentChange(
                                        index,
                                        e.target.value
                                      )
                                    }
                                    placeholder="Enter file type"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    value={fileObj.comments}
                                    onChange={(e) =>
                                      handleFileCommentChange(
                                        index,
                                        e.target.value
                                      )
                                    }
                                    placeholder="Add comments"
                                  />
                                </td>
                                {/* <td>
                                  <input
                                    type="text"
                                    value={fileObj.attachmentStatus}
                                    onChange={(e) =>
                                      handleFileStatusChange(
                                        index,
                                        e.target.value
                                      )
                                    }
                                    placeholder="Enter status"
                                  />
                                </td> */}
                                <td>
                                  <button
                                    type="button"
                                    className="cancel-button"
                                    onClick={() => handleRemoveFile(index)}
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  <div className="form-buttons">
                    <button
                      type="submit"
                      className="save-button"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => setIsEditingAttachments(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="details-row">
                    {existingFiles.length > 0 && (
                      <div className="details-group">
                        <h4>Attached Files</h4>
                        <table className="attachment-table">
                          <thead>
                            <tr>
                              <th>File Name</th>
                              <th>Comments</th>
                              {/* <th>Status</th> */}
                            </tr>
                          </thead>
                          <tbody>
                            {existingFiles.map((fileObj, index) => (
                              <tr key={index}>
                                <td>
                                  <a
                                    href={`/Uploads/${fileObj.file_path}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {fileObj.name}
                                  </a>
                                </td>
                                <td>{fileObj.comments || '-'}</td>
                                {/* <td>{fileObj.attachmentStatus || '-'}</td> */}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  {!isResolved && (
                    <div className="details-buttons">
                      <button
                        className="edit-button"
                        onClick={() => handleEdit('attachments')}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default Overview;
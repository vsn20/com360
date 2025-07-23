'use client';

import React, { useEffect, useState } from 'react';
import { fetchreqbyid, fetchServiceRequestById, updateServiceRequestStatus, fetchActivitiesBySrId, addActivity, addAttachment, updateActivity, fetchResolverAttachments, deleteAttachment } from '@/app/serverActions/ServiceRequests/Requests';
import './overview.css';
import { useRouter } from 'next/navigation';

const Requests = ({ orgid, empid, type, subtype, priority, previousServiceRequests, onBack }) => {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSrNum, setSelectedSrNum] = useState(null);
  const [serviceRequestDetails, setServiceRequestDetails] = useState(null);
  const [activities, setActivities] = useState([]);
  const [newActivities, setNewActivities] = useState([]);
  const [editingActivity, setEditingActivity] = useState(null);
  const [newAttachments, setNewAttachments] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [resolverFiles, setResolverFiles] = useState([]);
  const [readOnlyMode, setReadOnlyMode] = useState(false); // New state for read-only mode
  const [formData, setFormData] = useState({
    serviceName: '',
    statusCd: 'Open',
    priorityCd: '',
    typeCd: '',
    subTypeCd: '',
    createdBy: '',
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

  const statusOptions = [
    { id: '1', Name: 'Open' },
    { id: '2', Name: 'In Progress' },
    { id: '4', Name: 'Resolved' },
  ];

  const formatDate = (date) => {
    if (!date) return '-';
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '-';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetchreqbyid();
        setRequests(response.rows || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching requests:', err);
        setError(err.message || 'Failed to load service requests');
        setRequests([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const loadServiceRequestDetails = async () => {
      if (!selectedSrNum || !orgid || !empid) {
        setServiceRequestDetails(null);
        setFormData({
          serviceName: '',
          statusCd: 'Open',
          priorityCd: '',
          typeCd: '',
          subTypeCd: '',
          createdBy: '',
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
        setExistingFiles([]);
        setResolverFiles([]);
        setActivities([]);
        setNewActivities([]);
        setNewAttachments([]);
        setEditingActivity(null);
        return;
      }
      try {
        setIsLoading(true);
        const [serviceRequest, activityRows, resolverAttachments] = await Promise.all([
          fetchServiceRequestById(selectedSrNum, orgid, empid),
          fetchActivitiesBySrId(selectedSrNum, orgid, empid),
          fetchResolverAttachments(selectedSrNum, orgid, empid),
        ]);
        setServiceRequestDetails(serviceRequest);
        setFormData({
          serviceName: serviceRequest.SERVICE_NAME || '',
          statusCd: serviceRequest.STATUS_CD || 'Open',
          priorityCd: serviceRequest.PRIORITY_CD || '',
          typeCd: serviceRequest.TYPE_CD || '',
          subTypeCd: serviceRequest.SUB_TYPE_CD || '',
          createdBy: serviceRequest.CREATED_BY || '',
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
        setResolverFiles(
          resolverAttachments.map((att) => ({
            sr_att_id: att.SR_ATT_ID,
            name: att.FILE_NAME,
            file_path: att.FILE_PATH,
            type: att.TYPE_CD || '',
            comments: att.COMMENTS || '',
            attachmentStatus: att.ATTACHMENT_STATUS || '',
          })) || []
        );
        setActivities(activityRows);
        setNewActivities([]);
        setNewAttachments([]);
        setEditingActivity(null);
        setError(null);
      } catch (err) {
        console.error('Error loading service request details, activities, or resolver attachments:', err);
        setError(err.message || 'Failed to load service request details, activities, or resolver attachments');
        setServiceRequestDetails(null);
        setActivities([]);
        setResolverFiles([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadServiceRequestDetails();
  }, [selectedSrNum, orgid, empid]);

  const handleRowClickInternal = (srNum, readOnly = false) => {
    setSelectedSrNum(srNum);
    setReadOnlyMode(readOnly); // Set read-only mode based on parameter
    setError(null);
  };

  const handleBack = () => {
    router.refresh();
    setSelectedSrNum(null);
    setServiceRequestDetails(null);
    setActivities([]);
    setNewActivities([]);
    setNewAttachments([]);
    setEditingActivity(null);
    setExistingFiles([]);
    setResolverFiles([]);
    setReadOnlyMode(false); // Reset read-only mode
    setError(null);
    // onBack(); // Call the onBack prop to return to Overview
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleActivityFormChange = (index, field, value) => {
    setNewActivities((prev) =>
      prev.map((activity, i) =>
        i === index ? { ...activity, [field]: value } : activity
      )
    );
  };

  const handleEditActivityFormChange = (field, value) => {
    setEditingActivity((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddActivityForm = () => {
    setNewActivities((prev) => [
      ...prev,
      {
        TYPE: '',
        SUB_TYPE: '',
        COMMENTS: '',
        START_DATE: '',
        END_DATE: '',
      },
    ]);
  };

  const handleRemoveActivityForm = (index) => {
    setNewActivities((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditActivity = (activity) => {
    setEditingActivity({
      ACT_ID: activity.ACT_ID,
      SR_ID: activity.SR_ID,
      TYPE: activity.TYPE || '',
      SUB_TYPE: activity.SUB_TYPE || '',
      COMMENTS: activity.COMMENTS || '',
      START_DATE: formatDate(activity.START_DATE),
      END_DATE: formatDate(activity.END_DATE),
    });
  };

  const handleCancelEditActivity = () => {
    setEditingActivity(null);
  };

  const handleSaveActivity = async (index) => {
    setError(null);
    setIsLoading(true);

    try {
      if (!orgid || !empid) {
        throw new Error('Organization ID or Employee ID is missing');
      }
      const activity = newActivities[index];
      if (!activity.TYPE) {
        throw new Error('Activity Type is required');
      }
      const result = await addActivity({
        SR_ID: selectedSrNum,
        orgid,
        empid,
        TYPE: activity.TYPE,
        SUB_TYPE: activity.SUB_TYPE,
        COMMENTS: activity.COMMENTS,
        START_DATE: activity.START_DATE || null,
        END_DATE: activity.END_DATE || null,
      });
      if (result && result.success) {
        const updatedActivities = await fetchActivitiesBySrId(selectedSrNum, orgid, empid);
        setActivities(updatedActivities);
        setNewActivities((prev) => prev.filter((_, i) => i !== index));
        setError(null);
      } else {
        setError(result.error || 'Failed to save activity: Invalid response from server');
      }
    } catch (err) {
      console.error('Error saving activity:', err);
      setError(err.message || 'An unexpected error occurred while saving activity.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEditedActivity = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (!orgid || !empid) {
        throw new Error('Organization ID or Employee ID is missing');
      }
      if (!editingActivity.TYPE) {
        throw new Error('Activity Type is required');
      }
      const result = await updateActivity({
        ACT_ID: editingActivity.ACT_ID,
        SR_ID: selectedSrNum,
        orgid,
        empid,
        TYPE: editingActivity.TYPE,
        SUB_TYPE: editingActivity.SUB_TYPE,
        COMMENTS: editingActivity.COMMENTS,
        START_DATE: editingActivity.START_DATE || null,
        END_DATE: editingActivity.END_DATE || null,
      });
      if (result && result.success) {
        const updatedActivities = await fetchActivitiesBySrId(selectedSrNum, orgid, empid);
        setActivities(updatedActivities);
        setEditingActivity(null);
        setError(null);
      } else {
        setError(result.error || 'Failed to save activity: Invalid response from server');
      }
    } catch (err) {
      console.error('Error saving edited activity:', err);
      setError(err.message || 'An unexpected error occurred while saving activity.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttachmentChange = (index, field, value) => {
    setNewAttachments((prev) =>
      prev.map((attachment, i) =>
        i === index ? { ...attachment, [field]: field === 'file' ? value : value } : attachment
      )
    );
  };

  const handleAddAttachmentForm = () => {
    setNewAttachments((prev) => [
      ...prev,
      { file: null, TYPE_CD: '', COMMENTS: '' },
    ]);
  };

  const handleRemoveAttachmentForm = (index) => {
    setNewAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAttachment = async (index) => {
    setError(null);
    setIsLoading(true);

    try {
      if (!orgid || !empid) {
        throw new Error('Organization ID or Employee ID is missing');
      }
      const attachment = newAttachments[index];
      if (!attachment.file) {
        throw new Error('File is required');
      }
      const result = await addAttachment(
        { SR_ID: selectedSrNum, orgid, empid, TYPE_CD: attachment.TYPE_CD, COMMENTS: attachment.COMMENTS },
        attachment.file
      );
      if (result && result.success) {
        const [updatedRequest, updatedResolverAttachments] = await Promise.all([
          fetchServiceRequestById(selectedSrNum, orgid, empid),
          fetchResolverAttachments(selectedSrNum, orgid, empid),
        ]);
        setServiceRequestDetails(updatedRequest);
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
        setResolverFiles(
          updatedResolverAttachments.map((att) => ({
            sr_att_id: att.SR_ATT_ID,
            name: att.FILE_NAME,
            file_path: att.FILE_PATH,
            type: att.TYPE_CD || '',
            comments: att.COMMENTS || '',
            attachmentStatus: att.ATTACHMENT_STATUS || '',
          })) || []
        );
        setNewAttachments((prev) => prev.filter((_, i) => i !== index));
        setError(null);
      } else {
        setError(result.error || 'Failed to save attachment: Invalid response from server');
      }
    } catch (err) {
      console.error('Error saving attachment:', err);
      setError(err.message || 'An unexpected error occurred while saving attachment.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAttachment = async (srAttId) => {
    setError(null);
    setIsLoading(true);

    try {
      if (!orgid || !empid) {
        throw new Error('Organization ID or Employee ID is missing');
      }
      const result = await deleteAttachment({
        SR_ATT_ID: srAttId,
        SR_ID: selectedSrNum,
        orgid,
        empid,
      });
      if (result && result.success) {
        const [updatedRequest, updatedResolverAttachments] = await Promise.all([
          fetchServiceRequestById(selectedSrNum, orgid, empid),
          fetchResolverAttachments(selectedSrNum, orgid, empid),
        ]);
        setServiceRequestDetails(updatedRequest);
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
        setResolverFiles(
          updatedResolverAttachments.map((att) => ({
            sr_att_id: att.SR_ATT_ID,
            name: att.FILE_NAME,
            file_path: att.FILE_PATH,
            type: att.TYPE_CD || '',
            comments: att.COMMENTS || '',
            attachmentStatus: att.ATTACHMENT_STATUS || '',
          })) || []
        );
        setError(null);
      } else {
        setError(result.error || 'Failed to delete attachment: Invalid response from server');
      }
    } catch (err) {
      console.error('Error deleting attachment:', err);
      setError(err.message || 'An unexpected error occurred while deleting attachment.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleServiceCompleted = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (!orgid || !empid) {
        throw new Error('Organization ID or Employee ID is missing');
      }
      const result = await updateServiceRequestStatus({
        SR_NUM: selectedSrNum,
        orgid,
        empid,
        statusCd: 'Resolved',
      });
      if (result && result.success) {
        const updatedRequest = await fetchServiceRequestById(selectedSrNum, orgid, empid);
        setServiceRequestDetails(updatedRequest);
        setFormData({
          serviceName: updatedRequest.SERVICE_NAME || '',
          statusCd: updatedRequest.STATUS_CD || 'Open',
          priorityCd: updatedRequest.PRIORITY_CD || '',
          typeCd: updatedRequest.TYPE_CD || '',
          subTypeCd: updatedRequest.SUB_TYPE_CD || '',
          createdBy: updatedRequest.CREATED_BY || '',
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
        setRequests((prev) =>
          prev.map((req) =>
            req.SR_NUM === selectedSrNum ? { ...req, STATUS_CD: updatedRequest.STATUS_CD } : req
          )
        );
        setError(null);
      } else {
        setError(result.error || 'Failed to save: Invalid response from server');
      }
    } catch (err) {
      console.error('Error setting service request to resolved:', err);
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveStatus = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (!orgid || !empid) {
        throw new Error('Organization ID or Employee ID is missing');
      }
      const result = await updateServiceRequestStatus({
        SR_NUM: selectedSrNum,
        orgid,
        empid,
        statusCd: formData.statusCd,
      });
      if (result && result.success) {
        const [updatedRequest, updatedResolverAttachments] = await Promise.all([
          fetchServiceRequestById(selectedSrNum, orgid, empid),
          fetchResolverAttachments(selectedSrNum, orgid, empid),
        ]);
        setServiceRequestDetails(updatedRequest);
        setFormData({
          serviceName: updatedRequest.SERVICE_NAME || '',
          statusCd: updatedRequest.STATUS_CD || 'Open',
          priorityCd: updatedRequest.PRIORITY_CD || '',
          typeCd: updatedRequest.TYPE_CD || '',
          subTypeCd: updatedRequest.SUB_TYPE_CD || '',
          createdBy: updatedRequest.CREATED_BY || '',
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
        setResolverFiles(
          updatedResolverAttachments.map((att) => ({
            sr_att_id: att.SR_ATT_ID,
            name: att.FILE_NAME,
            file_path: att.FILE_PATH,
            type: att.TYPE_CD || '',
            comments: att.COMMENTS || '',
            attachmentStatus: att.ATTACHMENT_STATUS || '',
          })) || []
        );
        setRequests((prev) =>
          prev.map((req) =>
            req.SR_NUM === selectedSrNum ? { ...req, STATUS_CD: updatedRequest.STATUS_CD } : req
          )
        );
        setError(null);
      } else {
        setError(result.error || 'Failed to save: Invalid response from server');
      }
    } catch (err) {
      console.error('Error saving service request status:', err);
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsLoading(false);
    }
  };

  const getdisplayprojectid = (prjid) => {
    return prjid ? prjid.split('-')[1] || prjid : '-';
  };

  const isResolved = formData.statusCd === 'Resolved';

  return (
    <div className="employee-overview-container">
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading-message">Loading...</div>}
      {!selectedSrNum ? (
        <div className="employee-list">
          <button className="back-button" onClick={onBack} disabled={isLoading}>
            Back
          </button>
          {!isLoading && !error && requests.length === 0 && (
            <p>No service requests found.</p>
          )}
          {!isLoading && requests.length > 0 && (
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Service Request ID</th>
                  <th>Service Name</th>
                  <th>Status</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr
                    key={req.SR_NUM}
                    onClick={() => handleRowClickInternal(req.SR_NUM, false)}
                    className="employee-table-row-clickable"
                  >
                    <td>SR-{getdisplayprojectid(req.SR_NUM)}</td>
                    <td>{req.SERVICE_NAME || '-'}</td>
                    <td>{req.STATUS_CD || '-'}</td>
                    <td>{req.CREATED_BY || '-'}</td>
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
              {readOnlyMode ? (
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
                      <label>Created By</label>
                      <p>{serviceRequestDetails.CREATED_BY || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Due Date</label>
                      <p>{formatDate(serviceRequestDetails.DUE_DATE)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveStatus();
                  }}
                >
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
                      <select
                        name="statusCd"
                        value={formData.statusCd}
                        onChange={handleFormChange}
                        className="form-control"
                        disabled={isResolved}
                      >
                        {statusOptions.map((status) => (
                          <option key={status.id} value={status.Name}>
                            {status.Name}
                          </option>
                        ))}
                      </select>
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
                      <label>Created By</label>
                      <p>{serviceRequestDetails.CREATED_BY || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Due Date</label>
                      <p>{formatDate(serviceRequestDetails.DUE_DATE)}</p>
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button
                      type="submit"
                      className="save-button"
                      disabled={isLoading || isResolved}
                    >
                      {isLoading ? 'Saving...' : 'Save Status'}
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => setFormData({ ...formData, statusCd: serviceRequestDetails.STATUS_CD || 'Open' })}
                      disabled={isLoading || isResolved}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="details-block">
              <h3>Additional Details</h3>
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
                    {serviceRequestDetails.PAR_ROW_ID ? (
                      <button
                        onClick={() => handleRowClickInternal(serviceRequestDetails.PAR_ROW_ID, true)}
                        className="link-button"
                      >
                        SR-{getdisplayprojectid(serviceRequestDetails.PAR_ROW_ID)}
                      </button>
                    ) : (
                      <p>-</p>
                    )}
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
              </div>
            </div>

            <div className="details-block">
              <h3>Description and Comments</h3>
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
              </div>
            </div>

            <div className="details-block">
              <h3>Attachments</h3>
              <div>
                <div className="details-row">
                  {existingFiles.length > 0 && (
                    <div className="details-group">
                      <h4>Assigned By Attachments</h4>
                      <table className="attachment-table">
                        <thead>
                          <tr>
                            <th>File Name</th>
                            <th>Comments</th>
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="details-block">
              <h3>Resolver Attachments</h3>
              {!readOnlyMode && (
                <div className="details-buttons">
                  <button
                    className="save-button"
                    onClick={handleAddAttachmentForm}
                    disabled={isLoading || isResolved}
                  >
                    Add Attachment
                  </button>
                </div>
              )}
              {resolverFiles.length > 0 && (
                <div className="details-group">
                  <h4>Other Attachments</h4>
                  <table className="attachment-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Comments</th>
                        {!readOnlyMode && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {resolverFiles.map((fileObj, index) => (
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
                          {!readOnlyMode && (
                            <td>
                              <button
                                className="delete-button"
                                onClick={() => handleDeleteAttachment(fileObj.sr_att_id)}
                                disabled={isLoading || isResolved}
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!readOnlyMode &&
                newAttachments.map((attachment, index) => (
                  <form
                    key={index}
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveAttachment(index);
                    }}
                    className="attachment-form"
                  >
                    <div className="form-row">
                      <div className="form-group">
                        <label>File*</label>
                        <input
                          type="file"
                          onChange={(e) => handleAttachmentChange(index, 'file', e.target.files[0])}
                          required
                          disabled={isResolved}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Comments</label>
                        <textarea
                          value={attachment.COMMENTS}
                          onChange={(e) => handleAttachmentChange(index, 'COMMENTS', e.target.value)}
                          placeholder="Enter Comments"
                          rows={4}
                          disabled={isResolved}
                        />
                      </div>
                    </div>
                    <div className="form-buttons">
                      <button
                        type="submit"
                        className="save-button"
                        disabled={isLoading || isResolved}
                      >
                        {isLoading ? 'Saving...' : 'Save Attachment'}
                      </button>
                      <button
                        type="button"
                        className="cancel-button"
                        onClick={() => handleRemoveAttachmentForm(index)}
                        disabled={isLoading || isResolved}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ))}
            </div>

            <div className="details-block">
              <h3>Activities</h3>
              {!readOnlyMode && (
                <div className="details-buttons">
                  <button
                    className="save-button"
                    onClick={handleAddActivityForm}
                    disabled={isLoading || isResolved}
                  >
                    Add Activity
                  </button>
                </div>
              )}
              {activities.length > 0 && (
                <div className="details-group">
                  <h4>Existing Activities</h4>
                  <table className="attachment-table">
                    <thead>
                      <tr>
                        <th>Activity ID</th>
                        <th>Type</th>
                        <th>Sub-Type</th>
                        <th>Comments</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Created By</th>
                        <th>Created</th>
                        <th>Last Updated By</th>
                        <th>Last Updated</th>
                        {!readOnlyMode && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((activity) => (
                        <tr key={activity.ACT_ID}>
                          <td>{activity.ACT_ID}</td>
                          <td>{activity.TYPE || '-'}</td>
                          <td>{activity.SUB_TYPE || '-'}</td>
                          <td>{activity.COMMENTS || '-'}</td>
                          <td>{formatDate(activity.START_DATE)}</td>
                          <td>{formatDate(activity.END_DATE)}</td>
                          <td>{activity.CREATED_BY || '-'}</td>
                          <td>{formatDate(activity.CREATED)}</td>
                          <td>{activity.LAST_UPD_BY || '-'}</td>
                          <td>{formatDate(activity.LAST_UPD)}</td>
                          {!readOnlyMode && (
                            <td>
                              <button
                                className="edit-button"
                                onClick={() => handleEditActivity(activity)}
                                disabled={isLoading || isResolved}
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!readOnlyMode && editingActivity && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveEditedActivity();
                  }}
                  className="activity-form"
                >
                  <div className="form-row">
                    <div className="form-group">
                      <label>Type*</label>
                      <select
                        value={editingActivity.TYPE}
                        onChange={(e) => handleEditActivityFormChange('TYPE', e.target.value)}
                        required
                        disabled={isResolved}
                      >
                        <option value="">Select Type</option>
                        {type.map((t) => (
                          <option key={t.id} value={t.Name}>
                            {t.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Sub-Type</label>
                      <select
                        value={editingActivity.SUB_TYPE}
                        onChange={(e) => handleEditActivityFormChange('SUB_TYPE', e.target.value)}
                        disabled={isResolved}
                      >
                        <option value="">Select Sub-Type</option>
                        {subtype.map((s) => (
                          <option key={s.id} value={s.Name}>
                            {s.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Comments</label>
                      <textarea
                        value={editingActivity.COMMENTS}
                        onChange={(e) => handleEditActivityFormChange('COMMENTS', e.target.value)}
                        placeholder="Enter Comments"
                        rows={4}
                        disabled={isResolved}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={editingActivity.START_DATE}
                        onChange={(e) => handleEditActivityFormChange('START_DATE', e.target.value)}
                        disabled={isResolved}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date</label>
                      <input
                        type="date"
                        value={editingActivity.END_DATE}
                        onChange={(e) => handleEditActivityFormChange('END_DATE', e.target.value)}
                        disabled={isResolved}
                      />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button
                      type="submit"
                      className="save-button"
                      disabled={isLoading || isResolved}
                    >
                      {isLoading ? 'Saving...' : 'Save Activity'}
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={handleCancelEditActivity}
                      disabled={isLoading || isResolved}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {!readOnlyMode &&
                newActivities.map((activity, index) => (
                  <form
                    key={index}
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveActivity(index);
                    }}
                    className="activity-form"
                  >
                    <div className="form-row">
                      <div className="form-group">
                        <label>Type*</label>
                        <select
                          value={activity.TYPE}
                          onChange={(e) => handleActivityFormChange(index, 'TYPE', e.target.value)}
                          required
                          disabled={isResolved}
                        >
                          <option value="">Select Type</option>
                          {type.map((t) => (
                            <option key={t.id} value={t.Name}>
                              {t.Name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Sub-Type</label>
                        <select
                          value={activity.SUB_TYPE}
                          onChange={(e) => handleActivityFormChange(index, 'SUB_TYPE', e.target.value)}
                          disabled={isResolved}
                        >
                          <option value="">Select Sub-Type</option>
                          {subtype.map((s) => (
                            <option key={s.id} value={s.Name}>
                              {s.Name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Comments</label>
                        <textarea
                          value={activity.COMMENTS}
                          onChange={(e) => handleActivityFormChange(index, 'COMMENTS', e.target.value)}
                          placeholder="Enter Comments"
                          rows={4}
                          disabled={isResolved}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Start Date</label>
                        <input
                          type="date"
                          value={activity.START_DATE}
                          onChange={(e) => handleActivityFormChange(index, 'START_DATE', e.target.value)}
                          disabled={isResolved}
                        />
                      </div>
                      <div className="form-group">
                        <label>End Date</label>
                        <input
                          type="date"
                          value={activity.END_DATE}
                          onChange={(e) => handleActivityFormChange(index, 'END_DATE', e.target.value)}
                          disabled={isResolved}
                        />
                      </div>
                    </div>
                    <div className="form-buttons">
                      <button
                        type="submit"
                        className="save-button"
                        disabled={isLoading || isResolved}
                      >
                        {isLoading ? 'Saving...' : 'Save Activity'}
                      </button>
                      <button
                        type="button"
                        className="cancel-button"
                        onClick={() => handleRemoveActivityForm(index)}
                        disabled={isLoading || isResolved}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ))}
            </div>

            {!readOnlyMode && (
              <div className="details-block">
                <div className="form-buttons">
                  <button
                    type="button"
                    className="save-button"
                    onClick={handleServiceCompleted}
                    disabled={isLoading || isResolved}
                  >
                    {isLoading ? 'Saving...' : 'Service Completed'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default Requests;
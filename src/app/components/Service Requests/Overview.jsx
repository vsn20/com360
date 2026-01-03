'use client';

import React, { useState, useEffect } from 'react';
import AddServiceReq from './AddServiceReq';
import { fetchServiceRequestById, getemployeename, updateServiceRequest, getparentsr, fetchActivitiesForCreator, fetchResolverAttachmentsForCreator } from '@/app/serverActions/ServiceRequests/Overview';
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
  accountRows,
  empname,
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
  const [activities, setActivities] = useState([]);
  const [resolverAttachments, setResolverAttachments] = useState([]);
  
  // Pagination and filtering state
  const [sortConfig, setSortConfig] = useState({ column: 'SR_NUM', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [requestsPerPage, setRequestsPerPage] = useState(10);
  const [requestsPerPageInput, setRequestsPerPageInput] = useState((10).toString());

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
    accountname:'',
  });
  const [existingFiles, setExistingFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  // Determine if the service request is resolved
  const isResolved = formData.statusCd === 'Resolved';

  // Utility function to format dates for display and form input
  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '';
  };

  const formatDateDisplay = (date) => {
    if (!date || isNaN(new Date(date))) return 'N/A';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
  };

  // Helper to get Parent SR Name for Display
  const getParentSrName = (parRowId) => {
    if (!parRowId) return '-';
    // Try to find the name in the loaded parentServiceRequests list
    const parent = parentServiceRequests.find(sr => sr.SR_NUM === parRowId);
    if (parent) return parent.SERVICE_NAME;
    
    // Fallback to displaying ID if name not found in list
    return `SR-${getdisplayprojectid(parRowId)}`;
  };

  useEffect(() => {
    handleBack();
  }, [searchparams.get('refresh')]);

  useEffect(() => {
    setAllServiceRequests(serviceRequests);
  }, [serviceRequests]);

  useEffect(() => {
    if (allServiceRequests.length > 0) {
      setAllServiceRequests([...allServiceRequests].sort((a, b) => 
        sortServiceRequests(a, b, sortConfig.column, sortConfig.direction)
      ));
    }
  }, [sortConfig]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setRequestsPerPageInput(requestsPerPage.toString());
  }, [requestsPerPage]);

  useEffect(() => {
    if (selectedSrNum) {
      const loadServiceRequestDetails = async () => {
        try {
          setIsLoading(true);
          const serviceRequest = await fetchServiceRequestById(selectedSrNum, orgid, empid);
          const employeeRequest = await getemployeename(serviceRequest.ASSIGNED_TO);
          const parentRequests = await getparentsr(selectedSrNum);
          
          // Fetch activities and resolver attachments for creator view
          const activitiesResult = await fetchActivitiesForCreator(selectedSrNum, orgid, empid);
          const resolverAttachmentsResult = await fetchResolverAttachmentsForCreator(selectedSrNum, orgid, empid);
          
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
          setActivities(activitiesResult.success ? activitiesResult.activityRows : []);
          setResolverAttachments(resolverAttachmentsResult.success ? resolverAttachmentsResult.attachments : []);
          setError(null);
        } catch (err) {
          console.error('Error loading service request details:', err);
          setError(err.message || 'Failed to load service request details');
          setServiceRequestDetails(null);
          setParentServiceRequests([]);
          setActivities([]);
          setResolverAttachments([]);
        } finally {
          setIsLoading(false);
        }
      };
      loadServiceRequestDetails();
    } else {
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
        accountname:'',
      });
      setExistingFiles([]);
      setNewFiles([]);
      setParentServiceRequests([]);
      setActivities([]);
      setResolverAttachments([]);
    }
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
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleEdit = (section) => {
    if (isResolved) return;
    if (section === 'basic') setIsEditingBasic(true);
    if (section === 'additional') setIsEditingAdditional(true);
    if (section === 'description') setIsEditingDescription(true);
    if (section === 'attachments') setIsEditingAttachments(true);
  };

  // Cancel handlers to reset form data to original values
  const handleCancelBasic = () => {
    setIsEditingBasic(false);
    if (serviceRequestDetails) {
      setFormData(prev => ({
        ...prev,
        serviceName: serviceRequestDetails.SERVICE_NAME || '',
        statusCd: serviceRequestDetails.STATUS_CD || 'Open',
        priorityCd: serviceRequestDetails.PRIORITY_CD || '',
        typeCd: serviceRequestDetails.TYPE_CD || '',
        subTypeCd: serviceRequestDetails.SUB_TYPE_CD || '',
        assignedTo: serviceRequestDetails.ASSIGNED_TO || '',
        dueDate: formatDate(serviceRequestDetails.DUE_DATE),
      }));
    }
    setError(null);
  };

  const handleCancelAdditional = () => {
    setIsEditingAdditional(false);
    if (serviceRequestDetails) {
      setFormData(prev => ({
        ...prev,
        escalatedFlag: !!serviceRequestDetails.ESCALATED_FLAG,
        escalatedTo: serviceRequestDetails.ESCALATED_TO || '',
        escalatedDate: formatDate(serviceRequestDetails.ESCALATED_DATE),
        contactId: serviceRequestDetails.CONTACT_ID || '',
        accountId: serviceRequestDetails.ACCOUNT_ID || '',
        assetId: serviceRequestDetails.ASSET_ID || '',
        parRowId: serviceRequestDetails.PAR_ROW_ID || '',
      }));
    }
    setError(null);
  };

  const handleCancelDescription = () => {
    setIsEditingDescription(false);
    if (serviceRequestDetails) {
      setFormData(prev => ({
        ...prev,
        description: serviceRequestDetails.DESCRIPTION || '',
        comments: serviceRequestDetails.COMMENTS || '',
      }));
    }
    setError(null);
  };

  const handleCancelAttachments = () => {
    setIsEditingAttachments(false);
    if (serviceRequestDetails) {
      setExistingFiles(
        serviceRequestDetails.attachments?.map((att) => ({
          sr_att_id: att.SR_ATT_ID,
          name: att.FILE_NAME,
          file_path: att.FILE_PATH,
          type: att.TYPE_CD || '',
          comments: att.COMMENTS || '',
          attachmentStatus: att.ATTACHMENT_STATUS || '',
        })) || []
      );
      setNewFiles([]);
    }
    setError(null);
  };

  // UPDATED: Handle Form Change with Escalation Logic
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Logic to clear escalated fields if checkbox is unchecked
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
      type: file.type || 'application/octet-stream',
      comments: '',
      attachmentStatus: '',
    }));
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
           accountname:updatedRequest.accountname||'',
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

  // Sorting and filtering functions
  const sortServiceRequests = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'SR_NUM':
        aValue = parseInt(a.SR_NUM.split('-')[1] || a.SR_NUM);
        bValue = parseInt(b.SR_NUM.split('-')[1] || b.SR_NUM);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'SERVICE_NAME':
        aValue = a.SERVICE_NAME || '';
        bValue = b.SERVICE_NAME || '';
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'STATUS_CD':
        aValue = a.STATUS_CD || '';
        bValue = b.STATUS_CD || '';
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'PRIORITY_CD':
        aValue = a.PRIORITY_CD || '';
        bValue = b.PRIORITY_CD || '';
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'CREATED_DATE':
        aValue = new Date(a.CREATED_DATE || 0).getTime();
        bValue = new Date(b.CREATED_DATE || 0).getTime();
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      default:
        return 0;
    }
  };

  const requestSort = (column) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handlePriorityFilterChange = (e) => {
    setPriorityFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleRequestsPerPageInputChange = (e) => {
    setRequestsPerPageInput(e.target.value);
  };

  const handleRequestsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setRequestsPerPage(value);
        setRequestsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setRequestsPerPageInput(requestsPerPage.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      }
    }
  };

  const filteredServiceRequests = allServiceRequests.filter(request => {
    const matchesSearch = request.SERVICE_NAME?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          request.SR_NUM?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.STATUS_CD === statusFilter;
    const matchesPriority = priorityFilter === 'all' || request.PRIORITY_CD === priorityFilter;
    
    let matchesDate = true;
    if (request.CREATED_DATE && (startDate || endDate)) {
      const createdDate = new Date(request.CREATED_DATE);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (start && end && start > end) {
        return false;
      }
      if (start) {
        start.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && createdDate >= start;
      }
      if (end) {
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && createdDate <= end;
      }
    }
    return matchesSearch && matchesStatus && matchesPriority && matchesDate;
  });

  const totalPages = Math.ceil(filteredServiceRequests.length / requestsPerPage);
  const indexOfLastRequest = currentPage * requestsPerPage;
  const indexOfFirstRequest = indexOfLastRequest - requestsPerPage;
  const currentRequests = filteredServiceRequests.slice(indexOfFirstRequest, indexOfLastRequest);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      setPageInputValue((currentPage + 1).toString());
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
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

  const getdisplayprojectid = (prjid) => {
    return prjid?.split('-')[1] || prjid;
  };
  
  const getdisplayemployeeid = (prjid) => {
    return prjid?.split('_')[1] || prjid;
  };

  const getesclatedName = (superiorId) => {
    const superior = employees.find(emp => emp.empid === superiorId);
    return superior ? `${superior.EMP_FST_NAME} ${superior.EMP_LAST_NAME || ''}`.trim() : 'not escalated';
  };


  // Get unique status and priority values for filters
  const uniqueStatuses = [...new Set(allServiceRequests.map(req => req.STATUS_CD).filter(Boolean))];
  const uniquePriorities = [...new Set(allServiceRequests.map(req => req.PRIORITY_CD).filter(Boolean))];

  if (isLoading && !serviceRequestDetails) {
    return (
      <div className="service-requests-overview-container">
        <div className="loading-message">Loading...</div>
      </div>
    );
  }

  return (
    <div className="service-requests-overview-container">
      {error && <div className="error-message">{error}</div>}
      
      {req && !isAdd ? (
        <Requests
          orgid={orgid}
          empid={empid}
          type={type}
          subtype={subtype}
          priority={priority}
          previousServiceRequests={previousServiceRequests}
          onBack={handleBack}
        />
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
          accountRows={accountRows}
          empname={empname}
        />
      ) : !selectedSrNum ? (
        <div className="service-requests-list" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div className="title">Service Requests</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="button" onClick={handlerequest}>
                Action Required - Service Requests.
              </button>
              <button className="button" onClick={handleAddServiceRequest}>
                Create Service Request
              </button>
            </div>
          </div>

          <div className="search-filter-container">
            <input
              type="text"
              placeholder="Search by Service Name or SR ID"
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="filter-select"
            >
              <option value="all">All Status</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={handlePriorityFilterChange}
              className="filter-select"
            >
              <option value="all">All Priority</option>
              {uniquePriorities.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </div>

          {filteredServiceRequests.length === 0 && !error ? (
            <p className="empty-state">No service requests found.</p>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="service-requests-table four-column93">
                  <colgroup>
                    
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={sortConfig.column === 'SERVICE_NAME' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('SERVICE_NAME')}>
                        Service Name
                      </th>
                      <th className={sortConfig.column === 'STATUS_CD' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('STATUS_CD')}>
                        Status
                      </th>
                      <th className={sortConfig.column === 'PRIORITY_CD' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('PRIORITY_CD')}>
                        Priority
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRequests.map((request) => (
                      <tr
                        key={request.SR_NUM}
                        onClick={() => handleRowClick(request.SR_NUM)}
                        style={{ cursor: 'pointer' }}
                        className={selectedSrNum === request.SR_NUM ? 'selected-row' : ''}
                      >
                        <td className="id-cell">
                          <span className={request.STATUS_CD?.toLowerCase() === 'resolved' ? 'service-request-indicator-active' : 'service-request-indicator-inactive'}></span>
                          {request.SERVICE_NAME || '-'}
                        </td>
                        <td className="status-cell">
                          <span className={`status-badge ${request.STATUS_CD?.toLowerCase() === 'resolved' ? 'active' : 'inactive'}`}>
                            {request.STATUS_CD || '-'}
                          </span>
                        </td>
                        <td className="priority-cell">{request.PRIORITY_CD || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredServiceRequests.length > requestsPerPage && (
                <div className="pagination-container">
                  <button
                    className="button"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  <span className="pagination-text">
                    Page{' '}
                    <input
                      type="text"
                      value={pageInputValue}
                      onChange={handlePageInputChange}
                      onKeyPress={handlePageInputKeyPress}
                      className="pagination-input"
                    />{' '}
                    of {totalPages}
                  </span>
                  <button
                    className="button"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
              <div className="rows-per-page-container">
                <label className="rows-per-page-label">Rows/ Page</label>
                <input
                  type="text"
                  value={requestsPerPageInput}
                  onChange={handleRequestsPerPageInputChange}
                  onKeyPress={handleRequestsPerPageInputKeyPress}
      
                  placeholder="Requests per page"
                  className="rows-per-page-input"
                  aria-label="Number of rows per page"
                />
              </div>
            </>
          )}
        </div>
      ) : (
        serviceRequestDetails && (
          <div className="service-request-details-container">
            <div className="header-section">
              <div className="title">{`${formData.serviceName || '-'}`} Service Request Details</div>
              <button className="back-button" onClick={handleBack}></button>
            </div>

            <div className="details-block">
              <div className="section-header">
                <div>Basic Details</div>
                {!isResolved && !isEditingBasic && (
                  <button className="button" onClick={() => handleEdit('basic')}>Edit</button>
                )}
              </div>
              {isEditingBasic ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave('basic');
                  }}
                >
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
                        value={getesclatedName(formData.assignedTo)}
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
                      className="save"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="cancel"
                      onClick={handleCancelBasic}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-g">
                      <label>Service Name</label>
                      <p>{serviceRequestDetails.SERVICE_NAME || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Status</label>
                      <p>{serviceRequestDetails.STATUS_CD || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Priority</label>
                      <p>{serviceRequestDetails.PRIORITY_CD || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Type</label>
                      <p>{serviceRequestDetails.TYPE_CD || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Sub-Type</label>
                      <p>{serviceRequestDetails.SUB_TYPE_CD || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Assigned To</label>
                      <p>{serviceRequestDetails.employees ? `${serviceRequestDetails.employees.EMP_FST_NAME} ${serviceRequestDetails.employees.EMP_LAST_NAME}` : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Due Date</label>
                      <p>{formatDate(serviceRequestDetails.DUE_DATE) || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="details-block">
              <div className="section-header">
                <div>Additional Details</div>
                {!isResolved && !isEditingAdditional && (
                  <button className="button" onClick={() => handleEdit('additional')}>Edit</button>
                )}
              </div>
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
                      <select 
                        name="escalatedTo" 
                        value={formData.escalatedTo} 
                        onChange={handleFormChange}
                        disabled={!formData.escalatedFlag}
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
                        disabled={!formData.escalatedFlag}
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
                           {sr.SERVICE_NAME || '-'}
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
                  <div className="form-buttons">
                    <button
                      type="submit"
                      className="save"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="cancel"
                      onClick={handleCancelAdditional}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-g">
                      <label>Escalated</label>
                      <p>{serviceRequestDetails.ESCALATED_FLAG ? 'Yes' : 'No'}</p>
                    </div>
                    <div className="details-g">
                      <label>Escalated To</label>
                      <p>{getesclatedName(serviceRequestDetails.ESCALATED_TO) || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Escalated Date</label>
                      <p>{formatDate(serviceRequestDetails.ESCALATED_DATE) || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Parent SR Name</label>
                      <p>
                        {getParentSrName(serviceRequestDetails.PAR_ROW_ID)}
                      </p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Contact ID</label>
                      <p>{serviceRequestDetails.CONTACT_ID || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Account ID</label>
                      <p>{serviceRequestDetails.accountname || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Asset ID</label>
                      <p>{serviceRequestDetails.ASSET_ID || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="details-block">
              <div className="section-header">
                <div>Description and Comments</div>
                {!isResolved && !isEditingDescription && (
                  <button className="button" onClick={() => handleEdit('description')}>Edit</button>
                )}
              </div>
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
                      className="save"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="cancel"
                      onClick={handleCancelDescription}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-g">
                      <label>Description</label>
                      <p>{serviceRequestDetails.DESCRIPTION || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Comments</label>
                      <p>{serviceRequestDetails.COMMENTS || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="details-block">
              <div className="section-header">
                <div>Attachments</div>
                {!isResolved && !isEditingAttachments && (
                  <button className="button" onClick={() => handleEdit('attachments')}>Edit</button>
                )}
              </div>
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
                        <div>Attached Files</div>
                        <div className="table-wrapper">
                          <table className="attachment-table">
                            <thead>
                              <tr>
                                <th>File Name</th>
                                <th>Type</th>
                                <th>Comments</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {existingFiles.map((fileObj, index) => (
                                <tr key={`existing-${index}`}>
                                  <td>
                                    <a
                                      href={`/uploads/ServiceRequests/${fileObj.file_path}`}
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
                                  <td>
                                    <button
                                      type="button"
                                      className="cancel"
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
                                  <td>
                                    <button
                                      type="button"
                                      className="cancel"
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
                    </div>
                  )}
                  <div className="form-buttons">
                    <button
                      type="submit"
                      className="save"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="cancel"
                      onClick={handleCancelAttachments}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    {existingFiles.length > 0 && (
                      <div className="details-g">
                        <div>Attached Files</div>
                        <div className="table-wrapper">
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
                                      href={`/uploads/ServiceRequests/${fileObj.file_path}`}
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
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Resolver Attachments Section - Read Only for Creator */}
            <div className="details-block">
              <div className="section-header">
                <div>Resolver Attachments</div>
              </div>
              <div className="view-details">
                {resolverAttachments.length > 0 ? (
                  <div className="details-row">
                    <div className="details-g">
                      <div className="table-wrapper">
                        <table className="attachment-table">
                          <thead>
                            <tr>
                              <th>File Name</th>
                              <th>Comments</th>
                              <th>Added By</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resolverAttachments.map((fileObj, index) => (
                              <tr key={index}>
                                <td>
                                  <a
                                    href={`/uploads/ServiceRequests/${fileObj.FILE_PATH}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {fileObj.FILE_NAME}
                                  </a>
                                </td>
                                <td>{fileObj.COMMENTS || '-'}</td>
                                <td>{fileObj.CREATED_BY_NAME || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No resolver attachments yet.</p>
                )}
              </div>
            </div>

            {/* Activities Section - Read Only for Creator */}
            <div className="details-block">
              <div className="section-header">
                <div>Activities</div>
              </div>
              <div className="view-details">
                {activities.length > 0 ? (
                  <div className="details-row">
                    <div className="details-g">
                      <div className="table-wrapper">
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
                            </tr>
                          </thead>
                          <tbody>
                            {activities.map((activity) => (
                              <tr key={activity.ACT_ID}>
                                <td>{activity.ACT_ID}</td>
                                <td>{activity.TYPE || '-'}</td>
                                <td>{activity.SUB_TYPE || '-'}</td>
                                <td>{activity.COMMENTS || '-'}</td>
                                <td>{formatDate(activity.START_DATE) || '-'}</td>
                                <td>{formatDate(activity.END_DATE) || '-'}</td>
                                <td>{activity.CREATED_BY_NAME || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No activities yet.</p>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default Overview;
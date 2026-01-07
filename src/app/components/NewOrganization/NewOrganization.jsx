'use client'
import React, { useState, useEffect } from 'react'
import { fetchRequests, approveRequest, rejectRequest, fetchExistingOrganizations } from '@/app/serverActions/NewOrganizations/FetchNewOrganization'
import styles from './neworg.module.css'

const NewOrganization = ({ initialRequests = [], initialOrganizations = [] }) => {
  const [requests, setRequests] = useState(initialRequests);
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [processingId, setProcessingId] = useState(null); 
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // State to toggle views
  const [showRequests, setShowRequests] = useState(false);
  
  // Search and filter states for Organizations
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [orgPlanFilter, setOrgPlanFilter] = useState('all');
  
  // Search and filter states for Requests
  const [reqSearchQuery, setReqSearchQuery] = useState('');
  const [reqStatusFilter, setReqStatusFilter] = useState('all');
  
  // Pagination states for Organizations
  const [orgCurrentPage, setOrgCurrentPage] = useState(1);
  const [orgPageInputValue, setOrgPageInputValue] = useState('1');
  const [orgPerPage, setOrgPerPage] = useState(10);
  const [orgPerPageInput, setOrgPerPageInput] = useState('10');
  
  // Pagination states for Requests
  const [reqCurrentPage, setReqCurrentPage] = useState(1);
  const [reqPageInputValue, setReqPageInputValue] = useState('1');
  const [reqPerPage, setReqPerPage] = useState(10);
  const [reqPerPageInput, setReqPerPageInput] = useState('10');
  
  // Sorting states for Organizations
  const [orgSortConfig, setOrgSortConfig] = useState({ column: 'org_name', direction: 'asc' });
  
  // Sorting states for Requests
  const [reqSortConfig, setReqSortConfig] = useState({ column: 'created_at', direction: 'desc' });

  // Refresh data helper
  const refreshRequests = async () => {
    const data = await fetchRequests();
    setRequests(data);
  };

  const refreshOrganizations = async () => {
    const data = await fetchExistingOrganizations();
    setOrganizations(data);
  }

  const handleApprove = async (id) => {
    if (!confirm("Are you sure you want to approve and create this organization?")) return;
    
    setProcessingId(id);
    setMessage({ type: 'info', text: 'Processing approval... Do not close window.' });

    try {
      const result = await approveRequest(id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Organization Approved & Created Successfully!' });
        await refreshRequests(); 
        await refreshOrganizations();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to approve.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Critical error.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    if (!confirm("Reject this request? It can be approved later if needed.")) return;

    setProcessingId(id);
    try {
      const result = await rejectRequest(id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Request rejected.' });
        await refreshRequests(); 
      } else {
        setMessage({ type: 'error', text: 'Failed to reject.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error rejecting.' });
    } finally {
      setProcessingId(null);
    }
  };

  // Sorting functions
  const sortOrganizations = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'org_name':
        aValue = (a.org_name || '').toLowerCase();
        bValue = (b.org_name || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'plan_name':
        aValue = (a.plan_name || '').toLowerCase();
        bValue = (b.plan_name || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'active_employees':
      case 'inactive_employees':
      case 'total_employees':
        aValue = parseInt(a[column]) || 0;
        bValue = parseInt(b[column]) || 0;
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      default:
        return 0;
    }
  };

  const sortRequests = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'company_name':
      case 'email':
      case 'plan_name':
      case 'status':
        aValue = (a[column] || '').toLowerCase();
        bValue = (b[column] || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'admin_name':
        aValue = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
        bValue = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'created_at':
        aValue = new Date(a.created_at).getTime() || 0;
        bValue = new Date(b.created_at).getTime() || 0;
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      default:
        return 0;
    }
  };

  const requestOrgSort = (column) => {
    setOrgSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const requestReqSort = (column) => {
    setReqSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Filtered and sorted organizations
  const uniquePlans = [...new Set(organizations.map(org => org.plan_name).filter(Boolean))];
  
  const filteredOrganizations = organizations
    .filter(org => {
      const matchesSearch = org.org_name.toLowerCase().includes(orgSearchQuery.toLowerCase());
      const matchesPlan = orgPlanFilter === 'all' || org.plan_name === orgPlanFilter;
      return matchesSearch && matchesPlan;
    })
    .sort((a, b) => sortOrganizations(a, b, orgSortConfig.column, orgSortConfig.direction));

  const orgTotalPages = Math.ceil(filteredOrganizations.length / orgPerPage);
  const orgIndexOfLast = orgCurrentPage * orgPerPage;
  const orgIndexOfFirst = orgIndexOfLast - orgPerPage;
  const currentOrganizations = filteredOrganizations.slice(orgIndexOfFirst, orgIndexOfLast);

  // Filtered and sorted requests
  const uniqueStatuses = [...new Set(requests.map(req => req.status).filter(Boolean))];
  
  const filteredRequests = requests
    .filter(req => {
      const matchesSearch = 
        req.company_name.toLowerCase().includes(reqSearchQuery.toLowerCase()) ||
        req.email.toLowerCase().includes(reqSearchQuery.toLowerCase()) ||
        `${req.first_name} ${req.last_name}`.toLowerCase().includes(reqSearchQuery.toLowerCase());
      const matchesStatus = reqStatusFilter === 'all' || req.status === reqStatusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => sortRequests(a, b, reqSortConfig.column, reqSortConfig.direction));

  const reqTotalPages = Math.ceil(filteredRequests.length / reqPerPage);
  const reqIndexOfLast = reqCurrentPage * reqPerPage;
  const reqIndexOfFirst = reqIndexOfLast - reqPerPage;
  const currentRequests = filteredRequests.slice(reqIndexOfFirst, reqIndexOfLast);

  // Pagination handlers for Organizations
  const handleOrgNextPage = () => {
    if (orgCurrentPage < orgTotalPages) {
      setOrgCurrentPage(prev => prev + 1);
      setOrgPageInputValue((orgCurrentPage + 1).toString());
    }
  };

  const handleOrgPrevPage = () => {
    if (orgCurrentPage > 1) {
      setOrgCurrentPage(prev => prev - 1);
      setOrgPageInputValue((orgCurrentPage - 1).toString());
    }
  };

  const handleOrgPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(orgPageInputValue, 10);
      if (!isNaN(value) && value >= 1 && value <= orgTotalPages) {
        setOrgCurrentPage(value);
        setOrgPageInputValue(value.toString());
      } else {
        setOrgPageInputValue(orgCurrentPage.toString());
      }
    }
  };

  const handleOrgPerPageKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setOrgPerPage(value);
        setOrgPerPageInput(value.toString());
        setOrgCurrentPage(1);
        setOrgPageInputValue('1');
      } else {
        setOrgPerPageInput(orgPerPage.toString());
      }
    }
  };

  // Pagination handlers for Requests
  const handleReqNextPage = () => {
    if (reqCurrentPage < reqTotalPages) {
      setReqCurrentPage(prev => prev + 1);
      setReqPageInputValue((reqCurrentPage + 1).toString());
    }
  };

  const handleReqPrevPage = () => {
    if (reqCurrentPage > 1) {
      setReqCurrentPage(prev => prev - 1);
      setReqPageInputValue((reqCurrentPage - 1).toString());
    }
  };

  const handleReqPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(reqPageInputValue, 10);
      if (!isNaN(value) && value >= 1 && value <= reqTotalPages) {
        setReqCurrentPage(value);
        setReqPageInputValue(value.toString());
      } else {
        setReqPageInputValue(reqCurrentPage.toString());
      }
    }
  };

  const handleReqPerPageKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setReqPerPage(value);
        setReqPerPageInput(value.toString());
        setReqCurrentPage(1);
        setReqPageInputValue('1');
      } else {
        setReqPerPageInput(reqPerPage.toString());
      }
    }
  };

  // Reset search when switching views
  useEffect(() => {
    setOrgSearchQuery('');
    setOrgPlanFilter('all');
    setReqSearchQuery('');
    setReqStatusFilter('all');
    setOrgCurrentPage(1);
    setReqCurrentPage(1);
    setOrgPageInputValue('1');
    setReqPageInputValue('1');
  }, [showRequests]);

  return (
    <div className={styles.neworg_container}>
      
      {!showRequests ? (
        // --- VIEW 1: EXISTING ORGANIZATIONS (Main Page) ---
        <div>
            <div className={styles.neworg_header_section}>
                <h1 className={styles.neworg_title}>Companies</h1>
                <div className={styles.neworg_header_buttons}>
                    {/* <button 
                        onClick={refreshOrganizations} 
                        className={styles.neworg_button}
                        style={{backgroundColor: '#6c757d', color: 'white'}}>
                        Refresh
                    </button> */}
                    <button 
                        onClick={() => setShowRequests(true)} 
                        className={styles.neworg_button}>
                        New Company Requests
                    </button>
                </div>
            </div>

            {/* Search and Filter */}
            <div className={styles.neworg_search_filter_container}>
              <input
                type="text"
                placeholder="Search by Organization Name"
                value={orgSearchQuery}
                onChange={(e) => {
                  setOrgSearchQuery(e.target.value);
                  setOrgCurrentPage(1);
                  setOrgPageInputValue('1');
                }}
                className={styles.neworg_search_input}
              />
              <select
                value={orgPlanFilter}
                onChange={(e) => {
                  setOrgPlanFilter(e.target.value);
                  setOrgCurrentPage(1);
                  setOrgPageInputValue('1');
                }}
                className={styles.neworg_filter_select}
              >
                <option value="all">All Plans</option>
                {uniquePlans.map((plan) => (
                  <option key={plan} value={plan}>{plan}</option>
                ))}
              </select>
            </div>

            {filteredOrganizations.length === 0 ? (
                <div className={styles.neworg_empty_state}>
                    <p>No organizations found matching your search.</p>
                </div>
            ) : (
                <>
                  <div className={styles.neworg_table_wrapper}>
                      <table className={styles.neworg_table}>
                          <thead>
                              <tr>
                                  <th 
                                    className={`${styles.neworg_th} ${styles.neworg_sortable} ${orgSortConfig.column === 'org_name' ? styles[`neworg_sort_${orgSortConfig.direction}`] : ''}`}
                                    onClick={() => requestOrgSort('org_name')}>
                                    Organization Name
                                  </th>
                                  <th 
                                    className={`${styles.neworg_th} ${styles.neworg_sortable} ${orgSortConfig.column === 'plan_name' ? styles[`neworg_sort_${orgSortConfig.direction}`] : ''}`}
                                    onClick={() => requestOrgSort('plan_name')}>
                                    Plan Name
                                  </th>
                                  <th 
                                    className={`${styles.neworg_th} ${styles.neworg_sortable} ${orgSortConfig.column === 'active_employees' ? styles[`neworg_sort_${orgSortConfig.direction}`] : ''}`}
                                    onClick={() => requestOrgSort('active_employees')}>
                                    Active Employees
                                  </th>
                                  <th 
                                    className={`${styles.neworg_th} ${styles.neworg_sortable} ${orgSortConfig.column === 'inactive_employees' ? styles[`neworg_sort_${orgSortConfig.direction}`] : ''}`}
                                    onClick={() => requestOrgSort('inactive_employees')}>
                                    Inactive Employees
                                  </th>
                                  <th 
                                    className={`${styles.neworg_th} ${styles.neworg_sortable} ${orgSortConfig.column === 'total_employees' ? styles[`neworg_sort_${orgSortConfig.direction}`] : ''}`}
                                    onClick={() => requestOrgSort('total_employees')}>
                                    Total Employees
                                  </th>
                              </tr>
                          </thead>
                          <tbody>
                              {currentOrganizations.map((org) => (
                                  <tr key={org.org_id} className={styles.neworg_row}>
                                      <td className={styles.neworg_td}>
                                          <span className={styles.neworg_role_indicator}></span>
                                          <span style={{fontWeight: '600'}}>{org.org_name}</span>
                                      </td>
                                      <td className={styles.neworg_td}>
                                          <span className={styles.neworg_plan_badge}>
                                              {org.plan_name}
                                          </span>
                                      </td>
                                      <td className={styles.neworg_td} style={{color: '#166534', fontWeight: 'bold'}}>{org.active_employees}</td>
                                      <td className={styles.neworg_td} style={{color: '#991b1b'}}>{org.inactive_employees}</td>
                                      <td className={styles.neworg_td}>{org.total_employees}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  {/* Pagination */}
                  {filteredOrganizations.length > orgPerPage && (
                    <div className={styles.neworg_pagination_container}>
                      <button 
                        className={styles.neworg_button} 
                        onClick={handleOrgPrevPage} 
                        disabled={orgCurrentPage === 1}>
                        ← Previous
                      </button>
                      <span className={styles.neworg_pagination_text}>
                        Page 
                        <input 
                          type="text" 
                          value={orgPageInputValue} 
                          onChange={(e) => setOrgPageInputValue(e.target.value)} 
                          onKeyPress={handleOrgPageInputKeyPress} 
                          className={styles.neworg_pagination_input}
                        /> of {orgTotalPages}
                      </span>
                      <button 
                        className={styles.neworg_button} 
                        onClick={handleOrgNextPage} 
                        disabled={orgCurrentPage === orgTotalPages}>
                        Next →
                      </button>
                    </div>
                  )}

                  {/* Rows per page */}
                  <div className={styles.neworg_rows_per_page_container}>
                    <label className={styles.neworg_rows_per_page_label}>Rows per Page:</label>
                    <input 
                      type="text" 
                      value={orgPerPageInput} 
                      onChange={(e) => setOrgPerPageInput(e.target.value)} 
                      onKeyPress={handleOrgPerPageKeyPress} 
                      className={styles.neworg_rows_per_page_input}
                      aria-label="Number of rows per page"
                    />
                  </div>
                </>
            )}
        </div>
      ) : (
        // --- VIEW 2: ORGANIZATION REQUESTS ---
        <div>
            <div className={styles.neworg_requests_header_container}>
                <h1 className={styles.neworg_title}>Organization Requests</h1>
                <button 
                    onClick={() => setShowRequests(false)} 
                    className={styles.neworg_back_button}>
                </button>
            </div>
            
            {message.text && (
                <div className={`
                    ${styles.neworg_message} 
                    ${message.type === 'success' ? styles.neworg_message_success : ''}
                    ${message.type === 'error' ? styles.neworg_message_error : ''}
                    ${message.type === 'info' ? styles.neworg_message_info : ''}
                `}>
                {message.text}
                </div>
            )}

            {/* Search and Filter with Refresh Button */}
            <div className={styles.neworg_search_with_refresh}>
              <div className={styles.neworg_search_filter_container}>
                <input
                  type="text"
                  placeholder="Search by Company, Email, or Admin Name"
                  value={reqSearchQuery}
                  onChange={(e) => {
                    setReqSearchQuery(e.target.value);
                    setReqCurrentPage(1);
                    setReqPageInputValue('1');
                  }}
                  className={styles.neworg_search_input}
                />
                <select
                  value={reqStatusFilter}
                  onChange={(e) => {
                    setReqStatusFilter(e.target.value);
                    setReqCurrentPage(1);
                    setReqPageInputValue('1');
                  }}
                  className={styles.neworg_filter_select}
                >
                  <option value="all">All Status</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <button 
                  onClick={refreshRequests} 
                  className={styles.neworg_button}
                  style={{backgroundColor: '#6c757d', color: 'white'}}>
                  Refresh
              </button>
            </div>

            {filteredRequests.length === 0 ? (
                <div className={styles.neworg_empty_state}>
                    <p>No requests found matching your search.</p>
                </div>
            ) : (
                <>
                  <div className={styles.neworg_table_wrapper}>
                  <table className={styles.neworg_table}>
                      <thead>
                      <tr>
                          <th 
                            className={`${styles.neworg_th} ${styles.neworg_sortable} ${reqSortConfig.column === 'status' ? styles[`neworg_sort_${reqSortConfig.direction}`] : ''}`}
                            onClick={() => requestReqSort('status')}>
                            Status
                          </th>
                          <th 
                            className={`${styles.neworg_th} ${styles.neworg_sortable} ${reqSortConfig.column === 'company_name' ? styles[`neworg_sort_${reqSortConfig.direction}`] : ''}`}
                            onClick={() => requestReqSort('company_name')}>
                            Company
                          </th>
                          <th 
                            className={`${styles.neworg_th} ${styles.neworg_sortable} ${reqSortConfig.column === 'admin_name' ? styles[`neworg_sort_${reqSortConfig.direction}`] : ''}`}
                            onClick={() => requestReqSort('admin_name')}>
                            Admin
                          </th>
                          <th 
                            className={`${styles.neworg_th} ${styles.neworg_sortable} ${reqSortConfig.column === 'email' ? styles[`neworg_sort_${reqSortConfig.direction}`] : ''}`}
                            onClick={() => requestReqSort('email')}>
                            Email
                          </th>
                          <th 
                            className={`${styles.neworg_th} ${styles.neworg_sortable} ${reqSortConfig.column === 'plan_name' ? styles[`neworg_sort_${reqSortConfig.direction}`] : ''}`}
                            onClick={() => requestReqSort('plan_name')}>
                            Plan Name
                          </th>
                          <th 
                            className={`${styles.neworg_th} ${styles.neworg_sortable} ${reqSortConfig.column === 'created_at' ? styles[`neworg_sort_${reqSortConfig.direction}`] : ''}`}
                            onClick={() => requestReqSort('created_at')}>
                            Date
                          </th>
                          <th className={styles.neworg_th}>Actions</th>
                      </tr>
                      </thead>
                      <tbody>
                      {currentRequests.map((req) => (
                          <tr key={req.request_id} className={styles.neworg_row}>
                          <td className={styles.neworg_td}>
                              <span className={`
                                  ${styles.neworg_status_badge}
                                  ${req.status === 'PENDING' ? styles.neworg_status_pending : styles.neworg_status_rejected}
                              `}>
                                  {req.status}
                              </span>
                          </td>
                          <td className={styles.neworg_td}>
                              <span className={styles.neworg_role_indicator}></span>
                              <span style={{fontWeight: '600'}}>{req.company_name}</span>
                              {req.logo_path && <span style={{fontSize: '0.8rem', color: '#666', marginLeft: '8px'}}>(Has Logo)</span>}
                          </td>
                          <td className={styles.neworg_td}>{req.first_name} {req.last_name}</td>
                          <td className={styles.neworg_td}>{req.email}</td>
                          <td className={styles.neworg_td}>{req.plan_name}</td>
                          <td className={styles.neworg_td}>{req.created_at}</td>
                          <td className={styles.neworg_td}>
                              <div className={styles.neworg_action_buttons}>
                              <button 
                                  onClick={() => handleApprove(req.request_id)}
                                  disabled={processingId !== null}
                                  className={`${styles.neworg_approve_btn} ${processingId && processingId !== req.request_id ? styles.neworg_disabled : ''}`}
                              >
                                  {processingId === req.request_id ? 'Wait...' : 'Approve'}
                              </button>
                              
                              <button 
                                  onClick={() => handleReject(req.request_id)}
                                  disabled={processingId !== null || req.status === 'REJECTED'}
                                  className={`${styles.neworg_reject_btn} ${(processingId !== null || req.status === 'REJECTED') ? styles.neworg_disabled : ''}`}
                              >
                                  Reject
                              </button>
                              </div>
                          </td>
                          </tr>
                      ))}
                      </tbody>
                  </table>
                  </div>

                  {/* Pagination */}
                  {filteredRequests.length > reqPerPage && (
                    <div className={styles.neworg_pagination_container}>
                      <button 
                        className={styles.neworg_button} 
                        onClick={handleReqPrevPage} 
                        disabled={reqCurrentPage === 1}>
                        ← Previous
                      </button>
                      <span className={styles.neworg_pagination_text}>
                        Page 
                        <input 
                          type="text" 
                          value={reqPageInputValue} 
                          onChange={(e) => setReqPageInputValue(e.target.value)} 
                          onKeyPress={handleReqPageInputKeyPress} 
                          className={styles.neworg_pagination_input}
                        /> of {reqTotalPages}
                      </span>
                      <button 
                        className={styles.neworg_button} 
                        onClick={handleReqNextPage} 
                        disabled={reqCurrentPage === reqTotalPages}>
                        Next →
                      </button>
                    </div>
                  )}

                  {/* Rows per page */}
                  <div className={styles.neworg_rows_per_page_container}>
                    <label className={styles.neworg_rows_per_page_label}>Rows per Page:</label>
                    <input 
                      type="text" 
                      value={reqPerPageInput} 
                      onChange={(e) => setReqPerPageInput(e.target.value)} 
                      onKeyPress={handleReqPerPageKeyPress} 
                      className={styles.neworg_rows_per_page_input}
                      aria-label="Number of rows per page"
                    />
                  </div>
                </>
            )}
        </div>
      )}
    </div>
  )
}

export default NewOrganization
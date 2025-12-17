'use client'
import React, { useState } from 'react'
import { fetchRequests, approveRequest, rejectRequest } from '@/app/serverActions/NewOrganizations/FetchNewOrganization'

const NewOrganization = ({ initialRequests = [] }) => {
  const [requests, setRequests] = useState(initialRequests);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null); 
  const [message, setMessage] = useState({ type: '', text: '' });

  // Refresh data helper
  const refreshRequests = async () => {
    const data = await fetchRequests();
    setRequests(data);
  };

  const handleApprove = async (id) => {
    if (!confirm("Are you sure you want to approve and create this organization?")) return;
    
    setProcessingId(id);
    setMessage({ type: 'info', text: 'Processing approval... Do not close window.' });

    try {
      const result = await approveRequest(id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Organization Approved & Created Successfully!' });
        await refreshRequests(); 
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

  // Styles
  const thStyle = { padding: '16px', textAlign: 'left', fontSize: '0.9rem', color: '#666', fontWeight: '600', borderBottom: '2px solid #e5e7eb' };
  const tdStyle = { padding: '16px', fontSize: '0.95rem', color: '#1f2937', borderBottom: '1px solid #e5e7eb' };
  const btnStyle = {
    padding: '8px 16px',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'opacity 0.2s',
    fontWeight: '500'
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Organization Requests</h1>
        <button 
            onClick={refreshRequests} 
            style={{padding: '8px 12px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer'}}>
            Refresh
        </button>
      </div>
      
      {message.text && (
        <div style={{
          padding: '15px', marginBottom: '20px', borderRadius: '8px',
          backgroundColor: message.type === 'success' ? '#d1fae5' : message.type === 'error' ? '#fee2e2' : '#e0f2fe',
          color: message.type === 'success' ? '#065f46' : message.type === 'error' ? '#991b1b' : '#075985'
        }}>
          {message.text}
        </div>
      )}

      {requests.length === 0 ? (
        <p style={{ color: '#666' }}>No requests found.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead style={{ backgroundColor: '#f9fafb' }}>
              <tr>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Admin</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Plan Name</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.request_id} style={{backgroundColor: req.status === 'REJECTED' ? '#fdf2f2' : 'white'}}>
                  <td style={tdStyle}>
                    <span style={{
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        backgroundColor: req.status === 'PENDING' ? '#fff7ed' : '#fef2f2',
                        color: req.status === 'PENDING' ? '#c2410c' : '#b91c1c',
                        border: req.status === 'PENDING' ? '1px solid #ffedd5' : '1px solid #fecaca'
                    }}>
                        {req.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{fontWeight: '600'}}>{req.company_name}</div>
                    {req.logo_path && <span style={{fontSize: '0.8rem', color: '#666'}}>(Has Logo)</span>}
                  </td>
                  <td style={tdStyle}>{req.first_name} {req.last_name}</td>
                  <td style={tdStyle}>{req.email}</td>
                  <td style={tdStyle}>{req.plan_name}</td>
                  <td style={tdStyle}>{req.created_at}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleApprove(req.request_id)}
                        disabled={processingId !== null}
                        style={{
                          ...btnStyle, 
                          backgroundColor: '#10b981', 
                          opacity: processingId && processingId !== req.request_id ? 0.5 : 1
                        }}
                      >
                        {processingId === req.request_id ? 'Wait...' : 'Approve'}
                      </button>
                      
                      {/* Disable Reject button if already Rejected */}
                      <button 
                        onClick={() => handleReject(req.request_id)}
                        disabled={processingId !== null || req.status === 'REJECTED'}
                        style={{ 
                            ...btnStyle, 
                            backgroundColor: '#ef4444',
                            opacity: (processingId !== null || req.status === 'REJECTED') ? 0.3 : 1,
                            cursor: (processingId !== null || req.status === 'REJECTED') ? 'not-allowed' : 'pointer'
                        }}
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
      )}
    </div>
  )
}

export default NewOrganization
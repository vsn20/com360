'use client';
import React, { useEffect, useState, useCallback } from 'react';
import AddOrganization from './AddOrganization';
import EditOrganization from './EditOrganization';
import SubOrgDocument from './SubOrgDocument';
import { fetchSubOrgDocumentsById } from '@/app/serverActions/Organizations/Actions';
import { useRouter, useSearchParams } from 'next/navigation';
import './organizations.css';

const Overview = ({ orgid, empid, organizations, countries, states }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedorgid, setSelectedorgid] = useState(null);
  const [add, setAdd] = useState(false);
  const [allOrganizations, setAllOrganizations] = useState(organizations);
  const [sortConfig, setSortConfig] = useState({ column: 'suborgid', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [orgsPerPage, setOrgsPerPage] = useState(10);
  const [orgsPerPageInput, setOrgsPerPageInput] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('all');

  const [activeTab, setActiveTab] = useState('details');
  const [subOrgDocs, setSubOrgDocs] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  useEffect(() => {
    setAllOrganizations(organizations);
  }, [organizations]);

  const fetchDocuments = useCallback(async () => {
    if (!selectedorgid) return;
    setIsLoadingDocs(true);
    try {
      const docs = await fetchSubOrgDocumentsById(selectedorgid);
      setSubOrgDocs(docs);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [selectedorgid]);

  useEffect(() => {
    if (searchParams.get('refresh')) {
        handleBackClick();
    }
  }, [searchParams]);

  // <-- MODIFIED: Fetch documents as soon as an organization is selected -->
  useEffect(() => {
    if (selectedorgid) {
      fetchDocuments();
    }
  }, [selectedorgid, fetchDocuments]);
  
  const sortOrganizations = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'suborgid':
        aValue = parseInt(a.suborgid.split('-')[1] || a.suborgid, 10);
        bValue = parseInt(b.suborgid.split('-')[1] || b.suborgid, 10);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'suborgname':
        aValue = (a.suborgname || '').toLowerCase();
        bValue = (b.suborgname || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
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

  const handleRowClick = (orgid) => {
    setSelectedorgid(orgid);
    setActiveTab('details');
    setAdd(false);
  };

  const handleAdd = () => {
    setSelectedorgid(null);
    setAdd(true);
  };

  const handleBackClick = () => {
    router.refresh();
    setSelectedorgid(null);
    setAdd(false);
    setSearchQuery('');
    setIsActiveFilter('all');
  };

  const filteredOrganizations = allOrganizations.filter((org) => {
    const matchesSearch = org.suborgname?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      isActiveFilter === 'all' ||
      (isActiveFilter === 'active' && org.isstatus) ||
      (isActiveFilter === 'inactive' && !org.isstatus);
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOrganizations.length / orgsPerPage);
  const currentOrganizations = filteredOrganizations.slice((currentPage - 1) * orgsPerPage, currentPage * orgsPerPage);

  return (
    <div className="organization_overview_container">
      {add && (
        <div className="organization_details_container">
          <div className="organization_header_section">
            <h1 className="organization_title">Add Organization</h1>
            <button className="organization_back_button" onClick={handleBackClick}></button>
          </div>
          <AddOrganization orgid={orgid} empid={empid} countries={countries} states={states} />
        </div>
      )}
      {!add && selectedorgid ? (
        <div className="organization_details_container">
          <div className="organization_header_section">
            <h1 className="organization_title">Edit Organization</h1>
            <button className="organization_back_button" onClick={handleBackClick}></button>
          </div>
          
          <div className="organization_submenu_bar">
            <button
              className={activeTab === 'details' ? 'active' : ''}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button
              className={activeTab === 'documents' ? 'active' : ''}
              onClick={() => setActiveTab('documents')}
            >
              Documents
            </button>
          </div>

          <div className="organization_details_content">
            {/* <-- MODIFIED: Use CSS to hide/show content to prevent re-fetching --> */}
            <div style={{ display: activeTab === 'details' ? 'block' : 'none' }}>
              <EditOrganization selectedorgid={selectedorgid} orgid={orgid} empid={empid} countries={countries} states={states} />
            </div>
            
            <div style={{ display: activeTab === 'documents' ? 'block' : 'none' }}>
              {isLoadingDocs ? <p>Loading documents...</p> :
              <SubOrgDocument 
                  suborgid={selectedorgid} 
                  documents={subOrgDocs}
                  onDocumentsUpdate={fetchDocuments}
              />
              }
            </div>
          </div>
        </div>
      ) : (
        !add && (
          <div>
             <div className="organization_header_section">
              <h1 className="organization_title">Existing Organizations</h1>
              <button onClick={handleAdd} className="organization_button">Add Organization</button>
            </div>
            <div className="organization_search_filter_container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="organization_search_input"
                placeholder="Search by organization name..."
              />
              <select value={isActiveFilter} onChange={(e) => setIsActiveFilter(e.target.value)} className="organization_filter_select">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {filteredOrganizations.length === 0 ? (
              <div className="organization_empty_state">No organizations found.</div>
            ) : (
              <>
                <div className="organization_table_wrapper">
                  <table className="organization_table">
                    <thead>
                      <tr>
                        <th onClick={() => requestSort('suborgid')}>Organization ID</th>
                        <th onClick={() => requestSort('suborgname')}>Organization Name</th>
                        <th>Country</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentOrganizations.map((org) => (
                        <tr key={org.suborgid} onClick={() => handleRowClick(org.suborgid)} className="organization_clickable_row">
                          <td className="organization_id_cell">
                             <span className={org.isstatus ? 'organization_indicator_active' : 'organization_indicator_inactive'}></span>
                            {org.suborgid.split('-')[1] || org.suborgid}
                          </td>
                          <td>{org.suborgname || '-'}</td>
                          <td>{org.country ? (countries.find(c => String(c.ID) === org.country)?.VALUE || 'Unknown Country') : '-'}</td>
                          <td>
                            <span className={`organization_status_badge ${org.isstatus ? 'organization_active' : 'organization_inactive'}`}>
                              {org.isstatus ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default Overview;


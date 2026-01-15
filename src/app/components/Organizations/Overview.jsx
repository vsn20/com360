'use client';
import React, { useEffect, useState, useCallback } from 'react';
import AddOrganization from './AddOrganization';
import EditOrganization from './EditOrganization';
import SubOrgDocument from './SubOrgDocument';
import { fetchSubOrgDocumentsById } from '@/app/serverActions/Organizations/Actions';
import { gptintegration } from '@/app/serverActions/gptintegration';
import { useRouter, useSearchParams } from 'next/navigation';
import './organizations.css';

const Overview = ({ orgid, empid, organizations, countries, states,documenttypes }) => {
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
  const [aiPrefilledData, setAiPrefilledData] = useState(null);
  const [aiMessage, setAiMessage] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [matchingOrgs, setMatchingOrgs] = useState([]);
  const [pendingEditData, setPendingEditData] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);

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

  // Listen for AI queries from navbar
  useEffect(() => {
    const handleAIQueryEvent = (e) => {
      const query = e.detail;
      if (query) {
        handleAIQuery(query);
      }
    };

    const storedQuery = sessionStorage.getItem('aiQuery');
    if (storedQuery) {
      handleAIQuery(storedQuery);
      sessionStorage.removeItem('aiQuery');
    }

    window.addEventListener('aiQuerySubmitted', handleAIQueryEvent);
    return () => window.removeEventListener('aiQuerySubmitted', handleAIQueryEvent);
  }, [allOrganizations, countries, states]);

  useEffect(() => {
    if (selectedorgid) {
      fetchDocuments();
    }
  }, [selectedorgid, fetchDocuments]);

  // Advanced filtering function - FIXED: Each filter result ANDs with others
  const applyFilters = (organizations, filters) => {
    if (!filters || filters.length === 0) return organizations;

    return organizations.filter(org => {
      return filters.every(filter => {
        const { field, operator, value, value2 } = filter;
        let orgValue;

        // Get the field value from the organization
        switch (field) {
          case 'suborgname':
            orgValue = (org.suborgname || '').toLowerCase();
            break;
          case 'country':
            orgValue = String(org.country || '');
            break;
          case 'state':
            orgValue = String(org.state || '');
            break;
          case 'isstatus':
            orgValue = org.isstatus ? '1' : '0';
            break;
          case 'addresslane1':
            orgValue = (org.addresslane1 || '').toLowerCase();
            break;
          case 'addresslane2':
            orgValue = (org.addresslane2 || '').toLowerCase();
            break;
          case 'postalcode':
            orgValue = (org.postalcode || '').toLowerCase();
            break;
          case 'trade_name':
            orgValue = (org.trade_name || '').toLowerCase();
            break;
          case 'registration_number':
            orgValue = (org.registration_number || '').toLowerCase();
            break;
          case 'company_type':
            orgValue = (org.company_type || '').toLowerCase();
            break;
          case 'industry':
            orgValue = (org.industry || '').toLowerCase();
            break;
          case 'created_date':
            orgValue = org.created_date ? new Date(org.created_date) : null;
            break;
          case 'updated_date':
            orgValue = org.updated_date ? new Date(org.updated_date) : null;
            break;
          case 'created_by':
            orgValue = (org.created_by || '').toLowerCase();
            break;
          case 'updated_by':
            orgValue = (org.updated_by || '').toLowerCase();
            break;
          default:
            return true;
        }

        // Apply operator
        const filterValue = String(value).toLowerCase();
        
        switch (operator) {
          case 'equals':
            return String(orgValue) === String(value);
          case 'notEquals':
            return String(orgValue) !== String(value);
          case 'contains':
            return String(orgValue).includes(filterValue);
          case 'notContains':
            return !String(orgValue).includes(filterValue);
          case 'startsWith':
            return String(orgValue).startsWith(filterValue);
          case 'endsWith':
            return String(orgValue).endsWith(filterValue);
          case 'before':
            if (!orgValue || !(orgValue instanceof Date)) return false;
            return orgValue < new Date(value);
          case 'after':
            if (!orgValue || !(orgValue instanceof Date)) return false;
            return orgValue > new Date(value);
          case 'between':
            if (!orgValue || !(orgValue instanceof Date) || !value2) return false;
            return orgValue >= new Date(value) && orgValue <= new Date(value2);
          default:
            return true;
        }
      });
    });
  };

  // AI Query Handler
  const handleAIQuery = async (query) => {
    setIsProcessingAI(true);
    setAiMessage('');
    
    // Clear manual filters when AI query comes in
    setSearchQuery('');
    setIsActiveFilter('all');
    
    try {
      const result = await gptintegration(query, '/organizations', countries, states);
      
      if (result.confidence < 0.5) {
        setAiMessage('Sorry, I could not understand your request clearly. Please try again.');
        setIsProcessingAI(false);
        return;
      }

      setAiMessage(result.message);

      // Handle based on intent
      switch (result.intent) {
        case 'add':
          if (result.entity === 'organization') {
            setAiPrefilledData(result.data);
            setAdd(true);
            setSelectedorgid(null);
            setShowSelectionModal(false);
            setActiveFilters([]);
          }
          break;

        case 'edit':
          if (result.entity === 'organization') {
            const matches = applyFilters(allOrganizations, result.filters);
            
            if (matches.length === 0) {
              setAiMessage(`No organizations found matching your criteria`);
              setActiveFilters([]);
            } else if (matches.length === 1 && !result.requiresSelection) {
              // Single match and no selection required
              setSelectedorgid(matches[0].suborgid);
              setAiPrefilledData(result.data);
              setAdd(false);
              setShowSelectionModal(false);
              setActiveFilters([]);
              setAiMessage(`${result.message}. Editing: ${matches[0].suborgname}`);
            } else {
              // Multiple matches or selection required
              setMatchingOrgs(matches);
              setPendingEditData(result.data);
              setShowSelectionModal(true);
              setAdd(false);
              setSelectedorgid(null);
              setActiveFilters(result.filters);
              setAiMessage(`Found ${matches.length} organizations matching your criteria. Please select one to edit.`);
            }
          }
          break;

        case 'display':
          if (result.entity === 'organization') {
            setActiveFilters(result.filters);
            setAdd(false);
            setSelectedorgid(null);
            setShowSelectionModal(false);
            setSearchQuery(''); // Clear basic search
            setIsActiveFilter('all'); // Reset status filter
          }
          break;

        default:
          setAiMessage('I can help you add, edit, or view organizations. Try: "Create organization named Tech Corp in California"');
      }

    } catch (error) {
      console.error('AI Query Error:', error);
      setAiMessage('An error occurred while processing your request.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleOrgSelection = (org) => {
    setSelectedorgid(org.suborgid);
    setAiPrefilledData(pendingEditData);
    setShowSelectionModal(false);
    setMatchingOrgs([]);
    setPendingEditData(null);
    setAdd(false);
    setActiveFilters([]);
    setAiMessage(`Now editing: ${org.suborgname}`);
  };
  
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
    setAiPrefilledData(null);
    setShowSelectionModal(false);
    // Don't clear filters when viewing details
  };

  const handleAdd = () => {
    setSelectedorgid(null);
    setAdd(true);
    setAiPrefilledData(null);
    setShowSelectionModal(false);
    setActiveFilters([]);
  };

  const handleBackClick = () => {
    router.refresh();
    setSelectedorgid(null);
    setAdd(false);
    setSearchQuery('');
    setIsActiveFilter('all');
    setAiPrefilledData(null);
    setAiMessage('');
    setShowSelectionModal(false);
    setMatchingOrgs([]);
    setPendingEditData(null);
    setActiveFilters([]);
  };

  const clearFilters = () => {
    setActiveFilters([]);
    setSearchQuery('');
    setIsActiveFilter('all');
    setAiMessage('');
  };

  // FIXED: Apply filters with proper AND logic
  let filteredOrganizations = allOrganizations;
  
  // Create combined filter array
  const allActiveFilters = [...activeFilters];
  
  // Add manual search as a filter if present
  if (searchQuery.trim()) {
    allActiveFilters.push({
      field: 'suborgname',
      operator: 'contains',
      value: searchQuery.toLowerCase(),
      displayValue: searchQuery
    });
  }
  
  // Add status filter if not 'all'
  if (isActiveFilter !== 'all') {
    allActiveFilters.push({
      field: 'isstatus',
      operator: 'equals',
      value: isActiveFilter === 'active' ? '1' : '0',
      displayValue: isActiveFilter === 'active' ? 'Active' : 'Inactive'
    });
  }
  
  // Apply all filters at once using unified logic
  if (allActiveFilters.length > 0) {
    filteredOrganizations = applyFilters(filteredOrganizations, allActiveFilters);
  }

  const totalPages = Math.ceil(filteredOrganizations.length / orgsPerPage);
  const currentOrganizations = filteredOrganizations.slice((currentPage - 1) * orgsPerPage, currentPage * orgsPerPage);

  return (
    <div className="organization_overview_container">
      {/* AI Message Display */}
      {aiMessage && (
        <div className={`organization_ai_message ${isProcessingAI ? 'processing' : ''}`}>
          {isProcessingAI ? 'Processing your request...' : aiMessage}
        </div>
      )}

      {/* Active Filters Display - ENHANCED */}
      {(activeFilters.length > 0 || searchQuery || isActiveFilter !== 'all') && !add && !selectedorgid && (
        <div className="organization_active_filters">
          <div className="organization_filter_header">
            <span>Active Filters ({allActiveFilters.length}):</span>
            <button onClick={clearFilters} className="organization_clear_filters">Clear All</button>
          </div>
          <div className="organization_filter_tags">
            {allActiveFilters.map((filter, index) => (
              <span key={index} className="organization_filter_tag">
                {filter.field}: {filter.operator} "{filter.displayValue || filter.value}"
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Selection Modal for Multiple Matches */}
      {showSelectionModal && matchingOrgs.length > 0 && (
        <div className="organization_selection_modal">
          <div className="organization_selection_modal_content">
            <h3>Select Organization to Edit</h3>
            <p>Found {matchingOrgs.length} matching organizations:</p>
            <div className="organization_selection_list">
              {matchingOrgs.map((org) => (
                <div
                  key={org.suborgid}
                  className="organization_selection_item"
                  onClick={() => handleOrgSelection(org)}
                >
                  <div className="organization_selection_item_name">{org.suborgname}</div>
                  <div className="organization_selection_item_details">
                    ID: {org.suborgid.split('-')[1]} | 
                    Status: {org.isstatus ? 'Active' : 'Inactive'} |
                    Country: {countries.find(c => String(c.ID) === String(org.country))?.VALUE || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
            <button 
              className="organization_selection_cancel"
              onClick={() => {
                setShowSelectionModal(false);
                setMatchingOrgs([]);
                setPendingEditData(null);
                setAiMessage('');
                setActiveFilters([]);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {add && (
        <div className="organization_details_container">
          <div className="organization_header_section">
            <h1 className="organization_title">Add Organization</h1>
            <button className="organization_back_button" onClick={handleBackClick}></button>
          </div>
          <AddOrganization 
            orgid={orgid} 
            empid={empid} 
            countries={countries} 
            states={states}
            prefilledData={aiPrefilledData}
            onAIQuery={handleAIQuery}
          />
        </div>
      )}
      {!add && selectedorgid ? (
        <div className="organization_details_container">
          <div className="organization_header_section">
            <h1 className="organization_title">{allOrganizations.find(org => org.suborgid === selectedorgid)?.suborgname || ''} Organization Details</h1>
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
            <div style={{ display: activeTab === 'details' ? 'block' : 'none' }}>
              <EditOrganization 
                selectedorgid={selectedorgid} 
                orgid={orgid} 
                empid={empid} 
                countries={countries} 
                states={states}
                aiPrefilledData={aiPrefilledData}
              />
            </div>
            
            <div style={{ display: activeTab === 'documents' ? 'block' : 'none' }}>
              {isLoadingDocs ? <p>Loading documents...</p> :
              <SubOrgDocument 
                  suborgid={selectedorgid}
                  orgid={orgid}
                  documents={subOrgDocs}
                  onDocumentsUpdate={fetchDocuments}
                  documenttypes={documenttypes}
                  states={states}
              />
              }
            </div>
          </div>
        </div>
      ) : (
        !add && (
          <div>
             <div className="organization_header_section">
              <h1 className="organization_title">Organizations</h1>
              <button onClick={handleAdd} className="organization_button">Add Organization</button>
            </div>
            <div className="organization_search_filter_container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // Clear AI message when manual search is used
                  if (e.target.value && aiMessage) {
                    setAiMessage('');
                  }
                }}
                className="organization_search_input"
                placeholder="Search by organization name..."
              />
              <select 
                value={isActiveFilter} 
                onChange={(e) => {
                  setIsActiveFilter(e.target.value);
                  // Clear AI message when manual filter is used
                  if (aiMessage) {
                    setAiMessage('');
                  }
                }} 
                className="organization_filter_select"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {filteredOrganizations.length === 0 ? (
              <div className="organization_empty_state">
                No organizations found matching your criteria.
                {allActiveFilters.length > 0 && (
                  <button onClick={clearFilters} className="organization_retry_button">
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="organization_table_wrapper">
                  <table className="organization_table">
                    <thead>
                      <tr>
                        {/* <th onClick={() => requestSort('suborgid')}>Organization ID</th> */}
                        <th onClick={() => requestSort('suborgname')}>Organization Name</th>
                        <th>Trade Name</th>
                        <th>Comapny Type</th>
                        <th>Country</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentOrganizations.map((org) => (
                        <tr key={org.suborgid} onClick={() => handleRowClick(org.suborgid)} className="organization_clickable_row">
                          <td className="organization_id_cell">
                             <span className={org.isstatus ? 'organization_indicator_active' : 'organization_indicator_inactive'}></span>
                          {org.suborgname || '-'}
                          </td>
                          <td>{org.trade_name || '-'}</td>
                          <td>{org.company_type}</td>
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
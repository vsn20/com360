'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getRefreshedContacts } from '@/app/serverActions/Contacts/actions';
import { gptContactIntegration } from '@/app/serverActions/ai_integration/Contact_AI_Integration';
import AddContactForm from './AddContactForm';
import EditContactForm from './EditContactForm';
import './contact.css'

export default function Overview({
  initialContacts,
  accounts,
  suborgs,
  countries,
  states,
  orgid,
  contactTypes,
  userSuborgId,
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [contactsPerPage, setContactsPerPage] = useState(10);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [contactsPerPageInput, setContactsPerPageInput] = useState('10');
  const [accountFilter, setAccountFilter] = useState('all');
  const [suborgFilter, setSuborgFilter] = useState('all');

  // AI Integration State
  const [aiPrefilledData, setAiPrefilledData] = useState(null);
  const [aiMessage, setAiMessage] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [matchingContacts, setMatchingContacts] = useState([]);
  const [pendingEditData, setPendingEditData] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);

  // Advanced filtering function
  const applyFilters = (contactsList, filters) => {
    if (!filters || filters.length === 0) return contactsList;

    return contactsList.filter(contact => {
      return filters.every(filter => {
        const { field, operator, value, value2 } = filter;
        let contactValue;

        switch (field) {
          case 'ROW_ID':
            const displayFormat = `${contact.accountName}-${contact.ROW_ID}`.toLowerCase();
            const justRowId = String(contact.ROW_ID).toLowerCase();
            contactValue = displayFormat;
            if (operator === 'equals' && (displayFormat === String(value).toLowerCase() || justRowId === String(value).toLowerCase())) {
                return true;
            }
            break;
          case 'accountName': contactValue = (contact.accountName || '').toLowerCase(); break;
          case 'suborgName': contactValue = (contact.suborgName || '').toLowerCase(); break;
          case 'EMAIL': contactValue = (contact.EMAIL || '').toLowerCase(); break;
          case 'PHONE': contactValue = (contact.PHONE || '').toLowerCase(); break;
          case 'MOBILE': contactValue = (contact.MOBILE || '').toLowerCase(); break;
          case 'FAX': contactValue = (contact.FAX || '').toLowerCase(); break;
          // Add other fields as necessary
          default: return true;
        }

        const filterValue = String(value).toLowerCase();
        
        switch (operator) {
          case 'equals': return String(contactValue) === String(value).toLowerCase();
          case 'contains': return String(contactValue).includes(filterValue);
          // ... (keep existing operators if needed)
          default: return true;
        }
      });
    });
  };

  // --- AI Query Handler ---
  const handleAIQuery = async (query) => {
    setIsProcessingAI(true);
    setAiMessage('');
    
    setSearchQuery('');
    setAccountFilter('all');
    setSuborgFilter('all');
    
    try {
      const result = await gptContactIntegration(query, '/contacts', accounts, suborgs, countries, states);
      
      console.log('AI Integration Result:', result);
      
      if (result.confidence < 0.5) {
        setAiMessage('Sorry, I could not understand your request clearly. Please try again.');
        setIsProcessingAI(false);
        return;
      }

      setAiMessage(result.message);

      switch (result.intent) {
        case 'add':
          if (result.entity === 'contact') {
            setAiPrefilledData(result.data);
            setIsAdding(true);
            setSelectedContactId(null);
            setShowSelectionModal(false);
            setActiveFilters([]);
          }
          break;

        case 'edit':
          if (result.entity === 'contact') {
            const matches = applyFilters(contacts, result.filters);
            
            if (matches.length === 0) {
              setAiMessage(`No contacts found matching your criteria`);
              setActiveFilters([]);
            } else if (matches.length === 1 && !result.requiresSelection) {
              setSelectedContactId(matches[0].ROW_ID);
              setAiPrefilledData(result.data);
              setIsAdding(false);
              setShowSelectionModal(false);
              setActiveFilters([]);
              setAiMessage(`${result.message}. Editing: ${matches[0].accountName}`);
            } else {
              setMatchingContacts(matches);
              setPendingEditData(result.data);
              setShowSelectionModal(true);
              setIsAdding(false);
              setSelectedContactId(null);
              setActiveFilters(result.filters);
              setAiMessage(`Found ${matches.length} contacts matching your criteria. Please select one to edit.`);
            }
          }
          break;

        case 'display':
          if (result.entity === 'contact') {
            setActiveFilters(result.filters);
            setIsAdding(false);
            setSelectedContactId(null);
            setShowSelectionModal(false);
            setSearchQuery('');
            setAccountFilter('all');
            setSuborgFilter('all');
          }
          break;

        default:
          setAiMessage('I can help you add, edit, or view contacts.');
      }

    } catch (error) {
      console.error('AI Query Error:', error);
      setAiMessage('An error occurred while processing your request.');
    } finally {
      setIsProcessingAI(false);
    }
  };

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
  }, [contacts, accounts, suborgs, countries, states]);

  const handleContactSelection = (contact) => {
    setSelectedContactId(contact.ROW_ID);
    setAiPrefilledData(pendingEditData);
    setShowSelectionModal(false);
    setMatchingContacts([]);
    setPendingEditData(null);
    setIsAdding(false);
    setActiveFilters([]);
    setAiMessage(`Now editing: ${contact.accountName}`);
  };

  const clearFilters = () => {
    setActiveFilters([]);
    setSearchQuery('');
    setAccountFilter('all');
    setSuborgFilter('all');
    setAiMessage('');
  };

  // --- State Handlers ---

  const handleRowClick = (rowId) => {
    setSelectedContactId(rowId);
    setIsAdding(false);
    setAiPrefilledData(null);
    setShowSelectionModal(false);
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setSelectedContactId(null);
    setAiPrefilledData(null);
    setShowSelectionModal(false);
    setActiveFilters([]);
  };

  const handleBackClick = () => {
    setIsAdding(false);
    setSelectedContactId(null);
    setSearchQuery('');
    setAccountFilter('all');
    setSuborgFilter('all');
    setAiPrefilledData(null);
    setAiMessage('');
    setShowSelectionModal(false);
    setMatchingContacts([]);
    setPendingEditData(null);
    setActiveFilters([]);
  };

  const handleSaveSuccess = async () => {
    try {
      const refreshedContacts = await getRefreshedContacts();
      setContacts(refreshedContacts);
    } catch (error) {
      console.error('Failed to refresh contacts:', error);
    }
    handleBackClick();
  };

  const handleeditsuccess = async () => {
    try {
      const refreshedContacts = await getRefreshedContacts();
      setContacts(refreshedContacts);
    } catch (error) {
      console.error('Failed to refresh contacts:', error);
    }
  }

  // --- Filtering and Pagination ---

  const uniqueAccounts = useMemo(() => [...new Set(contacts.map(c => c.accountName).filter(Boolean))].sort(), [contacts]);
  const uniqueSuborgs = useMemo(() => [...new Set(contacts.map(c => c.suborgName).filter(Boolean))].sort(), [contacts]);

  let filteredContacts = contacts;
  
  const allActiveFilters = [...activeFilters];
  
  if (searchQuery.trim()) {
    allActiveFilters.push({
      field: 'contactValue', // Keeps using custom search logic
      operator: 'contains',
      value: searchQuery.toLowerCase(),
      displayValue: searchQuery
    });
  }
  
  if (accountFilter !== 'all') {
    allActiveFilters.push({
      field: 'accountName',
      operator: 'equals',
      value: accountFilter,
      displayValue: accountFilter
    });
  }
  
  if (suborgFilter !== 'all') {
    allActiveFilters.push({
      field: 'suborgName',
      operator: 'equals',
      value: suborgFilter,
      displayValue: suborgFilter
    });
  }
  
  if (allActiveFilters.length > 0) {
    // Custom filter for search query across multiple fields
    if (searchQuery.trim()) {
        filteredContacts = filteredContacts.filter(contact => 
            (contact.accountName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (contact.suborgName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (contact.EMAIL || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (contact.PHONE || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (contact.MOBILE || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    } else {
        filteredContacts = applyFilters(filteredContacts, allActiveFilters);
    }
  }

  const indexOfLastContact = currentPage * contactsPerPage;
  const indexOfFirstContact = indexOfLastContact - contactsPerPage;
  const currentContacts = filteredContacts.slice(
    indexOfFirstContact,
    indexOfLastContact
  );
  const totalPages = Math.ceil(filteredContacts.length / contactsPerPage);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setContactsPerPageInput(contactsPerPage.toString());
  }, [contactsPerPage]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
    if (e.target.value && aiMessage) setAiMessage('');
  };

  const handleAccountFilterChange = (e) => {
    setAccountFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
    if (aiMessage) setAiMessage('');
  };

  const handleSuborgFilterChange = (e) => {
    setSuborgFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
    if (aiMessage) setAiMessage('');
  };

  const handleContactsPerPageInputChange = (e) => setContactsPerPageInput(e.target.value);

  const handleContactsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setContactsPerPage(value);
        setContactsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setContactsPerPageInput(contactsPerPage.toString());
      }
    }
  };

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

  const handlePageInputChange = (e) => setPageInputValue(e.target.value);

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

  if (isAdding) {
    return (
      <>
        {aiMessage && (
          <div className={`contact_ai-message ${isProcessingAI ? 'processing' : ''}`}>
            {isProcessingAI ? 'Processing your request...' : aiMessage}
          </div>
        )}
        <AddContactForm
          accounts={accounts}
          suborgs={suborgs}
          countries={countries}
          states={states}
          orgid={orgid}
          contactTypes={contactTypes}
          userSuborgId={userSuborgId}
          onBackClick={handleBackClick}
          onSaveSuccess={handleSaveSuccess}
          prefilledData={aiPrefilledData}
        />
      </>
    );
  }

  if (selectedContactId) {
    return (
      <>
        {aiMessage && (
          <div className={`contact_ai-message ${isProcessingAI ? 'processing' : ''}`}>
            {isProcessingAI ? 'Processing your request...' : aiMessage}
          </div>
        )}
        <EditContactForm
          selectedContactId={selectedContactId}
          accounts={accounts}
          suborgs={suborgs}
          countries={countries}
          states={states}
          orgid={orgid}
          contactTypes={contactTypes}
          userSuborgId={userSuborgId}
          onBackClick={handleBackClick}
          onSaveSuccess={handleeditsuccess}
          aiPrefilledData={aiPrefilledData}
        />
      </>
    );
  }

  return (
    <div className="contact_overview-container">
      {aiMessage && (
        <div className={`contact_ai-message ${isProcessingAI ? 'processing' : ''}`}>
          {isProcessingAI ? 'Processing your request...' : aiMessage}
        </div>
      )}

      {(activeFilters.length > 0 || searchQuery || accountFilter !== 'all' || suborgFilter !== 'all') && (
        <div className="contact_active-filters">
          <div className="contact_filter-header">
            <span>Active Filters ({allActiveFilters.length}):</span>
            <button onClick={clearFilters} className="contact_clear-filters">Clear All</button>
          </div>
          <div className="contact_filter-tags">
            {allActiveFilters.map((filter, index) => (
              <span key={index} className="contact_filter-tag">
                {filter.field}: {filter.operator} "{filter.displayValue || filter.value}"
              </span>
            ))}
          </div>
        </div>
      )}

      {showSelectionModal && matchingContacts.length > 0 && (
        <div className="contact_selection-modal">
          <div className="contact_selection-modal-content">
            <h3>Select Contact to Edit</h3>
            <p>Found {matchingContacts.length} matching contacts:</p>
            <div className="contact_selection-list">
              {matchingContacts.map((contact) => (
                <div
                  key={contact.ROW_ID}
                  className="contact_selection-item"
                  onClick={() => handleContactSelection(contact)}
                >
                  <div className="contact_selection-item-name">
                    {contact.accountName} - {contact.primaryContact}
                  </div>
                  <div className="contact_selection-item-details">
                    Email: {contact.EMAIL || '-'} | Phone: {contact.PHONE || '-'} |
                    Org: {contact.suborgName || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
            <button 
              className="contact_selection-cancel"
              onClick={() => {
                setShowSelectionModal(false);
                setMatchingContacts([]);
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

      <div className="contact_header-section">
        <h1 className="contact_title">Contacts</h1>
        <button className="contact_button" onClick={handleAddClick}>
          Add Contact
        </button>
      </div>

      <div className="contact_search-filter-container">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="contact_search-input"
        />
        <select
          value={accountFilter}
          onChange={handleAccountFilterChange}
          className="contact_filter-select"
        >
          <option value="all">All Accounts</option>
          {uniqueAccounts.map((account) => (
            <option key={account} value={account}>{account}</option>
          ))}
        </select>
        <select
          value={suborgFilter}
          onChange={handleSuborgFilterChange}
          className="contact_filter-select"
        >
          <option value="all">All Orgs</option>
          {uniqueSuborgs.map((suborg) => (
            <option key={suborg} value={suborg}>{suborg}</option>
          ))}
        </select>
      </div>

      {filteredContacts.length === 0 ? (
        <div className="contact_empty-state">
          No contacts found matching your criteria.
          {allActiveFilters.length > 0 && (
            <button onClick={clearFilters} className="contact_retry-button">
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="contact_table-wrapper">
            <table className="contact_table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Account</th>
                  <th>Organization</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {currentContacts.map((contact) => (
                  <tr
                    key={contact.ROW_ID}
                    onClick={() => handleRowClick(contact.ROW_ID)}
                  >
                    <td>
                      <span className="contact_status-indicator"></span>
                      {contact.displayName || 'N/A'}
                    </td>
                    <td>{contact.accountName}</td>
                    <td>{contact.suborgName}</td>
                    <td>{contact.EMAIL || '-'}</td>
                    <td>{contact.PHONE || contact.MOBILE || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredContacts.length > contactsPerPage && (
            <div className="contact_pagination-container">
              <button
                className="contact_button"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              <span className="contact_pagination-text">
                Page{' '}
                <input
                  type="text"
                  value={pageInputValue}
                  onChange={handlePageInputChange}
                  onKeyPress={handlePageInputKeyPress}
                  className="contact_pagination-input"
                />{' '}
                of {totalPages}
              </span>
              <button
                className="contact_button"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          )}
          
          <div className="contact_rows-per-page-container">
            <label className="contact_rows-per-page-label">Rows per Page:</label>
            <input
              type="text"
              value={contactsPerPageInput}
              onChange={handleContactsPerPageInputChange}
              onKeyPress={handleContactsPerPageInputKeyPress}
              placeholder="Contacts per page"
              className="contact_rows-per-page-input"
              aria-label="Number of rows per page"
            />
          </div>
        </>
      )}
    </div>
  );
}
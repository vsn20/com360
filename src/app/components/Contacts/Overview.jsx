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
  const [contactTypeFilter, setContactTypeFilter] = useState('all');

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

        // Get the field value from the contact
        switch (field) {
          case 'ROW_ID':
            // Match against the display format: accountName-ROW_ID
            contactValue = `${contact.accountName}-${contact.ROW_ID}`.toLowerCase();
            break;
          case 'accountName':
            contactValue = (contact.accountName || '').toLowerCase();
            break;
          case 'suborgName':
            contactValue = (contact.suborgName || '').toLowerCase();
            break;
          case 'CONTACT_TYPE_CD':
            contactValue = (contact.CONTACT_TYPE_CD || '').toLowerCase();
            break;
          case 'contactValue':
            contactValue = (contact.contactValue || '').toLowerCase();
            break;
          case 'EMAIL':
            contactValue = (contact.EMAIL || '').toLowerCase();
            break;
          case 'PHONE':
            contactValue = (contact.PHONE || '').toLowerCase();
            break;
          case 'MOBILE':
            contactValue = (contact.MOBILE || '').toLowerCase();
            break;
          case 'FAX':
            contactValue = (contact.FAX || '').toLowerCase();
            break;
          case 'HOME_CITY':
            contactValue = (contact.HOME_CITY || '').toLowerCase();
            break;
          case 'MAILING_CITY':
            contactValue = (contact.MAILING_CITY || '').toLowerCase();
            break;
          case 'HOME_COUNTRY_ID':
            contactValue = String(contact.HOME_COUNTRY_ID || '');
            break;
          case 'MAILING_COUNTRY_ID':
            contactValue = String(contact.MAILING_COUNTRY_ID || '');
            break;
          case 'HOME_STATE_ID':
            contactValue = String(contact.HOME_STATE_ID || '');
            break;
          case 'MAILING_STATE_ID':
            contactValue = String(contact.MAILING_STATE_ID || '');
            break;
          case 'HOME_POSTAL_CODE':
            contactValue = (contact.HOME_POSTAL_CODE || '').toLowerCase();
            break;
          case 'MAILING_POSTAL_CODE':
            contactValue = (contact.MAILING_POSTAL_CODE || '').toLowerCase();
            break;
          case 'STATUS':
            contactValue = (contact.STATUS || '').toLowerCase();
            break;
          case 'CREATED_DATE':
            contactValue = contact.CREATED_DATE ? new Date(contact.CREATED_DATE) : null;
            break;
          case 'LAST_UPDATED_DATE':
            contactValue = contact.LAST_UPDATED_DATE ? new Date(contact.LAST_UPDATED_DATE) : null;
            break;
          case 'CREATED_BY':
            contactValue = (contact.CREATED_BY || '').toLowerCase();
            break;
          case 'LAST_UPDATED_BY':
            contactValue = (contact.LAST_UPDATED_BY || '').toLowerCase();
            break;
          default:
            return true;
        }

        // Apply operator
        const filterValue = String(value).toLowerCase();
        
        switch (operator) {
          case 'equals':
            if (field === 'ROW_ID') {
              // For ROW_ID, check both the full display format and just the ROW_ID
              const displayFormat = `${contact.accountName}-${contact.ROW_ID}`.toLowerCase();
              const justRowId = String(contact.ROW_ID).toLowerCase();
              return displayFormat === filterValue || justRowId === filterValue || 
                     displayFormat.includes(filterValue) || justRowId.includes(filterValue);
            }
            return String(contactValue) === String(value);
          case 'notEquals':
            return String(contactValue) !== String(value);
          case 'contains':
            return String(contactValue).includes(filterValue);
          case 'notContains':
            return !String(contactValue).includes(filterValue);
          case 'startsWith':
            return String(contactValue).startsWith(filterValue);
          case 'endsWith':
            return String(contactValue).endsWith(filterValue);
          case 'before':
            if (!contactValue || !(contactValue instanceof Date)) return false;
            return contactValue < new Date(value);
          case 'after':
            if (!contactValue || !(contactValue instanceof Date)) return false;
            return contactValue > new Date(value);
          case 'between':
            if (!contactValue || !(contactValue instanceof Date) || !value2) return false;
            return contactValue >= new Date(value) && contactValue <= new Date(value2);
          default:
            return true;
        }
      });
    });
  };

  // --- AI Query Handler ---
  const handleAIQuery = async (query) => {
    setIsProcessingAI(true);
    setAiMessage('');
    
    // Clear manual filters when AI query comes in
    setSearchQuery('');
    setAccountFilter('all');
    setSuborgFilter('all');
    setContactTypeFilter('all');
    
    try {
      const result = await gptContactIntegration(query, '/contacts', accounts, suborgs, countries, states);
      
      console.log('AI Integration Result:', result);
      
      if (result.confidence < 0.5) {
        setAiMessage('Sorry, I could not understand your request clearly. Please try again.');
        setIsProcessingAI(false);
        return;
      }

      setAiMessage(result.message);

      // Handle based on intent
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
            console.log('Applying filters:', result.filters);
            const matches = applyFilters(contacts, result.filters);
            console.log('Matched contacts:', matches);
            
            if (matches.length === 0) {
              setAiMessage(`No contacts found matching your criteria`);
              setActiveFilters([]);
            } else if (matches.length === 1 && !result.requiresSelection) {
              // Single match and no selection required - directly edit
              console.log('Single match found, directly editing:', matches[0]);
              setSelectedContactId(matches[0].ROW_ID);
              setAiPrefilledData(result.data);
              setIsAdding(false);
              setShowSelectionModal(false);
              setActiveFilters([]);
              setAiMessage(`${result.message}. Editing: ${matches[0].accountName} - ${matches[0].contactValue}`);
            } else {
              // Multiple matches or selection required
              console.log('Multiple matches or selection required:', matches.length);
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
            setContactTypeFilter('all');
          }
          break;

        default:
          setAiMessage('I can help you add, edit, or view contacts. Try: "Add email contact john@example.com for TechCorp"');
      }

    } catch (error) {
      console.error('AI Query Error:', error);
      setAiMessage('An error occurred while processing your request.');
    } finally {
      setIsProcessingAI(false);
    }
  };

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
  }, [contacts, accounts, suborgs, countries, states]);

  const handleContactSelection = (contact) => {
    setSelectedContactId(contact.ROW_ID);
    setAiPrefilledData(pendingEditData);
    setShowSelectionModal(false);
    setMatchingContacts([]);
    setPendingEditData(null);
    setIsAdding(false);
    setActiveFilters([]);
    setAiMessage(`Now editing: ${contact.accountName} - ${contact.contactValue}`);
  };

  const clearFilters = () => {
    setActiveFilters([]);
    setSearchQuery('');
    setAccountFilter('all');
    setSuborgFilter('all');
    setContactTypeFilter('all');
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
    setContactTypeFilter('all');
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
  const uniqueContactTypes = useMemo(() => [...new Set(contacts.map(c => c.CONTACT_TYPE_CD).filter(Boolean))].sort(), [contacts]);

  // Apply filters - combining AI and manual filters
  let filteredContacts = contacts;
  
  const allActiveFilters = [...activeFilters];
  
  if (searchQuery.trim()) {
    allActiveFilters.push({
      field: 'contactValue',
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
  
  if (contactTypeFilter !== 'all') {
    allActiveFilters.push({
      field: 'CONTACT_TYPE_CD',
      operator: 'equals',
      value: contactTypeFilter,
      displayValue: contactTypeFilter
    });
  }
  
  if (allActiveFilters.length > 0) {
    filteredContacts = applyFilters(filteredContacts, allActiveFilters);
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
    if (e.target.value && aiMessage) {
      setAiMessage('');
    }
  };

  const handleAccountFilterChange = (e) => {
    setAccountFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
    if (aiMessage) {
      setAiMessage('');
    }
  };

  const handleSuborgFilterChange = (e) => {
    setSuborgFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
    if (aiMessage) {
      setAiMessage('');
    }
  };

  const handleContactTypeFilterChange = (e) => {
    setContactTypeFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
    if (aiMessage) {
      setAiMessage('');
    }
  };

  const handleContactsPerPageInputChange = (e) => {
    setContactsPerPageInput(e.target.value);
  };

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

  // --- Conditional Rendering ---

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
          onBackClick={handleBackClick}
          onSaveSuccess={handleeditsuccess}
          aiPrefilledData={aiPrefilledData}
        />
      </>
    );
  }

  // --- Default View (List) ---
  return (
    <div className="contact_overview-container">
      {aiMessage && (
        <div className={`contact_ai-message ${isProcessingAI ? 'processing' : ''}`}>
          {isProcessingAI ? 'Processing your request...' : aiMessage}
        </div>
      )}

      {(activeFilters.length > 0 || searchQuery || accountFilter !== 'all' || suborgFilter !== 'all' || contactTypeFilter !== 'all') && (
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
                    {contact.accountName} - {contact.contactValue}
                  </div>
                  <div className="contact_selection-item-details">
                    Type: {contact.CONTACT_TYPE_CD} | 
                    Organization: {contact.suborgName || 'N/A'} |
                    Contact ID: {contact.accountName}-{contact.ROW_ID}
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
          placeholder="Search by Account, Suborg, or Contact Info..."
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
        <select
          value={contactTypeFilter}
          onChange={handleContactTypeFilterChange}
          className="contact_filter-select"
        >
          <option value="all">All Contact Types</option>
          {uniqueContactTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
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
                  <th>Account</th>
                  <th>Organization</th>
                  <th>Contact Type</th>
                  <th>Contact Info</th>
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
                      {contact.accountName}
                    </td>
                    <td>{contact.suborgName}</td>
                    <td>{contact.CONTACT_TYPE_CD}</td>
                    <td>{contact.contactValue}</td>
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
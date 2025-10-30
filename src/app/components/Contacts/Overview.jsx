'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { getRefreshedContacts } from '@/app/serverActions/Contacts/actions';
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

  // --- State Handlers ---

  const handleRowClick = (rowId) => {
    setSelectedContactId(rowId);
    setIsAdding(false);
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setSelectedContactId(null);
  };

  const handleBackClick = () => {
    setIsAdding(false);
    setSelectedContactId(null);
  };

  // This function is called after a successful save to refresh the list
  const handleSaveSuccess = async () => {
    try {
      const refreshedContacts = await getRefreshedContacts();
      setContacts(refreshedContacts);
    } catch (error) {
      console.error('Failed to refresh contacts:', error);
    }
    handleBackClick();
  };

  const handleeditsuccess=async()=>{
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

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        contact.accountName?.toLowerCase().includes(searchLower) ||
        contact.suborgName?.toLowerCase().includes(searchLower) ||
        contact.contactValue?.toLowerCase().includes(searchLower);
      const matchesAccount = accountFilter === 'all' || contact.accountName === accountFilter;
      const matchesSuborg = suborgFilter === 'all' || contact.suborgName === suborgFilter;
      const matchesContactType = contactTypeFilter === 'all' || contact.CONTACT_TYPE_CD === contactTypeFilter;
      return matchesSearch && matchesAccount && matchesSuborg && matchesContactType;
    });
  }, [contacts, searchQuery, accountFilter, suborgFilter, contactTypeFilter]);

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
  };

  const handleAccountFilterChange = (e) => {
    setAccountFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleSuborgFilterChange = (e) => {
    setSuborgFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleContactTypeFilterChange = (e) => {
    setContactTypeFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
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
      <AddContactForm
        accounts={accounts}
        suborgs={suborgs}
        countries={countries}
        states={states}
        orgid={orgid}
        onBackClick={handleBackClick}
        onSaveSuccess={handleSaveSuccess}
      />
    );
  }

  if (selectedContactId) {
    return (
      <EditContactForm
        selectedContactId={selectedContactId}
        accounts={accounts}
        suborgs={suborgs}
        countries={countries}
        states={states}
        orgid={orgid}
        onBackClick={handleBackClick}
        onSaveSuccess={handleeditsuccess}
      />
    );
  }

  // --- Default View (List) ---
  return (
    <div className="contact-overview-container">
      <div className="contact-header-section">
        <h1 className="contact-title">Contacts</h1>
        <button className="contact-button" onClick={handleAddClick}>
          Add Contact
        </button>
      </div>

      <div className="contact-overview-search-filter-container">
        <input
          type="text"
          placeholder="Search by Account, Suborg, or Contact Info..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="contact-overview-search-input"
        />
        <select
          value={accountFilter}
          onChange={handleAccountFilterChange}
          className="contact-overview-filter-select"
        >
          <option value="all">All Accounts</option>
          {uniqueAccounts.map((account) => (
            <option key={account} value={account}>{account}</option>
          ))}
        </select>
        <select
          value={suborgFilter}
          onChange={handleSuborgFilterChange}
          className="contact-overview-filter-select"
        >
          <option value="all">All Suborgs</option>
          {uniqueSuborgs.map((suborg) => (
            <option key={suborg} value={suborg}>{suborg}</option>
          ))}
        </select>
        <select
          value={contactTypeFilter}
          onChange={handleContactTypeFilterChange}
          className="contact-overview-filter-select"
        >
          <option value="all">All Contact Types</option>
          {uniqueContactTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="contact-table-wrapper">
        <table className="contact-table">
          <thead>
            <tr>
              <th>Contact ID</th>
              <th>Account</th>
              <th>Organization</th>
              <th>Contact Type</th>
              <th>Contact Info</th>
            </tr>
          </thead>
          <tbody>
            {currentContacts.length > 0 ? (
              currentContacts.map((contact) => (
                <tr
                  key={contact.ROW_ID}
                  onClick={() => handleRowClick(contact.ROW_ID)}
                >
                  {/* <td>{contact.ROW_ID}</td> */}
                  <td>{`${contact.accountName}-${contact.ROW_ID}`}</td>
                  <td>{contact.accountName}</td>
                  <td>{contact.suborgName}</td>
                  <td>{contact.CONTACT_TYPE_CD}</td>
                  <td>{contact.contactValue}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center' }}>
                  No contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredContacts.length > contactsPerPage && (
        <div className="contact-overview-pagination-container">
          <button
            className="contact-overview-button"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            ← Previous
          </button>
          <span className="contact-overview-pagination-text">
            Page{' '}
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyPress={handlePageInputKeyPress}
              className="contact-overview-pagination-input"
            />{' '}
            of {totalPages}
          </span>
          <button
            className="contact-overview-button"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
      
      <div className="contact-overview-rows-per-page-container">
        <label className="contact-overview-rows-per-page-label">Rows per Page:</label>
        <input
          type="text"
          value={contactsPerPageInput}
          onChange={handleContactsPerPageInputChange}
          onKeyPress={handleContactsPerPageInputKeyPress}
          placeholder="Contacts per page"
          className="contact-overview-rows-per-page-input"
          aria-label="Number of rows per page"
        />
      </div>
    </div>
  );
}
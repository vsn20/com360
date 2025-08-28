'use client';
import React, { useEffect, useState } from 'react';
import AddOrganization from './AddOrganization';
import EditOrganization from './EditOrganization';
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

  useEffect(() => {
    setAllOrganizations(organizations);
  }, [organizations]);

  useEffect(() => {
    handleBackClick();
  }, [searchParams.get('refresh')]);

  useEffect(() => {
    const sortedOrganizations = [...organizations].sort((a, b) => sortOrganizations(a, b, sortConfig.column, sortConfig.direction));
    setAllOrganizations(sortedOrganizations);
  }, [sortConfig, organizations]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const sortOrganizations = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'suborgid':
        aValue = parseInt(a.suborgid.split('-')[1] || a.suborgid);
        bValue = parseInt(b.suborgid.split('-')[1] || b.suborgid);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'suborgname':
        aValue = (a.suborgname || '').toLowerCase();
        bValue = (b.suborgname || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'isstatus':
        aValue = a.isstatus ? 'Yes' : 'No';
        bValue = b.isstatus ? 'Yes' : 'No';
        if (direction === 'asc') {
          return aValue === 'Yes' ? -1 : bValue === 'Yes' ? 1 : aValue.localeCompare(bValue);
        } else {
          return aValue === 'No' ? -1 : bValue === 'No' ? 1 : bValue.localeCompare(aValue);
        }
      case 'created_date':
        aValue = new Date(a.created_date).getTime();
        bValue = new Date(b.created_date).getTime();
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'country':
        aValue = a.country ? (countries.find(c => String(c.ID) === a.country)?.VALUE || 'Unknown Country').toLowerCase() : '';
        bValue = b.country ? (countries.find(c => String(c.ID) === b.country)?.VALUE || 'Unknown Country').toLowerCase() : '';
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

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
      setPageInputValue((currentPage + 1).toString());
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
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

  const handleOrgsPerPageInputChange = (e) => {
    setOrgsPerPageInput(e.target.value);
  };

  const handleOrgsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setOrgsPerPage(value);
        setOrgsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setOrgsPerPageInput(orgsPerPage.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      }
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleStatusFilterChange = (e) => {
    setIsActiveFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  // Filter logic
  const filteredOrganizations = allOrganizations.filter((org) => {
    const matchesSearch = org.suborgname?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      isActiveFilter === 'all' ||
      (isActiveFilter === 'active' && org.isstatus) ||
      (isActiveFilter === 'inactive' && !org.isstatus);
    return matchesSearch && matchesStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredOrganizations.length / orgsPerPage);
  const indexOfLastOrg = currentPage * orgsPerPage;
  const indexOfFirstOrg = indexOfLastOrg - orgsPerPage;
  const currentOrganizations = filteredOrganizations.slice(indexOfFirstOrg, indexOfLastOrg);

  return (
    <div className="organization-overview-container89">
      {add && (
        <div className="organization-details-container89">
          <div className="header-section89">
            <h1 className="title89">Add Organization</h1>
            <button className="back-button89" onClick={handleBackClick}></button>
          </div>
          <AddOrganization orgid={orgid} empid={empid} countries={countries} states={states} />
        </div>
      )}
      {!add && selectedorgid ? (
        <div className="organization-details-container89">
          <div className="header-section89">
            <h1 className="title89">Edit Organization</h1>
            <button className="back-button89" onClick={handleBackClick}></button>
          </div>
          <EditOrganization selectedorgid={selectedorgid} orgid={orgid} empid={empid} countries={countries} states={states} />
        </div>
      ) : (
        !add && (
          <div className="organization-list89">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h1 className="title89">Existing Organizations</h1>
              <button onClick={handleAdd} className="button89">Add Organization</button>
            </div>
            <div className="search-filter-container89">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                className="search-input89"
                placeholder="Search by organization name..."
              />
              <select value={isActiveFilter} onChange={handleStatusFilterChange} className="filter-select89">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {filteredOrganizations.length === 0 ? (
              <div className="empty-state89">No organizations found.</div>
            ) : (
              <>
                <div className="table-wrapper89">
                  <table className="four-column89">
                    <colgroup>
                      <col />
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className={sortConfig.column === 'suborgid' ? `sortable89 sort-${sortConfig.direction}89` : 'sortable89'} onClick={() => requestSort('suborgid')}>
                          Organization ID
                        </th>
                        <th className={sortConfig.column === 'suborgname' ? `sortable89 sort-${sortConfig.direction}89` : 'sortable89'} onClick={() => requestSort('suborgname')}>
                          Organization Name
                        </th>
                        <th className={sortConfig.column === 'country' ? `sortable89 sort-${sortConfig.direction}89` : 'sortable89'} onClick={() => requestSort('country')}>
                          Country
                        </th>
                        <th className={sortConfig.column === 'isstatus' ? `sortable89 sort-${sortConfig.direction}89` : 'sortable89'} onClick={() => requestSort('isstatus')}>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentOrganizations.map((org) => (
                        <tr key={org.suborgid} onClick={() => handleRowClick(org.suborgid)}>
                          <td className="id-cell89">
                            <span className="org-indicator89"></span>
                            {org.suborgid.split('-')[1] || org.suborgid}
                          </td>
                          <td>{org.suborgname || '-'}</td>
                          <td>{org.country ? (countries.find(c => String(c.ID) === org.country)?.VALUE || 'Unknown Country') : '-'}</td>
                          <td className={org.isstatus ? 'status-badge89 active89' : 'status-badge89 inactive89'}>
                            {org.isstatus ? 'Active' : 'Inactive'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredOrganizations.length > orgsPerPage && (
                  <div className="pagination-container89">
                    <button
                      className="button89"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </button>
                    <span className="pagination-text89">
                      Page{' '}
                      <input
                        type="text"
                        value={pageInputValue}
                        onChange={handlePageInputChange}
                        onKeyPress={handlePageInputKeyPress}
                        className="pagination-input89"
                      />{' '}
                      of {totalPages}
                    </span>
                    <button
                      className="button89"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </div>
                )}
                {filteredOrganizations.length > 0 && (
                  <div className="rows-per-page-container89">
                    <label className="rows-per-page-label89">Rows/ Page</label>
                    <input
                      type="text"
                      value={orgsPerPageInput}
                      onChange={handleOrgsPerPageInputChange}
                      onKeyPress={handleOrgsPerPageInputKeyPress}
                      className="rows-per-page-input89"
                      aria-label="Number of rows per page"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default Overview;
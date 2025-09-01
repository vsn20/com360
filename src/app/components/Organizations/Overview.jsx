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
          <EditOrganization selectedorgid={selectedorgid} orgid={orgid} empid={empid} countries={countries} states={states} />
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
                onChange={handleSearchChange}
                className="organization_search_input"
                placeholder="Search by organization name..."
              />
              <select value={isActiveFilter} onChange={handleStatusFilterChange} className="organization_filter_select">
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
                        <th className={`organization_sortable ${sortConfig.column === 'suborgid' ? `organization_sort_${sortConfig.direction}` : ''}`} onClick={() => requestSort('suborgid')}>
                          Organization ID
                        </th>
                        <th className={`organization_sortable ${sortConfig.column === 'suborgname' ? `organization_sort_${sortConfig.direction}` : ''}`} onClick={() => requestSort('suborgname')}>
                          Organization Name
                        </th>
                        <th className={`organization_sortable ${sortConfig.column === 'country' ? `organization_sort_${sortConfig.direction}` : ''}`} onClick={() => requestSort('country')}>
                          Country
                        </th>
                        <th className={`organization_sortable ${sortConfig.column === 'isstatus' ? `organization_sort_${sortConfig.direction}` : ''}`} onClick={() => requestSort('isstatus')}>
                          Status
                        </th>
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
                {filteredOrganizations.length > orgsPerPage && (
                  <div className="organization_pagination_container">
                    <button
                      className="organization_button"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </button>
                    <span className="organization_pagination_text">
                      Page{' '}
                      <input
                        type="text"
                        value={pageInputValue}
                        onChange={handlePageInputChange}
                        onKeyPress={handlePageInputKeyPress}
                        className="organization_pagination_input"
                      />{' '}
                      of {totalPages}
                    </span>
                    <button
                      className="organization_button"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </div>
                )}
                {filteredOrganizations.length > 0 && (
                  <div className="organization_rows_per_page_container">
                    <label className="organization_rows_per_page_label">Rows/ Page</label>
                    <input
                      type="text"
                      value={orgsPerPageInput}
                      onChange={handleOrgsPerPageInputChange}
                      onKeyPress={handleOrgsPerPageInputKeyPress}
                      className="organization_rows_per_page_input"
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

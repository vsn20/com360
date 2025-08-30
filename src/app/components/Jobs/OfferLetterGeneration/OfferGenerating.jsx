'use client'
import React, { useEffect, useState } from 'react';
import Details from './Details';
import { useRouter } from 'next/navigation';
import './offergenerating.css';

const OfferGenerating = ({ empid, orgid, interviewdetails, acceptingtime, handlebAck }) => {
  const router = useRouter();
  const [filetered, setFiletered] = useState([]);
  const [selectedid, setSelectedid] = useState(null);
  // Pagination and filtering state
  const [sortConfig, setSortConfig] = useState({ column: 'interview_id', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rowsPerPageInput, setRowsPerPageInput] = useState('10');

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  // Update filtered data and apply sorting
  useEffect(() => {
    setFiletered([...interviewdetails].sort((a, b) =>
      sortOfferLetters(a, b, sortConfig.column, sortConfig.direction)
    ));
  }, [interviewdetails, orgid, sortConfig]);

  // Update page input when currentPage changes
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  // Update rows per page input when rowsPerPage changes
  useEffect(() => {
    setRowsPerPageInput(rowsPerPage.toString());
  }, [rowsPerPage]);

  const selectid = (id) => {
    setSelectedid(id);
  };

  const handleback = () => {
    router.refresh();
    setSelectedid(null);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  // Sorting function
  const sortOfferLetters = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'interview_id':
        aValue = parseInt(getdisplayprojectid(a.interview_id));
        bValue = parseInt(getdisplayprojectid(b.interview_id));
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'application_id':
        aValue = parseInt(getdisplayprojectid(a.application_id));
        bValue = parseInt(getdisplayprojectid(b.application_id));
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'applicant_name':
        aValue = `${a.first_name} ${a.last_name}`.toLowerCase();
        bValue = `${b.first_name} ${b.last_name}`.toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
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

  // Search and filter handlers
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

  const handleRowsPerPageInputChange = (e) => {
    setRowsPerPageInput(e.target.value);
  };

  const handleRowsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setRowsPerPage(value);
        setRowsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setRowsPerPageInput(rowsPerPage.toString());
      }
    }
  };

  // Filtering logic
  const filteredOfferLetters = filetered.filter((details) => {
    const applicantName = `${details.first_name} ${details.last_name}`.toLowerCase();
    const interviewId = getdisplayprojectid(details.interview_id).toLowerCase();
    const matchesSearch = applicantName.includes(searchQuery.toLowerCase()) || interviewId.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || details.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredOfferLetters.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredOfferLetters.slice(indexOfFirstRow, indexOfLastRow);

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

  // Get unique statuses for filter
  const uniqueStatuses = [...new Set(interviewdetails.map((req) => req.status).filter(Boolean))];

  return (
    <div>
      {selectedid ? (
        <>
          <Details
            selectid={selectedid}
            orgid={orgid}
            empid={empid}
            handleback={handleback}
          />
        </>
      ) : (
        <>
            <div className="employee-details-container1">
          <div className="header-section1">
            <h1 className="title">Generate Offer Letters</h1>
            <button className="back-button" onClick={handlebAck}></button>
          </div>
          </div>
          <div className="search-filter-container">
            <input
              type="text"
              placeholder="Search by Applicant Name or Interview ID"
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
          </div>

          {filteredOfferLetters.length === 0 ? (
            <p className="empty-state">No offer letters found.</p>
          ) : (
            <>
              <div className="table-wrapper2">
                <table className="employee-table2">
                  <thead>
                    <tr>
                      <th
                        className={sortConfig.column === 'interview_id' ? `sortable sort-${sortConfig.direction}` : 'sortable'}
                        onClick={() => requestSort('interview_id')}
                      >
                        Interview ID
                      </th>
                      <th
                        className={sortConfig.column === 'application_id' ? `sortable sort-${sortConfig.direction}` : 'sortable'}
                        onClick={() => requestSort('application_id')}
                      >
                        Application Id
                      </th>
                      <th
                        className={sortConfig.column === 'applicant_name' ? `sortable sort-${sortConfig.direction}` : 'sortable'}
                        onClick={() => requestSort('applicant_name')}
                      >
                        Applicant Name
                      </th>
                      <th
                        className={sortConfig.column === 'status' ? `sortable sort-${sortConfig.direction}` : 'sortable'}
                        onClick={() => requestSort('status')}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((details) => (
                      <tr key={details.interview_id} onClick={() => selectid(details.interview_id)}>
                        <td className="id-cell2">
                          <span className={details.status === 'active' ? 'role-indicator' : 'role-indicator1'}></span>
                          {getdisplayprojectid(details.interview_id)}
                        </td>
                        <td>{getdisplayprojectid(details.application_id)}</td>
                        <td>{`${details.first_name} ${details.last_name}`}</td>
                        <td>
                          <span className={details.status === 'active' ? 'status-badge2 active2' : 'status-badge2 inactive2'}>
                            {details.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredOfferLetters.length > rowsPerPage && (
                <div className="pagination-container">
                  <button
                    className="button2"
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
                    className="button2"
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
                  value={rowsPerPageInput}
                  onChange={handleRowsPerPageInputChange}
                  onKeyPress={handleRowsPerPageInputKeyPress}
                  placeholder="Rows per page"
                  className="rows-per-page-input"
                  aria-label="Number of rows per page"
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default OfferGenerating;
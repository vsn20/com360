'use client';
import React, { useEffect, useState } from 'react';
import Details from './Details';
import { useRouter } from 'next/navigation';
import './Offerletter.css';

const OfferGenerating = ({ empid, orgid, interviewdetails, acceptingtime, handlebAck }) => {
  const router = useRouter();
  const [filtered, setFiltered] = useState([]);
  const [selectedid, setSelectedid] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [rowsPerPageInput, setRowsPerPageInput] = useState('5');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  useEffect(() => {
    let filteredData = interviewdetails;
    if (searchQuery) {
      filteredData = filteredData.filter(
        (detail) =>
          detail.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          detail.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          getdisplayprojectid(detail.interview_id).includes(searchQuery) ||
          getdisplayprojectid(detail.application_id).includes(searchQuery)
      );
    }
    if (filterStatus) {
      filteredData = filteredData.filter((detail) => detail.status === filterStatus);
    }
    setFiltered(filteredData);
    setCurrentPage(1);
  }, [searchQuery, filterStatus, interviewdetails]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleFilterChange = (e) => {
    setFilterStatus(e.target.value);
  };

  const handleRowsPerPageChange = (e) => {
    const value = e.target.value;
    setRowsPerPageInput(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setRowsPerPage(numValue);
      setCurrentPage(1);
    }
  };

  const handlePageInputChange = (e) => {
    setPageInputValue(e.target.value);
  };

  const handlePageChange = (page) => {
    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
    setPageInputValue(newPage.toString());
  };

  const selectid = (id) => {
    setSelectedid(id);
  };

  const handleback = () => {
    router.refresh();
    setSelectedid(null);
  };

  const paginatedData = filtered.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  return (
    <div className="employee-overview-container">
      {selectedid ? (
        <Details
          selectid={selectedid}
          orgid={orgid}
          empid={empid}
          handleback={handleback}
        />
      ) : (
        <div className="employee-details-container">
          <div className="header-section">
            <h1 className="title">Offer Letter Generation</h1>
            <button className="back-button" onClick={handlebAck}>
              Back
            </button>
          </div>
          <div className="search-filter-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search by name, interview ID, or application ID"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            <select
              className="filter-select"
              value={filterStatus}
              onChange={handleFilterChange}
            >
              <option value="">All Statuses</option>
              <option value="offerletter-generated">Offer Letter Generated</option>
              <option value="offerletter-rejected">Offer Letter Rejected</option>
              <option value="offerletter-hold">Offer Letter Hold</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <div className="empty-state">No interviews found.</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="service-requests-table">
                  <thead>
                    <tr>
                      <th>Interview ID</th>
                      <th>Application ID</th>
                      <th>Applicant Name</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((details) => (
                      <tr
                        key={details.interview_id}
                        onClick={() => selectid(details.interview_id)}
                        className={selectedid === details.interview_id ? 'selected-row' : ''}
                      >
                        <td className="id-cell">
                          <span className="role-indicator"></span>
                          {getdisplayprojectid(details.interview_id)}
                        </td>
                        <td>{getdisplayprojectid(details.application_id)}</td>
                        <td>{`${details.first_name} ${details.last_name}`}</td>
                        <td className={details.status ? 'status-badge active' : 'status-badge inactive'}>
                          {details.status || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination-controls">
                <div className="rows-per-page">
                  <label>Rows per page:</label>
                  <input
                    type="number"
                    value={rowsPerPageInput}
                    onChange={handleRowsPerPageChange}
                    min="1"
                  />
                </div>
                <div className="pagination-buttons">
                  <button
                    className="button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                  <input
                    type="number"
                    className="search-input"
                    value={pageInputValue}
                    onChange={handlePageInputChange}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const page = parseInt(pageInputValue, 10);
                        if (!isNaN(page)) handlePageChange(page);
                      }
                    }}
                    min="1"
                    max={totalPages}
                    style={{ width: '60px' }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default OfferGenerating;
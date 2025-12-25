'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import './Applications.css'; // Using Applications.css as requested

const formatDate = (date) => {
  if (!date || isNaN(new Date(date))) return '';
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${d.getFullYear()}`;
};

export default function Applications() {
    const [allApplications, setAllApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [uniqueOrgs, setUniqueOrgs] = useState([]);
    const [uniqueStatuses, setUniqueStatuses] = useState([]);
    const [orgFilter, setOrgFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ column: 'applicationid', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageInputValue, setPageInputValue] = useState('1');
    const [appsPerPage, setAppsPerPage] = useState(10);
    const [appsPerPageInput, setAppsPerPageInput] = useState('10');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        const fetchApplications = async () => {
            try {
                const response = await fetch('/api/applications', {
                    credentials: 'include',
                });
                const data = await response.json();
                if (response.ok) {
                    const sortedData = [...data.C_APPLICATIONS].sort((a, b) => {
                        const aId = parseInt(a.applicationid.split('-')[1] || 0, 10);
                        const bId = parseInt(b.applicationid.split('-')[1] || 0, 10);
                        return bId - aId;
                    });
                    setAllApplications(sortedData);
                    
                    const orgs = [...new Set(data.C_APPLICATIONS.map(app => app.orgname))];
                    setUniqueOrgs(orgs);

                    // **NEW** Dynamically create status filter options
                    const statuses = [...new Set(data.C_APPLICATIONS.map(app => app.status).filter(Boolean))];
                    setUniqueStatuses(statuses);

                } else {
                    setError(data.error || 'Failed to fetch applications');
                }
            } catch (err) {
                setError('Error fetching applications');
            } finally {
                setLoading(false);
            }
        };
        fetchApplications();
    }, []);

    useEffect(() => {
        setPageInputValue(currentPage.toString());
    }, [currentPage]);

    const getdisplayprojectid = (prjid) => {
        return prjid.split('-')[1] || prjid;
    };

    const sortApplications = (a, b, column, direction) => {
        const aValue = a[column];
        const bValue = b[column];
        let comparison = 0;

        if (column === 'applicationid') {
            const aId = parseInt(getdisplayprojectid(aValue), 10);
            const bId = parseInt(getdisplayprojectid(bValue), 10);
            comparison = aId - bId;
        } else if (column === 'applieddate') {
            comparison = new Date(aValue) - new Date(bValue);
        } else if (column === 'salary_expected') {
            comparison = Number(aValue) - Number(bValue);
        } else {
            comparison = (aValue || '').toString().toLowerCase().localeCompare((bValue || '').toString().toLowerCase());
        }

        return direction === 'asc' ? comparison : -comparison;
    };

    const sortedApplications = [...allApplications].sort((a, b) => sortApplications(a, b, sortConfig.column, sortConfig.direction));

    const requestSort = (column) => {
        setSortConfig(prev => ({
            column,
            direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
    };

    const handleStatusFilterChange = (e) => {
        setStatusFilter(e.target.value);
        setCurrentPage(1);
    };
    
    const handleOrgFilterChange = (e) => {
        setOrgFilter(e.target.value);
        setCurrentPage(1);
    };

    const filteredApplications = sortedApplications.filter(app => {
        const matchesSearch = 
            app.orgname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            app.display_job_name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || app.status?.toLowerCase() === statusFilter.toLowerCase();
        const matchesOrg = orgFilter === 'all' || app.orgname === orgFilter;
        return matchesSearch && matchesStatus && matchesOrg;
    });

    const totalPages = Math.ceil(filteredApplications.length / appsPerPage);
    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(p => p + 1);
    };
    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(p => p - 1);
    };
    const handlePageInputChange = (e) => setPageInputValue(e.target.value);
    const handlePageInputKeyPress = (e) => {
        if (e.key === 'Enter') {
            const value = parseInt(pageInputValue, 10);
            if (!isNaN(value) && value >= 1 && value <= totalPages) {
                setCurrentPage(value);
            } else {
                setPageInputValue(currentPage.toString());
            }
        }
    };
    const handleAppsPerPageInputChange = (e) => setAppsPerPageInput(e.target.value);
    const handleAppsPerPageInputKeyPress = (e) => {
        if (e.key === 'Enter') {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value) && value >= 1) {
                setAppsPerPage(value);
                setCurrentPage(1);
            } else {
                setAppsPerPageInput(appsPerPage.toString());
            }
        }
    };

    const indexOfLastApp = currentPage * appsPerPage;
    const indexOfFirstApp = indexOfLastApp - appsPerPage;
    const currentApplications = filteredApplications.slice(indexOfFirstApp, indexOfLastApp);
    
    // **UPDATED** Helper functions for conditional styling based on keywords
    const getStatusIndicatorClass = (status) => {
        const s = status.toLowerCase();
        if (s.includes('rejected') || s.includes('hold')) {
            return 'jobs_application_indicator-negative';
        }
        if (s.includes('applied') || s.includes('scheduled') || s.includes('generated') || s.includes('accepted')) {
            return 'jobs_application_indicator-positive';
        }
        return 'jobs_application_indicator-neutral';
    };

    const getStatusBadgeClass = (status) => {
        const s = status.toLowerCase();
        if (s.includes('rejected')) return 'jobs_application_status-rejected';
        if (s.includes('hold')) return 'jobs_application_status-hold';
        if (s.includes('generated') || s.includes('accepted')) return 'jobs_application_status-offerletter-generated';
        if (s.includes('scheduled')) return 'jobs_application_status-scheduled';
        if (s.includes('applied')) return 'jobs_application_status-applied';
        return 'jobs_application_status-submitted'; // Default fallback
    };


    if (loading) return <div className="jobs_application_loading">Loading Applications...</div>;
    if (error) return <div className="jobs_application_error">{error}</div>;

    return (
        <div className="jobs_application_container">
            <h1 className="jobs_application_title">My Applications</h1>

            <div className="jobs_application_search-filter-container">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="jobs_application_search-input"
                    placeholder="Search by Org or Job Title..."
                />
                <select value={orgFilter} onChange={handleOrgFilterChange} className="jobs_application_filter-select">
                    <option value="all">All Organizations</option>
                    {uniqueOrgs.map(org => <option key={org} value={org}>{org}</option>)}
                </select>
                {/* **UPDATED** Dynamic Status Filter */}
                <select value={statusFilter} onChange={handleStatusFilterChange} className="jobs_application_filter-select">
                    <option value="all">All Statuses</option>
                    {uniqueStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                </select>
            </div>

            {filteredApplications.length === 0 ? (
                <p className="jobs_application_empty-state">No applications found.</p>
            ) : (
                <>
                    <div className="jobs_application_table-wrapper">
                        <table className="jobs_application_table">
                            <thead>
                                <tr>
                                    {/* <th className={sortConfig.column === 'applicationid' ? `jobs_application_sortable jobs_application_sort-${sortConfig.direction}` : 'jobs_application_sortable'} onClick={() => requestSort('applicationid')}>App ID</th> */}
                                    <th className={sortConfig.column === 'orgname' ? `jobs_application_sortable jobs_application_sort-${sortConfig.direction}` : 'jobs_application_sortable'} onClick={() => requestSort('orgname')}>Organization</th>
                                    <th className={sortConfig.column === 'display_job_name' ? `jobs_application_sortable jobs_application_sort-${sortConfig.direction}` : 'jobs_application_sortable'} onClick={() => requestSort('display_job_name')}>Job Title</th>
                                    <th className={sortConfig.column === 'applieddate' ? `jobs_application_sortable jobs_application_sort-${sortConfig.direction}` : 'jobs_application_sortable'} onClick={() => requestSort('applieddate')}>Applied Date</th>
                                    <th className={sortConfig.column === 'salary_expected' ? `jobs_application_sortable jobs_application_sort-${sortConfig.direction}` : 'jobs_application_sortable'} onClick={() => requestSort('salary_expected')}>Salary Expected</th>
                                    <th className={sortConfig.column === 'status' ? `jobs_application_sortable jobs_application_sort-${sortConfig.direction}` : 'jobs_application_sortable'} onClick={() => requestSort('status')}>Status</th>
                                    <th>Resume</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentApplications.map((app) => (
                                    <tr key={app.applicationid}>
                                        <td >
                                            <span className={`jobs_application_role-indicator ${getStatusIndicatorClass(app.status)}`}></span>
                                            {/* {getdisplayprojectid(app.applicationid)} */}
                                            {app.orgname}
                                        </td>
                                        
                                        <td>{app.display_job_name}</td>
                                        <td>{formatDate(app.applieddate)}</td>
                                        <td>${Number(app.salary_expected).toLocaleString()}</td>
                                        <td>
                                            <span className={`jobs_application_status-badge ${getStatusBadgeClass(app.status)}`}>
                                                {app.status}
                                            </span>
                                        </td>
                                        <td>
                                            {app.resumepath ? (
                                                <Link href={app.resumepath} target="_blank" className="jobs_application_resume-link">
                                                    View Resume
                                                </Link>
                                            ) : ( 'No resume' )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="jobs_application_pagination-controls">
                        <div className="jobs_application_rows-per-page-container">
                            <label className="jobs_application_rows-per-page-label">Rows/ Page</label>
                            <input
                                type="text"
                                value={appsPerPageInput}
                                onChange={handleAppsPerPageInputChange}
                                onKeyPress={handleAppsPerPageInputKeyPress}
                                className="jobs_application_rows-per-page-input"
                            />
                        </div>
                        {totalPages > 1 && (
                            <div className="jobs_application_pagination-container">
                                <button className="jobs_application_button" onClick={handlePrevPage} disabled={currentPage === 1}>
                                    ← Previous
                                </button>
                                <span className="jobs_application_pagination-text">
                                    Page{' '}
                                    <input
                                        type="text"
                                        value={pageInputValue}
                                        onChange={handlePageInputChange}
                                        onKeyPress={handlePageInputKeyPress}
                                        className="jobs_application_pagination-input"
                                    />{' '}
                                    of {totalPages}
                                </span>
                                <button className="jobs_application_button" onClick={handleNextPage} disabled={currentPage === totalPages}>
                                    Next →
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}


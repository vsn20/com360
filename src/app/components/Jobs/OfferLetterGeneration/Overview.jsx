'use client';
import React, { useEffect, useState } from 'react';
import OfferGenerating from './OfferGenerating';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchalldetails, fetchDropdownData, updateStatus, saveOfferLetter } from '@/app/serverActions/Jobs/OfferLetterGeneration/Overview';
import './Offerletter.css';

// Helper function to trigger download
const triggerDownload = (fileUrl, fileName) => {
  const anchor = document.createElement('a');
  anchor.href = fileUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

// Custom Multi-Select Dropdown Component
const MultiSelectDropdown = ({ options, selectedValues, onChange, name, required }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleSelect = (value) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange({ target: { name, value: newValues } });
  };

  return (
    <div className="multi-select-container1">
      <div className="multi-select-input1" onClick={handleToggle}>
        {selectedValues.length > 0 ? (
          <div className="selected-tags1">
            {selectedValues.map((value) => {
              const option = options.find((opt) => opt.roleid === value);
              return (
                <span key={value} className="selected-tag1">
                  {option?.rolename || value}
                  <button
                    type="button"
                    className="remove-tag1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(value);
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="placeholder1">Select Roles</span>
        )}
        <span className="dropdown-arrow1">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div className="multi-select-options1">
          {options.length > 0 ? (
            options.map((option) => (
              <label key={option.roleid} className="multi-select-option1">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.roleid)}
                  onChange={() => handleSelect(option.roleid)}
                />
                {option.rolename}
              </label>
            ))
          ) : (
            <div className="no-options1">No roles available</div>
          )}
        </div>
      )}
      {required && selectedValues.length === 0 && (
        <input type="hidden" name={name} value="" required />
      )}
    </div>
  );
};

const Overview = ({ empid, orgid, interviewdetails, acceptingtime, offerlettergenerated }) => {
  const router = useRouter();
  const searchparams = useSearchParams();
  const [generate, setGenerate] = useState(false);
  const [selectid, setSelectedInterviewId] = useState(null);
  const [details, setDetails] = useState(null);
  const [formData, setFormData] = useState({ status: '' });
  const [offerLetterData, setOfferLetterData] = useState({
    finalised_salary: '',
    finalised_roleids: [],
    finalised_jobtitle: '',
    finalised_department: '',
    finalised_jobtype: '',
    finalised_pay_term: '',
    reportto_empid: '',
    adress_lane_1: '',
    adress_lane_2: '',
    zipcode: '',
    stateid: '',
    countryid: '185',
    custom_state_name: '',
    expected_join_date: '',
    url: '',
  });
  const [dropdownData, setDropdownData] = useState({
    departments: [],
    payFrequencies: [],
    jobTitles: [],
    countries: [],
    states: [],
    employees: [],
    jobtype: [],
    roles: [],
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [editingStatus, setEditingStatus] = useState(false);
  const [offerLetterUrls, setOfferLetterUrls] = useState({});

  // Pagination and filtering state
  const [sortConfig, setSortConfig] = useState({ column: 'interview_id', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rowsPerPageInput, setRowsPerPageInput] = useState('10');

  const getdisplayprojectid = (prjid) => prjid.split('-')[1] || prjid;
  const getdisplayid = (prjid) => prjid.split('_')[1] || prjid;

  // Reset states on route change (refresh)
  useEffect(() => {
    handleBack();
  }, [searchparams.get('refresh')]);

  // Fetch offerletter_url for each interview
  useEffect(() => {
    const fetchOfferLetterUrls = async () => {
      const urls = {};
      for (const interview of offerlettergenerated) {
        try {
          const result = await fetchalldetails(interview.interview_id);
          if (result?.success && result?.data?.offerletter?.offerletter_url) {
            urls[interview.interview_id] = result.data.offerletter.offerletter_url;
          }
        } catch (err) {
          console.error(`Error fetching offerletter_url for interview ${interview.interview_id}:`, err);
        }
      }
      setOfferLetterUrls(urls);
    };

    if (offerlettergenerated?.length > 0) {
      fetchOfferLetterUrls();
    }
  }, [offerlettergenerated]);

  // Sort offerlettergenerated when sortConfig changes
  useEffect(() => {
    setOfferLetterGeneratedSorted([...offerlettergenerated].sort((a, b) =>
      sortOfferLetters(a, b, sortConfig.column, sortConfig.direction)
    ));
  }, [sortConfig, offerlettergenerated]);

  // Update page input when currentPage changes
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  // Update rows per page input when rowsPerPage changes
  useEffect(() => {
    setRowsPerPageInput(rowsPerPage.toString());
  }, [rowsPerPage]);

  // State to hold sorted offerlettergenerated
  const [offerLetterGeneratedSorted, setOfferLetterGeneratedSorted] = useState(offerlettergenerated);

  // Fetch details and dropdown data when selecting an interview
  const selectId = async (interviewId) => {
    setSelectedInterviewId(interviewId);
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchalldetails(interviewId);
      if (result?.success && result?.data) {
        setDetails(result.data);
        setFormData({ status: result.data?.status || '' });
        setOfferLetterData({
          finalised_salary: result.data?.offerletter?.finalised_salary || '',
          finalised_roleids: result.data?.offerletter?.finalised_roleids || [],
          finalised_jobtitle: result.data?.offerletter?.finalised_jobtitle || '',
          finalised_department: result.data?.offerletter?.finalised_department || '',
          finalised_jobtype: result.data?.offerletter?.finalised_jobtype || '',
          finalised_pay_term: result.data?.offerletter?.finalised_pay_term || '',
          reportto_empid: result.data?.offerletter?.reportto_empid || '',
          adress_lane_1: result.data?.offerletter?.adress_lane_1 || '',
          adress_lane_2: result.data?.offerletter?.adress_lane_2 || '',
          zipcode: result.data?.offerletter?.zipcode || result.data?.zipcode || '',
          stateid: result.data?.offerletter?.stateid || '',
          countryid: result.data?.offerletter?.countryid || '',
          custom_state_name: result.data?.offerletter?.custom_state_name || '',
          expected_join_date: result.data?.offerletter?.expected_join_date
            ? new Date(result.data.offerletter.expected_join_date).toISOString().split('T')[0]
            : '',
          url: result.data?.offerletter?.offerletter_url || '',
        });

        if (result.data?.status === 'offerletter-processing' && result.data?.offerletter?.offer_letter_sent === 1) {
          setError('Cannot edit: Offer letter has already been sent.');
          setEditingStatus(false);
        } else {
          setError(null);
        }
      } else {
        setError(result?.error || 'No details found for the selected interview.');
      }

      const dropdownResult = await fetchDropdownData(orgid);
      if (dropdownResult?.success && dropdownResult?.data) {
        setDropdownData(dropdownResult.data);
      } else {
        setError(dropdownResult?.error || 'Failed to load dropdown data.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (e) => {
    setFormData((prev) => ({ ...prev, status: e.target.value }));
  };

  const handleOfferLetterChange = (e) => {
    const { name, value } = e.target;
    if (name === 'finalised_roleids') {
      setOfferLetterData((prev) => ({ ...prev, [name]: value }));
    } else {
      setOfferLetterData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleButtonGenerate = () => {
    setGenerate(true);
  };

  const salarycopy = () => {
    if (parseInt(details.salary_expected) < parseInt(details.max_salary, 10)) {
      return true;
    } else {
      return false;
    }
  };

  const handleCopy = () => {
    let salary;
    if (!salarycopy()) {
      salary = details.max_salary;
    } else {
      salary = details.salary_expected;
    }
    setOfferLetterData((prev) => ({
      ...prev,
      finalised_jobtitle: details.expected_job_title || '',
      adress_lane_1: details.a1 || '',
      adress_lane_2: details.a2 || '',
      zipcode: details.z1 || '',
      stateid: details.s1 || '',
      countryid: details.c1 || '',
      custom_state_name: details.s2 || '',
      finalised_department: details.d1 || '',
      finalised_jobtype: details.job1 || '',
      finalised_salary: salary || '',
    }));
  };

  const handleEditStatus = () => {
    setEditingStatus(true);
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (details?.status === 'offerletter-processing' && details?.offerletter?.offer_letter_sent === 1) {
        setError('Cannot save: Offer letter has already been sent.');
        setIsLoading(false);
        return;
      }

      if (formData.status === 'offerletter-generated') {
        const offerLetterResult = await saveOfferLetter(details?.application_id, offerLetterData, orgid, details);
        if (!offerLetterResult?.success) {
          setError(offerLetterResult?.error || 'Failed to save offer letter details.');
          setIsLoading(false);
          return;
        }
        triggerDownload(offerLetterResult.offerletter_url, `Offer_Letter_${details?.application_id}.pdf`);
        setDetails((prev) => ({ ...prev, offerletter_url: offerLetterResult.offerletter_url }));
        setOfferLetterUrls((prev) => ({
          ...prev,
          [details.interview_id]: offerLetterResult.offerletter_url,
        }));
      }

      const result = await updateStatus(details?.application_id, formData.status, details?.interview_id);
      if (result?.success) {
        setSuccess(result.message);
        setDetails((prev) => ({ ...prev, status: formData.status }));
        setEditingStatus(false);
        setTimeout(() => setSuccess(null), 3000);
        setSelectedInterviewId(null);
        router.refresh();
      } else {
        setError(result?.error || 'Failed to update status.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingStatus(false);
    setFormData({ status: details?.status || '' });
    setOfferLetterData({
      finalised_salary: details?.offerletter?.finalised_salary || '',
      finalised_roleids: details?.offerletter?.finalised_roleids || [],
      finalised_jobtitle: details?.offerletter?.finalised_jobtitle || '',
      finalised_department: details?.offerletter?.finalised_department || '',
      finalised_jobtype: details?.offerletter?.finalised_jobtype || '',
      finalised_pay_term: details?.offerletter?.finalised_pay_term || '',
      reportto_empid: details?.offerletter?.reportto_empid || '',
      adress_lane_1: details?.offerletter?.adress_lane_1 || '',
      adress_lane_2: details?.offerletter?.adress_lane_2 || '',
      zipcode: details?.offerletter?.zipcode || details?.zipcode || '',
      stateid: details?.offerletter?.stateid || '',
      countryid: details?.offerletter?.countryid || '',
      custom_state_name: details?.offerletter?.custom_state_name || '',
      expected_join_date: details?.offerletter?.expected_join_date
        ? new Date(details.offerletter.expected_join_date).toISOString().split('T')[0]
        : '',
      url: details?.offerletter?.offerletter_url || '',
    });
    setError(null);
  };

  const handleBack = () => {
    router.refresh();
    setGenerate(false);
    setSelectedInterviewId(null);
    setDetails(null);
    setEditingStatus(false);
    setError(null);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const formatDate = (date) => {
    if (!date) return '-';
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '-';
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
  const filteredOfferLetters = offerLetterGeneratedSorted.filter((details) => {
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
  const uniqueStatuses = [...new Set(offerlettergenerated.map((req) => req.status).filter(Boolean))];

  return (
    <div className="employee-overview-container1">
      {isLoading && <div className="loading-message1">Loading...</div>}
      {error && <div className="error-message1">{error}</div>}
      {success && <div className="success-message1">{success}</div>}

      {generate ? (
        <div className="employee-details-container1">
          <div className="header-section1">
            <h1 className="title">Generate Offer Letters</h1>
            <button className="back-button" onClick={handleBack}></button>
          </div>
          <OfferGenerating
            empid={empid}
            orgid={orgid}
            interviewdetails={interviewdetails}
            acceptingtime={acceptingtime}
            handlebAck={handleBack}
          />
        </div>
      ) : selectid && details ? (
        <div className="employee-details-container1">
          <div className="header-section1">
            <h1 className="title">Interview Details</h1>
            <button className="back-button" onClick={handleBack}></button>
          </div>

          <div className="details-block1">
            <h3>Basic Details</h3>
            <div className="details-row1">
              <div className="details-group1">
                <label>First Name</label>
                <p>{details?.first_name || '-'}</p>
              </div>
              <div className="details-group1">
                <label>Last Name</label>
                <p>{details?.last_name || '-'}</p>
              </div>
            </div>
            <div className="details-row1">
              <div className="details-group1">
                <label>Email</label>
                <p>{details?.email || '-'}</p>
              </div>
              <div className="details-group1">
                <label>Mobile Number</label>
                <p>{details?.mobilenumber || '-'}</p>
              </div>
            </div>
            <div className="details-row1">
              <div className="details-group1">
                <label>Date of Birth</label>
                <p>{formatDate(details?.dateofbirth)}</p>
              </div>
              <div className="details-group1">
                <label>Gender</label>
                <p>{details?.gender || '-'}</p>
              </div>
            </div>
            <div className="details-row1">
              <div className="details-group1">
                <label>Job Name</label>
                <p>{details.display_job_name || '-'}</p>
              </div>
              <div className="details-group1">
                <label>Applied Date</label>
                <p>{formatDate(details?.applieddate)}</p>
              </div>
            </div>
          </div>

          <div className="details-block1">
            <h3>Application Details</h3>
            <div className="details-row1">
              <div className="details-group1">
                <label>Interview ID</label>
                <p>{getdisplayprojectid(details?.interview_id) || '-'}</p>
              </div>
              <div className="details-group1">
                <label>Application ID</label>
                <p>{getdisplayprojectid(details?.application_id) || '-'}</p>
              </div>
            </div>
            <div className="details-row1">
              <div className="details-group1">
                <label>Organization ID</label>
                <p>{details?.orgid || '-'}</p>
              </div>
              <div className="details-group1">
                <label>Job Title</label>
                <p>
                  {details?.job_title
                    ? `${details.job_title} minsalary-${details?.min_salary || '-'} maxsalary-${details?.max_salary || '-'} level-${details?.level || '-'}`
                    : '-'}
                </p>
              </div>
            </div>
            <div className="details-row1">
              <div className="details-group1">
                <label>Resume Path</label>
                {details?.resumepath ? (
                  <a href={details.resumepath} className="view-resume-link1" target="_blank" rel="noopener noreferrer">
                    View Resume
                  </a>
                ) : (
                  <span className="no-resume-text1">No Resume</span>
                )}
              </div>
              <div className="details-group1">
                <label>Salary Expected</label>
                <p>{details?.salary_expected || '-'}</p>
              </div>
            </div>
            <div className="details-row1">
              <div className="details-group1">
                <label>Status</label>
                <p>{details?.status || '-'}</p>
              </div>
              <div className="details-group1">
                <label>Offer Letter</label>
                {details?.offerletter_url ? (
                  <a href={details.offerletter_url} className="view-resume-link1" target="_blank" rel="noopener noreferrer">
                    View Offer Letter
                  </a>
                ) : (
                  <span className="no-resume-text1">-</span>
                )}
              </div>
            </div>
          </div>

          <div className="details-block1">
            <h3>Interview Status Management</h3>
            {editingStatus ? (
              <form onSubmit={handleSave}>
                <div className="form-row1">
                  <div className="form-group1">
                    <label>Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleStatusChange}
                      required
                    >
                      <option>Select Status Option</option>
                      <option value="offerletter-generated">Offer Letter Generated</option>
                      <option value="offerletter-rejected">Offer Letter Rejected</option>
                      <option value="offerletter-hold">Offer Letter Hold</option>
                    </select>
                  </div>
                </div>

                {formData.status === 'offerletter-generated' && (
                  <div className="offer-letter-form1">
                    <div className="offer-letter-column1">
                      <h4>Expected Details</h4>
                      <div className="form-group1">
                        <label>Expected Job Title</label>
                        <input type="text" value={details?.job_title || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Expected Salary</label>
                        <input type="text" value={details?.salary_expected || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Min Salary</label>
                        <input type="text" value={details?.min_salary || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Max Salary</label>
                        <input type="text" value={details?.max_salary || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Level</label>
                        <input type="text" value={details?.level || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Expected Department</label>
                        <input type="text" value={details.departmentname || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Expected Job Type</label>
                        <input type="text" value={details.jobtypename || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Address Lane-1</label>
                        <input type="text" value={details.a1 || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Address Lane-2</label>
                        <input type="text" value={details.a2 || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Zipcode</label>
                        <input type="text" value={details.z1 || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>State</label>
                        <input type="text" value={details.statename || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Custom State Name</label>
                        <input type="text" value={details.s2 || ''} disabled />
                      </div>
                      <div className="form-group1">
                        <label>Country</label>
                        <input type="text" value={details.countryname || ''} disabled />
                      </div>
                    </div>
                    <div className="offer-letter-column1">
                      <h4>Finalized Details</h4>
                      <div className="form-group1">
                        <label>Finalized Job Title</label>
                        <select
                          name="finalised_jobtitle"
                          value={offerLetterData.finalised_jobtitle}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Job Title</option>
                          {dropdownData.jobTitles?.map((job) => (
                            <option key={job.job_title_id} value={job.job_title_id}>
                              {job.job_title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group1">
                        <label>Finalized Salary</label>
                        <input
                          type="text"
                          name="finalised_salary"
                          value={offerLetterData.finalised_salary}
                          onChange={handleOfferLetterChange}
                          required
                        />
                      </div>
                      <div className="form-group1">
                        <label>Finalized Roles</label>
                        <MultiSelectDropdown
                          options={dropdownData.roles}
                          selectedValues={offerLetterData.finalised_roleids}
                          onChange={handleOfferLetterChange}
                          name="finalised_roleids"
                          required
                        />
                      </div>
                      <div className="form-group1">
                        <label>Finalized Department</label>
                        <select
                          name="finalised_department"
                          value={offerLetterData.finalised_department}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Department</option>
                          {dropdownData.departments?.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group1">
                        <label>Finalized Job Type</label>
                        <select
                          name="finalised_jobtype"
                          value={offerLetterData.finalised_jobtype}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Job Type</option>
                          {dropdownData.jobtype?.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.Name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group1">
                        <label>Pay Term</label>
                        <select
                          name="finalised_pay_term"
                          value={offerLetterData.finalised_pay_term}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Pay Term</option>
                          {dropdownData.payFrequencies?.map((freq) => (
                            <option key={freq.id} value={freq.Name}>
                              {freq.Name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group1">
                        <label>Report To Employee ID</label>
                        <select
                          name="reportto_empid"
                          value={offerLetterData.reportto_empid}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Employee</option>
                          {dropdownData.employees?.map((emp) => (
                            <option key={emp.empid} value={emp.empid}>
                              {emp.name} ({emp.empid})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group1">
                        <label>Address Line 1</label>
                        <input
                          type="text"
                          name="adress_lane_1"
                          value={offerLetterData.adress_lane_1}
                          onChange={handleOfferLetterChange}
                          required
                        />
                      </div>
                      <div className="form-group1">
                        <label>Address Line 2</label>
                        <input
                          type="text"
                          name="adress_lane_2"
                          value={offerLetterData.adress_lane_2}
                          onChange={handleOfferLetterChange}
                        />
                      </div>
                      <div className="form-group1">
                        <label>Zip Code</label>
                        <input
                          type="text"
                          name="zipcode"
                          value={offerLetterData.zipcode}
                          onChange={handleOfferLetterChange}
                          required
                        />
                      </div>
                      <div className="form-group1">
                        <label>State</label>
                        <select
                          name="stateid"
                          value={offerLetterData.stateid}
                          onChange={handleOfferLetterChange}
                          disabled={offerLetterData.countryid !== '185'}
                        >
                          <option value="">Select State</option>
                          {dropdownData.states?.map((state) => (
                            <option key={state.ID} value={state.ID}>
                              {state.VALUE}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group1">
                        <label>Country</label>
                        <select
                          name="countryid"
                          value={offerLetterData.countryid}
                          onChange={handleOfferLetterChange}
                          required
                        >
                          <option value="">Select Country</option>
                          {dropdownData.countries?.map((country) => (
                            <option key={country.ID} value={country.ID}>
                              {country.VALUE}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group1">
                        <label>Custom State Name</label>
                        <input
                          type="text"
                          name="custom_state_name"
                          value={offerLetterData.custom_state_name}
                          onChange={handleOfferLetterChange}
                          disabled={offerLetterData.countryid === '185'}
                        />
                      </div>
                      <div className="form-group1">
                        <label>Expected Join Date</label>
                        <input
                          type="date"
                          name="expected_join_date"
                          value={offerLetterData.expected_join_date}
                          onChange={handleOfferLetterChange}
                          required
                        />
                      </div>
                      <div className="form-row1">
                        <button type="button" className="button" onClick={handleCopy}>
                          Copy Expected Details
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="form-buttons1">
                  <button type="submit" className="save" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Status'}
                  </button>
                  <button type="button" className="cancel" onClick={handleCancel} disabled={isLoading}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="view-details">
                <div className="details-buttons1">
                  <button className="button" onClick={handleEditStatus}>Edit Status</button>
                </div>
              </div>
            )}
          </div>

          {details?.rounds && details.rounds.length > 0 && (
            <>
              {details.rounds.map((round, index) => (
                <div key={`${round.Roundid}-${index}`} className="details-block1">
                  <h3>Round {round.RoundNo || index + 1}</h3>
                  <div className="details-row1">
                    <div className="details-group1">
                      <label>Start Date</label>
                      <p>{formatDate(round.start_date)}</p>
                    </div>
                    <div className="details-group1">
                      <label>Start Time</label>
                      <p>{round.start_time && round.start_am_pm ? `${round.start_time} ${round.start_am_pm}` : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row1">
                    <div className="details-group1">
                      <label>End Date</label>
                      <p>{formatDate(round.end_date)}</p>
                    </div>
                    <div className="details-group1">
                      <label>End Time</label>
                      <p>{round.end_time && round.end_am_pm ? `${round.end_time} ${round.end_am_pm}` : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row1">
                    <div className="details-group1">
                      <label>Meeting Link</label>
                      <p>{round.meeting_link || '-'}</p>
                    </div>
                    <div className="details-group1">
                      <label>Status</label>
                      <p>{round.status || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row1">
                    <div className="details-group1">
                      <label>Marks</label>
                      <p>{round.marks || '-'}</p>
                    </div>
                    <div className="details-group1">
                      <label>Comments</label>
                      <p>{round.comments || '-'}</p>
                    </div>
                  </div>
                  {round.panelMembers && round.panelMembers.length > 0 && (
                    <div className="panel-members-section1">
                      <h4>Panel Members</h4>
                      {round.panelMembers.map((member, memberIndex) => (
                        <div key={`${round.Roundid}-member-${memberIndex}`} className="details-row1">
                          <div className="details-group1">
                            <label>Employee ID</label>
                            <p>{member.empid ? getdisplayid(member.empid) : '-'}</p>
                          </div>
                          <div className="details-group1">
                            <label>Email</label>
                            <p>{member.email || '-'}</p>
                          </div>
                          <div className="details-group1">
                            <label>Is Employee</label>
                            <p>{member.is_he_employee === 1 ? 'Yes' : 'No'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          <div className="details-block1">
            <h3>Address Details</h3>
            <div className="details-row1">
              <div className="details-group1">
                <label>Address Line 1</label>
                <p>{details?.addresslane1 || '-'}</p>
              </div>
              <div className="details-group1">
                <label>Address Line 2</label>
                <p>{details?.addresslane2 || '-'}</p>
              </div>
            </div>
            <div className="details-row1">
              <div className="details-group1">
                <label>Zip Code</label>
                <p>{details?.zipcode || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="employee-list1">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 className="title">Offer Letter Generation</h1>
            <button onClick={handleButtonGenerate} className="button">Generate Offer Letters</button>
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

          {filteredOfferLetters.length === 0 && !error ? (
            <p className="empty-state">No offer letters found.</p>
          ) : (
            <>
              <div className="table-wrapper1">
                <table className="employee-table1">
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
                        Application ID
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
                      <th>Offer Letter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((details) => (
                      <tr
                        key={details.interview_id}
                        onClick={() => selectId(details.interview_id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="id-cell1">
                          <span className="role-indicator1"></span>
                          {getdisplayprojectid(details.interview_id)}
                        </td>
                        <td>{getdisplayprojectid(details.application_id)}</td>
                        <td>{`${details.first_name} ${details.last_name}`}</td>
                        <td>
                          <span className={details.status === 'offerletter-generated' ? 'status-badge1 active1' : 'status-badge1 inactive1'}>
                            {details.status}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {details.status === 'offerletter-generated' ? (
                            <a
                              href={details.offerletter_url}
                              className="view-resume-link1"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View Offer Letter
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredOfferLetters.length > rowsPerPage && (
                <div className="pagination-container">
                  <button
                    className="button"
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
                    className="button"
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
        </div>
      )}
    </div>
  );
};

export default Overview;
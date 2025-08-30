'use client';

import React, { useState, useEffect } from 'react';
import { 
  fetchAccountByOrgId, 
  fetchAccountById,
  updateAccount
} from '@/app/serverActions/Account/Overview';
import { addAccount } from '@/app/serverActions/Account/AddAccountServerAction';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import './overview.css';

const Overview = ({
  accountTypes,
  branchTypes,
  countries,
  states,
  orgid,
  error: initialError,
  accounts,
  suborgs
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchparams = useSearchParams();
  const [selectedAccntId, setSelectedAccntId] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [basicdetailsdisplay,setbasicdetailsdisplay]=useState(false);
  const [addressdisplay,setaddressdisplay]=useState(false);
  const [activeSubmenuTab, setActiveSubmenuTab] = useState('basic');
  const [formData, setFormData] = useState({
    accntId: '',
    orgid: orgid || '',
    activeFlag: '1',
    acctTypeCd: '',
    email: '',
    aliasName: '',
    businessAddrLine1: '',
    businessAddrLine2: '',
    businessAddrLine3: '',
    businessCity: '',
    businessStateId: '',
    businessCountryId: '185',
    businessPostalCode: '',
    mailingAddrLine1: '',
    mailingAddrLine2: '',
    mailingAddrLine3: '',
    mailingCity: '',
    mailingStateId: '',
    mailingCountryId: '185',
    mailingPostalCode: '',
    lastLoginDate: '',
    branchType: '',
    createdBy: '',
    lastUpdatedBy: '',
    lastUpdatedDate: '',
    suborgid: ''
  });
  const [error, setError] = useState(initialError);
  const [canEditAccounts, setCanEditAccounts] = useState(true);
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingBusinessAddress, setEditingBusinessAddress] = useState(false);
  const [editingMailingAddress, setEditingMailingAddress] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isadd, setisadd] = useState(false);
  const [addFormError, addsetFormError] = useState(null);
  const [addFormSuccess, addsetFormSuccess] = useState(null);
  const [addformData, setaddFormData] = useState({
    accountName: '',
    acctTypeCd: '',
    branchType: '',
    email: '',
    businessAddrLine1: '',
    businessAddrLine2: '',
    businessAddrLine3: '',
    businessCity: '',
    businessStateId: '',
    businessCountryId: '',
    businessPostalCode: '',
    mailingAddrLine1: '',
    mailingAddrLine2: '',
    mailingAddrLine3: '',
    mailingCity: '',
    mailingStateId: '',
    mailingCountryId: '',
    mailingPostalCode: '',
    suborgid: ''
  });
  const [allAccounts, setAllAccounts] = useState(accounts);
  const [sortConfig, setSortConfig] = useState({ column: 'accntId', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [accountsPerPage, setAccountsPerPage] = useState(10);
  const [accountsPerPageInput, setAccountsPerPageInput] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');
  const [branchTypeFilter, setBranchTypeFilter] = useState('all');

  useEffect(() => {
    console.log("resetting");
    handleBackClick();
  }, [searchparams.get('refresh')]);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  useEffect(() => {
    setAllAccounts(accounts);
  }, [accounts]);

  useEffect(() => {
    const sortedAccounts = [...accounts].sort((a, b) => sortAccounts(a, b, sortConfig.column, sortConfig.direction));
    setAllAccounts(sortedAccounts);
  }, [sortConfig, accounts]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '';
  };

  const sortAccounts = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'accntId':
        aValue = parseInt(a.ACCNT_ID.split('-')[1] || a.ACCNT_ID);
        bValue = parseInt(b.ACCNT_ID.split('-')[1] || b.ACCNT_ID);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'aliasName':
        aValue = (a.ALIAS_NAME || '').toLowerCase();
        bValue = (b.ALIAS_NAME || '').toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'acctTypeCd':
        aValue = getAccountTypeName(a.ACCT_TYPE_CD).toLowerCase();
        bValue = getAccountTypeName(b.ACCT_TYPE_CD).toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'branchType':
        aValue = getBranchTypeName(a.BRANCH_TYPE).toLowerCase();
        bValue = getBranchTypeName(b.BRANCH_TYPE).toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      default:
        return 0;
    }
  };

  const requestSort = (column) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleRowClick = (accntId) => {
    setSelectedAccntId(accntId);
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setError(null);
    setisadd(false);
    setActiveSubmenuTab('basic');
    setbasicdetailsdisplay(true);
    setaddressdisplay(false);
  };

  const handleBackClick = () => {
    router.refresh();
    setSelectedAccntId(null);
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setError(null);
    setisadd(false);
    setSearchQuery('');
    setAccountTypeFilter('all');
    setBranchTypeFilter('all');
    setActiveSubmenuTab('basic');
    setbasicdetailsdisplay(false);
    setaddressdisplay(false);
  };

  const handleaddaccount = () => {
    setSelectedAccntId(null);
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setError(null);
    setisadd(true);
    setActiveSubmenuTab('basic');
    setbasicdetailsdisplay(false);
    setaddressdisplay(false);
  };

  const handleSubmenuTabClick = (tab) => {
    setActiveSubmenuTab(tab);
    if (tab === 'basic') {
      setbasicdetailsdisplay(true);
      setaddressdisplay(false);
    } else if (tab === 'address') {
      setbasicdetailsdisplay(false);
      setaddressdisplay(true);
    }
    // Cancel any ongoing edits when switching tabs
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
  };

  const handlebasicdetails=(accntId)=>{
    setSelectedAccntId(accntId);
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setError(null);
    setisadd(false);
    setActiveSubmenuTab('basic');
    setbasicdetailsdisplay(true);
    setaddressdisplay(false);
  }
  
  const handleaddressdetails=(accntId)=>{
    setSelectedAccntId(accntId);
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setError(null);
    setisadd(false);
    setActiveSubmenuTab('address');
    setbasicdetailsdisplay(false);
    setaddressdisplay(true);
  }

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

  const handleAccountsPerPageInputChange = (e) => {
    setAccountsPerPageInput(e.target.value);
  };

  const handleAccountsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setAccountsPerPage(value);
        setAccountsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setAccountsPerPageInput(accountsPerPage.toString());
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

  const handleAccountTypeFilterChange = (e) => {
    setAccountTypeFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleBranchTypeFilterChange = (e) => {
    setBranchTypeFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  // Filter logic
  const filteredAccounts = allAccounts.filter((account) => {
    const matchesSearch = account.ALIAS_NAME?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAccountType =
      accountTypeFilter === 'all' ||
      String(account.ACCT_TYPE_CD) === accountTypeFilter;
    const matchesBranchType =
      branchTypeFilter === 'all' ||
      String(account.BRANCH_TYPE) === branchTypeFilter;
    return matchesSearch && matchesAccountType && matchesBranchType;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredAccounts.length / accountsPerPage);
  const indexOfLastAccount = currentPage * accountsPerPage;
  const indexOfFirstAccount = indexOfLastAccount - accountsPerPage;
  const currentAccounts = filteredAccounts.slice(indexOfFirstAccount, indexOfLastAccount);

  useEffect(() => {
    const loadAccountDetails = async () => {
      if (!selectedAccntId) {
        setAccountDetails(null);
        setFormData({
          accntId: '',
          orgid: orgid || '',
          activeFlag: '1',
          acctTypeCd: '',
          email: '',
          aliasName: '',
          businessAddrLine1: '',
          businessAddrLine2: '',
          businessAddrLine3: '',
          businessCity: '',
          businessStateId: '',
          businessCountryId: '185',
          businessPostalCode: '',
          mailingAddrLine1: '',
          mailingAddrLine2: '',
          mailingAddrLine3: '',
          mailingCity: '',
          mailingStateId: '',
          mailingCountryId: '185',
          mailingPostalCode: '',
          lastLoginDate: '',
          branchType: '',
          createdBy: '',
          lastUpdatedBy: '',
          lastUpdatedDate: '',
          suborgid: ''
        });
        return;
      }
      try {
        setIsLoading(true);
        const account = await fetchAccountById(selectedAccntId);
        if (!account.ORGID) {
          setError('Account data is missing organization ID.');
          return;
        }
        setAccountDetails(account);
        setFormData({
          accntId: account.ACCNT_ID || '',
          orgid: account.ORGID || orgid || '',
          activeFlag: account.ACTIVE_FLAG ? '1' : '0',
          acctTypeCd: account.ACCT_TYPE_CD || '',
          email: account.EMAIL || '',
          aliasName: account.ALIAS_NAME || '',
          businessAddrLine1: account.BUSINESS_ADDR_LINE1 || '',
          businessAddrLine2: account.BUSINESS_ADDR_LINE2 || '',
          businessAddrLine3: account.BUSINESS_ADDR_LINE3 || '',
          businessCity: account.BUSINESS_CITY || '',
          businessStateId: account.BUSINESS_STATE_ID ? String(account.BUSINESS_STATE_ID) : '',
          businessCountryId: account.BUSINESS_COUNTRY_ID ? String(account.BUSINESS_COUNTRY_ID) : '185',
          businessPostalCode: account.BUSINESS_POSTAL_CODE || '',
          mailingAddrLine1: account.MAILING_ADDR_LINE1 || '',
          mailingAddrLine2: account.MAILING_ADDR_LINE2 || '',
          mailingAddrLine3: account.MAILING_ADDR_LINE3 || '',
          mailingCity: account.MAILING_CITY || '',
          mailingStateId: account.MAILING_STATE_ID ? String(account.MAILING_STATE_ID) : '',
          mailingCountryId: account.MAILING_COUNTRY_ID ? String(account.MAILING_COUNTRY_ID) : '185',
          mailingPostalCode: account.MAILING_POSTAL_CODE || '',
          lastLoginDate: account.LAST_LOGIN_DATE ? formatDate(account.LAST_LOGIN_DATE) : '',
          branchType: account.BRANCH_TYPE || '',
          createdBy: account.CREATED_BY || '',
          lastUpdatedBy: account.LAST_UPDATED_BY || '',
          lastUpdatedDate: formatDate(account.LAST_UPDATED_DATE) || '',
          suborgid: account.suborgid || ''
        });
        setError(null);
      } catch (err) {
        console.error('Error loading account details:', err);
        setError(err.message);
        setAccountDetails(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadAccountDetails();
  }, [selectedAccntId, orgid]);

  const handleEdit = (section) => {
    if (section === 'basic') setEditingBasic(true);
    if (section === 'businessAddress') setEditingBusinessAddress(true);
    if (section === 'mailingAddress') setEditingMailingAddress(true);
  };

  const ensureOrgId = async () => {
    if (!formData.orgid || formData.orgid === '') {
      if (orgid) {
        setFormData(prev => ({ ...prev, orgid }));
        return orgid;
      }
      setError('Organization ID is missing or invalid.');
      return null;
    }
    return formData.orgid;
  };

  const handleSave = async (section) => {
    const orgid = await ensureOrgId();
    if (!orgid) {
      setError('Organization ID is missing or invalid.');
      return;
    }
    setIsLoading(true);
    const formDataToSubmit = new FormData();
    formDataToSubmit.append('ACCNT_ID', formData.accntId);
    formDataToSubmit.append('ORGID', orgid);
    formDataToSubmit.append('section', section);

    if (section === 'basic') {
      if (!formData.acctTypeCd) {
        setError('Account Type is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.email) {
        setError('Email is required.');
        setIsLoading(false);
        return;
      }
      formDataToSubmit.append('ACTIVE_FLAG', formData.activeFlag);
      formDataToSubmit.append('ACCT_TYPE_CD', formData.acctTypeCd);
      formDataToSubmit.append('EMAIL', formData.email);
      formDataToSubmit.append('ALIAS_NAME', formData.aliasName || '');
      formDataToSubmit.append('BRANCH_TYPE', formData.branchType || '');
      formDataToSubmit.append('suborgid', formData.suborgid || '');
    } else if (section === 'businessAddress') {
      formDataToSubmit.append('BUSINESS_ADDR_LINE1', formData.businessAddrLine1 || '');
      formDataToSubmit.append('BUSINESS_ADDR_LINE2', formData.businessAddrLine2 || '');
      formDataToSubmit.append('BUSINESS_ADDR_LINE3', formData.businessAddrLine3 || '');
      formDataToSubmit.append('BUSINESS_CITY', formData.businessCity || '');
      formDataToSubmit.append('BUSINESS_STATE_ID', formData.businessStateId || '');
      formDataToSubmit.append('BUSINESS_COUNTRY_ID', formData.businessCountryId || '');
      formDataToSubmit.append('BUSINESS_POSTAL_CODE', formData.businessPostalCode || '');
    } else if (section === 'mailingAddress') {
      formDataToSubmit.append('MAILING_ADDR_LINE1', formData.mailingAddrLine1 || '');
      formDataToSubmit.append('MAILING_ADDR_LINE2', formData.mailingAddrLine2 || '');
      formDataToSubmit.append('MAILING_ADDR_LINE3', formData.mailingAddrLine3 || '');
      formDataToSubmit.append('MAILING_CITY', formData.mailingCity || '');
      formDataToSubmit.append('MAILING_STATE_ID', formData.mailingStateId || '');
      formDataToSubmit.append('MAILING_COUNTRY_ID', formData.mailingCountryId || '');
      formDataToSubmit.append('MAILING_POSTAL_CODE', formData.mailingPostalCode || '');
    }

    try {
      console.log('FormData to submit:', Object.fromEntries(formDataToSubmit));
      const result = await updateAccount(formDataToSubmit);
      if (result && result.success) {
        const updatedAccount = await fetchAccountById(formData.accntId);
        setAccountDetails(updatedAccount);
        accounts.forEach((account, index) => {
          if (account.ACCNT_ID === formData.accntId) {
            accounts[index] = {
              ...account,
              ACTIVE_FLAG: updatedAccount.ACTIVE_FLAG || account.ACTIVE_FLAG,
              ACCT_TYPE_CD: updatedAccount.ACCT_TYPE_CD || account.ACCT_TYPE_CD,
              EMAIL: updatedAccount.EMAIL || account.EMAIL,
              ALIAS_NAME: updatedAccount.ALIAS_NAME || account.ALIAS_NAME,
              BRANCH_TYPE: updatedAccount.BRANCH_TYPE || account.BRANCH_TYPE,
              BUSINESS_ADDR_LINE1: updatedAccount.BUSINESS_ADDR_LINE1 || account.BUSINESS_ADDR_LINE1,
              BUSINESS_ADDR_LINE2: updatedAccount.BUSINESS_ADDR_LINE2 || account.BUSINESS_ADDR_LINE2,
              BUSINESS_ADDR_LINE3: updatedAccount.BUSINESS_ADDR_LINE3 || account.BUSINESS_ADDR_LINE3,
              BUSINESS_CITY: updatedAccount.BUSINESS_CITY || account.BUSINESS_CITY,
              BUSINESS_STATE_ID: updatedAccount.BUSINESS_STATE_ID || account.BUSINESS_STATE_ID,
              BUSINESS_COUNTRY_ID: updatedAccount.BUSINESS_COUNTRY_ID || account.BUSINESS_COUNTRY_ID,
              BUSINESS_POSTAL_CODE: updatedAccount.BUSINESS_POSTAL_CODE || account.BUSINESS_POSTAL_CODE,
              MAILING_ADDR_LINE1: updatedAccount.MAILING_ADDR_LINE1 || account.MAILING_ADDR_LINE1,
              MAILING_ADDR_LINE2: updatedAccount.MAILING_ADDR_LINE2 || account.MAILING_ADDR_LINE2,
              MAILING_ADDR_LINE3: updatedAccount.MAILING_ADDR_LINE3 || account.MAILING_ADDR_LINE3,
              MAILING_CITY: updatedAccount.MAILING_CITY || account.MAILING_CITY,
              MAILING_STATE_ID: updatedAccount.MAILING_STATE_ID || account.MAILING_STATE_ID,
              MAILING_COUNTRY_ID: updatedAccount.MAILING_COUNTRY_ID || account.MAILING_COUNTRY_ID,
              MAILING_POSTAL_CODE: updatedAccount.MAILING_POSTAL_CODE || account.MAILING_POSTAL_CODE,
              LAST_LOGIN_DATE: updatedAccount.LAST_LOGIN_DATE || account.LAST_LOGIN_DATE,
              CREATED_BY: updatedAccount.CREATED_BY || account.CREATED_BY,
              LAST_UPDATED_BY: updatedAccount.LAST_UPDATED_BY || account.LAST_UPDATED_BY,
              LAST_UPDATED_DATE: updatedAccount.LAST_UPDATED_DATE || account.LAST_UPDATED_DATE,
              suborgid: updatedAccount.suborgid || account.suborgid
            };
          }
        });
        if (section === 'basic') setEditingBasic(false);
        if (section === 'businessAddress') setEditingBusinessAddress(false);
        if (section === 'mailingAddress') setEditingMailingAddress(false);
        setError(null);
      } else {
        setError(result.error || 'Failed to save: Invalid response from server');
      }
    } catch (err) {
      console.error('Error saving account:', err);
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getAccountTypeName = (acctTypeCd) => {
    const accountType = accountTypes.find(type => String(type.id) === String(acctTypeCd));
    return accountType ? accountType.Name : 'No Account Type';
  };

  const getBranchTypeName = (branchType) => {
    const branch = branchTypes.find(type => String(type.id) === String(branchType));
    return branch ? branch.Name : 'No Branch Type';
  };

  const getCountryName = (countryId) => {
    const country = countries.find(c => c.ID === countryId);
    return country ? country.VALUE : 'No Country';
  };

  const getStateName = (stateId) => {
    const state = states.find(s => s.ID === stateId);
    return state ? state.VALUE : 'No State';
  };

  const getSubOrgName = (suborgid) => {
    const suborg = suborgs.find(s => String(s.suborgid) === String(suborgid));
    return suborg ? suborg.suborgname : 'No Suborganization';
  };

  const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
  };

  const addhandleChange = (e) => {
    const { name, value } = e.target;
    setaddFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addhandleSubmit = async (e) => {
    e.preventDefault();
    addsetFormError(null);
    addsetFormSuccess(null);

    if (!addformData.accountName) {
      addsetFormError('Account name is required.');
      return;
    }
    if (!addformData.acctTypeCd) {
      addsetFormError('Please select an account type.');
      return;
    }
    if (!addformData.branchType) {
      addsetFormError('Please select a branch type.');
      return;
    }
    if (!addformData.email) {
      addsetFormError('Email is required.');
      return;
    }

    const addformDataToSend = new FormData();
    Object.entries(addformData).forEach(([key, value]) => {
      addformDataToSend.append(key, value);
    });
    addformDataToSend.append('orgid', orgid);

    const addresult = await addAccount(addformDataToSend);
    if (addresult?.error) {
      addsetFormError(addresult.error);
    } else if (addresult?.success) {
      setaddFormData({
        accountName: '',
        acctTypeCd: '',
        branchType: '',
        email: '',
        businessAddrLine1: '',
        businessAddrLine2: '',
        businessAddrLine3: '',
        businessCity: '',
        businessStateId: '',
        businessCountryId: '',
        businessPostalCode: '',
        mailingAddrLine1: '',
        mailingAddrLine2: '',
        mailingAddrLine3: '',
        mailingCity: '',
        mailingStateId: '',
        mailingCountryId: '',
        mailingPostalCode: '',
        suborgid: ''
      });
      addsetFormSuccess('Account added successfully.');
      setTimeout(() => addsetFormSuccess(null), 3000);
      setTimeout(() => router.refresh(), 4000);
    }
  };

  return (
    <div className="employee-overview-container88">
      {error && <div className="error-message88">{error}</div>}
      {isLoading && <div className="loading-message88">Saving...</div>}
    
      {isadd && (
        <div className="employee-overview-container88">
          <div className="header-section88">
            <h2 className="title88">Add Account</h2>
            <button className="back-button88" onClick={handleBackClick}></button>
          </div>
          {addFormError && <div className="error-message88">{addFormError}</div>}
          {addFormSuccess && <div className="success-message88">{addFormSuccess}</div>}
          <form onSubmit={addhandleSubmit} className="employee-details-container88">
            <div className="details-block88">
              <h3>Basic Details</h3>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Account Name*</label>
                  <input
                    type="text"
                    name="accountName"
                    value={addformData.accountName}
                    onChange={addhandleChange}
                    placeholder="Enter Account Name"
                    required
                  />
                </div>
              </div>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Account Type*</label>
                  <select
                    name="acctTypeCd"
                    value={addformData.acctTypeCd}
                    onChange={addhandleChange}
                    required
                  >
                    <option value="">Select Account Type</option>
                    {accountTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group88">
                  <label>Branch Type*</label>
                  <select
                    name="branchType"
                    value={addformData.branchType}
                    onChange={addhandleChange}
                    required
                  >
                    <option value="">Select Branch Type</option>
                    {branchTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Email*</label>
                  <input
                    type="email"
                    name="email"
                    value={addformData.email}
                    onChange={addhandleChange}
                    placeholder="Enter Email"
                    required
                  />
                </div>
                <div className="form-group88">
                  <label>Organization</label>
                  <select
                    name="suborgid"
                    value={addformData.suborgid}
                    onChange={addhandleChange}
                  >
                    <option value="">Select Organization</option>
                    {suborgs.map((suborg) => (
                      <option key={suborg.suborgid} value={suborg.suborgid}>
                        {suborg.suborgname}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="details-block88">
              <h3>Business Address</h3>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Address Line 1</label>
                  <input
                    type="text"
                    name="businessAddrLine1"
                    value={addformData.businessAddrLine1}
                    onChange={addhandleChange}
                    placeholder="Enter Address Line 1"
                  />
                </div>
                <div className="form-group88">
                  <label>Address Line 2</label>
                  <input
                    type="text"
                    name="businessAddrLine2"
                    value={addformData.businessAddrLine2}
                    onChange={addhandleChange}
                    placeholder="Enter Address Line 2"
                  />
                </div>
              </div>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Address Line 3</label>
                  <input
                    type="text"
                    name="businessAddrLine3"
                    value={addformData.businessAddrLine3}
                    onChange={addhandleChange}
                    placeholder="Enter Address Line 3"
                  />
                </div>
                <div className="form-group88">
                  <label>City</label>
                  <input
                    type="text"
                    name="businessCity"
                    value={addformData.businessCity}
                    onChange={addhandleChange}
                    placeholder="Enter City"
                  />
                </div>
              </div>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Country</label>
                  <select
                    name="businessCountryId"
                    value={addformData.businessCountryId}
                    onChange={addhandleChange}
                  >
                    <option value="">Select Country</option>
                    {countries.map((country) => (
                      <option key={country.ID} value={country.ID}>
                        {country.VALUE}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group88">
                  <label>State</label>
                  <select
                    name="businessStateId"
                    value={addformData.businessStateId}
                    onChange={addhandleChange}
                  >
                    <option value="">Select State</option>
                    {states.map((state) => (
                      <option key={state.ID} value={state.ID}>
                        {state.VALUE}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Postal Code</label>
                  <input
                    type="text"
                    name="businessPostalCode"
                    value={addformData.businessPostalCode}
                    onChange={addhandleChange}
                    placeholder="Enter Postal Code"
                  />
                </div>
              </div>
            </div>

            <div className="details-block88">
              <h3>Mailing Address</h3>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Address Line 1</label>
                  <input
                    type="text"
                    name="mailingAddrLine1"
                    value={addformData.mailingAddrLine1}
                    onChange={addhandleChange}
                    placeholder="Enter Address Line 1"
                  />
                </div>
                <div className="form-group88">
                  <label>Address Line 2</label>
                  <input
                    type="text"
                    name="mailingAddrLine2"
                    value={addformData.mailingAddrLine2}
                    onChange={addhandleChange}
                    placeholder="Enter Address Line 2"
                  />
                </div>
              </div>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Address Line 3</label>
                  <input
                    type="text"
                    name="mailingAddrLine3"
                    value={addformData.mailingAddrLine3}
                    onChange={addhandleChange}
                    placeholder="Enter Address Line 3"
                  />
                </div>
                <div className="form-group88">
                  <label>City</label>
                  <input
                    type="text"
                    name="mailingCity"
                    value={addformData.mailingCity}
                    onChange={addhandleChange}
                    placeholder="Enter City"
                  />
                </div>
              </div>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Country</label>
                  <select
                    name="mailingCountryId"
                    value={addformData.mailingCountryId}
                    onChange={addhandleChange}
                  >
                    <option value="">Select Country</option>
                    {countries.map((country) => (
                      <option key={country.ID} value={country.ID}>
                        {country.VALUE}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group88">
                  <label>State</label>
                  <select
                    name="mailingStateId"
                    value={addformData.mailingStateId}
                    onChange={addhandleChange}
                  >
                    <option value="">Select State</option>
                    {states.map((state) => (
                      <option key={state.ID} value={state.ID}>
                        {state.VALUE}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row88">
                <div className="form-group88">
                  <label>Postal Code</label>
                  <input
                    type="text"
                    name="mailingPostalCode"
                    value={addformData.mailingPostalCode}
                    onChange={addhandleChange}
                    placeholder="Enter Postal Code"
                  />
                </div>
              </div>
            </div>

            <div className="form-buttons88">
              <button type="submit" className="save88">
                Add Account
              </button>
            </div>
          </form>
        </div>
      )}

      {!isadd && !selectedAccntId ? (
        <div className="employee-list88">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 className="title88">Existing Accounts</h1>
            <button onClick={() => handleaddaccount()} className="save88">Add Account</button>
          </div>
          <div className="search-filter-container88">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input88"
              placeholder="Search by account name..."
            />
            <select value={accountTypeFilter} onChange={handleAccountTypeFilterChange} className="filter-select88">
              <option value="all">All Account Types</option>
              {accountTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.Name}
                </option>
              ))}
            </select>
            <select value={branchTypeFilter} onChange={handleBranchTypeFilterChange} className="filter-select88">
              <option value="all">All Branch Types</option>
              {branchTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.Name}
                </option>
              ))}
            </select>
          </div>
          {filteredAccounts.length === 0 && !error ? (
            <div className="empty-state88">No accounts found.</div>
          ) : (
            <>
              <div className="table-wrapper88">
                <table className="employee-table88">
                  <colgroup>
                    <col />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={sortConfig.column === 'accntId' ? `sortable88 sort-${sortConfig.direction}88` : 'sortable88'} onClick={() => requestSort('accntId')}>
                        Account ID
                      </th>
                      <th className={sortConfig.column === 'aliasName' ? `sortable88 sort-${sortConfig.direction}88` : 'sortable88'} onClick={() => requestSort('aliasName')}>
                        Account Name
                      </th>
                      <th className={sortConfig.column === 'acctTypeCd' ? `sortable88 sort-${sortConfig.direction}88` : 'sortable88'} onClick={() => requestSort('acctTypeCd')}>
                        Account Type
                      </th>
                      <th className={sortConfig.column === 'branchType' ? `sortable88 sort-${sortConfig.direction}88` : 'sortable88'} onClick={() => requestSort('branchType')}>
                        Branch Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAccounts.map((account) => (
                      <tr
                        key={account.ACCNT_ID}
                        onClick={() => handleRowClick(account.ACCNT_ID)}
                        className={selectedAccntId === account.ACCNT_ID ? 'selected-row88' : ''}
                      >
                        <td className="id-cell88">
                          <span className="account-indicator88"></span>
                          Account-{getdisplayprojectid(account.ACCNT_ID)}
                        </td>
                        <td>{account.ALIAS_NAME || '-'}</td>
                        <td>{getAccountTypeName(account.ACCT_TYPE_CD)}</td>
                        <td>{getBranchTypeName(account.BRANCH_TYPE)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredAccounts.length > accountsPerPage && (
                <div className="pagination-container88">
                  <button
                    className="button88"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  <span className="pagination-text88">
                    Page{' '}
                    <input
                      type="text"
                      value={pageInputValue}
                      onChange={handlePageInputChange}
                      onKeyPress={handlePageInputKeyPress}
                      className="pagination-input88"
                    />{' '}
                    of {totalPages}
                  </span>
                  <button
                    className="button88"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
              {filteredAccounts.length > 0 && (
                <div className="rows-per-page-container88">
                  <label className="rows-per-page-label88">Rows/ Page</label>
                  <input
                    type="text"
                    value={accountsPerPageInput}
                    onChange={handleAccountsPerPageInputChange}
                    onKeyPress={handleAccountsPerPageInputKeyPress}
                    className="rows-per-page-input88"
                    aria-label="Number of rows per page"
                  />
                </div>
              )}
            </>
          )}
        </div>
      ) : !isadd && (
        accountDetails && (
          <div className="employee-details-container88">
            <div className="header-section88">
              <h1 className="title88">Account Details</h1>
              <button className="back-button88" onClick={handleBackClick}></button>
            </div>
            
            {/* Account Submenu Bar */}
            <div className="account-submenu-bar">
              <button 
                className={activeSubmenuTab === 'basic' ? 'active' : ''}
                onClick={() => handleSubmenuTabClick('basic')}
              >
                Basic Details
              </button>
              <button 
                className={activeSubmenuTab === 'address' ? 'active' : ''}
                onClick={() => handleSubmenuTabClick('address')}
              >
                Address Details
              </button>
            </div>

            {/* Account Details Content */}
            <div className="account-details-content">
              {basicdetailsdisplay && !addressdisplay && (
                <div className="details-block88">
                  <h3>Basic Details</h3>
                  {editingBasic && canEditAccounts ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleSave('basic'); }}>
                      <div className="form-row88">
                        <div className="form-group88">
                          <label>Account Name</label>
                          <input type="text" name="aliasName" value={formData.aliasName} onChange={handleFormChange} />
                        </div>
                        <div className="form-group88">
                          <label>Account Type*</label>
                          <select name="acctTypeCd" value={formData.acctTypeCd} onChange={handleFormChange} required>
                            <option value="">Select Account Type</option>
                            {accountTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.Name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="form-row88">
                        <div className="form-group88">
                          <label>Email*</label>
                          <input type="email" name="email" value={formData.email} onChange={handleFormChange} required />
                        </div>
                        <div className="form-group88">
                          <label>Active Flag</label>
                          <select name="activeFlag" value={formData.activeFlag} onChange={handleFormChange}>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row88">
                        <div className="form-group88">
                          <label>Branch Type</label>
                          <select name="branchType" value={formData.branchType} onChange={handleFormChange}>
                            <option value="">Select Branch Type</option>
                            {branchTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.Name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group88">
                          <label>Organization</label>
                          <select name="suborgid" value={formData.suborgid} disabled>
                            <option value="">Select Organization</option>
                            {suborgs.map((suborg) => (
                              <option key={suborg.suborgid} value={suborg.suborgid}>
                                {suborg.suborgname}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="form-buttons88">
                        <button type="submit" className="save88" disabled={isLoading}>
                          {isLoading ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" className="cancel88" onClick={() => setEditingBasic(false)} disabled={isLoading}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="view-details88">
                      <div className="details-row88">
                        <div className="details-group88">
                          <label>Account ID</label>
                          <p>Account-{getdisplayprojectid(accountDetails.ACCNT_ID)}</p>
                        </div>
                      </div>
                      <div className="details-row88">
                        <div className="details-group88">
                          <label>Active Flag</label>
                          <p>{accountDetails.ACTIVE_FLAG ? 'Active' : 'Inactive'}</p>
                        </div>
                        <div className="details-group88">
                          <label>Account Type</label>
                          <p>{getAccountTypeName(accountDetails.ACCT_TYPE_CD)}</p>
                        </div>
                      </div>
                      <div className="details-row88">
                        <div className="details-group88">
                          <label>Email</label>
                          <p>{accountDetails.EMAIL || '-'}</p>
                        </div>
                        <div className="details-group88">
                          <label>Account Name</label>
                          <p>{accountDetails.ALIAS_NAME || '-'}</p>
                        </div>
                      </div>
                      <div className="details-row88">
                        <div className="details-group88">
                          <label>Branch Type</label>
                          <p>{getBranchTypeName(accountDetails.BRANCH_TYPE)}</p>
                        </div>
                        <div className="details-group88">
                          <label>Organization</label>
                          <p>{getSubOrgName(accountDetails.suborgid)}</p>
                        </div>
                      </div>
                      <div className="details-row88">
                        <div className="details-group88">
                          <label>Last Login Date</label>
                          <p>{accountDetails.LAST_LOGIN_DATE ? formatDate(accountDetails.LAST_LOGIN_DATE) : '-'}</p>
                        </div>
                        <div className="details-group88">
                          <label>Created By</label>
                          <p>{accountDetails.CREATED_BY || '-'}</p>
                        </div>
                      </div>
                      <div className="details-row88">
                        <div className="details-group88">
                          <label>Last Updated By</label>
                          <p>{accountDetails.LAST_UPDATED_BY || '-'}</p>
                        </div>
                        <div className="details-group88">
                          <label>Last Updated Date</label>
                          <p>{formatDate(accountDetails.LAST_UPDATED_DATE) || '-'}</p>
                        </div>
                      </div>
                      {canEditAccounts && (
                        <div className="details-buttons88">
                          <button className="button88" onClick={() => handleEdit('basic')}>Edit</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {addressdisplay && (
                <>
                  <div className="details-block88">
                    <h3>Business Address</h3>
                    {editingBusinessAddress && canEditAccounts ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleSave('businessAddress'); }}>
                        <div className="form-row88">
                          <div className="form-group88">
                            <label>Address Line 1</label>
                            <input type="text" name="businessAddrLine1" value={formData.businessAddrLine1} onChange={handleFormChange} />
                          </div>
                          <div className="form-group88">
                            <label>Address Line 2</label>
                            <input type="text" name="businessAddrLine2" value={formData.businessAddrLine2} onChange={handleFormChange} />
                          </div>
                        </div>
                        <div className="form-row88">
                          <div className="form-group88">
                            <label>Address Line 3</label>
                            <input type="text" name="businessAddrLine3" value={formData.businessAddrLine3} onChange={handleFormChange} />
                          </div>
                          <div className="form-group88">
                            <label>City</label>
                            <input type="text" name="businessCity" value={formData.businessCity} onChange={handleFormChange} />
                          </div>
                        </div>
                        <div className="form-row88">
                          <div className="form-group88">
                            <label>Country</label>
                            <select name="businessCountryId" value={formData.businessCountryId} onChange={handleFormChange}>
                              <option value="">Select Country</option>
                              {countries.map((country) => (
                                <option key={country.ID} value={country.ID}>
                                  {country.VALUE}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group88">
                            <label>State</label>
                            <select name="businessStateId" value={formData.businessStateId} onChange={handleFormChange}>
                              <option value="">Select State</option>
                              {states.map((state) => (
                                <option key={state.ID} value={state.ID}>
                                  {state.VALUE}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="form-row88">
                          <div className="form-group88">
                            <label>Postal Code</label>
                            <input type="text" name="businessPostalCode" value={formData.businessPostalCode} onChange={handleFormChange} />
                          </div>
                        </div>
                        <div className="form-buttons88">
                          <button type="submit" className="save88" disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Save'}
                          </button>
                          <button type="button" className="cancel88" onClick={() => setEditingBusinessAddress(false)} disabled={isLoading}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="view-details88">
                        <div className="details-row88">
                          <div className="details-group88">
                            <label>Address Line 1</label>
                            <p>{accountDetails.BUSINESS_ADDR_LINE1 || '-'}</p>
                          </div>
                          <div className="details-group88">
                            <label>Address Line 2</label>
                            <p>{accountDetails.BUSINESS_ADDR_LINE2 || '-'}</p>
                          </div>
                        </div>
                        <div className="details-row88">
                          <div className="details-group88">
                            <label>Address Line 3</label>
                            <p>{accountDetails.BUSINESS_ADDR_LINE3 || '-'}</p>
                          </div>
                          <div className="details-group88">
                            <label>City</label>
                            <p>{accountDetails.BUSINESS_CITY || '-'}</p>
                          </div>
                        </div>
                        <div className="details-row88">
                          <div className="details-group88">
                            <label>Country</label>
                            <p>{getCountryName(accountDetails.BUSINESS_COUNTRY_ID)}</p>
                          </div>
                          <div className="details-group88">
                            <label>State</label>
                            <p>{accountDetails.BUSINESS_STATE_ID ? getStateName(accountDetails.BUSINESS_STATE_ID) : '-'}</p>
                          </div>
                        </div>
                        <div className="details-row88">
                          <div className="details-group88">
                            <label>Postal Code</label>
                            <p>{accountDetails.BUSINESS_POSTAL_CODE || '-'}</p>
                          </div>
                        </div>
                        {canEditAccounts && (
                          <div className="details-buttons88">
                            <button className="button88" onClick={() => handleEdit('businessAddress')}>Edit</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="details-block88">
                    <h3>Mailing Address</h3>
                    {editingMailingAddress && canEditAccounts ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleSave('mailingAddress'); }}>
                        <div className="form-row88">
                          <div className="form-group88">
                            <label>Address Line 1</label>
                            <input type="text" name="mailingAddrLine1" value={formData.mailingAddrLine1} onChange={handleFormChange} />
                          </div>
                          <div className="form-group88">
                            <label>Address Line 2</label>
                            <input type="text" name="mailingAddrLine2" value={formData.mailingAddrLine2} onChange={handleFormChange} />
                          </div>
                        </div>
                        <div className="form-row88">
                          <div className="form-group88">
                            <label>Address Line 3</label>
                            <input type="text" name="mailingAddrLine3" value={formData.mailingAddrLine3} onChange={handleFormChange} />
                          </div>
                          <div className="form-group88">
                            <label>City</label>
                            <input type="text" name="mailingCity" value={formData.mailingCity} onChange={handleFormChange} />
                          </div>
                        </div>
                        <div className="form-row88">
                          <div className="form-group88">
                            <label>Country</label>
                            <select name="mailingCountryId" value={formData.mailingCountryId} onChange={handleFormChange}>
                              <option value="">Select Country</option>
                              {countries.map((country) => (
                                <option key={country.ID} value={country.ID}>
                                  {country.VALUE}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group88">
                            <label>State</label>
                            <select name="mailingStateId" value={formData.mailingStateId} onChange={handleFormChange}>
                              <option value="">Select State</option>
                              {states.map((state) => (
                                <option key={state.ID} value={state.ID}>
                                  {state.VALUE}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="form-row88">
                          <div className="form-group88">
                            <label>Postal Code</label>
                            <input type="text" name="mailingPostalCode" value={formData.mailingPostalCode} onChange={handleFormChange} />
                          </div>
                        </div>
                        <div className="form-buttons88">
                          <button type="submit" className="save88" disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Save'}
                          </button>
                          <button type="button" className="cancel88" onClick={() => setEditingMailingAddress(false)} disabled={isLoading}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="view-details88">
                        <div className="details-row88">
                          <div className="details-group88">
                            <label>Address Line 1</label>
                            <p>{accountDetails.MAILING_ADDR_LINE1 || '-'}</p>
                          </div>
                          <div className="details-group88">
                            <label>Address Line 2</label>
                            <p>{accountDetails.MAILING_ADDR_LINE2 || '-'}</p>
                          </div>
                        </div>
                        <div className="details-row88">
                          <div className="details-group88">
                            <label>Address Line 3</label>
                            <p>{accountDetails.MAILING_ADDR_LINE3 || '-'}</p>
                          </div>
                          <div className="details-group88">
                            <label>City</label>
                            <p>{accountDetails.MAILING_CITY || '-'}</p>
                          </div>
                        </div>
                        <div className="details-row88">
                          <div className="details-group88">
                            <label>Country</label>
                            <p>{getCountryName(accountDetails.MAILING_COUNTRY_ID)}</p>
                          </div>
                          <div className="details-group88">
                            <label>State</label>
                            <p>{accountDetails.MAILING_STATE_ID ? getStateName(accountDetails.MAILING_STATE_ID) : '-'}</p>
                          </div>
                        </div>
                        <div className="details-row88">
                          <div className="details-group88">
                            <label>Postal Code</label>
                            <p>{accountDetails.MAILING_POSTAL_CODE || '-'}</p>
                          </div>
                        </div>
                        {canEditAccounts && (
                          <div className="details-buttons88">
                            <button className="button88" onClick={() => handleEdit('mailingAddress')}>Edit</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default Overview;
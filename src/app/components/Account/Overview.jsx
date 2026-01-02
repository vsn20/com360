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
  suborgs,
  companySizes,
  loyaltyStatuses
}) => {
  const router = useRouter();
  const searchparams = useSearchParams();
  const [selectedAccntId, setSelectedAccntId] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [basicdetailsdisplay, setbasicdetailsdisplay] = useState(false);
  const [addressdisplay, setaddressdisplay] = useState(false);
  const [activeSubmenuTab, setActiveSubmenuTab] = useState('basic');
  
  // Initialize State
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
    suborgid: '',
    ourorg: '0',
    phone: '',
    mobile: '',
    website: '',
    ein: '',
    dunsNumber: '',
    linkedin: '',
    youtube: '',
    facebook: '',
    twitter: '',
    instagram: '',
    companySize: '',
    loyaltyStatus: ''
  });

  const [error, setError] = useState(initialError);
  const [canEditAccounts, setCanEditAccounts] = useState(true);
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingBusinessAddress, setEditingBusinessAddress] = useState(false);
  const [editingMailingAddress, setEditingMailingAddress] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [contactdisplay, setcontactdisplay] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isadd, setisadd] = useState(false);
  const [addFormError, addsetFormError] = useState(null);
  const [addFormSuccess, addsetFormSuccess] = useState(null);
  const [isCopying, setIsCopying] = useState(false);
  
  // Initialize Add Form Data
  const [addformData, setaddFormData] = useState({
    accountName: '',
    acctTypeCd: '',
    branchType: '',
    email: '',
    phone: '',
    mobile: '',
    website: '',
    ein: '',
    dunsNumber: '',
    linkedin: '',
    youtube: '',
    facebook: '',
    twitter: '',
    instagram: '',
    companySize: '',
    loyaltyStatus: '',
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
    suborgid: '',
    ourorg: '0'
  });

  const [allAccounts, setAllAccounts] = useState(accounts);
  const [sortConfig, setSortConfig] = useState({ column: 'accntId', direction: 'asc' });
  
  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [accountsPerPage, setAccountsPerPage] = useState(10);
  const [accountsPerPageInput, setAccountsPerPageInput] = useState('10');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');
  const [branchTypeFilter, setBranchTypeFilter] = useState('all');

  // Helper to check if country is USA (assuming ID 185 is USA)
  const isUSA = (id) => String(id) === '185';

  useEffect(() => {
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

  // --- SYNC PAGINATION INPUTS ---
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setAccountsPerPageInput(accountsPerPage.toString());
  }, [accountsPerPage]);

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
    setEditingContact(false);
    setError(null);
    setisadd(false);
    setActiveSubmenuTab('basic');
    setbasicdetailsdisplay(true);
    setaddressdisplay(false);
    setcontactdisplay(false);
  };

  const handleBackClick = () => {
    router.refresh();
    setSelectedAccntId(null);
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setEditingContact(false);
    setError(null);
    setisadd(false);
    setSearchQuery('');
    setAccountTypeFilter('all');
    setBranchTypeFilter('all');
    setActiveSubmenuTab('basic');
    setbasicdetailsdisplay(false);
    setaddressdisplay(false);
    setcontactdisplay(false);
  };

  const handleaddaccount = () => {
    setSelectedAccntId(null);
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setEditingContact(false);
    setError(null);
    setisadd(true);
    setActiveSubmenuTab('basic');
    setbasicdetailsdisplay(false);
    setaddressdisplay(false);
    setcontactdisplay(false);
  };

  const handleSubmenuTabClick = (tab) => {
    setActiveSubmenuTab(tab);
    if (tab === 'basic') {
      setbasicdetailsdisplay(true);
      setaddressdisplay(false);
      setcontactdisplay(false);
    } else if (tab === 'address') {
      setbasicdetailsdisplay(false);
      setaddressdisplay(true);
      setcontactdisplay(false);
    } else if (tab === 'contact') {
      setbasicdetailsdisplay(false);
      setaddressdisplay(false);
      setcontactdisplay(true);
    }
    setEditingBasic(false);
    setEditingBusinessAddress(false);
    setEditingMailingAddress(false);
    setEditingContact(false);
  };

  const handleEdit = (section) => {
    if (section === 'basic') setEditingBasic(true);
    if (section === 'businessAddress') setEditingBusinessAddress(true);
    if (section === 'mailingAddress') setEditingMailingAddress(true);
    if (section === 'contact') setEditingContact(true);
  };

  // --- FILTERING ---
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

  const filteredAccounts = allAccounts.filter((account) => {
    const matchesSearch = account.ALIAS_NAME?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAccountType = accountTypeFilter === 'all' || String(account.ACCT_TYPE_CD) === accountTypeFilter;
    const matchesBranchType = branchTypeFilter === 'all' || String(account.BRANCH_TYPE) === branchTypeFilter;
    return matchesSearch && matchesAccountType && matchesBranchType;
  });

  const totalPages = Math.ceil(filteredAccounts.length / accountsPerPage);
  const currentAccounts = filteredAccounts.slice((currentPage - 1) * accountsPerPage, currentPage * accountsPerPage);

  // --- PAGINATION HANDLERS (UPDATED TO MATCH REFERENCE) ---
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
  
  const handleAccountsPerPageInputChange = (e) => setAccountsPerPageInput(e.target.value);
  
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
      }
    }
  };

  // Load Details Effect
  useEffect(() => {
    const loadAccountDetails = async () => {
      if (!selectedAccntId) return;
      try {
        setIsLoading(true);
        const account = await fetchAccountById(selectedAccntId);
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
          suborgid: account.suborgid || '',
          ourorg: account.ourorg ? String(account.ourorg) : '0',
          phone: account.PHONE || '',
          mobile: account.MOBILE || '',
          website: account.WEBSITE || '',
          ein: account.EIN || '',
          dunsNumber: account.DUNS_NUMBER || '',
          linkedin: account.LINKEDIN || '',
          youtube: account.YOUTUBE || '',
          facebook: account.FACEBOOK || '',
          twitter: account.TWITTER || '',
          instagram: account.INSTAGRAM || '',
          companySize: account.COMPANY_SIZE ? String(account.COMPANY_SIZE) : '',
          loyaltyStatus: account.LOYALTY_STATUS ? String(account.LOYALTY_STATUS) : '',
        });
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadAccountDetails();
  }, [selectedAccntId, orgid]);

  const handleCancelBasic = () => {
    setEditingBasic(false);
    if (accountDetails) {
      setFormData(prev => ({
        ...prev,
        activeFlag: accountDetails.ACTIVE_FLAG ? '1' : '0',
        acctTypeCd: accountDetails.ACCT_TYPE_CD || '',
        email: accountDetails.EMAIL || '',
        aliasName: accountDetails.ALIAS_NAME || '',
        branchType: accountDetails.BRANCH_TYPE || '',
        suborgid: accountDetails.suborgid || '',
        ourorg: accountDetails.ourorg ? String(accountDetails.ourorg) : '0',
      }));
    }
  };

  const handleCancelBusinessAddress = () => {
    setEditingBusinessAddress(false);
    if (accountDetails) {
      setFormData(prev => ({
        ...prev,
        businessAddrLine1: accountDetails.BUSINESS_ADDR_LINE1 || '',
        businessAddrLine2: accountDetails.BUSINESS_ADDR_LINE2 || '',
        businessAddrLine3: accountDetails.BUSINESS_ADDR_LINE3 || '',
        businessCity: accountDetails.BUSINESS_CITY || '',
        businessStateId: accountDetails.BUSINESS_STATE_ID ? String(accountDetails.BUSINESS_STATE_ID) : '',
        businessCountryId: accountDetails.BUSINESS_COUNTRY_ID ? String(accountDetails.BUSINESS_COUNTRY_ID) : '185',
        businessPostalCode: accountDetails.BUSINESS_POSTAL_CODE || '',
      }));
    }
  };

  const handleCancelMailingAddress = () => {
    setEditingMailingAddress(false);
    if (accountDetails) {
      setFormData(prev => ({
        ...prev,
        mailingAddrLine1: accountDetails.MAILING_ADDR_LINE1 || '',
        mailingAddrLine2: accountDetails.MAILING_ADDR_LINE2 || '',
        mailingAddrLine3: accountDetails.MAILING_ADDR_LINE3 || '',
        mailingCity: accountDetails.MAILING_CITY || '',
        mailingStateId: accountDetails.MAILING_STATE_ID ? String(accountDetails.MAILING_STATE_ID) : '',
        mailingCountryId: accountDetails.MAILING_COUNTRY_ID ? String(accountDetails.MAILING_COUNTRY_ID) : '185',
        mailingPostalCode: accountDetails.MAILING_POSTAL_CODE || '',
      }));
    }
  };

  const handleCancelContact = () => {
    setEditingContact(false);
    if (accountDetails) {
      setFormData(prev => ({
        ...prev,
        phone: accountDetails.PHONE || '',
        mobile: accountDetails.MOBILE || '',
        website: accountDetails.WEBSITE || '',
        ein: accountDetails.EIN || '',
        dunsNumber: accountDetails.DUNS_NUMBER || '',
        linkedin: accountDetails.LINKEDIN || '',
        youtube: accountDetails.YOUTUBE || '',
        facebook: accountDetails.FACEBOOK || '',
        twitter: accountDetails.TWITTER || '',
        instagram: accountDetails.INSTAGRAM || '',
        companySize: accountDetails.COMPANY_SIZE ? String(accountDetails.COMPANY_SIZE) : '',
        loyaltyStatus: accountDetails.LOYALTY_STATUS ? String(accountDetails.LOYALTY_STATUS) : '',
      }));
    }
  };

  const handleCopyBusinessToMailingAdd = () => {
    setIsCopying(true);
    setTimeout(() => {
      setaddFormData(prev => ({
        ...prev,
        mailingAddrLine1: prev.businessAddrLine1,
        mailingAddrLine2: prev.businessAddrLine2,
        mailingAddrLine3: prev.businessAddrLine3, 
        mailingCity: prev.businessCity,
        mailingStateId: prev.businessStateId, 
        mailingCountryId: prev.businessCountryId,
        mailingPostalCode: prev.businessPostalCode,
      }));
      setIsCopying(false);
    }, 500);
  };

  const handleCopyBusinessToMailingEdit = () => {
    setIsCopying(true);
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        mailingAddrLine1: prev.businessAddrLine1,
        mailingAddrLine2: prev.businessAddrLine2,
        mailingAddrLine3: prev.businessAddrLine3, 
        mailingCity: prev.businessCity,
        mailingStateId: prev.businessStateId, 
        mailingCountryId: prev.businessCountryId,
        mailingPostalCode: prev.businessPostalCode,
      }));
      setIsCopying(false);
    }, 500);
  };

  const handleSave = async (section) => {
    if (!formData.orgid) { setError('Organization ID missing.'); return; }
    setIsLoading(true);
    
    const formDataToSubmit = new FormData();
    formDataToSubmit.append('ACCNT_ID', formData.accntId);
    formDataToSubmit.append('ORGID', formData.orgid);
    formDataToSubmit.append('section', section);

    if (section === 'basic') {
      formDataToSubmit.append('ACTIVE_FLAG', formData.activeFlag);
      formDataToSubmit.append('ACCT_TYPE_CD', formData.acctTypeCd);
      formDataToSubmit.append('EMAIL', formData.email);
      formDataToSubmit.append('ALIAS_NAME', formData.aliasName || '');
      formDataToSubmit.append('BRANCH_TYPE', formData.branchType || '');
      formDataToSubmit.append('suborgid', formData.suborgid || '');
      formDataToSubmit.append('ourorg', formData.ourorg || '0');
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
    } else if (section === 'contact') {
      formDataToSubmit.append('PHONE', formData.phone || '');
      formDataToSubmit.append('MOBILE', formData.mobile || '');
      formDataToSubmit.append('WEBSITE', formData.website || '');
      formDataToSubmit.append('EIN', formData.ein || '');
      formDataToSubmit.append('DUNS_NUMBER', formData.dunsNumber || '');
      formDataToSubmit.append('LINKEDIN', formData.linkedin || '');
      formDataToSubmit.append('YOUTUBE', formData.youtube || '');
      formDataToSubmit.append('FACEBOOK', formData.facebook || '');
      formDataToSubmit.append('TWITTER', formData.twitter || '');
      formDataToSubmit.append('INSTAGRAM', formData.instagram || '');
      formDataToSubmit.append('COMPANY_SIZE', formData.companySize || '');
      formDataToSubmit.append('LOYALTY_STATUS', formData.loyaltyStatus || '');
    }

    try {
      const result = await updateAccount(formDataToSubmit);
      if (result && result.success) {
        const updatedAccount = await fetchAccountById(formData.accntId);
        setAccountDetails(updatedAccount);
        // Update local list
        const idx = accounts.findIndex(a => a.ACCNT_ID === formData.accntId);
        if (idx !== -1) {
          accounts[idx] = { ...accounts[idx], ...updatedAccount };
        }
        
        if (section === 'basic') setEditingBasic(false);
        if (section === 'businessAddress') setEditingBusinessAddress(false);
        if (section === 'mailingAddress') setEditingMailingAddress(false);
        if (section === 'contact') setEditingContact(false);
        setError(null);
      } else {
        setError(result.error || 'Failed to save.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'businessCountryId') {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        businessStateId: '', 
        businessAddrLine3: '' 
      }));
    } else if (name === 'mailingCountryId') {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        mailingStateId: '', 
        mailingAddrLine3: '' 
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const addhandleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'businessCountryId') {
      setaddFormData(prev => ({ 
        ...prev, 
        [name]: value,
        businessStateId: '',
        businessAddrLine3: '' 
      }));
    } else if (name === 'mailingCountryId') {
      setaddFormData(prev => ({ 
        ...prev, 
        [name]: value,
        mailingStateId: '',
        mailingAddrLine3: ''
      }));
    } else {
      setaddFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const addhandleSubmit = async (e) => {
    e.preventDefault();
    addsetFormError(null);
    setIsAdding(true);

    const formDataToSend = new FormData();
    Object.entries(addformData).forEach(([key, value]) => formDataToSend.append(key, value));
    formDataToSend.append('orgid', orgid);

    const result = await addAccount(formDataToSend);
    setIsAdding(false);
    
    if (result?.error) {
      addsetFormError(result.error);
    } else if (result?.success) {
      addsetFormSuccess('Account added successfully.');
      setaddFormData({
        accountName: '', acctTypeCd: '', branchType: '', email: '',
        businessAddrLine1: '', businessAddrLine2: '', businessAddrLine3: '',
        businessCity: '', businessStateId: '', businessCountryId: '185', businessPostalCode: '',
        mailingAddrLine1: '', mailingAddrLine2: '', mailingAddrLine3: '',
        mailingCity: '', mailingStateId: '', mailingCountryId: '185', mailingPostalCode: '',
        suborgid: '', ourorg: '0',
        phone: '', mobile: '', website: '', ein: '', dunsNumber: '',
        linkedin: '', youtube: '', facebook: '', twitter: '', instagram: '',
        companySize: '', loyaltyStatus: ''
      });
      setTimeout(() => { addsetFormSuccess(null); router.refresh(); }, 2000);
      handleBackClick();
    }
  };

  const getAccountTypeName = (id) => accountTypes.find(t => String(t.id) === String(id))?.Name || 'No Account Type';
  const getBranchTypeName = (id) => branchTypes.find(t => String(t.id) === String(id))?.Name || 'No Branch Type';
  const getCountryName = (id) => countries.find(c => c.ID === id)?.VALUE || 'No Country';
  const getCompanySizeName = (id) => companySizes.find(cs => String(cs.ID) === String(id))?.VALUE || '-';
  const getLoyaltyStatusName = (id) => loyaltyStatuses.find(ls => String(ls.ID) === String(id))?.VALUE || '-';
  
  const getDisplayState = (countryId, stateId, addrLine3) => {
    if (isUSA(countryId)) {
      const stateObj = states.find(s => String(s.ID) === String(stateId));
      return stateObj ? stateObj.VALUE : '-';
    }
    return addrLine3 || '-';
  };
  
  const getSubOrgName = (id) => suborgs.find(s => String(s.suborgid) === String(id))?.suborgname || 'No Suborganization';
  
  return (
    <div className="account_overview_container">
      {error && <div className="account_error_message">{error}</div>}
      
      {/* ADD ACCOUNT FORM */}
      {isadd && (
        <div className="account_add_container">
          <div className="account_header_section">
            <h2 className="account_title">Add Account</h2>
            <button className="account_back_button" onClick={handleBackClick}></button>
          </div>
          {addFormError && <div className="account_error_message">{addFormError}</div>}
          {addFormSuccess && <div className="account_success_message">{addFormSuccess}</div>}
          
          <form onSubmit={addhandleSubmit} className="account_details_container">
            <div className="account_details_block">
              <h3>Basic Details</h3>
              <div className="account_form_grid">
                <div className="account_form_group">
                  <label>Account Name*</label>
                  <input type="text" name="accountName" value={addformData.accountName} onChange={addhandleChange} required />
                </div>
                <div className="account_form_group">
                  <label>Account Type*</label>
                  <select name="acctTypeCd" value={addformData.acctTypeCd} onChange={addhandleChange} required>
                    <option value="">Select Type</option>
                    {accountTypes.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}
                  </select>
                </div>
                <div className="account_form_group">
                  <label>Branch Type*</label>
                  <select name="branchType" value={addformData.branchType} onChange={addhandleChange} required>
                    <option value="">Select Branch</option>
                    {branchTypes.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}
                  </select>
                </div>
                <div className="account_form_group">
                  <label>Email*</label>
                  <input type="email" name="email" value={addformData.email} onChange={addhandleChange} required />
                </div>
                <div className="account_form_group">
                  <label>Organization</label>
                  <select name="suborgid" value={addformData.suborgid} onChange={addhandleChange}>
                    <option value="">Select Org</option>
                    {suborgs.map(s => <option key={s.suborgid} value={s.suborgid}>{s.suborgname}</option>)}
                  </select>
                </div>
                <div className="account_form_group">
                  <label>Account Ownership*</label>
                  <select name="ourorg" value={addformData.ourorg} onChange={addhandleChange} required>
                    <option value="0">Outside Account</option>
                    <option value="1">Our Own Account</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="account_details_block">
              <h3>Business Address</h3>
              <div className="account_form_grid">
                <div className="account_form_group"><label>Address Line 1</label><input type="text" name="businessAddrLine1" value={addformData.businessAddrLine1} onChange={addhandleChange} /></div>
                <div className="account_form_group"><label>Address Line 2</label><input type="text" name="businessAddrLine2" value={addformData.businessAddrLine2} onChange={addhandleChange} /></div>
                
                <div className="account_form_group"><label>City</label><input type="text" name="businessCity" value={addformData.businessCity} onChange={addhandleChange} /></div>
                <div className="account_form_group">
                  <label>Country</label>
                  <select name="businessCountryId" value={addformData.businessCountryId} onChange={addhandleChange}>
                    <option value="">Select Country</option>
                    {countries.map(c => <option key={c.ID} value={c.ID}>{c.VALUE}</option>)}
                  </select>
                </div>
                <div className="account_form_group">
                  <label>State</label>
                  <select 
                    name="businessStateId" 
                    value={isUSA(addformData.businessCountryId) ? addformData.businessStateId : ''} 
                    onChange={addhandleChange}
                    disabled={!isUSA(addformData.businessCountryId)}
                    className={!isUSA(addformData.businessCountryId) ? 'account_bg_gray_100' : ''}
                  >
                    <option value="">Select State</option>
                    {states.map(s => <option key={s.ID} value={s.ID}>{s.VALUE}</option>)}
                  </select>
                </div>
                <div className="account_form_group">
                  <label>Custom State Name</label>
                  <input 
                    type="text" 
                    name="businessAddrLine3" 
                    value={!isUSA(addformData.businessCountryId) ? addformData.businessAddrLine3 : ''} 
                    onChange={addhandleChange} 
                    disabled={isUSA(addformData.businessCountryId)}
                    className={isUSA(addformData.businessCountryId) ? 'account_bg_gray_100' : ''}
                  />
                </div>
                <div className="account_form_group"><label>Postal Code</label><input type="text" name="businessPostalCode" value={addformData.businessPostalCode} onChange={addhandleChange} /></div>
              </div>
            </div>

            <div className="account_details_block">
              <div className="account_block_header">
                <h3>Mailing Address</h3>
                <button 
                  type="button" 
                  onClick={handleCopyBusinessToMailingAdd} 
                  className="account_copy_button"
                  disabled={isCopying}
                >
                  {isCopying ? 'Copying...' : 'Copy Business Address'}
                </button>
              </div>
              <div className="account_form_grid">
                <div className="account_form_group"><label>Address Line 1</label><input type="text" name="mailingAddrLine1" value={addformData.mailingAddrLine1} onChange={addhandleChange} /></div>
                <div className="account_form_group"><label>Address Line 2</label><input type="text" name="mailingAddrLine2" value={addformData.mailingAddrLine2} onChange={addhandleChange} /></div>
                
                <div className="account_form_group"><label>City</label><input type="text" name="mailingCity" value={addformData.mailingCity} onChange={addhandleChange} /></div>
                <div className="account_form_group">
                  <label>Country</label>
                  <select name="mailingCountryId" value={addformData.mailingCountryId} onChange={addhandleChange}>
                    <option value="">Select Country</option>
                    {countries.map(c => <option key={c.ID} value={c.ID}>{c.VALUE}</option>)}
                  </select>
                </div>
                <div className="account_form_group">
                  <label>State</label>
                  <select 
                    name="mailingStateId" 
                    value={isUSA(addformData.mailingCountryId) ? addformData.mailingStateId : ''} 
                    onChange={addhandleChange}
                    disabled={!isUSA(addformData.mailingCountryId)}
                    className={!isUSA(addformData.mailingCountryId) ? 'account_bg_gray_100' : ''}
                  >
                    <option value="">Select State</option>
                    {states.map(s => <option key={s.ID} value={s.ID}>{s.VALUE}</option>)}
                  </select>
                </div>
                <div className="account_form_group">
                  <label>Custom State Name</label>
                  <input 
                    type="text" 
                    name="mailingAddrLine3"
                    value={!isUSA(addformData.mailingCountryId) ? addformData.mailingAddrLine3 : ''} 
                    onChange={addhandleChange} 
                    disabled={isUSA(addformData.mailingCountryId)}
                    className={isUSA(addformData.mailingCountryId) ? 'account_bg_gray_100' : ''}
                  />
                </div>
                <div className="account_form_group"><label>Postal Code</label><input type="text" name="mailingPostalCode" value={addformData.mailingPostalCode} onChange={addhandleChange} /></div>
              </div>
            </div>

            <div className="account_details_block">
              <div className="account_block_header">
                <h3>Additional Details</h3>
              </div>
              <div className="account_form_grid">
                <div className="account_form_group"><label>Phone</label><input type="text" name="phone" value={addformData.phone} onChange={addhandleChange} /></div>
                <div className="account_form_group"><label>Mobile</label><input type="text" name="mobile" value={addformData.mobile} onChange={addhandleChange} /></div>
                <div className="account_form_group"><label>Website</label><input type="text" name="website" value={addformData.website} onChange={addhandleChange} placeholder="https://" /></div>
                <div className="account_form_group"><label>EIN</label><input type="text" name="ein" value={addformData.ein} onChange={addhandleChange} /></div>
                <div className="account_form_group"><label>DUNS Number</label><input type="text" name="dunsNumber" value={addformData.dunsNumber} onChange={addhandleChange} /></div>
                <div className="account_form_group"><label>LinkedIn</label><input type="text" name="linkedin" value={addformData.linkedin} onChange={addhandleChange} placeholder="https://linkedin.com/company/..." /></div>
                <div className="account_form_group"><label>YouTube</label><input type="text" name="youtube" value={addformData.youtube} onChange={addhandleChange} placeholder="https://youtube.com/..." /></div>
                <div className="account_form_group"><label>Facebook</label><input type="text" name="facebook" value={addformData.facebook} onChange={addhandleChange} placeholder="https://facebook.com/..." /></div>
                <div className="account_form_group"><label>Twitter</label><input type="text" name="twitter" value={addformData.twitter} onChange={addhandleChange} placeholder="https://twitter.com/..." /></div>
                <div className="account_form_group"><label>Instagram</label><input type="text" name="instagram" value={addformData.instagram} onChange={addhandleChange} placeholder="https://instagram.com/..." /></div>
                <div className="account_form_group">
                  <label>Company Size</label>
                  <select name="companySize" value={addformData.companySize} onChange={addhandleChange}>
                    <option value="">Select Company Size</option>
                    {companySizes.map(cs => <option key={cs.ID} value={cs.ID}>{cs.VALUE}</option>)}
                  </select>
                </div>
                <div className="account_form_group">
                  <label>Loyalty Status</label>
                  <select name="loyaltyStatus" value={addformData.loyaltyStatus} onChange={addhandleChange}>
                    <option value="">Select Loyalty Status</option>
                    {loyaltyStatuses.map(ls => <option key={ls.ID} value={ls.ID}>{ls.VALUE}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="account_form_buttons">
              <button type="submit" className="account_save" disabled={isAdding}>{isAdding ? 'Adding...' : 'Add Account'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ACCOUNT LIST */}
      {!isadd && !selectedAccntId ? (
        <div className="account_list">
           <div className="account_header_section">
            <h1 className="account_title">Accounts</h1>
            <button onClick={handleaddaccount} className="account_save">Add Account</button>
          </div>
          <div className="account_search_filter_container">
            <input type="text" value={searchQuery} onChange={handleSearchChange} className="account_search_input" placeholder="Search by name..." />
            <select value={accountTypeFilter} onChange={handleAccountTypeFilterChange} className="account_filter_select">
              <option value="all">All Types</option>
              {accountTypes.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}
            </select>
            <select value={branchTypeFilter} onChange={handleBranchTypeFilterChange} className="account_filter_select">
              <option value="all">All Branches</option>
              {branchTypes.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}
            </select>
          </div>

          <div className="account_table_wrapper">
            <table className="account_table">
              <thead>
                <tr>
                  <th onClick={() => requestSort('aliasName')}>Account Name</th>
                  <th onClick={() => requestSort('acctTypeCd')}>Account Type</th>
                  <th onClick={() => requestSort('branchType')}>Branch Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {currentAccounts.length > 0 ? currentAccounts.map((account) => (
                  <tr key={account.ACCNT_ID} onClick={() => handleRowClick(account.ACCNT_ID)} className={selectedAccntId === account.ACCNT_ID ? 'account_selected_row' : ''}>
                    <td>{account.ALIAS_NAME}</td>
                    <td>{getAccountTypeName(account.ACCT_TYPE_CD)}</td>
                    <td>{getBranchTypeName(account.BRANCH_TYPE)}</td>
                   
                    <td>
                      <span className={`account_status_badge ${account.ACTIVE_FLAG === 1 ? 'account_actives' : 'account_inactive'}`}>
                        {account.ACTIVE_FLAG === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                )) : <tr><td colSpan="4" style={{textAlign: 'center'}}>No accounts found.</td></tr>}
              </tbody>
            </table>
          </div>
          
          {/* UPDATED PAGINATION CONTROLS TO MATCH REFERENCE */}
          {filteredAccounts.length > accountsPerPage && (
            <div className="account_pagination_container">
              <button className="account_button" onClick={handlePrevPage} disabled={currentPage === 1}>← Previous</button>
              <span className="account_pagination_text">
                Page{' '}
                <input
                  type="text"
                  value={pageInputValue}
                  onChange={handlePageInputChange}
                  onKeyPress={handlePageInputKeyPress}
                  className="account_pagination_input"
                />{' '}
                of {totalPages}
              </span>
              <button className="account_button" onClick={handleNextPage} disabled={currentPage === totalPages}>Next →</button>
            </div>
          )}

          {/* ADDED ROWS PER PAGE SECTION TO MATCH REFERENCE */}
          <div className="account_rows_per_page_container">
            <label className="account_rows_per_page_label">Rows per Page:</label>
            <input
              type="text"
              value={accountsPerPageInput}
              onChange={handleAccountsPerPageInputChange}
              onKeyPress={handleAccountsPerPageInputKeyPress}
              placeholder="Rows per page"
              className="account_rows_per_page_input"
              aria-label="Number of rows per page"
            />
          </div>

        </div>
      ) : !isadd && accountDetails && (
        <div className="account_details_container">
          <div className="account_header_section">
            <h1 className="account_title">{`${formData.aliasName || '-'}`} Account Details</h1>
            <button className="account_back_button" onClick={handleBackClick}></button>
          </div>

          <div className="account_submenu_bar">
            <button className={activeSubmenuTab === 'basic' ? 'account_active' : ''} onClick={() => handleSubmenuTabClick('basic')}>Basic Details</button>
            <button className={activeSubmenuTab === 'address' ? 'account_active' : ''} onClick={() => handleSubmenuTabClick('address')}>Address Details</button>
            <button className={activeSubmenuTab === 'contact' ? 'account_active' : ''} onClick={() => handleSubmenuTabClick('contact')}>Additional Details</button>
          </div>

          <div className="account_details_content">
            {basicdetailsdisplay && (
              <div className="account_details_block">
                <h3>Basic Details</h3>
                {editingBasic && canEditAccounts ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave('basic'); }}>
                    <div className="account_form_grid">
                      <div className="account_form_group"><label>Account Name</label><input type="text" name="aliasName" value={formData.aliasName} onChange={handleFormChange} /></div>
                      <div className="account_form_group"><label>Account Type*</label><select name="acctTypeCd" value={formData.acctTypeCd} onChange={handleFormChange} required>{accountTypes.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}</select></div>
                      <div className="account_form_group"><label>Branch Type</label><select name="branchType" value={formData.branchType} onChange={handleFormChange}><option value="">Select Branch</option>{branchTypes.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}</select></div>
                      <div className="account_form_group"><label>Email*</label><input type="email" name="email" value={formData.email} onChange={handleFormChange} required /></div>
                      <div className="account_form_group"><label>Organization</label><select name="suborgid" value={formData.suborgid} onChange={handleFormChange}><option value="">Select Org</option>{suborgs.map(s => <option key={s.suborgid} value={s.suborgid}>{s.suborgname}</option>)}</select></div>
                      <div className="account_form_group"><label>Account Ownership*</label><select name="ourorg" value={formData.ourorg} onChange={handleFormChange} required><option value="0">Outside Account</option><option value="1">Our Own Account</option></select></div>
                      <div className="account_form_group"><label>Active Status</label><select name="activeFlag" value={formData.activeFlag} onChange={handleFormChange}><option value="1">Active</option><option value="0">Inactive</option></select></div>
                    </div>
                    <div className="account_form_buttons">
                      <button type="submit" className="account_save" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save'}</button>
                      <button type="button" className="account_cancel" onClick={handleCancelBasic} disabled={isLoading}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                  <div className="account_view_grid">
                    <div className="account_view_group"><label>Account Name</label><p>{accountDetails.ALIAS_NAME || '-'}</p></div>
                    <div className="account_view_group"><label>Account Type</label><p>{getAccountTypeName(accountDetails.ACCT_TYPE_CD)}</p></div>
                    <div className="account_view_group"><label>Branch Type</label><p>{getBranchTypeName(accountDetails.BRANCH_TYPE)}</p></div>
                    <div className="account_view_group"><label>Email</label><p>{accountDetails.EMAIL}</p></div>
                    <div className="account_view_group"><label>Organization</label><p>{getSubOrgName(accountDetails.suborgid)}</p></div>
                    <div className="account_view_group"><label>Account Ownership</label><p>{accountDetails.ourorg === 1 ? 'Our Own Account' : 'Outside Account'}</p></div>
                    <div className="account_view_group"><label>Status</label><p>{accountDetails.ACTIVE_FLAG ? 'Active' : 'Inactive'}</p></div>
                    <div className="account_view_group"><label>Last Login</label><p>{accountDetails.LAST_LOGIN_DATE ? formatDate(accountDetails.LAST_LOGIN_DATE) : '-'}</p></div>
                    <div className="account_view_group"><label>Updated By</label><p>{accountDetails.LAST_UPDATED_BY || '-'}</p></div>
                  </div>
                  {canEditAccounts && <div className="account_form_buttons"><button className="account_edit_button" onClick={() => handleEdit('basic')}>Edit</button></div>}
                  </>
                )}
              </div>
            )}
            
            {addressdisplay && (
              <>
              <div className="account_details_block">
                <h3>Business Address</h3>
                {editingBusinessAddress ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave('businessAddress'); }}>
                    <div className="account_form_grid">
                      <div className="account_form_group"><label>Address Line 1</label><input name="businessAddrLine1" value={formData.businessAddrLine1} onChange={handleFormChange}/></div>
                      <div className="account_form_group"><label>Address Line 2</label><input name="businessAddrLine2" value={formData.businessAddrLine2} onChange={handleFormChange}/></div>
                      
                      <div className="account_form_group"><label>City</label><input name="businessCity" value={formData.businessCity} onChange={handleFormChange}/></div>
                      <div className="account_form_group"><label>Country</label><select name="businessCountryId" value={formData.businessCountryId} onChange={handleFormChange}><option value="">Select Country</option>{countries.map(c => <option key={c.ID} value={c.ID}>{c.VALUE}</option>)}</select></div>
                      <div className="account_form_group">
                        <label>State</label>
                        <select 
                          name="businessStateId" 
                          value={isUSA(formData.businessCountryId) ? formData.businessStateId : ''} 
                          onChange={handleFormChange} 
                          disabled={!isUSA(formData.businessCountryId)}
                          className={!isUSA(formData.businessCountryId) ? 'account_bg_gray_100' : ''}
                        >
                          <option value="">Select State</option>
                          {states.map(s => <option key={s.ID} value={s.ID}>{s.VALUE}</option>)}
                        </select>
                      </div>
                      <div className="account_form_group">
                        <label>Custom State Name</label>
                        <input 
                          type="text" 
                          name="businessAddrLine3" 
                          value={!isUSA(formData.businessCountryId) ? formData.businessAddrLine3 : ''} 
                          onChange={handleFormChange}
                          disabled={isUSA(formData.businessCountryId)}
                          className={isUSA(formData.businessCountryId) ? 'account_bg_gray_100' : ''}
                        />
                      </div>
                      <div className="account_form_group"><label>Postal Code</label><input name="businessPostalCode" value={formData.businessPostalCode} onChange={handleFormChange}/></div>
                    </div>
                    <div className="account_form_buttons">
                      <button type="submit" className="account_save" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save'}</button>
                      <button type="button" className="account_cancel" onClick={handleCancelBusinessAddress} disabled={isLoading}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                  <div className="account_view_grid">
                    <div className="account_view_group"><label>Address Line 1</label><p>{accountDetails.BUSINESS_ADDR_LINE1 || '-'}</p></div>
                    <div className="account_view_group"><label>Address Line 2</label><p>{accountDetails.BUSINESS_ADDR_LINE2 || '-'}</p></div>
                    <div className="account_view_group"><label>City</label><p>{accountDetails.BUSINESS_CITY || '-'}</p></div>
                    <div className="account_view_group"><label>Country</label><p>{getCountryName(accountDetails.BUSINESS_COUNTRY_ID)}</p></div>
                    <div className="account_view_group">
                      <label>State</label>
                      <p>{getDisplayState(accountDetails.BUSINESS_COUNTRY_ID, accountDetails.BUSINESS_STATE_ID, accountDetails.BUSINESS_ADDR_LINE3)}</p>
                    </div>
                    <div className="account_view_group"><label>Postal Code</label><p>{accountDetails.BUSINESS_POSTAL_CODE || '-'}</p></div>
                  </div>
                  {canEditAccounts && <div className="account_form_buttons"><button className="account_edit_button" onClick={() => handleEdit('businessAddress')}>Edit</button></div>}
                  </>
                )}
              </div>
              
              <div className="account_details_block">
                <div className="account_block_header">
                  <h3>Mailing Address</h3>
                  {editingMailingAddress && (
                    <button 
                      type="button" 
                      onClick={handleCopyBusinessToMailingEdit} 
                      className="account_copy_button"
                      disabled={isCopying}
                    >
                      {isCopying ? 'Copying...' : 'Copy Business Address'}
                    </button>
                  )}
                </div>
                {editingMailingAddress ? (
                   <form onSubmit={(e) => { e.preventDefault(); handleSave('mailingAddress'); }}>
                    <div className="account_form_grid">
                      <div className="account_form_group"><label>Address Line 1</label><input name="mailingAddrLine1" value={formData.mailingAddrLine1} onChange={handleFormChange}/></div>
                      <div className="account_form_group"><label>Address Line 2</label><input name="mailingAddrLine2" value={formData.mailingAddrLine2} onChange={handleFormChange}/></div>
                      
                      <div className="account_form_group"><label>City</label><input name="mailingCity" value={formData.mailingCity} onChange={handleFormChange}/></div>
                      <div className="account_form_group"><label>Country</label><select name="mailingCountryId" value={formData.mailingCountryId} onChange={handleFormChange}><option value="">Select Country</option>{countries.map(c => <option key={c.ID} value={c.ID}>{c.VALUE}</option>)}</select></div>
                      <div className="account_form_group">
                        <label>State</label>
                        <select 
                          name="mailingStateId" 
                          value={isUSA(formData.mailingCountryId) ? formData.mailingStateId : ''} 
                          onChange={handleFormChange}
                          disabled={!isUSA(formData.mailingCountryId)}
                          className={!isUSA(formData.mailingCountryId) ? 'account_bg_gray_100' : ''}
                        >
                          <option value="">Select State</option>
                          {states.map(s => <option key={s.ID} value={s.ID}>{s.VALUE}</option>)}
                        </select>
                      </div>
                      <div className="account_form_group">
                        <label>Custom State Name</label>
                        <input 
                          type="text" 
                          name="mailingAddrLine3" 
                          value={!isUSA(formData.mailingCountryId) ? formData.mailingAddrLine3 : ''} 
                          onChange={handleFormChange}
                          disabled={isUSA(formData.mailingCountryId)}
                          className={isUSA(formData.mailingCountryId) ? 'account_bg_gray_100' : ''}
                        />
                      </div>
                      <div className="account_form_group"><label>Postal Code</label><input name="mailingPostalCode" value={formData.mailingPostalCode} onChange={handleFormChange}/></div>
                    </div>
                    <div className="account_form_buttons">
                      <button type="submit" className="account_save" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save'}</button>
                      <button type="button" className="account_cancel" onClick={handleCancelMailingAddress} disabled={isLoading}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                  <div className="account_view_grid">
                     <div className="account_view_group"><label>Address Line 1</label><p>{accountDetails.MAILING_ADDR_LINE1 || '-'}</p></div>
                    <div className="account_view_group"><label>Address Line 2</label><p>{accountDetails.MAILING_ADDR_LINE2 || '-'}</p></div>
                    <div className="account_view_group"><label>City</label><p>{accountDetails.MAILING_CITY || '-'}</p></div>
                    <div className="account_view_group"><label>Country</label><p>{getCountryName(accountDetails.MAILING_COUNTRY_ID)}</p></div>
                    <div className="account_view_group">
                      <label>State</label>
                      <p>{getDisplayState(accountDetails.MAILING_COUNTRY_ID, accountDetails.MAILING_STATE_ID, accountDetails.MAILING_ADDR_LINE3)}</p>
                    </div>
                    <div className="account_view_group"><label>Postal Code</label><p>{accountDetails.MAILING_POSTAL_CODE || '-'}</p></div>
                  </div>
                  {canEditAccounts && <div className="account_form_buttons"><button className="account_edit_button" onClick={() => handleEdit('mailingAddress')}>Edit</button></div>}
                  </>
                )}
              </div>
              </>
            )}
            
            {contactdisplay && (
              <div className="account_details_block">
                <h3>Additional Details</h3>
                {editingContact && canEditAccounts ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave('contact'); }}>
                    <div className="account_form_grid">
                      <div className="account_form_group"><label>Phone</label><input type="text" name="phone" value={formData.phone} onChange={handleFormChange} /></div>
                      <div className="account_form_group"><label>Mobile</label><input type="text" name="mobile" value={formData.mobile} onChange={handleFormChange} /></div>
                      <div className="account_form_group"><label>Website</label><input type="text" name="website" value={formData.website} onChange={handleFormChange} placeholder="https://" /></div>
                      <div className="account_form_group"><label>EIN</label><input type="text" name="ein" value={formData.ein} onChange={handleFormChange} /></div>
                      <div className="account_form_group"><label>DUNS Number</label><input type="text" name="dunsNumber" value={formData.dunsNumber} onChange={handleFormChange} /></div>
                      <div className="account_form_group"><label>LinkedIn</label><input type="text" name="linkedin" value={formData.linkedin} onChange={handleFormChange} placeholder="https://linkedin.com/company/..." /></div>
                      <div className="account_form_group"><label>YouTube</label><input type="text" name="youtube" value={formData.youtube} onChange={handleFormChange} placeholder="https://youtube.com/..." /></div>
                      <div className="account_form_group"><label>Facebook</label><input type="text" name="facebook" value={formData.facebook} onChange={handleFormChange} placeholder="https://facebook.com/..." /></div>
                      <div className="account_form_group"><label>Twitter</label><input type="text" name="twitter" value={formData.twitter} onChange={handleFormChange} placeholder="https://twitter.com/..." /></div>
                      <div className="account_form_group"><label>Instagram</label><input type="text" name="instagram" value={formData.instagram} onChange={handleFormChange} placeholder="https://instagram.com/..." /></div>
                      <div className="account_form_group">
                        <label>Company Size</label>
                        <select name="companySize" value={formData.companySize} onChange={handleFormChange}>
                          <option value="">Select Company Size</option>
                          {companySizes.map(cs => <option key={cs.ID} value={cs.ID}>{cs.VALUE}</option>)}
                        </select>
                      </div>
                      <div className="account_form_group">
                        <label>Loyalty Status</label>
                        <select name="loyaltyStatus" value={formData.loyaltyStatus} onChange={handleFormChange}>
                          <option value="">Select Loyalty Status</option>
                          {loyaltyStatuses.map(ls => <option key={ls.ID} value={ls.ID}>{ls.VALUE}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="account_form_buttons">
                      <button type="submit" className="account_save" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save'}</button>
                      <button type="button" className="account_cancel" onClick={handleCancelContact} disabled={isLoading}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                  <div className="account_view_grid">
                    <div className="account_view_group"><label>Phone</label><p>{accountDetails.PHONE || '-'}</p></div>
                    <div className="account_view_group"><label>Mobile</label><p>{accountDetails.MOBILE || '-'}</p></div>
                    <div className="account_view_group"><label>Website</label><p>{accountDetails.WEBSITE ? <a href={accountDetails.WEBSITE} target="_blank" rel="noopener noreferrer">{accountDetails.WEBSITE}</a> : '-'}</p></div>
                    <div className="account_view_group"><label>EIN</label><p>{accountDetails.EIN || '-'}</p></div>
                    <div className="account_view_group"><label>DUNS Number</label><p>{accountDetails.DUNS_NUMBER || '-'}</p></div>
                    <div className="account_view_group"><label>LinkedIn</label><p>{accountDetails.LINKEDIN ? <a href={accountDetails.LINKEDIN} target="_blank" rel="noopener noreferrer">{accountDetails.LINKEDIN}</a> : '-'}</p></div>
                    <div className="account_view_group"><label>YouTube</label><p>{accountDetails.YOUTUBE ? <a href={accountDetails.YOUTUBE} target="_blank" rel="noopener noreferrer">{accountDetails.YOUTUBE}</a> : '-'}</p></div>
                    <div className="account_view_group"><label>Facebook</label><p>{accountDetails.FACEBOOK ? <a href={accountDetails.FACEBOOK} target="_blank" rel="noopener noreferrer">{accountDetails.FACEBOOK}</a> : '-'}</p></div>
                    <div className="account_view_group"><label>Twitter</label><p>{accountDetails.TWITTER ? <a href={accountDetails.TWITTER} target="_blank" rel="noopener noreferrer">{accountDetails.TWITTER}</a> : '-'}</p></div>
                    <div className="account_view_group"><label>Instagram</label><p>{accountDetails.INSTAGRAM ? <a href={accountDetails.INSTAGRAM} target="_blank" rel="noopener noreferrer">{accountDetails.INSTAGRAM}</a> : '-'}</p></div>
                    <div className="account_view_group"><label>Company Size</label><p>{getCompanySizeName(accountDetails.COMPANY_SIZE)}</p></div>
                    <div className="account_view_group"><label>Loyalty Status</label><p>{getLoyaltyStatusName(accountDetails.LOYALTY_STATUS)}</p></div>
                  </div>
                  {canEditAccounts && <div className="account_form_buttons"><button className="account_edit_button" onClick={() => handleEdit('contact')}>Edit</button></div>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Overview;
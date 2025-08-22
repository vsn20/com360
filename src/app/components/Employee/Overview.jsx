'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  fetchEmployeeById, 
  fetchLeaveAssignments, 
  updateEmployee 
} from '@/app/serverActions/Employee/overview';
import './overview.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { addemployee } from '@/app/serverActions/addemployee';

const CustomSelect = ({ name, value, onChange, options, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleSelect = (optionValue, optionLabel) => {
    onChange({ target: { name, value: optionValue } });
    setIsOpen(false);
  };

  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`custom-select ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <div className="select-selected" onClick={() => !disabled && setIsOpen(!isOpen)}>
        {selectedOption ? selectedOption.label : placeholder}
      </div>
      {isOpen && (
        <div className="select-items">
          {options.map((option) => (
            <div
              key={option.value}
              className={`select-option ${value === option.value ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value, option.label)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MultiSelectRoles = ({ selectedRoles, setSelectedRoles, roles, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleRoleToggle = (roleid) => {
    setSelectedRoles((prev) =>
      prev.includes(roleid)
        ? prev.filter((id) => id !== roleid)
        : [...prev, roleid]
    );
  };

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getSelectedRoleNames = () => {
    return selectedRoles
      .map((roleid) => roles.find((r) => r.roleid === roleid)?.rolename || 'Unknown Role')
      .join(', ') || 'Select Roles';
  };

  return (
    <div className={`custom-select-container ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <div className="select-selected" onClick={() => !disabled && toggleDropdown()}>
        {getSelectedRoleNames()}
      </div>
      {isOpen && (
        <div className="select-items">
          {roles.map((role) => (
            <div
              key={role.roleid}
              className={`select-option ${selectedRoles.includes(role.roleid) ? 'selected' : ''}`}
              onClick={() => handleRoleToggle(role.roleid)}
            >
              <input
                type="checkbox"
                checked={selectedRoles.includes(role.roleid)}
                readOnly
              />
              {role.rolename}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Overview = ({
  roles,
  currentrole,
  orgid,
  error: initialError,
  employees,
  leaveTypes,
  countries,
  states,
  departments,
  payFrequencies,
  jobTitles,
  statuses,
  workerCompClasses,
  timestamp
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [leaveAssignments, setLeaveAssignments] = useState({});
  const [allEmployees, setAllEmployees] = useState(employees);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const router = useRouter();
  const searchparams = useSearchParams();
  let ts = timestamp;
  
  const [formData, setFormData] = useState({
    empid: '',
    orgid: orgid || '',
    empFstName: '',
    empMidName: '',
    empLastName: '',
    empPrefName: '',
    email: '',
    roleid: '',
    gender: '',
    mobileNumber: '',
    phoneNumber: '',
    dob: '',
    hireDate: '',
    lastWorkDate: '',
    terminatedDate: '',
    rejoinDate: '',
    superior: '',
    ssn: '',
    status: '',
    linkedinUrl: '',
    jobTitle: '',
    payFrequency: '',
    deptId: '',
    deptName: '',
    workCompClass: '',
    workAddrLine1: '',
    workAddrLine2: '',
    workAddrLine3: '',
    workCity: '',
    workStateId: '',
    workStateNameCustom: '',
    workCountryId: '185',
    workPostalCode: '',
    homeAddrLine1: '',
    homeAddrLine2: '',
    homeAddrLine3: '',
    homeCity: '',
    homeStateId: '',
    homeStateNameCustom: '',
    homeCountryId: '185',
    homePostalCode: '',
    emergCnctName: '',
    emergCnctPhoneNumber: '',
    emergCnctEmail: '',
    emergCnctAddrLine1: '',
    emergCnctAddrLine2: '',
    emergCnctAddrLine3: '',
    emergCnctCity: '',
    emergCnctStateId: '',
    emergCnctStateNameCustom: '',
    emergCnctCountryId: '185',
    emergCnctPostalCode: '',
  });
  
  const [formLeaves, setFormLeaves] = useState({});
  const [error, setError] = useState(initialError);
  const [canEditEmployees, setCanEditEmployees] = useState(true);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingEmployment, setEditingEmployment] = useState(false);
  const [editingLeaves, setEditingLeaves] = useState(false);
  const [editingWorkAddress, setEditingWorkAddress] = useState(false);
  const [editingHomeAddress, setEditingHomeAddress] = useState(false);
  const [editingEmergencyContact, setEditingEmergencyContact] = useState(false);
  const [issadd, setisadd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [employeesPerPage, setEmployeesPerPage] = useState(10);
  const [employeesPerPageInput, setEmployeesPerPageInput] = useState('10');
  
  // Add state for sorting configuration
  const [sortConfig, setSortConfig] = useState({ column: 'empid', direction: 'asc' });

  // Update useEffect for sorting
  useEffect(() => {
    const sortedEmployees = [...employees].sort((a, b) => sortEmployees(a, b, sortConfig.column, sortConfig.direction));
    setAllEmployees(sortedEmployees);
  }, [sortConfig, employees]);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);
 
  useEffect(() => {
    handleBackClick();
  }, [searchparams.get('refresh')]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setEmployeesPerPageInput(employeesPerPage.toString());
  }, [employeesPerPage]);

  useEffect(() => {
    const loadEmployeeDetails = async () => {
      if (!selectedEmpId) {
        setEmployeeDetails(null);
        setLeaveAssignments({});
        setSelectedRoles([]);
        setFormData({
          empid: '',
          orgid: orgid || '',
          empFstName: '',
          empMidName: '',
          empLastName: '',
          empPrefName: '',
          email: '',
          roleid: '',
          gender: '',
          mobileNumber: '',
          phoneNumber: '',
          dob: '',
          hireDate: '',
          lastWorkDate: '',
          terminatedDate: '',
          rejoinDate: '',
          superior: '',
          ssn: '',
          status: '',
          linkedinUrl: '',
          jobTitle: '',
          payFrequency: '',
          deptId: '',
          deptName: '',
          workCompClass: '',
          workAddrLine1: '',
          workAddrLine2: '',
          workAddrLine3: '',
          workCity: '',
          workStateId: '',
          workStateNameCustom: '',
          workCountryId: '185',
          workPostalCode: '',
          homeAddrLine1: '',
          homeAddrLine2: '',
          homeAddrLine3: '',
          homeCity: '',
          homeStateId: '',
          homeStateNameCustom: '',
          homeCountryId: '185',
          homePostalCode: '',
          emergCnctName: '',
          emergCnctPhoneNumber: '',
          emergCnctEmail: '',
          emergCnctAddrLine1: '',
          emergCnctAddrLine2: '',
          emergCnctAddrLine3: '',
          emergCnctCity: '',
          emergCnctStateId: '',
          emergCnctStateNameCustom: '',
          emergCnctCountryId: '185',
          emergCnctPostalCode: '',
        });
        setFormLeaves({});
        console.log('Cleared employee details: no selectedEmpId');
        return;
      }
      try {
        const [employee, leaveData] = await Promise.all([
          fetchEmployeeById(selectedEmpId),
          fetchLeaveAssignments(selectedEmpId),
        ]);
        console.log('Fetched employee data:', employee);
        if (!employee.orgid) {
          console.error('Employee data missing orgid for empid:', selectedEmpId);
          setError('Employee data is missing organization ID.');
          return;
        }
        setEmployeeDetails(employee);
        setLeaveAssignments(leaveData);
        setSelectedRoles(employee.roleids || []);
        setFormData({
          empid: employee.empid || '',
          orgid: employee.orgid || orgid || '',
          empFstName: employee.EMP_FST_NAME || '',
          empMidName: employee.EMP_MID_NAME || '',
          empLastName: employee.EMP_LAST_NAME || '',
          empPrefName: employee.EMP_PREF_NAME || '',
          email: employee.email || '',
          roleid: employee.roleid || '',
          gender: employee.GENDER || '',
          mobileNumber: employee.MOBILE_NUMBER || '',
          phoneNumber: employee.PHONE_NUMBER || '',
          dob: employee.DOB ? new Date(employee.DOB).toISOString().split('T')[0] : '',
          hireDate: employee.HIRE ? new Date(employee.HIRE).toISOString().split('T')[0] : '',
          lastWorkDate: employee.LAST_WORK_DATE ? new Date(employee.LAST_WORK_DATE).toISOString().split('T')[0] : '',
          terminatedDate: employee.TERMINATED_DATE ? new Date(employee.TERMINATED_DATE).toISOString().split('T')[0] : '',
          rejoinDate: employee.REJOIN_DATE ? new Date(employee.REJOIN_DATE).toISOString().split('T')[0] : '',
          superior: employee.superior || '',
          ssn: employee.SSN || '',
          status: employee.STATUS || '',
          linkedinUrl: employee.LINKEDIN_URL || '',
          jobTitle: employee.JOB_TITLE || '',
          payFrequency: employee.PAY_FREQUENCY || '',
          deptId: employee.DEPT_ID !== null && employee.DEPT_ID !== undefined ? String(employee.DEPT_ID) : '',
          deptName: employee.DEPT_NAME || '',
          workCompClass: employee.WORK_COMP_CLASS || '',
          workAddrLine1: employee.WORK_ADDR_LINE1 || '',
          workAddrLine2: employee.WORK_ADDR_LINE2 || '',
          workAddrLine3: employee.WORK_ADDR_LINE3 || '',
          workCity: employee.WORK_CITY || '',
          workStateId: employee.WORK_STATE_ID ? String(employee.WORK_STATE_ID) : '',
          workStateNameCustom: employee.WORK_STATE_NAME_CUSTOM || '',
          workCountryId: employee.WORK_COUNTRY_ID ? String(employee.WORK_COUNTRY_ID) : '185',
          workPostalCode: employee.WORK_POSTAL_CODE || '',
          homeAddrLine1: employee.HOME_ADDR_LINE1 || '',
          homeAddrLine2: employee.HOME_ADDR_LINE2 || '',
          homeAddrLine3: employee.HOME_ADDR_LINE3 || '',
          homeCity: employee.HOME_CITY || '',
          homeStateId: employee.HOME_STATE_ID ? String(employee.HOME_STATE_ID) : '',
          homeStateNameCustom: employee.HOME_STATE_NAME_CUSTOM || '',
          homeCountryId: employee.HOME_COUNTRY_ID ? String(employee.HOME_COUNTRY_ID) : '185',
          homePostalCode: employee.HOME_POSTAL_CODE || '',
          emergCnctName: employee.EMERG_CNCT_NAME || '',
          emergCnctPhoneNumber: employee.EMERG_CNCT_PHONE_NUMBER || '',
          emergCnctEmail: employee.EMERG_CNCT_EMAIL || '',
          emergCnctAddrLine1: employee.EMERG_CNCT_ADDR_LINE1 || '',
          emergCnctAddrLine2: employee.EMERG_CNCT_ADDR_LINE2 || '',
          emergCnctAddrLine3: employee.EMERG_CNCT_ADDR_LINE3 || '',
          emergCnctCity: employee.EMERG_CNCT_CITY || '',
          emergCnctStateId: employee.EMERG_CNCT_STATE_ID ? String(employee.EMERG_CNCT_STATE_ID) : '',
          emergCnctStateNameCustom: employee.EMERG_CNCT_STATE_NAME_CUSTOM || '',
          emergCnctCountryId: employee.EMERG_CNCT_COUNTRY_ID ? String(employee.EMERG_CNCT_COUNTRY_ID) : '185',
          emergCnctPostalCode: employee.EMERG_CNCT_POSTAL_CODE || '',
        });
        setFormLeaves(leaveData);
        setError(null);
        console.log('Loaded employee details for empid:', selectedEmpId, 'deptId:', employee.DEPT_ID, 'deptName:', employee.DEPT_NAME, 'roleids:', employee.roleids);
      } catch (err) {
        console.error('Error loading employee details:', err);
        setError(err.message);
        setEmployeeDetails(null);
        setLeaveAssignments({});
        setSelectedRoles([]);
        setFormLeaves({});
      }
    };
    loadEmployeeDetails();
  }, [selectedEmpId, orgid]);

  const handleRowClick = (empid) => {
    setSelectedEmpId(empid);
    setEditingPersonal(false);
    setEditingEmployment(false);
    setEditingLeaves(false);
    setEditingWorkAddress(false);
    setEditingHomeAddress(false);
    setEditingEmergencyContact(false);
    setError(null);
    setisadd(false);
    console.log('Selected employee:', empid);
  };

  const handleBackClick = () => {
    router.refresh();
    setSelectedEmpId(null);
    setEditingPersonal(false);
    setEditingEmployment(false);
    setEditingLeaves(false);
    setEditingWorkAddress(false);
    setEditingHomeAddress(false);
    setEditingEmergencyContact(false);
    setSelectedRoles([]);
    setError(null);
    setisadd(false);
    router.refresh();
    console.log('Back to employee list');
  };

  const handleaddemployee = () => {
    setSelectedEmpId(null);
    setEditingPersonal(false);
    setEditingEmployment(false);
    setEditingLeaves(false);
    setEditingWorkAddress(false);
    setEditingHomeAddress(false);
    setEditingEmergencyContact(false);
    setSelectedRoles([]);
    setError(null);
    setisadd(true);
    console.log('Back to employee list');
  };

  const handleEdit = (section) => {
    if (section === 'personal') setEditingPersonal(true);
    if (section === 'employment') setEditingEmployment(true);
    if (section === 'leaves') setEditingLeaves(true);
    if (section === 'workAddress') setEditingWorkAddress(true);
    if (section === 'homeAddress') setEditingHomeAddress(true);
    if (section === 'emergencyContact') setEditingEmergencyContact(true);
    console.log(`Editing ${section} details`);
  };

  const ensureOrgId = async () => {
    if (!formData.orgid || formData.orgid === '') {
      console.log('orgid missing or empty, using prop orgid:', orgid);
      if (orgid) {
        setFormData(prev => ({ ...prev, orgid }));
        return orgid;
      }
      console.error('No orgid available in formData or props');
      return null;
    }
    return formData.orgid;
  };

  const handleSave = async (section) => {
    const orgid = await ensureOrgId();
    if (!orgid) {
      setError('Organization ID is missing or invalid.');
      console.error('Missing or invalid orgid in formData:', formData);
      return;
    }
    const formDataToSubmit = new FormData();
    formDataToSubmit.append('empid', formData.empid);
    formDataToSubmit.append('orgid', orgid);
    formDataToSubmit.append('section', section);

    if (section === 'personal') {
      if (!formData.empFstName.trim()) {
        setError('First Name is required.');
        return;
      }
      if (!formData.empLastName.trim()) {
        setError('Last Name is required.');
        return;
      }
      if (!formData.email.trim()) {
        setError('Email is required.');
        return;
      }
      formDataToSubmit.append('empFstName', formData.empFstName);
      formDataToSubmit.append('empMidName', formData.empMidName || '');
      formDataToSubmit.append('empLastName', formData.empLastName);
      formDataToSubmit.append('empPrefName', formData.empPrefName || '');
      formDataToSubmit.append('email', formData.email);
      formDataToSubmit.append('gender', formData.gender || '');
      formDataToSubmit.append('mobileNumber', formData.mobileNumber || '');
      formDataToSubmit.append('phoneNumber', formData.phoneNumber || '');
      formDataToSubmit.append('dob', formData.dob || '');
      formDataToSubmit.append('ssn', formData.ssn || '');
      formDataToSubmit.append('linkedinUrl', formData.linkedinUrl || '');
    } else if (section === 'employment') {
      if (selectedRoles.length === 0) {
        setError('At least one role is required.');
        return;
      }
      if (!formData.hireDate) {
        setError('Hire Date is required.');
        return;
      }
      if (!formData.status) {
        setError('Status is required.');
        return;
      }
      selectedRoles.forEach((roleid) => formDataToSubmit.append('roleids', roleid));
      formDataToSubmit.append('hireDate', formData.hireDate || '');
      formDataToSubmit.append('lastWorkDate', formData.lastWorkDate || '');
      formDataToSubmit.append('terminatedDate', formData.terminatedDate || '');
      formDataToSubmit.append('rejoinDate', formData.rejoinDate || '');
      formDataToSubmit.append('superior', formData.superior || '');
      formDataToSubmit.append('status', formData.status || '');
      formDataToSubmit.append('jobTitle', formData.jobTitle || '');
      formDataToSubmit.append('payFrequency', formData.payFrequency || '');
      formDataToSubmit.append('deptId', formData.deptId || '');
      formDataToSubmit.append('deptName', formData.deptName || '');
      formDataToSubmit.append('workCompClass', formData.workCompClass || '');
    } else if (section === 'leaves') {
      Object.entries(formLeaves).forEach(([leaveid, noofleaves]) => {
        if (noofleaves !== '' && noofleaves !== null && noofleaves !== undefined) {
          formDataToSubmit.append(`leaves[${leaveid}]`, noofleaves);
        }
      });
      if (Object.keys(formLeaves).length === 0) {
        setError('At least one leave assignment is required.');
        return;
      }
    } else if (section === 'workAddress') {
      formDataToSubmit.append('workAddrLine1', formData.workAddrLine1 || '');
      formDataToSubmit.append('workAddrLine2', formData.workAddrLine2 || '');
      formDataToSubmit.append('workAddrLine3', formData.workAddrLine3 || '');
      formDataToSubmit.append('workCity', formData.workCity || '');
      formDataToSubmit.append('workStateId', formData.workStateId || '');
      formDataToSubmit.append('workStateNameCustom', formData.workStateNameCustom || '');
      formDataToSubmit.append('workCountryId', formData.workCountryId || '');
      formDataToSubmit.append('workPostalCode', formData.workPostalCode || '');
    } else if (section === 'homeAddress') {
      formDataToSubmit.append('homeAddrLine1', formData.homeAddrLine1 || '');
      formDataToSubmit.append('homeAddrLine2', formData.homeAddrLine2 || '');
      formDataToSubmit.append('homeAddrLine3', formData.homeAddrLine3 || '');
      formDataToSubmit.append('homeCity', formData.homeCity || '');
      formDataToSubmit.append('homeStateId', formData.homeStateId || '');
      formDataToSubmit.append('homeStateNameCustom', formData.homeStateNameCustom || '');
      formDataToSubmit.append('homeCountryId', formData.homeCountryId || '');
      formDataToSubmit.append('homePostalCode', formData.homePostalCode || '');
    } else if (section === 'emergencyContact') {
      formDataToSubmit.append('emergCnctName', formData.emergCnctName || '');
      formDataToSubmit.append('emergCnctPhoneNumber', formData.emergCnctPhoneNumber || '');
      formDataToSubmit.append('emergCnctEmail', formData.emergCnctEmail || '');
      formDataToSubmit.append('emergCnctAddrLine1', formData.emergCnctAddrLine1 || '');
      formDataToSubmit.append('emergCnctAddrLine2', formData.emergCnctAddrLine2 || '');
      formDataToSubmit.append('emergCnctAddrLine3', formData.emergCnctAddrLine3 || '');
      formDataToSubmit.append('emergCnctCity', formData.emergCnctCity || '');
      formDataToSubmit.append('emergCnctStateId', formData.emergCnctStateId || '');
      formDataToSubmit.append('emergCnctStateNameCustom', formData.emergCnctStateNameCustom || '');
      formDataToSubmit.append('emergCnctCountryId', formData.emergCnctCountryId || '');
      formDataToSubmit.append('emergCnctPostalCode', formData.emergCnctPostalCode || '');
    }

    console.log(`${section} FormData:`, Object.fromEntries(formDataToSubmit));
    try {
      const result = await updateEmployee({}, formDataToSubmit);
      console.log('updateEmployee response:', result);
      if (result && typeof result === 'object' && result.success) {
        const updatedEmployee = await fetchEmployeeById(formData.empid);
        console.log('Updated employee data:', updatedEmployee);
        setEmployeeDetails(updatedEmployee);
        setLeaveAssignments(await fetchLeaveAssignments(formData.empid));
        setSelectedRoles(updatedEmployee.roleids || []);
        if (section === 'personal') setEditingPersonal(false);
        if (section === 'employment') setEditingEmployment(false);
        if (section === 'leaves') setEditingLeaves(false);
        if (section === 'workAddress') setEditingWorkAddress(false);
        if (section === 'homeAddress') setEditingHomeAddress(false);
        if (section === 'emergencyContact') setEditingEmergencyContact(false);
        setError(null);
        console.log(`${section} details saved successfully for empid:`, formData.empid);
      } else {
        const errorMessage = result && result.error ? result.error : 'Failed to save: Invalid response from server';
        setError(errorMessage);
        console.error('Error from server:', errorMessage);
      }
    } catch (err) {
      console.error(`Error saving ${section} details:`, err);
      setError(err.message || 'An unexpected error occurred while saving.');
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleLeaveChange = (leaveid, value) => {
    setFormLeaves(prev => ({ ...prev, [leaveid]: value }));
  };

  const getRoleNames = (roleids) => {
    if (!roleids || roleids.length === 0) return 'No Roles';
    return roleids
      .map((roleid) => roles.find((r) => r.roleid === roleid)?.rolename || 'Unknown Role')
      .join(', ');
  };

  const getSuperiorName = (superiorId) => {
    const superior = allEmployees.find(emp => emp.empid === superiorId);
    return superior ? `${superior.EMP_FST_NAME} ${superior.EMP_LAST_NAME || ''}`.trim() : 'No Superior';
  };

  const getStatusName = (statusId) => {
    const status = statuses.find(s => s.Name === statusId);
    return status ? status.Name : 'No Status';
  };

  const getJobTitleName = (jobTitle) => {
    const job = jobTitles.find(j => j.job_title_id === jobTitle);
    return job ? `${job.job_title} (Level: ${job.level || 'N/A'}, Salary Range: $${job.min_salary || 'N/A'} - $${job.max_salary || 'N/A'})` : 'No Job Title';
  };

  const getPayFrequencyName = (payFrequencyId) => {
    const freq = payFrequencies.find(f => f.Name === payFrequencyId);
    return freq ? freq.Name : 'No Pay Frequency';
  };

  const getDepartmentName = (deptId) => {
    if (!deptId) return formData.deptName || 'No Department';
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.name : (formData.deptName || 'No Department');
  };

  const getWorkerCompClassName = (classCode) => {
    const compClass = workerCompClasses.find(c => c.class_code === classCode);
    return compClass ? `${compClass.class_code} - ${compClass.phraseology}` : 'No Worker Comp Class';
  };

  const getCountryName = (countryId) => {
    const country = countries.find(c => c.ID === countryId);
    return country ? country.VALUE : 'No Country';
  };

  const getStateName = (stateId) => {
    const state = states.find(s => s.ID === stateId);
    return state ? state.VALUE : 'No State';
  };

  const getdisplayprojectid = (prjid) => {
    return prjid.split('_')[1] || prjid;
  };

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

const handleRoleToggle = (roleid) => {
  setSelectedRoles((prev) => {
    const newRoles = prev.includes(roleid)
      ? prev.filter((id) => id !== roleid)
      : [...prev, roleid];
    return [...new Set(newRoles)];
  });
};

  // Add employee form states
  const [addform_formError, addform_setFormError] = useState(null);
  const [addform_leaves, addform_setLeaves] = useState({});
  const [addform_workCountryId, addform_setWorkCountryId] = useState('185');
  const [addform_homeCountryId, addform_setHomeCountryId] = useState('185');
  const [addform_emergCnctCountryId, addform_setEmergCnctCountryId] = useState('185');
  const [addform_selectedRoles, addform_setSelectedRoles] = useState([]);
  const [addform_isDropdownOpen, addform_setIsDropdownOpen] = useState(false);
  const [addform_isSubmitting, addform_setIsSubmitting] = useState(false);
  const [addform_success, addform_setsuccess] = useState(null);
  const addform_today = new Date().toISOString().split('T')[0];

  const addform_handleRoleToggle = (roleid) => {
    addform_setSelectedRoles((prev) => {
      const newRoles = prev.includes(roleid)
        ? prev.filter((id) => id !== roleid)
        : [...prev, roleid];
      return [...new Set(newRoles)];
    });
  };

  const addform_toggleDropdown = () => {
    addform_setIsDropdownOpen((prev) => !prev);
  };

  const addform_handleSubmit = async (formData) => {
    if (addform_isSubmitting) return;
    addform_setIsSubmitting(true);

    formData.append('currentRole', currentrole || '');
    const addform_uniqueRoleIds = [...new Set(addform_selectedRoles)];
    addform_uniqueRoleIds.forEach((roleid) => {
      formData.append('roleids', roleid);
    });
    Object.entries(addform_leaves).forEach(([leaveid, noofleaves]) => {
      if (noofleaves !== '') formData.append(`leaves[${leaveid}]`, noofleaves || '0');
    });

    try {
      const addform_result = await addemployee(formData);
      if (addform_result?.error) {
        addform_setFormError(addform_result.error);
        setTimeout(() => addform_setFormError(null), 4000)
      } else {
        addform_setsuccess("Employee added Successfully!");
        setTimeout(() => addform_setsuccess(null), 4000);
      }
    } catch (error) {
      addform_setFormError(`Submission failed: ${error.message}`);
      setTimeout(() => addform_setsuccess(null), 4000);
    } finally {
      addform_setIsSubmitting(false);
    }
  };

  const addform_handleLeaveChange = (leaveid, value) => {
    addform_setLeaves((prev) => ({ ...prev, [leaveid]: value }));
  };

  const addform_employeesWithRoles = employees.map((employee) => {
    const role = roles.find((r) => r.roleid === employee.roleid);
    const rolename = role ? role.rolename : 'Unknown Role';
    return { ...employee, rolename };
  });

  // Sorting functions
  const sortEmployees = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'empid':
        aValue = parseInt(a.empid.split('_')[1] || a.empid);
        bValue = parseInt(b.empid.split('_')[1] || b.empid);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'name':
        aValue = (a.EMP_PREF_NAME || `${a.EMP_FST_NAME} ${a.EMP_MID_NAME || ''} ${a.EMP_LAST_NAME}`.trim()).toLowerCase();
        bValue = (b.EMP_PREF_NAME || `${b.EMP_FST_NAME} ${b.EMP_MID_NAME || ''} ${b.EMP_LAST_NAME}`.trim()).toLowerCase();
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'hireDate':
        aValue = a.HIRE ? new Date(a.HIRE).getTime() : 0;
        bValue = b.HIRE ? new Date(b.HIRE).getTime() : 0;
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'gender':
        aValue = a.GENDER || '';
        bValue = b.GENDER || '';
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

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleGenderFilterChange = (e) => {
    setGenderFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleEmployeesPerPageInputChange = (e) => {
    setEmployeesPerPageInput(e.target.value);
  };

  const handleEmployeesPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setEmployeesPerPage(value);
        setEmployeesPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setEmployeesPerPageInput(employeesPerPage.toString());
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

  const uniqueGenders = [...new Set(allEmployees.map(emp => emp.GENDER).filter(Boolean))];
    const uniqueStatus = [...new Set(allEmployees.map(emp => emp.STATUS).filter(Boolean))];

  const filteredEmployees = allEmployees.filter(emp => {
    const fullName = (emp.EMP_PREF_NAME || `${emp.EMP_FST_NAME} ${emp.EMP_MID_NAME || ''} ${emp.EMP_LAST_NAME}`.trim()).toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || emp.empid.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = genderFilter === 'all' || emp.STATUS === genderFilter;
    return matchesSearch && matchesGender;
  });

  const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage);
  const indexOfLastEmployee = currentPage * employeesPerPage;
  const indexOfFirstEmployee = indexOfLastEmployee - employeesPerPage;
  const currentEmployees = filteredEmployees.slice(indexOfFirstEmployee, indexOfLastEmployee);

  return (
    <div className="roles-overview-container">
      {error && <div className="error-message">{error}</div>}
      
      {issadd && (
        <div className="add-role-container">
          <div className="header-section">
            <h1 className="title">Add Employee</h1>
            <button className="back-button" onClick={handleBackClick}></button>
          </div>
          
          {addform_formError && <p className="error-message">{addform_formError}</p>}
          {addform_success && <p className="success-message">{addform_success}</p>}
          
          <form action={addform_handleSubmit} >
            <div className="form-section">
              {/* Personal Details */}
              <div className="role-details-block93">
                <h3>Personal Details</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="orgid">Organization ID:</label>
                    <input
                      type="text"
                      id="orgid"
                      name="orgid"
                      value={orgid || ''}
                      className="bg-gray-100"
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="empFstName">First Name: *</label>
                    <input
                      type="text"
                      id="empFstName"
                      name="empFstName"
                      placeholder="Enter First Name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="empMidName">Middle Name:</label>
                    <input
                      type="text"
                      id="empMidName"
                      name="empMidName"
                      placeholder="Enter Middle Name"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="empLastName">Last Name: *</label>
                    <input
                      type="text"
                      id="empLastName"
                      name="empLastName"
                      placeholder="Enter Last Name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email: *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="Enter Email"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="empPrefName">Preferred Name:</label>
                    <input
                      type="text"
                      id="empPrefName"
                      name="empPrefName"
                      placeholder="Enter Preferred Name"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="gender">Gender:</label>
                    <select id="gender" name="gender">
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="mobileNumber">Mobile Number:</label>
                    <input
                      type="tel"
                      id="mobileNumber"
                      name="mobileNumber"
                      placeholder="Enter Mobile Number"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phoneNumber">Phone Number:</label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      placeholder="Enter Phone Number"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="dob">Date of Birth:</label>
                    <input
                      type="date"
                      id="dob"
                      name="dob"
                      className="date-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ssn">SSN:</label>
                    <input
                      type="text"
                      id="ssn"
                      name="ssn"
                      placeholder="Enter SSN"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="linkedinUrl">LinkedIn URL:</label>
                    <input
                      type="url"
                      id="linkedinUrl"
                      name="linkedinUrl"
                      placeholder="Enter LinkedIn URL"
                    />
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="role-details-block93">
                <h3>Employment Details</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="roleids">Roles: * (Click to select/deselect)</label>
                    <div className="custom-select-container">
                      <div
                        className={`custom-select ${addform_isDropdownOpen ? 'open' : ''}`}
                        onClick={addform_toggleDropdown}
                      >
                        <div className="selected-value">
                          {addform_selectedRoles.length > 0
                            ? addform_selectedRoles
                                .map((id) => roles.find((r) => r.roleid === id)?.rolename)
                                .join(', ')
                            : 'Select Roles'}
                        </div>
                        {addform_isDropdownOpen && (
                          <div className="options-container">
                            {roles.map((role) => (
                              <div
                                key={role.roleid}
                                className={`option ${addform_selectedRoles.includes(role.roleid) ? 'selected' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addform_handleRoleToggle(role.roleid);
                                }}
                              >
                                {role.rolename}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {addform_selectedRoles.length === 0 && (
                        <input type="hidden" name="roleids" value="" disabled />
                      )}
                      {addform_selectedRoles.map((roleid) => (
                        <input key={roleid} type="hidden" name="roleids" value={roleid} />
                      ))}
                    </div>
                    {addform_selectedRoles.length > 0 && (
                      <div className="selected-roles">
                        <p>Selected Roles: {addform_selectedRoles.map((id) => roles.find((r) => r.roleid === id)?.rolename).join(', ')}</p>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="superior">Superior:</label>
                    <select id="superior" name="superior">
                      <option value="">Select a Superior (Optional)</option>
                      {addform_employeesWithRoles.map((employee) => (
                        <option key={employee.empid} value={employee.empid}>
                          {`${employee.empid} - ${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="hireDate">Hire Date: *</label>
                    <input
                      type="date"
                      id="hireDate"
                      name="hireDate"
                      defaultValue={addform_today}
                      className="date-input"
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="status">Status: *</label>
                    <select id="status" name="status" required>
                      {statuses.map((status) => (
                        <option key={status.id} value={status.Name}>
                          {status.Name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="jobTitle">Job Title:</label>
                    <select id="jobTitle" name="jobTitle">
                      <option value="">Select Job Title</option>
                      {jobTitles.map((job) => (
                        <option key={job.job_title_id} value={job.job_title_id}>
                          {`${job.job_title} (Level: ${job.level || 'N/A'}, Salary Range: ${job.min_salary || 'N/A'} - ${job.max_salary || 'N/A'})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="payFrequency">Pay Frequency:</label>
                    <select id="payFrequency" name="payFrequency">
                      <option value="">Select Pay Frequency</option>
                      {payFrequencies.map((freq) => (
                        <option key={freq.id} value={freq.Name}>
                          {freq.Name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="deptId">Department:</label>
                    <select id="deptId" name="deptId">
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="workCompClass">Work Compensation Class:</label>
                    <select id="workCompClass" name="workCompClass">
                      <option value="">Select Work Compensation Class</option>
                      {workerCompClasses.map((compClass) => (
                        <option key={compClass.class_code} value={compClass.class_code}>
                          {`${compClass.class_code} - ${compClass.phraseology}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Work Address */}
              <div className="role-details-block93">
                <h3>Work Address</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="workAddrLine1">Address Line 1:</label>
                    <input
                      type="text"
                      id="workAddrLine1"
                      name="workAddrLine1"
                      placeholder="Enter Work Address Line 1"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="workAddrLine2">Address Line 2:</label>
                    <input
                      type="text"
                      id="workAddrLine2"
                      name="workAddrLine2"
                      placeholder="Enter Work Address Line 2"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="workAddrLine3">Address Line 3:</label>
                    <input
                      type="text"
                      id="workAddrLine3"
                      name="workAddrLine3"
                      placeholder="Enter Work Address Line 3"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="workCity">City:</label>
                    <input
                      type="text"
                      id="workCity"
                      name="workCity"
                      placeholder="Enter Work City"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="workStateId">State:</label>
                    <select
                      id="workStateId"
                      name="workStateId"
                      disabled={addform_workCountryId !== '185'}
                    >
                      <option value="">Select State</option>
                      {states.map((state) => (
                        <option key={state.ID} value={state.ID}>
                          {state.VALUE}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="workStateNameCustom">Custom State Name:</label>
                    <input
                      type="text"
                      id="workStateNameCustom"
                      name="workStateNameCustom"
                      placeholder="Enter Custom State Name"
                      disabled={addform_workCountryId === '185'}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="workCountryId">Country:</label>
                    <select
                      id="workCountryId"
                      name="workCountryId"
                      value={addform_workCountryId}
                      onChange={(e) => addform_setWorkCountryId(e.target.value)}
                    >
                      <option value="">Select Country</option>
                      {countries.map((country) => (
                        <option key={country.ID} value={country.ID}>
                          {country.VALUE}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="workPostalCode">Postal Code:</label>
                    <input
                      type="text"
                      id="workPostalCode"
                      name="workPostalCode"
                      placeholder="Enter Work Postal Code"
                    />
                  </div>
                </div>
              </div>

              {/* Home Address */}
              <div className="role-details-block93">
                <h3>Home Address</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="homeAddrLine1">Address Line 1:</label>
                    <input
                      type="text"
                      id="homeAddrLine1"
                      name="homeAddrLine1"
                      placeholder="Enter Home Address Line 1"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="homeAddrLine2">Address Line 2:</label>
                    <input
                      type="text"
                      id="homeAddrLine2"
                      name="homeAddrLine2"
                      placeholder="Enter Home Address Line 2"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="homeAddrLine3">Address Line 3:</label>
                    <input
                      type="text"
                      id="homeAddrLine3"
                      name="homeAddrLine3"
                      placeholder="Enter Home Address Line 3"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="homeCity">City:</label>
                    <input
                      type="text"
                      id="homeCity"
                      name="homeCity"
                      placeholder="Enter Home City"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="homeStateId">State:</label>
                    <select
                      id="homeStateId"
                      name="homeStateId"
                      disabled={addform_homeCountryId !== '185'}
                    >
                      <option value="">Select State</option>
                      {states.map((state) => (
                        <option key={state.ID} value={state.ID}>
                          {state.VALUE}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="homeStateNameCustom">Custom State Name:</label>
                    <input
                      type="text"
                      id="homeStateNameCustom"
                      name="homeStateNameCustom"
                      placeholder="Enter Custom State Name"
                      disabled={addform_homeCountryId === '185'}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="homeCountryId">Country:</label>
                    <select
                      id="homeCountryId"
                      name="homeCountryId"
                      value={addform_homeCountryId}
                      onChange={(e) => addform_setHomeCountryId(e.target.value)}
                    >
                      <option value="">Select Country</option>
                      {countries.map((country) => (
                        <option key={country.ID} value={country.ID}>
                          {country.VALUE}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="homePostalCode">Postal Code:</label>
                    <input
                      type="text"
                      id="homePostalCode"
                      name="homePostalCode"
                      placeholder="Enter Home Postal Code"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="role-details-block93">
                <h3>Emergency Contact</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="emergCnctName">Name:</label>
                    <input
                      type="text"
                      id="emergCnctName"
                      name="emergCnctName"
                      placeholder="Enter Emergency Contact Name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="emergCnctPhoneNumber">Phone Number:</label>
                    <input
                      type="tel"
                      id="emergCnctPhoneNumber"
                      name="emergCnctPhoneNumber"
                      placeholder="Enter Emergency Contact Phone Number"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="emergCnctEmail">Email:</label>
                    <input
                      type="email"
                      id="emergCnctEmail"
                      name="emergCnctEmail"
                      placeholder="Enter Emergency Contact Email"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="emergCnctAddrLine1">Address Line 1:</label>
                    <input
                      type="text"
                      id="emergCnctAddrLine1"
                      name="emergCnctAddrLine1"
                      placeholder="Enter Emergency Contact Address Line 1"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="emergCnctAddrLine2">Address Line 2:</label>
                    <input
                      type="text"
                      id="emergCnctAddrLine2"
                      name="emergCnctAddrLine2"
                      placeholder="Enter Emergency Contact Address Line 2"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="emergCnctAddrLine3">Address Line 3:</label>
                    <input
                      type="text"
                      id="emergCnctAddrLine3"
                      name="emergCnctAddrLine3"
                      placeholder="Enter Emergency Contact Address Line 3"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="emergCnctCity">City:</label>
                    <input
                      type="text"
                      id="emergCnctCity"
                      name="emergCnctCity"
                      placeholder="Enter Emergency Contact City"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="emergCnctStateId">State:</label>
                    <select
                      id="emergCnctStateId"
                      name="emergCnctStateId"
                      disabled={addform_emergCnctCountryId !== '185'}
                    >
                      <option value="">Select State</option>
                      {states.map((state) => (
                        <option key={state.ID} value={state.ID}>
                          {state.VALUE}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="emergCnctStateNameCustom">Custom State Name:</label>
                    <input
                      type="text"
                      id="emergCnctStateNameCustom"
                      name="emergCnctStateNameCustom"
                      placeholder="Enter Custom State Name"
                      disabled={addform_emergCnctCountryId === '185'}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="emergCnctCountryId">Country:</label>
                    <select
                      id="emergCnctCountryId"
                      name="emergCnctCountryId"
                      value={addform_emergCnctCountryId}
                      onChange={(e) => addform_setEmergCnctCountryId(e.target.value)}
                    >
                      <option value="">Select Country</option>
                      {countries.map((country) => (
                        <option key={country.ID} value={country.ID}>
                          {country.VALUE}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="emergCnctPostalCode">Postal Code:</label>
                    <input
                      type="text"
                      id="emergCnctPostalCode"
                      name="emergCnctPostalCode"
                      placeholder="Enter Emergency Contact Postal Code"
                    />
                  </div>
                </div>
              </div>

              {/* Leaves */}
              <div className="role-details-block93">
                <h3>Leaves</h3>
                <div className="leaves-container">
                  {leaveTypes.map((leave) => (
                    <div key={leave.id} className="form-group">
                      <label htmlFor={`noofleaves_${leave.id}`}>{leave.Name} (Number of Leaves):</label>
                      <input
                        type="number"
                        id={`noofleaves_${leave.id}`}
                        name={`noofleaves_${leave.id}`}
                        value={addform_leaves[leave.id] || ''}
                        onChange={(e) => addform_handleLeaveChange(leave.id, e.target.value)}
                        min="0"
                        step="any"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Section */}
              <div className="submit-section">
                <button 
                  type="submit" 
                  className={`button save ${addform_isSubmitting ? 'disabled' : ''}`}
                  disabled={addform_isSubmitting}
                >
                  {addform_isSubmitting ? 'Submitting...' : 'Add Employee'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      
      {!issadd && !selectedEmpId ? (
        <div className="roles-list">
          <div className="header-section">
            <h2 className="title">Employees</h2>
            <button className="button save" onClick={handleaddemployee}>Add Employee</button>
          </div>
          
          <div className="search-filter-container">
            <input
              type="text"
              placeholder="Search by Name or Emp ID"
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
            <select
              value={genderFilter}
              onChange={handleGenderFilterChange}
              className="filter-select"
            >
              <option value="all">Status</option>
              {uniqueStatus.map((gender) => (
                <option key={gender} value={gender}>{gender}</option>
              ))}
            </select>
          </div>
          
          {employees.length === 0 && !error ? (
            <div className="empty-state">
              <p>No active employees found.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="six-column">
                <colgroup>
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th 
                      className={`sortable ${sortConfig.column === 'empid' ? `sort-${sortConfig.direction}` : ''}`}
                      onClick={() => requestSort('empid')}
                    >
                      Employee ID
                    </th>
                    <th 
                      className={`sortable ${sortConfig.column === 'name' ? `sort-${sortConfig.direction}` : ''}`}
                      onClick={() => requestSort('name')}
                    >
                      Name
                    </th>
                    <th>Email</th>
                    <th 
                      className={`sortable ${sortConfig.column === 'hireDate' ? `sort-${sortConfig.direction}` : ''}`}
                      onClick={() => requestSort('hireDate')}
                    >
                      Hire Date
                    </th>
                    <th>Mobile</th>
                    <th>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentEmployees.map((employee) => (
                    <tr
                      key={employee.empid}
                      onClick={() => handleRowClick(employee.empid)}
                      className={selectedEmpId === employee.empid ? 'selected-row' : ''}
                    >
                      <td className="id-cell">
                        <span className={employee.STATUS.toLowerCase() === 'active' ? 'role-indicator' : 'role-indicatorinactive '}></span>
                        Employee-{getdisplayprojectid(employee.empid)}
                      </td>
                      <td>{employee.EMP_PREF_NAME || `${employee.EMP_FST_NAME} ${employee.EMP_MID_NAME || ''} ${employee.EMP_LAST_NAME}`.trim()}</td>
                      <td>{employee.email}</td>
                      <td>{employee.HIRE ? new Date(employee.HIRE).toLocaleDateString('en-US') : '-'}</td>
                      <td>{employee.MOBILE_NUMBER || '-'}</td>
                      <td>
                        {/* {employee.STATUS || '-'} */}
                        {employee.STATUS && (
                          <span className={`status-badge ${employee.STATUS.toLowerCase() === 'active' ? 'active' : 'inactive'}`}>
                            {employee.STATUS}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {filteredEmployees.length > employeesPerPage && (
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
            <label className="rows-per-page-label">Rows per Page:</label>
            <input
              type="text"
              value={employeesPerPageInput}
              onChange={handleEmployeesPerPageInputChange}
              onKeyPress={handleEmployeesPerPageInputKeyPress}
              placeholder="Employees per page"
              className="rows-per-page-input"
              aria-label="Number of rows per page"
            />
          </div>
        </div>
      ) : !issadd && (
        employeeDetails && (
          <div className="role-details-container">
            <div className="roledetails-header">
              <h2 className="title">Employee Details</h2>
              <button className="back-button" onClick={handleBackClick}></button>
            </div>

            {/* Personal Details Section */}
            <div className="role-details-block96">
              <h3>Personal Details</h3>
              {editingPersonal && canEditEmployees ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('personal'); }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name*</label>
                      <input type="text" name="empFstName" value={formData.empFstName} onChange={handleFormChange} required />
                    </div>
                    <div className="form-group">
                      <label>Middle Name</label>
                      <input type="text" name="empMidName" value={formData.empMidName} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Last Name*</label>
                      <input type="text" name="empLastName" value={formData.empLastName} onChange={handleFormChange} required />
                    </div>
                    <div className="form-group">
                      <label>Preferred Name</label>
                      <input type="text" name="empPrefName" value={formData.empPrefName} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email*</label>
                      <input type="email" name="email" value={formData.email} onChange={handleFormChange} required />
                    </div>
                    <div className="form-group">
                      <label>Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleFormChange}>
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Mobile Number</label>
                      <input type="text" name="mobileNumber" value={formData.mobileNumber} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Phone Number</label>
                      <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input type="date" name="dob" value={formData.dob} onChange={handleFormChange} className="date-input" />
                    </div>
                    <div className="form-group">
                      <label>SSN</label>
                      <input type="text" name="ssn" value={formData.ssn} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>LinkedIn URL</label>
                      <input type="url" name="linkedinUrl" value={formData.linkedinUrl} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button type="submit" className="save">Save</button>
                    <button type="button" className="cancel" onClick={() => setEditingPersonal(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-g">
                      <label>Employee ID</label>
                      <p>Employee-{getdisplayprojectid(employeeDetails.empid)}</p>
                    </div>
                    <div className="details-g">
                      <label>Organization ID</label>
                      <p>{employeeDetails.orgid}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>First Name</label>
                      <p>{employeeDetails.EMP_FST_NAME}</p>
                    </div>
                    <div className="details-g">
                      <label>Middle Name</label>
                      <p>{employeeDetails.EMP_MID_NAME || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Last Name</label>
                      <p>{employeeDetails.EMP_LAST_NAME}</p>
                    </div>
                    <div className="details-g">
                      <label>Preferred Name</label>
                      <p>{employeeDetails.EMP_PREF_NAME || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Email</label>
                      <p>{employeeDetails.email}</p>
                    </div>
                    <div className="details-g">
                      <label>Gender</label>
                      <p>{employeeDetails.GENDER || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Mobile Number</label>
                      <p>{employeeDetails.MOBILE_NUMBER || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Phone Number</label>
                      <p>{employeeDetails.PHONE_NUMBER || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Date of Birth</label>
                      <p>{employeeDetails.DOB ? new Date(employeeDetails.DOB).toLocaleDateString('en-US') : '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>SSN</label>
                      <p>{employeeDetails.SSN || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>LinkedIn URL</label>
                      <p>{employeeDetails.LINKEDIN_URL || '-'}</p>
                    </div>
                  </div>
                  {canEditEmployees && (
                   
                      <button className="button" onClick={() => handleEdit('personal')}>Edit</button>
                    
                  )}
                </div>
              )}
            </div>

            {/* Employment Details Section */}
            <div className="role-details-block96">
              <h3>Employment Details</h3>
              {editingEmployment && canEditEmployees ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('employment'); }}>
                  <div className="form-row">
                    {/* <div className="form-group">
                      <label>Roles*</label>
                      <MultiSelectRoles
                        selectedRoles={selectedRoles}
                        setSelectedRoles={setSelectedRoles}
                        roles={roles}
                        disabled={false}
                      />
                    </div> */}
                    <div className="form-group">
  <label htmlFor="roleids">Roles: * (Click to select/deselect)</label>
  <div className="custom-select-container">
    <div
      className={`custom-select ${isDropdownOpen ? 'open' : ''}`}
      onClick={() => setIsDropdownOpen(prev => !prev)}
    >
      <div className="selected-value">
        {selectedRoles.length > 0
          ? selectedRoles
              .map((id) => roles.find((r) => r.roleid === id)?.rolename)
              .join(', ')
          : 'Select Roles'}
      </div>
      {isDropdownOpen && (
        <div className="options-container">
          {roles.map((role) => (
            <div
              key={role.roleid}
              className={`option ${selectedRoles.includes(role.roleid) ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleRoleToggle(role.roleid);
              }}
            >
              {role.rolename}
            </div>
          ))}
        </div>
      )}
    </div>
    {selectedRoles.length === 0 && (
      <input type="hidden" name="roleids" value="" disabled />
    )}
    {selectedRoles.map((roleid) => (
      <input key={roleid} type="hidden" name="roleids" value={roleid} />
    ))}
  </div>
  {/* {selectedRoles.length > 0 && (
    <div className="selected-roles">
      <p>Selected Roles: {selectedRoles.map((id) => roles.find((r) => r.roleid === id)?.rolename).join(', ')}</p>
    </div>
  )} */}
</div>
                    <div className="form-group">
                      <label>Hire Date*</label>
                      <input type="date" name="hireDate" value={formData.hireDate} onChange={handleFormChange} className="date-input" required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Status*</label>
                      <select name="status" value={formData.status} onChange={handleFormChange} required>
                        <option value="">Select Status</option>
                        {statuses.map((status) => (
                          <option key={status.id} value={status.Name}>
                            {status.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Job Title</label>
                      <select name="jobTitle" value={formData.jobTitle} onChange={handleFormChange}>
                        <option value="">Select Job Title</option>
                        {jobTitles.map((job) => (
                          <option key={job.job_title_id} value={job.job_title_id}>
                            {`${job.job_title} (Level: ${job.level || 'N/A'}, Salary Range: ${job.min_salary || 'N/A'} - ${job.max_salary || 'N/A'})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Pay Frequency</label>
                      <select name="payFrequency" value={formData.payFrequency} onChange={handleFormChange}>
                        <option value="">Select Pay Frequency</option>
                        {payFrequencies.map((freq) => (
                          <option key={freq.id} value={freq.Name}>
                            {freq.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Department</label>
                      <select name="deptId" value={formData.deptId} onChange={handleFormChange}>
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Work Compensation Class</label>
                      <select name="workCompClass" value={formData.workCompClass} onChange={handleFormChange}>
                        <option value="">Select Work Compensation Class</option>
                        {workerCompClasses.map((compClass) => (
                          <option key={compClass.class_code} value={compClass.class_code}>
                            {`${compClass.class_code} - ${compClass.phraseology}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Superior</label>
                      <select name="superior" value={formData.superior} onChange={handleFormChange}>
                        <option value="">Select a Superior (Optional)</option>
                        {allEmployees
                          .filter(emp => emp.empid !== formData.empid)
                          .map((employee) => (
                            <option key={employee.empid} value={employee.empid}>
                              {`${employee.empid} - ${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME} (${getRoleNames(employee.roleids || [employee.roleid])})`}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Last Work Date</label>
                      <input type="date" name="lastWorkDate" value={formData.lastWorkDate} onChange={handleFormChange} className="date-input" />
                    </div>
                    <div className="form-group">
                      <label>Terminated Date</label>
                      <input type="date" name="terminatedDate" value={formData.terminatedDate} onChange={handleFormChange} className="date-input" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Rejoin Date</label>
                      <input type="date" name="rejoinDate" value={formData.rejoinDate} onChange={handleFormChange} className="date-input" />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button type="submit" className="save">Save</button>
                    <button type="button" className="cancel" onClick={() => setEditingEmployment(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-g">
                      <label>Roles</label>
                      <p>{getRoleNames(employeeDetails.roleids)}</p>
                    </div>
                    <div className="details-g">
                      <label>Hire Date</label>
                      <p>{employeeDetails.HIRE ? new Date(employeeDetails.HIRE).toLocaleDateString('en-US') : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Status</label>
                      <p>{getStatusName(employeeDetails.STATUS)}</p>
                    </div>
                    <div className="details-g">
                      <label>Job Title</label>
                      <p>{getJobTitleName(employeeDetails.JOB_TITLE)}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Pay Frequency</label>
                      <p>{getPayFrequencyName(employeeDetails.PAY_FREQUENCY)}</p>
                    </div>
                    <div className="details-g">
                      <label>Department</label>
                      <p>{getDepartmentName(employeeDetails.DEPT_ID)}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Work Compensation Class</label>
                      <p>{getWorkerCompClassName(employeeDetails.WORK_COMP_CLASS)}</p>
                    </div>
                    <div className="details-g">
                      <label>Superior</label>
                      <p>{getSuperiorName(employeeDetails.superior)}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Last Work Date</label>
                      <p>{employeeDetails.LAST_WORK_DATE ? new Date(employeeDetails.LAST_WORK_DATE).toLocaleDateString('en-US') : '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Terminated Date</label>
                      <p>{employeeDetails.TERMINATED_DATE ? new Date(employeeDetails.TERMINATED_DATE).toLocaleDateString('en-US') : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Rejoin Date</label>
                      <p>{employeeDetails.REJOIN_DATE ? new Date(employeeDetails.REJOIN_DATE).toLocaleDateString('en-US') : '-'}</p>
                    </div>
                  </div>
                  {canEditEmployees && (
                    
                      <button className="button" onClick={() => handleEdit('employment')}>Edit</button>
                    
                  )}
                </div>
              )}
            </div>

            {/* Work Address Section */}
            <div className="role-details-block96">
              <h3>Work Address</h3>
              {editingWorkAddress && canEditEmployees ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('workAddress'); }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 1</label>
                      <input type="text" name="workAddrLine1" value={formData.workAddrLine1} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Address Line 2</label>
                      <input type="text" name="workAddrLine2" value={formData.workAddrLine2} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 3</label>
                      <input type="text" name="workAddrLine3" value={formData.workAddrLine3} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>City</label>
                      <input type="text" name="workCity" value={formData.workCity} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Country</label>
                      <select name="workCountryId" value={formData.workCountryId} onChange={handleFormChange}>
                        <option value="">Select Country</option>
                        {countries.map((country) => (
                          <option key={country.ID} value={country.ID}>
                            {country.VALUE}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <select name="workStateId" value={formData.workStateId} onChange={handleFormChange} disabled={formData.workCountryId !== '185'}>
                        <option value="">Select State</option>
                        {states.map((state) => (
                          <option key={state.ID} value={state.ID}>
                            {state.VALUE}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Custom State Name</label>
                      <input type="text" name="workStateNameCustom" value={formData.workStateNameCustom} onChange={handleFormChange} disabled={formData.workCountryId === '185'} />
                    </div>
                    <div className="form-group">
                      <label>Postal Code</label>
                      <input type="text" name="workPostalCode" value={formData.workPostalCode} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button type="submit" className="save">Save</button>
                    <button type="button" className="cancel" onClick={() => setEditingWorkAddress(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-g">
                      <label>Address Line 1</label>
                      <p>{employeeDetails.WORK_ADDR_LINE1 || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Address Line 2</label>
                      <p>{employeeDetails.WORK_ADDR_LINE2 || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Address Line 3</label>
                      <p>{employeeDetails.WORK_ADDR_LINE3 || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>City</label>
                      <p>{employeeDetails.WORK_CITY || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Country</label>
                      <p>{getCountryName(employeeDetails.WORK_COUNTRY_ID)}</p>
                    </div>
                    <div className="details-g">
                      <label>State</label>
                      <p>{employeeDetails.WORK_STATE_ID ? getStateName(employeeDetails.WORK_STATE_ID) : employeeDetails.WORK_STATE_NAME_CUSTOM || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Postal Code</label>
                      <p>{employeeDetails.WORK_POSTAL_CODE || '-'}</p>
                    </div>
                  </div>
                  {canEditEmployees && (
                   
                      <button className="button" onClick={() => handleEdit('workAddress')}>Edit</button>
                   
                  )}
                </div>
              )}
            </div>

            {/* Home Address Section */}
            <div className="role-details-block96">
              <h3>Home Address</h3>
              {editingHomeAddress && canEditEmployees ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('homeAddress'); }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 1</label>
                      <input type="text" name="homeAddrLine1" value={formData.homeAddrLine1} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Address Line 2</label>
                      <input type="text" name="homeAddrLine2" value={formData.homeAddrLine2} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 3</label>
                      <input type="text" name="homeAddrLine3" value={formData.homeAddrLine3} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>City</label>
                      <input type="text" name="homeCity" value={formData.homeCity} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Country</label>
                      <select name="homeCountryId" value={formData.homeCountryId} onChange={handleFormChange}>
                        <option value="">Select Country</option>
                        {countries.map((country) => (
                          <option key={country.ID} value={country.ID}>
                            {country.VALUE}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <select name="homeStateId" value={formData.homeStateId} onChange={handleFormChange} disabled={formData.homeCountryId !== '185'}>
                        <option value="">Select State</option>
                        {states.map((state) => (
                          <option key={state.ID} value={state.ID}>
                            {state.VALUE}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Custom State Name</label>
                      <input type="text" name="homeStateNameCustom" value={formData.homeStateNameCustom} onChange={handleFormChange} disabled={formData.homeCountryId === '185'} />
                    </div>
                    <div className="form-group">
                      <label>Postal Code</label>
                      <input type="text" name="homePostalCode" value={formData.homePostalCode} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button type="submit" className="save">Save</button>
                    <button type="button" className="cancel" onClick={() => setEditingHomeAddress(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-g">
                      <label>Address Line 1</label>
                      <p>{employeeDetails.HOME_ADDR_LINE1 || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Address Line 2</label>
                      <p>{employeeDetails.HOME_ADDR_LINE2 || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Address Line 3</label>
                      <p>{employeeDetails.HOME_ADDR_LINE3 || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>City</label>
                      <p>{employeeDetails.HOME_CITY || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Country</label>
                      <p>{getCountryName(employeeDetails.HOME_COUNTRY_ID)}</p>
                    </div>
                    <div className="details-g">
                      <label>State</label>
                      <p>{employeeDetails.HOME_STATE_ID ? getStateName(employeeDetails.HOME_STATE_ID) : employeeDetails.HOME_STATE_NAME_CUSTOM || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Postal Code</label>
                      <p>{employeeDetails.HOME_POSTAL_CODE || '-'}</p>
                    </div>
                  </div>
                  {canEditEmployees && (
                    
                      <button className="button" onClick={() => handleEdit('homeAddress')}>Edit</button>
                  
                  )}
                </div>
              )}
            </div>

            {/* Emergency Contact Section */}
            <div className="role-details-block96">
              <h3>Emergency Contact</h3>
              {editingEmergencyContact && canEditEmployees ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('emergencyContact'); }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Name</label>
                      <input type="text" name="emergCnctName" value={formData.emergCnctName} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Phone Number</label>
                      <input type="text" name="emergCnctPhoneNumber" value={formData.emergCnctPhoneNumber} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email</label>
                      <input type="email" name="emergCnctEmail" value={formData.emergCnctEmail} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Address Line 1</label>
                      <input type="text" name="emergCnctAddrLine1" value={formData.emergCnctAddrLine1} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Address Line 2</label>
                      <input type="text" name="emergCnctAddrLine2" value={formData.emergCnctAddrLine2} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Address Line 3</label>
                      <input type="text" name="emergCnctAddrLine3" value={formData.emergCnctAddrLine3} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>City</label>
                      <input type="text" name="emergCnctCity" value={formData.emergCnctCity} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Country</label>
                      <select name="emergCnctCountryId" value={formData.emergCnctCountryId} onChange={handleFormChange}>
                        <option value="">Select Country</option>
                        {countries.map((country) => (
                          <option key={country.ID} value={country.ID}>
                            {country.VALUE}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>State</label>
                      <select name="emergCnctStateId" value={formData.emergCnctStateId} onChange={handleFormChange} disabled={formData.emergCnctCountryId !== '185'}>
                        <option value="">Select State</option>
                        {states.map((state) => (
                          <option key={state.ID} value={state.ID}>
                            {state.VALUE}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Custom State Name</label>
                      <input type="text" name="emergCnctStateNameCustom" value={formData.emergCnctStateNameCustom} onChange={handleFormChange} disabled={formData.emergCnctCountryId === '185'} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Postal Code</label>
                      <input type="text" name="emergCnctPostalCode" value={formData.emergCnctPostalCode} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button type="submit" className="save">Save</button>
                    <button type="button" className="cancel" onClick={() => setEditingEmergencyContact(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-g">
                      <label>Name</label>
                      <p>{employeeDetails.EMERG_CNCT_NAME || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Phone Number</label>
                      <p>{employeeDetails.EMERG_CNCT_PHONE_NUMBER || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Email</label>
                      <p>{employeeDetails.EMERG_CNCT_EMAIL || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Address Line 1</label>
                      <p>{employeeDetails.EMERG_CNCT_ADDR_LINE1 || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>Address Line 2</label>
                      <p>{employeeDetails.EMERG_CNCT_ADDR_LINE2 || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Address Line 3</label>
                      <p>{employeeDetails.EMERG_CNCT_ADDR_LINE3 || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>City</label>
                      <p>{employeeDetails.EMERG_CNCT_CITY || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Country</label>
                      <p>{getCountryName(employeeDetails.EMERG_CNCT_COUNTRY_ID)}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-g">
                      <label>State</label>
                      <p>{employeeDetails.EMERG_CNCT_STATE_ID ? getStateName(employeeDetails.EMERG_CNCT_STATE_ID) : employeeDetails.EMERG_CNCT_STATE_NAME_CUSTOM || '-'}</p>
                    </div>
                    <div className="details-g">
                      <label>Postal Code</label>
                      <p>{employeeDetails.EMERG_CNCT_POSTAL_CODE || '-'}</p>
                    </div>
                  </div>
                  {canEditEmployees && (
                    
                      <button className="button" onClick={() => handleEdit('emergencyContact')}>Edit</button>
                    
                  )}
                </div>
              )}
            </div>

            {/* Leave Assignments Section */}
            <div className="role-details-block96">
              <h3>Leave Assignments</h3>
              {editingLeaves && canEditEmployees ? (
                <div className="leaves-container">
                  {leaveTypes.map((leave) => (
                    <div key={leave.id} className="form-group">
                      <label>{leave.Name} (Number of Leaves)</label>
                      <input
                        type="number"
                        name={`noofleaves_${leave.id}`}
                        value={formLeaves[leave.id] || ''}
                        onChange={(e) => handleLeaveChange(leave.id, e.target.value)}
                        min="0"
                        step="any"
                      />
                    </div>
                  ))}
                  <div className="form-buttons">
                    <button className="save" onClick={() => handleSave('leaves')}>Save</button>
                    <button className="cancel" onClick={() => setEditingLeaves(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="view-leaves">
                  {Object.keys(leaveAssignments).length === 0 ? (
                    <p>No leave assignments.</p>
                  ) : (
                    leaveTypes.map((leave) => (
                      leaveAssignments[leave.id] !== undefined && (
                        <div key={leave.id} className="details-g">
                          <label>{leave.Name}</label>
                          <p>{leaveAssignments[leave.id] || '0'}</p>
                        </div>
                      )
                    ))
                  )}
                  {canEditEmployees && (
                      <button className="button" onClick={() => handleEdit('leaves')}>Edit</button>  
                  )}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default Overview;

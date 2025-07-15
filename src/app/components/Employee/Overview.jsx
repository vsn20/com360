
'use client';

import React, { useState, useEffect } from 'react';
import { 
  fetchEmployeeById, 
  fetchLeaveAssignments, 
  fetchUserPermissions, 
  updateEmployee 
} from '@/app/serverActions/Employee/overview';
import './overview.css';

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
  workerCompClasses
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [leaveAssignments, setLeaveAssignments] = useState({});
  const [allEmployees, setAllEmployees] = useState(employees);
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
  const [canEditEmployees, setCanEditEmployees] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingEmployment, setEditingEmployment] = useState(false);
  const [editingLeaves, setEditingLeaves] = useState(false);
  const [editingWorkAddress, setEditingWorkAddress] = useState(false);
  const [editingHomeAddress, setEditingHomeAddress] = useState(false);
  const [editingEmergencyContact, setEditingEmergencyContact] = useState(false);

  useEffect(() => {
    setAllEmployees(employees);
  }, [employees]);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const permissions = await fetchUserPermissions();
        setCanEditEmployees(permissions.some(item => item.href === '/userscreens/employee/edit/:empid'));
      } catch (err) {
        console.error('Error fetching permissions:', err);
        setError(err.message);
      }
    };
    checkPermissions();
  }, []);

  useEffect(() => {
    console.log('Departments prop:', departments); // Debug departments prop
    const loadEmployeeDetails = async () => {
      if (!selectedEmpId) {
        setEmployeeDetails(null);
        setLeaveAssignments({});
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
        console.log('Loaded employee details for empid:', selectedEmpId, 'deptId:', employee.DEPT_ID, 'deptName:', employee.DEPT_NAME);
      } catch (err) {
        console.error('Error loading employee details:', err);
        setError(err.message);
        setEmployeeDetails(null);
        setLeaveAssignments({});
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
    console.log('Selected employee:', empid);
  };

  const handleBackClick = () => {
    setSelectedEmpId(null);
    setEditingPersonal(false);
    setEditingEmployment(false);
    setEditingLeaves(false);
    setEditingWorkAddress(false);
    setEditingHomeAddress(false);
    setEditingEmergencyContact(false);
    setError(null);
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
      if (!formData.roleid) {
        setError('Role is required.');
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
      formDataToSubmit.append('roleid', formData.roleid || '');
      formDataToSubmit.append('hireDate', formData.hireDate || '');
      formDataToSubmit.append('lastWorkDate', formData.lastWorkDate || '');
      formDataToSubmit.append('terminatedDate', formData.terminatedDate || '');
      formDataToSubmit.append('rejoinDate', formData.rejoinDate || '');
      formDataToSubmit.append('superior', formData.superior || '');
      formDataToSubmit.append('status', formData.status || '');
      formDataToSubmit.append('jobTitle', formData.jobTitle || '');
      formDataToSubmit.append('payFrequency', formData.payFrequency || '');
      formDataToSubmit.append('deptId', formData.deptId || '');
      formDataToSubmit.append('deptName', formData.deptName || ''); // Include deptName
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
        console.log('Updated employee data:', updatedEmployee); // Debug log for deptId
        setEmployeeDetails(updatedEmployee);
        setLeaveAssignments(await fetchLeaveAssignments(formData.empid));
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

  const getRoleName = (roleid) => {
    const role = roles.find(r => r.roleid === roleid);
    return role ? role.rolename : 'No Role';
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
    const job = jobTitles.find(j => j.job_title === jobTitle);
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

  console.log('Rendering Overview component. selectedEmpId:', selectedEmpId, 'employeeDetails:', !!employeeDetails);

 const getdisplayprojectid=(prjid)=>{
  return prjid.split('_')[1]||prjid;
 }
  return (
    <div className="employee-overview-container">
     
      {error && <div className="error-message">{error}</div>}

      {!selectedEmpId ? (
        <div className="employee-list">
          {employees.length === 0 && !error ? (
            <p>No active employees found.</p>
          ) : (
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Hire Date</th>
                  <th>Mobile</th>
                  <th>Gender</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr
                    key={employee.empid}
                    onClick={() => handleRowClick(employee.empid)}
                    className={selectedEmpId === employee.empid ? 'selected-row' : ''}
                  >
                   
                    <td>Employee-{getdisplayprojectid(employee.empid)}</td>
                    <td>{employee.EMP_PREF_NAME || `${employee.EMP_FST_NAME} ${employee.EMP_MID_NAME || ''} ${employee.EMP_LAST_NAME}`.trim()}</td>
                    <td>{employee.email}</td>
                    <td>{employee.HIRE ? new Date(employee.HIRE).toLocaleDateString('en-US') : '-'}</td>
                    <td>{employee.MOBILE_NUMBER || '-'}</td>
                    <td>{employee.GENDER || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        employeeDetails && (
          <div className="employee-details-container">
            <button className="back-button" onClick={handleBackClick}>Back</button>

            {/* Personal Details Section */}
            <div className="details-block">
              <h3>Personal Details</h3>
              {editingPersonal && canEditEmployees ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('personal'); }}>
                  <div className="form-row">
                    {/* <div className="form-group">
                      <label>Employee ID</label>
                      <input type="text" name="empid" value={formData.empid} readOnly className="bg-gray-100" />
                    </div> */}
                    {/* <div className="form-group">
                      <label>Organization ID</label>
                      <input type="number" name="orgid" value={formData.orgid} readOnly className="bg-gray-100" />
                    </div> */}
                  </div>
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
                      <input type="date" name="dob" value={formData.dob} onChange={handleFormChange} />
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
                    <button type="submit" className="save-button">Save</button>
                    <button type="button" className="cancel-button" onClick={() => setEditingPersonal(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-group">
                      <label>Employee ID</label>
                      <p>Employee-{getdisplayprojectid(employeeDetails.empid)}</p>
                    </div>
                    <div className="details-group">
                      <label>Organization ID</label>
                      <p>{employeeDetails.orgid}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>First Name</label>
                      <p>{employeeDetails.EMP_FST_NAME}</p>
                    </div>
                    <div className="details-group">
                      <label>Middle Name</label>
                      <p>{employeeDetails.EMP_MID_NAME || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Last Name</label>
                      <p>{employeeDetails.EMP_LAST_NAME}</p>
                    </div>
                    <div className="details-group">
                      <label>Preferred Name</label>
                      <p>{employeeDetails.EMP_PREF_NAME || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Email</label>
                      <p>{employeeDetails.email}</p>
                    </div>
                    <div className="details-group">
                      <label>Gender</label>
                      <p>{employeeDetails.GENDER || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Mobile Number</label>
                      <p>{employeeDetails.MOBILE_NUMBER || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Phone Number</label>
                      <p>{employeeDetails.PHONE_NUMBER || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Date of Birth</label>
                      <p>{employeeDetails.DOB ? new Date(employeeDetails.DOB).toLocaleDateString('en-US') : '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>SSN</label>
                      <p>{employeeDetails.SSN || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>LinkedIn URL</label>
                      <p>{employeeDetails.LINKEDIN_URL || '-'}</p>
                    </div>
                  </div>
                  {canEditEmployees && (
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('personal')}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Employment Details Section */}
            <div className="details-block">
              <h3>Employment Details</h3>
              {editingEmployment && canEditEmployees ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave('employment'); }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Role*</label>
                      <select name="roleid" value={formData.roleid} onChange={handleFormChange} required>
                        <option value="">Select Role</option>
                        {roles.map((role) => (
                          <option key={role.roleid} value={role.roleid}>
                            {role.rolename}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Hire Date*</label>
                      <input type="date" name="hireDate" value={formData.hireDate} onChange={handleFormChange} required />
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
                          <option key={job.job_title} value={job.job_title}>
                            {`${job.job_title} (Level: ${job.level || 'N/A'}, Salary Range: $${job.min_salary || 'N/A'} - $${job.max_salary || 'N/A'})`}
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
                              {`${employee.empid} - ${employee.EMP_FST_NAME} ${employee.EMP_LAST_NAME} (${getRoleName(employee.roleid)})`}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Last Work Date</label>
                      <input type="date" name="lastWorkDate" value={formData.lastWorkDate} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Terminated Date</label>
                      <input type="date" name="terminatedDate" value={formData.terminatedDate} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Rejoin Date</label>
                      <input type="date" name="rejoinDate" value={formData.rejoinDate} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="form-buttons">
                    <button type="submit" className="save-button">Save</button>
                    <button type="button" className="cancel-button" onClick={() => setEditingEmployment(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-group">
                      <label>Role</label>
                      <p>{getRoleName(employeeDetails.roleid)}</p>
                    </div>
                    <div className="details-group">
                      <label>Hire Date</label>
                      <p>{employeeDetails.HIRE ? new Date(employeeDetails.HIRE).toLocaleDateString('en-US') : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Status</label>
                      <p>{getStatusName(employeeDetails.STATUS)}</p>
                    </div>
                    <div className="details-group">
                      <label>Job Title</label>
                      <p>{getJobTitleName(employeeDetails.JOB_TITLE)}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Pay Frequency</label>
                      <p>{getPayFrequencyName(employeeDetails.PAY_FREQUENCY)}</p>
                    </div>
                    <div className="details-group">
                      <label>Department</label>
                      <p>{getDepartmentName(employeeDetails.DEPT_ID)}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Work Compensation Class</label>
                      <p>{getWorkerCompClassName(employeeDetails.WORK_COMP_CLASS)}</p>
                    </div>
                    <div className="details-group">
                      <label>Superior</label>
                      <p>{getSuperiorName(employeeDetails.superior)}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Last Work Date</label>
                      <p>{employeeDetails.LAST_WORK_DATE ? new Date(employeeDetails.LAST_WORK_DATE).toLocaleDateString('en-US') : '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Terminated Date</label>
                      <p>{employeeDetails.TERMINATED_DATE ? new Date(employeeDetails.TERMINATED_DATE).toLocaleDateString('en-US') : '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Rejoin Date</label>
                      <p>{employeeDetails.REJOIN_DATE ? new Date(employeeDetails.REJOIN_DATE).toLocaleDateString('en-US') : '-'}</p>
                    </div>
                  </div>
                  {canEditEmployees && (
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('employment')}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Work Address Section */}
            <div className="details-block">
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
                    <button type="submit" className="save-button">Save</button>
                    <button type="button" className="cancel-button" onClick={() => setEditingWorkAddress(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-group">
                      <label>Address Line 1</label>
                      <p>{employeeDetails.WORK_ADDR_LINE1 || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Address Line 2</label>
                      <p>{employeeDetails.WORK_ADDR_LINE2 || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Address Line 3</label>
                      <p>{employeeDetails.WORK_ADDR_LINE3 || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>City</label>
                      <p>{employeeDetails.WORK_CITY || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Country</label>
                      <p>{getCountryName(employeeDetails.WORK_COUNTRY_ID)}</p>
                    </div>
                    <div className="details-group">
                      <label>State</label>
                      <p>{employeeDetails.WORK_STATE_ID ? getStateName(employeeDetails.WORK_STATE_ID) : employeeDetails.WORK_STATE_NAME_CUSTOM || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Postal Code</label>
                      <p>{employeeDetails.WORK_POSTAL_CODE || '-'}</p>
                    </div>
                  </div>
                  {canEditEmployees && (
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('workAddress')}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Home Address Section */}
            <div className="details-block">
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
                    <button type="submit" className="save-button">Save</button>
                    <button type="button" className="cancel-button" onClick={() => setEditingHomeAddress(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-group">
                      <label>Address Line 1</label>
                      <p>{employeeDetails.HOME_ADDR_LINE1 || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Address Line 2</label>
                      <p>{employeeDetails.HOME_ADDR_LINE2 || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Address Line 3</label>
                      <p>{employeeDetails.HOME_ADDR_LINE3 || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>City</label>
                      <p>{employeeDetails.HOME_CITY || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Country</label>
                      <p>{getCountryName(employeeDetails.HOME_COUNTRY_ID)}</p>
                    </div>
                    <div className="details-group">
                      <label>State</label>
                      <p>{employeeDetails.HOME_STATE_ID ? getStateName(employeeDetails.HOME_STATE_ID) : employeeDetails.HOME_STATE_NAME_CUSTOM || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Postal Code</label>
                      <p>{employeeDetails.HOME_POSTAL_CODE || '-'}</p>
                    </div>
                  </div>
                  {canEditEmployees && (
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('homeAddress')}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Emergency Contact Section */}
            <div className="details-block">
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
                    <button type="submit" className="save-button">Save</button>
                    <button type="button" className="cancel-button" onClick={() => setEditingEmergencyContact(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="view-details">
                  <div className="details-row">
                    <div className="details-group">
                      <label>Name</label>
                      <p>{employeeDetails.EMERG_CNCT_NAME || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Phone Number</label>
                      <p>{employeeDetails.EMERG_CNCT_PHONE_NUMBER || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Email</label>
                      <p>{employeeDetails.EMERG_CNCT_EMAIL || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Address Line 1</label>
                      <p>{employeeDetails.EMERG_CNCT_ADDR_LINE1 || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>Address Line 2</label>
                      <p>{employeeDetails.EMERG_CNCT_ADDR_LINE2 || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Address Line 3</label>
                      <p>{employeeDetails.EMERG_CNCT_ADDR_LINE3 || '-'}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>City</label>
                      <p>{employeeDetails.EMERG_CNCT_CITY || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Country</label>
                      <p>{getCountryName(employeeDetails.EMERG_CNCT_COUNTRY_ID)}</p>
                    </div>
                  </div>
                  <div className="details-row">
                    <div className="details-group">
                      <label>State</label>
                      <p>{employeeDetails.EMERG_CNCT_STATE_ID ? getStateName(employeeDetails.EMERG_CNCT_STATE_ID) : employeeDetails.EMERG_CNCT_STATE_NAME_CUSTOM || '-'}</p>
                    </div>
                    <div className="details-group">
                      <label>Postal Code</label>
                      <p>{employeeDetails.EMERG_CNCT_POSTAL_CODE || '-'}</p>
                    </div>
                  </div>
                  {canEditEmployees && (
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('emergencyContact')}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Leave Assignments Section */}
            <div className="details-block">
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
                    <button className="save-button" onClick={() => handleSave('leaves')}>Save</button>
                    <button className="cancel-button" onClick={() => setEditingLeaves(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="view-leaves">
                  {Object.keys(leaveAssignments).length === 0 ? (
                    <p>No leave assignments.</p>
                  ) : (
                    leaveTypes.map((leave) => (
                      leaveAssignments[leave.id] !== undefined && (
                        <div key={leave.id} className="details-group">
                          <label>{leave.Name}</label>
                          <p>{leaveAssignments[leave.id] || '0'}</p>
                        </div>
                      )
                    ))
                  )}
                  {canEditEmployees && (
                    <div className="details-buttons">
                      <button className="edit-button" onClick={() => handleEdit('leaves')}>Edit</button>
                    </div>
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

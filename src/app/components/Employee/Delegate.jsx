'use client';

import React, { useState, useEffect } from 'react';
import { delegateAction } from '@/app/serverActions/Employee/delegateaction';
import './Delegate.css';
import { set } from 'mongoose';

const Delegate = () => {
  const [hasPermission, setHasPermission] = useState({ TimeSheets: false, Leaves: false });
  const [employeesTimeSheets, setEmployeesTimeSheets] = useState([]);
  const [employeesLeaves, setEmployeesLeaves] = useState([]);
  const [selectedEmployeeTimeSheets, setSelectedEmployeeTimeSheets] = useState('');
  const [selectedEmployeeLeaves, setSelectedEmployeeLeaves] = useState('');
  const [activeDelegationsTimeSheets, setActiveDelegationsTimeSheets] = useState([]);
  const [activeDelegationsLeaves, setActiveDelegationsLeaves] = useState([]);
  const [delegationStatusTimeSheets, setDelegationStatusTimeSheets] = useState({});
  const [delegationStatusLeaves, setDelegationStatusLeaves] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userEmpId, setUserEmpId] = useState(null);
  const [timesheetdisplay, setTimesheetdisplay] = useState(true);
  const [leavedisplay, setLeavedisplay] = useState(false);
  const [activetab, setactivetab] = useState("TimeSheets");

  useEffect(() => {
    const fetchPermissionsAndData = async () => {
      setLoading(true);
      try {
        const result = await delegateAction('checkPermission');
        if (result.error) {
          setError(result.error);
        } else {
          setHasPermission(result.hasPermission);
          setUserEmpId(result.userEmpId);
          if (result.hasPermission.TimeSheets) {
            const empResult = await delegateAction('getEligibleEmployees', { menuName: 'Timesheets' });
            if (empResult.error) setError(empResult.error);
            else setEmployeesTimeSheets(empResult.employees || []);
            
            const activeResult = await delegateAction('getActiveDelegations', { menuName: 'Timesheets' });
            if (activeResult.error) setError(activeResult.error);
            else {
              setActiveDelegationsTimeSheets(activeResult.delegations || []);
              const initialStatus = {};
              activeResult.delegations.forEach((del) => { initialStatus[del.id] = true; });
              setDelegationStatusTimeSheets(initialStatus);
            }
          }
          if (result.hasPermission.Leaves) {
            const empResult = await delegateAction('getEligibleEmployees', { menuName: 'Leaves' });
            if (empResult.error) setError(empResult.error);
            else setEmployeesLeaves(empResult.employees || []);
            
            const activeResult = await delegateAction('getActiveDelegations', { menuName: 'Leaves' });
            if (activeResult.error) setError(activeResult.error);
            else {
              setActiveDelegationsLeaves(activeResult.delegations || []);
              const initialStatus = {};
              activeResult.delegations.forEach((del) => { initialStatus[del.id] = true; });
              setDelegationStatusLeaves(initialStatus);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPermissionsAndData();
  }, []);

  const handleDelegate = async (menuName) => {
    const isTimeSheets = menuName === 'TimeSheets';
    const selectedEmployee = isTimeSheets ? selectedEmployeeTimeSheets : selectedEmployeeLeaves;

    if (!hasPermission[menuName] || !selectedEmployee) {
      setError(`Permission or employee selection is missing for ${menuName}.`);
      return;
    }

    setLoading(true);
    try {
      // isActive is now hardcoded to true, as per the new requirement.
      const result = await delegateAction('C_DELEGATE', { receiverEmpId: selectedEmployee, isActive: true, menuName });
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setError(null);
        setTimeout(() => setSuccess(false), 3000);
        
        // Refresh data
        const empResult = await delegateAction('getEligibleEmployees', { menuName });
        if (empResult.error) setError(empResult.error);
        else {
          if (isTimeSheets) {
            setEmployeesTimeSheets(empResult.employees || []);
            setSelectedEmployeeTimeSheets('');
          } else {
            setEmployeesLeaves(empResult.employees || []);
            setSelectedEmployeeLeaves('');
          }
        }
        
        const activeResult = await delegateAction('getActiveDelegations', { menuName });
        if (activeResult.error) setError(activeResult.error);
        else {
          const delegations = activeResult.delegations || [];
          const updatedStatus = {};
          delegations.forEach((del) => { updatedStatus[del.id] = true; });
          if (isTimeSheets) {
            setActiveDelegationsTimeSheets(delegations);
            setDelegationStatusTimeSheets(updatedStatus);
          } else {
            setActiveDelegationsLeaves(delegations);
            setDelegationStatusLeaves(updatedStatus);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateDelegations = async (menuName) => {
    const isTimeSheets = menuName === 'TimeSheets';
    const delegationStatus = isTimeSheets ? delegationStatusTimeSheets : delegationStatusLeaves;
    
    const delegationsToUpdate = Object.entries(delegationStatus)
      .filter(([_, isActive]) => !isActive)
      .map(([id]) => id);

    if (delegationsToUpdate.length === 0) {
      setError(`No delegations selected to deactivate for ${menuName}.`);
      return;
    }
    
    setLoading(true);
    try {
      const result = await delegateAction('updateDelegations', { delegationIds: delegationsToUpdate });
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setError(null);
        setTimeout(() => setSuccess(false), 3000);
        
        // Refresh data
        const activeResult = await delegateAction('getActiveDelegations', { menuName });
        if (activeResult.error) setError(activeResult.error);
        else {
          const delegations = activeResult.delegations || [];
          const updatedStatus = {};
          delegations.forEach((del) => { updatedStatus[del.id] = true; });
          if (isTimeSheets) {
            setActiveDelegationsTimeSheets(delegations);
            setDelegationStatusTimeSheets(updatedStatus);
          } else {
            setActiveDelegationsLeaves(delegations);
            setDelegationStatusLeaves(updatedStatus);
          }
        }
        
        const empResult = await delegateAction('getEligibleEmployees', { menuName });
        if (empResult.error) setError(empResult.error);
        else {
           isTimeSheets ? setEmployeesTimeSheets(empResult.employees || []) : setEmployeesLeaves(empResult.employees || []);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelegationStatusChange = (delegationId, menuName) => {
    const setter = menuName === 'TimeSheets' ? setDelegationStatusTimeSheets : setDelegationStatusLeaves;
    setter((prev) => ({ ...prev, [delegationId]: !prev[delegationId] }));
  };
  
  const handletimesheet=()=>{
    setTimesheetdisplay(true);
    setLeavedisplay(false);
    setactivetab("TimeSheets");
  };
  
  const handleleave=()=>{
    setTimesheetdisplay(false);
    setLeavedisplay(true);
    setactivetab("Leaves");
  };

  if (loading) return <div>Loading...</div>;

  if (!hasPermission.TimeSheets && !hasPermission.Leaves) {
    return <div className="delegation_container">You do not have permission to delegate.</div>;
  }

  const renderDelegationUI = (menuName) => {
    const isTimeSheets = menuName === 'TimeSheets';
    const hasPerm = hasPermission[menuName];
    if (!hasPerm) return null;

    const employees = isTimeSheets ? employeesTimeSheets : employeesLeaves;
    const selectedEmployee = isTimeSheets ? selectedEmployeeTimeSheets : selectedEmployeeLeaves;
    const setSelectedEmployee = isTimeSheets ? setSelectedEmployeeTimeSheets : setSelectedEmployeeLeaves;
    const activeDelegations = isTimeSheets ? activeDelegationsTimeSheets : activeDelegationsLeaves;
    const delegationStatus = isTimeSheets ? delegationStatusTimeSheets : delegationStatusLeaves;

    return (
      <>
        <div className="delegation_form">
          <h3 className="delegation_section_title">{menuName} Delegation</h3>
          <div className="delegation_form_group">
            <label>Select Employee:</label>
            <select
              value={selectedEmployee}
              onChange={(e) => {
                setSelectedEmployee(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              disabled={!employees.length || loading}
            >
              <option value="">Select an employee</option>
              {employees.map((emp) => (
                <option key={emp.empid} value={emp.empid}>
                  {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}${emp.role_names ? ` (${emp.role_names})` : ''}`}
                </option>
              ))}
            </select>
            {!employees.length && <p>No eligible employees found.</p>}
          </div>

          <button onClick={() => handleDelegate(menuName)} disabled={!selectedEmployee || loading} className="delegation_button">
            {loading ? 'Updating...' : 'Update Delegation'}
          </button>
        </div>

        {activeDelegations.length > 0 && (
          <div className="delegation_active_delegations">
            <h3 className="delegation_section_title">Active {menuName} Delegations</h3>
            <ul className="delegation_active_grid">
              {activeDelegations.map((del) => (
                <li key={del.id} className="delegation_item">
                  <label className="delegation_checkbox_label">
                    <input
                      type="checkbox"
                      checked={delegationStatus[del.id] || false}
                      onChange={() => handleDelegationStatusChange(del.id, menuName)}
                      disabled={loading}
                    />
                    <span className="delegation_custom_checkbox"></span>
                    {`${del.EMP_FST_NAME} ${del.EMP_LAST_NAME || ''}`}
                  </label>
                </li>
              ))}
            </ul>
            <button onClick={() => handleUpdateDelegations(menuName)} disabled={loading} className="delegation_button">
              {loading ? 'Updating...' : 'Update Active Delegations'}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="delegation_container">
      <h2 className="delegation_title">Delegate Permissions</h2>
      {error && <p className="delegation_error_message">{error}</p>}
      {success && <p className="delegation_success_message">Delegation updated successfully!</p>}
      
      {hasPermission.TimeSheets && hasPermission.Leaves && 
        <div className='delegation_submenu_bar'>
          <button onClick={handletimesheet} className={activetab==='TimeSheets'?'delegation_active':''}>Time Sheets</button>
          <button onClick={handleleave} className={activetab==='Leaves'?'delegation_active':''}>Leaves</button>
        </div>
      }
       
      {hasPermission.TimeSheets && hasPermission.Leaves ? (
        <>
          {timesheetdisplay && renderDelegationUI('TimeSheets')}
          {leavedisplay && renderDelegationUI('Leaves')}
        </>
      ) : (
        <>
          {hasPermission.TimeSheets && renderDelegationUI('TimeSheets')}
          {hasPermission.Leaves && renderDelegationUI('Leaves')}
        </>
      )}
    </div>
  );
};

export default Delegate;
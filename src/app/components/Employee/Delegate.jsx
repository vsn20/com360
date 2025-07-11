'use client';

import React, { useState, useEffect } from 'react';
import { delegateAction } from '@/app/serverActions/Employee/delegateaction';
import './Delegate.css';

const Delegate = () => {
  const [hasPermission, setHasPermission] = useState({ TimeSheets: false, Leaves: false });
  const [employeesTimeSheets, setEmployeesTimeSheets] = useState([]);
  const [employeesLeaves, setEmployeesLeaves] = useState([]);
  const [selectedEmployeeTimeSheets, setSelectedEmployeeTimeSheets] = useState('');
  const [selectedEmployeeLeaves, setSelectedEmployeeLeaves] = useState('');
  const [isActiveTimeSheets, setIsActiveTimeSheets] = useState(false);
  const [isActiveLeaves, setIsActiveLeaves] = useState(false);
  const [activeDelegationsTimeSheets, setActiveDelegationsTimeSheets] = useState([]);
  const [activeDelegationsLeaves, setActiveDelegationsLeaves] = useState([]);
  const [delegationStatusTimeSheets, setDelegationStatusTimeSheets] = useState({});
  const [delegationStatusLeaves, setDelegationStatusLeaves] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [userEmpId, setUserEmpId] = useState(null);

  useEffect(() => {
    const fetchPermissionsAndData = async () => {
      const result = await delegateAction('checkPermission');
      console.log("Permission check result:", result);
      if (result.error) {
        setError(result.error);
      } else {
        setHasPermission(result.hasPermission);
        setUserEmpId(result.userEmpId);
        if (result.hasPermission.TimeSheets) {
          const empResult = await delegateAction('getEligibleEmployees', { userEmpId: result.userEmpId, menuName: 'TimeSheets' });
          console.log("Eligible employees result for TimeSheets:", empResult);
          if (empResult.error) {
            setError(empResult.error);
          } else {
            setEmployeesTimeSheets(empResult.employees || []);
          }
          const activeResult = await delegateAction('getActiveDelegations', { userEmpId: result.userEmpId, menuName: 'TimeSheets' });
          console.log("Active delegations result for TimeSheets:", activeResult);
          if (activeResult.error) {
            setError(activeResult.error);
          } else {
            setActiveDelegationsTimeSheets(activeResult.delegations || []);
            const initialStatus = {};
            activeResult.delegations.forEach((del) => {
              initialStatus[del.id] = true;
            });
            setDelegationStatusTimeSheets(initialStatus);
          }
        }
        if (result.hasPermission.Leaves) {
          const empResult = await delegateAction('getEligibleEmployees', { userEmpId: result.userEmpId, menuName: 'Leaves' });
          console.log("Eligible employees result for Leaves:", empResult);
          if (empResult.error) {
            setError(empResult.error);
          } else {
            setEmployeesLeaves(empResult.employees || []);
          }
          const activeResult = await delegateAction('getActiveDelegations', { userEmpId: result.userEmpId, menuName: 'Leaves' });
          console.log("Active delegations result for Leaves:", activeResult);
          if (activeResult.error) {
            setError(activeResult.error);
          } else {
            setActiveDelegationsLeaves(activeResult.delegations || []);
            const initialStatus = {};
            activeResult.delegations.forEach((del) => {
              initialStatus[del.id] = true;
            });
            setDelegationStatusLeaves(initialStatus);
          }
        }
      }
    };
    fetchPermissionsAndData();
  }, []);

  const handleDelegateTimeSheets = async () => {
    if (!hasPermission.TimeSheets || !selectedEmployeeTimeSheets) {
      console.log("Invalid delegation attempt for TimeSheets:", { hasPermission, selectedEmployeeTimeSheets });
      setError('Permission or employee selection is missing for TimeSheets.');
      return;
    }

    const result = await delegateAction('delegate', { receiverEmpId: selectedEmployeeTimeSheets, isActive: isActiveTimeSheets, menuName: 'TimeSheets' });
    console.log("Delegate action result for TimeSheets:", result);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      const empResult = await delegateAction('getEligibleEmployees', { userEmpId, menuName: 'TimeSheets' });
      if (empResult.error) {
        setError(empResult.error);
      } else {
        setEmployeesTimeSheets(empResult.employees || []);
        setSelectedEmployeeTimeSheets('');
        setIsActiveTimeSheets(false);
      }
      const activeResult = await delegateAction('getActiveDelegations', { userEmpId, menuName: 'TimeSheets' });
      if (activeResult.error) {
        setError(activeResult.error);
      } else {
        setActiveDelegationsTimeSheets(activeResult.delegations || []);
        const updatedStatus = {};
        activeResult.delegations.forEach((del) => {
          updatedStatus[del.id] = true;
        });
        setDelegationStatusTimeSheets(updatedStatus);
      }
    }
  };

  const handleDelegateLeaves = async () => {
    if (!hasPermission.Leaves || !selectedEmployeeLeaves) {
      console.log("Invalid delegation attempt for Leaves:", { hasPermission, selectedEmployeeLeaves });
      setError('Permission or employee selection is missing for Leaves.');
      return;
    }

    const result = await delegateAction('delegate', { receiverEmpId: selectedEmployeeLeaves, isActive: isActiveLeaves, menuName: 'Leaves' });
    console.log("Delegate action result for Leaves:", result);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      const empResult = await delegateAction('getEligibleEmployees', { userEmpId, menuName: 'Leaves' });
      if (empResult.error) {
        setError(empResult.error);
      } else {
        setEmployeesLeaves(empResult.employees || []);
        setSelectedEmployeeLeaves('');
        setIsActiveLeaves(false);
      }
      const activeResult = await delegateAction('getActiveDelegations', { userEmpId, menuName: 'Leaves' });
      if (activeResult.error) {
        setError(activeResult.error);
      } else {
        setActiveDelegationsLeaves(activeResult.delegations || []);
        const updatedStatus = {};
        activeResult.delegations.forEach((del) => {
          updatedStatus[del.id] = true;
        });
        setDelegationStatusLeaves(updatedStatus);
      }
    }
  };

  const handleDelegationStatusChangeTimeSheets = (delegationId) => {
    setDelegationStatusTimeSheets((prev) => ({
      ...prev,
      [delegationId]: !prev[delegationId],
    }));
  };

  const handleDelegationStatusChangeLeaves = (delegationId) => {
    setDelegationStatusLeaves((prev) => ({
      ...prev,
      [delegationId]: !prev[delegationId],
    }));
  };

  const handleUpdateDelegationsTimeSheets = async () => {
    const delegationsToUpdate = Object.entries(delegationStatusTimeSheets)
      .filter(([_, isActive]) => !isActive)
      .map(([id]) => id);
    if (delegationsToUpdate.length === 0) {
      setError('No delegations selected to deactivate for TimeSheets.');
      return;
    }

    const result = await delegateAction('updateDelegations', { delegationIds: delegationsToUpdate });
    console.log("Update delegations result for TimeSheets:", result);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      const activeResult = await delegateAction('getActiveDelegations', { userEmpId, menuName: 'TimeSheets' });
      if (activeResult.error) {
        setError(activeResult.error);
      } else {
        setActiveDelegationsTimeSheets(activeResult.delegations || []);
        const updatedStatus = {};
        activeResult.delegations.forEach((del) => {
          updatedStatus[del.id] = true;
        });
        setDelegationStatusTimeSheets(updatedStatus);
      }
      const empResult = await delegateAction('getEligibleEmployees', { userEmpId, menuName: 'TimeSheets' });
      if (empResult.error) {
        setError(empResult.error);
      } else {
        setEmployeesTimeSheets(empResult.employees || []);
      }
    }
  };

  const handleUpdateDelegationsLeaves = async () => {
    const delegationsToUpdate = Object.entries(delegationStatusLeaves)
      .filter(([_, isActive]) => !isActive)
      .map(([id]) => id);
    if (delegationsToUpdate.length === 0) {
      setError('No delegations selected to deactivate for Leaves.');
      return;
    }

    const result = await delegateAction('updateDelegations', { delegationIds: delegationsToUpdate });
    console.log("Update delegations result for Leaves:", result);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      const activeResult = await delegateAction('getActiveDelegations', { userEmpId, menuName: 'Leaves' });
      if (activeResult.error) {
        setError(activeResult.error);
      } else {
        setActiveDelegationsLeaves(activeResult.delegations || []);
        const updatedStatus = {};
        activeResult.delegations.forEach((del) => {
          updatedStatus[del.id] = true;
        });
        setDelegationStatusLeaves(updatedStatus);
      }
      const empResult = await delegateAction('getEligibleEmployees', { userEmpId, menuName: 'Leaves' });
      if (empResult.error) {
        setError(empResult.error);
      } else {
        setEmployeesLeaves(empResult.employees || []);
      }
    }
  };

  if (!hasPermission.TimeSheets && !hasPermission.Leaves) {
    return <div>You do not have permission to delegate TimeSheets or Leaves.</div>;
  }

  return (
    <div className="delegate-container">
      <h2>Delegate Permissions</h2>
      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">Delegation updated successfully!</p>}
      {hasPermission.TimeSheets && (
        <div className="delegate-form">
          <h3>TimeSheets Delegation</h3>
          <label>
            Select Employee:
            <select
              value={selectedEmployeeTimeSheets}
              onChange={(e) => {
                console.log("Selected employee for TimeSheets:", e.target.value);
                setSelectedEmployeeTimeSheets(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              disabled={!employeesTimeSheets.length}
            >
              <option value="">Select an employee</option>
              {employeesTimeSheets.map((emp) => (
                <option key={emp.empid} value={emp.empid}>
                  {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Active Delegation:
            <input
              type="checkbox"
              checked={isActiveTimeSheets}
              onChange={(e) => {
                console.log("Active delegation changed for TimeSheets:", e.target.checked);
                setIsActiveTimeSheets(e.target.checked);
                setError(null);
                setSuccess(false);
              }}
              disabled={!selectedEmployeeTimeSheets}
            />
          </label>
          <button onClick={handleDelegateTimeSheets} disabled={!selectedEmployeeTimeSheets}>
            Update Delegation
          </button>
          {activeDelegationsTimeSheets.length > 0 && (
            <div className="active-delegations">
              <h4>Active TimeSheets Delegations</h4>
              <ul>
                {activeDelegationsTimeSheets.map((del) => (
                  <li key={del.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={delegationStatusTimeSheets[del.id] || false}
                        onChange={() => handleDelegationStatusChangeTimeSheets(del.id)}
                      />
                      {`${del.EMP_FST_NAME} ${del.EMP_LAST_NAME || ''}`}
                    </label>
                  </li>
                ))}
              </ul>
              <button onClick={handleUpdateDelegationsTimeSheets}>Update Active Delegations</button>
            </div>
          )}
          {!employeesTimeSheets.length && !activeDelegationsTimeSheets.length && (
            <p>No eligible employees or active delegations for TimeSheets.</p>
          )}
        </div>
      )}
      {hasPermission.Leaves && (
        <div className="delegate-form">
          <h3>Leaves Delegation</h3>
          <label>
            Select Employee:
            <select
              value={selectedEmployeeLeaves}
              onChange={(e) => {
                console.log("Selected employee for Leaves:", e.target.value);
                setSelectedEmployeeLeaves(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              disabled={!employeesLeaves.length}
            >
              <option value="">Select an employee</option>
              {employeesLeaves.map((emp) => (
                <option key={emp.empid} value={emp.empid}>
                  {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Active Delegation:
            <input
              type="checkbox"
              checked={isActiveLeaves}
              onChange={(e) => {
                console.log("Active delegation changed for Leaves:", e.target.checked);
                setIsActiveLeaves(e.target.checked);
                setError(null);
                setSuccess(false);
              }}
              disabled={!selectedEmployeeLeaves}
            />
          </label>
          <button onClick={handleDelegateLeaves} disabled={!selectedEmployeeLeaves}>
            Update Delegation
          </button>
          {activeDelegationsLeaves.length > 0 && (
            <div className="active-delegations">
              <h4>Active Leaves Delegations</h4>
              <ul>
                {activeDelegationsLeaves.map((del) => (
                  <li key={del.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={delegationStatusLeaves[del.id] || false}
                        onChange={() => handleDelegationStatusChangeLeaves(del.id)}
                      />
                      {`${del.EMP_FST_NAME} ${del.EMP_LAST_NAME || ''}`}
                    </label>
                  </li>
                ))}
              </ul>
              <button onClick={handleUpdateDelegationsLeaves}>Update Active Delegations</button>
            </div>
          )}
          {!employeesLeaves.length && !activeDelegationsLeaves.length && (
            <p>No eligible employees or active delegations for Leaves.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Delegate;
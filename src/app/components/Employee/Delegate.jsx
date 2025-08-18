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
  const [loading, setLoading] = useState(false);
  const [userEmpId, setUserEmpId] = useState(null);

  useEffect(() => {
    const fetchPermissionsAndData = async () => {
      setLoading(true);
      try {
        const result = await delegateAction('checkPermission');
        console.log('Permission check result:', result);
        if (result.error) {
          setError(result.error);
        } else {
          setHasPermission(result.hasPermission);
          setUserEmpId(result.userEmpId);
          if (result.hasPermission.TimeSheets) {
            const empResult = await delegateAction('getEligibleEmployees', { menuName: 'TimeSheets' });
            console.log('Eligible employees result for TimeSheets:', empResult);
            if (empResult.error) {
              setError(empResult.error);
            } else {
              setEmployeesTimeSheets(empResult.employees || []);
            }
            const activeResult = await delegateAction('getActiveDelegations', { menuName: 'TimeSheets' });
            console.log('Active delegations result for TimeSheets:', activeResult);
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
            const empResult = await delegateAction('getEligibleEmployees', { menuName: 'Leaves' });
            console.log('Eligible employees result for Leaves:', empResult);
            if (empResult.error) {
              setError(empResult.error);
            } else {
              setEmployeesLeaves(empResult.employees || []);
            }
            const activeResult = await delegateAction('getActiveDelegations', { menuName: 'Leaves' });
            console.log('Active delegations result for Leaves:', activeResult);
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
      } finally {
        setLoading(false);
      }
    };
    fetchPermissionsAndData();
  }, []);

  const handleDelegateTimeSheets = async () => {
    if (!hasPermission.TimeSheets || !selectedEmployeeTimeSheets) {
      console.log('Invalid delegation attempt for TimeSheets:', { hasPermission, selectedEmployeeTimeSheets });
      setError('Permission or employee selection is missing for TimeSheets.');
      return;
    }
    setLoading(true);
    try {
      const result = await delegateAction('C_DELEGATE', { receiverEmpId: selectedEmployeeTimeSheets, isActive: isActiveTimeSheets, menuName: 'TimeSheets' });
      console.log('Delegate action result for TimeSheets:', result);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setError(null);
        setTimeout(() => setSuccess(false), 3000);
        const empResult = await delegateAction('getEligibleEmployees', { menuName: 'TimeSheets' });
        if (empResult.error) {
          setError(empResult.error);
        } else {
          setEmployeesTimeSheets(empResult.employees || []);
          setSelectedEmployeeTimeSheets('');
          setIsActiveTimeSheets(false);
        }
        const activeResult = await delegateAction('getActiveDelegations', { menuName: 'TimeSheets' });
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
    } finally {
      setLoading(false);
    }
  };

  const handleDelegateLeaves = async () => {
    if (!hasPermission.Leaves || !selectedEmployeeLeaves) {
      console.log('Invalid delegation attempt for Leaves:', { hasPermission, selectedEmployeeLeaves });
      setError('Permission or employee selection is missing for Leaves.');
      return;
    }
    setLoading(true);
    try {
      const result = await delegateAction('C_DELEGATE', { receiverEmpId: selectedEmployeeLeaves, isActive: isActiveLeaves, menuName: 'Leaves' });
      console.log('Delegate action result for Leaves:', result);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setError(null);
        setTimeout(() => setSuccess(false), 3000);
        const empResult = await delegateAction('getEligibleEmployees', { menuName: 'Leaves' });
        if (empResult.error) {
          setError(empResult.error);
        } else {
          setEmployeesLeaves(empResult.employees || []);
          setSelectedEmployeeLeaves('');
          setIsActiveLeaves(false);
        }
        const activeResult = await delegateAction('getActiveDelegations', { menuName: 'Leaves' });
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
    } finally {
      setLoading(false);
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
    setLoading(true);
    try {
      const result = await delegateAction('updateDelegations', { delegationIds: delegationsToUpdate });
      console.log('Update delegations result for TimeSheets:', result);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setError(null);
        setTimeout(() => setSuccess(false), 3000);
        const activeResult = await delegateAction('getActiveDelegations', { menuName: 'TimeSheets' });
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
        const empResult = await delegateAction('getEligibleEmployees', { menuName: 'TimeSheets' });
        if (empResult.error) {
          setError(empResult.error);
        } else {
          setEmployeesTimeSheets(empResult.employees || []);
        }
      }
    } finally {
      setLoading(false);
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
    setLoading(true);
    try {
      const result = await delegateAction('updateDelegations', { delegationIds: delegationsToUpdate });
      console.log('Update delegations result for Leaves:', result);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setError(null);
        setTimeout(() => setSuccess(false), 3000);
        const activeResult = await delegateAction('getActiveDelegations', { menuName: 'Leaves' });
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
        const empResult = await delegateAction('getEligibleEmployees', { menuName: 'Leaves' });
        if (empResult.error) {
          setError(empResult.error);
        } else {
          setEmployeesLeaves(empResult.employees || []);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!hasPermission.TimeSheets && !hasPermission.Leaves) {
    return <div>You do not have permission to C_DELEGATE TimeSheets or Leaves.</div>;
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
                console.log('Selected employee for TimeSheets:', e.target.value);
                setSelectedEmployeeTimeSheets(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              disabled={!employeesTimeSheets.length || loading}
            >
              <option value="">Select an employee</option>
              {employeesTimeSheets.map((emp) => (
                <option key={emp.empid} value={emp.empid}>
                  {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}${emp.role_names ? ` (${emp.role_names})` : ''}`}
                </option>
              ))}
            </select>
          </label>
          {!employeesTimeSheets.length && (
            <p>No eligible employees for TimeSheets. Ensure employees have roles with TimeSheets permissions.</p>
          )}
          <label>
            Active Delegation:
            <input
              type="checkbox"
              checked={isActiveTimeSheets}
              onChange={(e) => {
                console.log('Active delegation changed for TimeSheets:', e.target.checked);
                setIsActiveTimeSheets(e.target.checked);
                setError(null);
                setSuccess(false);
              }}
              disabled={!selectedEmployeeTimeSheets || loading}
            />
          </label>
          <button onClick={handleDelegateTimeSheets} disabled={!selectedEmployeeTimeSheets || loading}>
            {loading ? 'Updating...' : 'Update Delegation'}
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
                        disabled={loading}
                      />
                      {`${del.EMP_FST_NAME} ${del.EMP_LAST_NAME || ''}`}
                    </label>
                  </li>
                ))}
              </ul>
              <button onClick={handleUpdateDelegationsTimeSheets} disabled={loading}>
                {loading ? 'Updating...' : 'Update Active Delegations'}
              </button>
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
                console.log('Selected employee for Leaves:', e.target.value);
                setSelectedEmployeeLeaves(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              disabled={!employeesLeaves.length || loading}
            >
              <option value="">Select an employee</option>
              {employeesLeaves.map((emp) => (
                <option key={emp.empid} value={emp.empid}>
                  {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}${emp.role_names ? ` (${emp.role_names})` : ''}`}
                </option>
              ))}
            </select>
          </label>
          {!employeesLeaves.length && (
            <p>No eligible employees for Leaves. Ensure employees have roles with Leaves permissions.</p>
          )}
          <label>
            Active Delegation:
            <input
              type="checkbox"
              checked={isActiveLeaves}
              onChange={(e) => {
                console.log('Active delegation changed for Leaves:', e.target.checked);
                setIsActiveLeaves(e.target.checked);
                setError(null);
                setSuccess(false);
              }}
              disabled={!selectedEmployeeLeaves || loading}
            />
          </label>
          <button onClick={handleDelegateLeaves} disabled={!selectedEmployeeLeaves || loading}>
            {loading ? 'Updating...' : 'Update Delegation'}
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
                        disabled={loading}
                      />
                      {`${del.EMP_FST_NAME} ${del.EMP_LAST_NAME || ''}`}
                    </label>
                  </li>
                ))}
              </ul>
              <button onClick={handleUpdateDelegationsLeaves} disabled={loading}>
                {loading ? 'Updating...' : 'Update Active Delegations'}
              </button>
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
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchRolesByOrgId, fetchUserPermissions } from '@/app/serverActions/Roles/Overview';
import './rolesoverview.css';

const Overview = () => {
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState(null);
  const [accessibleItems, setAccessibleItems] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [roleData, permissions] = await Promise.all([
          fetchRolesByOrgId(),
          fetchUserPermissions(),
        ]);
        setRoles(roleData);
        setAccessibleItems(permissions);
        setError(null);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.message);
        setRoles([]);
      }
    };
    loadData();
  }, []);

  const handleEdit = (roleid) => {
    router.push(`/userscreens/roles/edit/${roleid}`);
  };

  const canEditRoles = accessibleItems.some(item => item.href === '/userscreens/roles/edit/:roleid');

  return (
    <div className="roles-overview-container">
      {error && <div className="error-message">{error}</div>}
      {roles.length === 0 && !error ? (
        <p>No active roles found.</p>
      ) : (
        <table className="roles-table">
          <thead>
            <tr>
              <th>Role ID</th>
              <th>Role Name</th>
              <th>Is Admin</th>
              {canEditRoles && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={`${role.roleid}-${role.orgid}`}>
                <td>{role.roleid}</td>
                <td>{role.rolename}</td>
                <td>{role.isadmin ? 'Yes' : 'No'}</td>
                {canEditRoles && (
                  <td>
                    <button className="edit-button" onClick={() => handleEdit(role.roleid)}>
                      ✏️
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Overview;
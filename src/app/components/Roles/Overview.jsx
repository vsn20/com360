'use client';

import React, { useState, useEffect } from 'react';
import { fetchRolesByOrgId, fetchRoleById, fetchMenusAndSubmenus, updateRole, fetchUserPermissions } from '@/app/serverActions/Roles/Overview';
import './rolesoverview.css';

const Overview = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleDetails, setRoleDetails] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [availableMenus, setAvailableMenus] = useState([]);
  const [availableSubmenus, setAvailableSubmenus] = useState([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editingFeatures, setEditingFeatures] = useState(false);
  const [formData, setFormData] = useState({
    roleid: '',
    orgid: '',
    rolename: '',
    is_active: '1',
  });
  const [detailsError, setDetailsError] = useState(null);
  const [featuresError, setFeaturesError] = useState(null);
  const [accessibleItems, setAccessibleItems] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [roleData, permissions] = await Promise.all([
          fetchRolesByOrgId(),
          fetchUserPermissions(),
        ]);
        setRoles(roleData);
        setAccessibleItems(permissions);
        setDetailsError(null);
        setFeaturesError(null);
      } catch (err) {
        console.error('Error loading roles:', err);
        setDetailsError(err.message);
        setFeaturesError(err.message);
        setRoles([]);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadRoleData = async () => {
      if (selectedRole) {
        try {
          const roleData = await fetchRoleById(selectedRole.roleid);
          setRoleDetails(roleData.role);
          // Ensure unique permissions in state
          const uniquePermissions = Array.from(
            new Set(
              roleData.permissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)
            ),
            key => {
              const [menuid, submenuid] = key.split(':');
              return {
                menuid: parseInt(menuid),
                submenuid: submenuid === 'null' ? null : parseInt(submenuid),
              };
            }
          );
          setPermissions(uniquePermissions);
          setFormData({
            roleid: roleData.role.roleid || '',
            orgid: roleData.role.orgid || '',
            rolename: roleData.role.rolename || '',
            is_active: roleData.role.is_active ? '1' : '0',
          });
          const menuData = await fetchMenusAndSubmenus();
          setAvailableMenus(menuData.menus);
          setAvailableSubmenus(menuData.submenus);
          setDetailsError(null);
          setFeaturesError(null);
        } catch (err) {
          console.error('Error loading role data:', err);
          setDetailsError(err.message);
          setFeaturesError(err.message);
          setRoleDetails(null);
          setPermissions([]);
        }
      }
    };
    loadRoleData();
  }, [selectedRole]);

  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setEditingDetails(false);
    setEditingFeatures(false);
  };

  const handleBackClick = () => {
    setSelectedRole(null);
    setRoleDetails(null);
    setPermissions([]);
    setEditingDetails(false);
    setEditingFeatures(false);
    setDetailsError(null);
    setFeaturesError(null);
  };

  const handleDetailsEdit = () => {
    setEditingDetails(true);
  };

  const handleDetailsSave = async () => {
    if (!formData.rolename.trim()) {
      setDetailsError('Role name is required.');
      return;
    }
    const formDataToSubmit = new FormData();
    formDataToSubmit.append('roleid', formData.roleid);
    formDataToSubmit.append('rolename', formData.rolename);
    formDataToSubmit.append('is_active', formData.is_active);
    console.log('Submitting form data:', Object.fromEntries(formDataToSubmit));
    try {
      const result = await updateRole({}, formDataToSubmit);
      if (result.success) {
        setEditingDetails(false);
        setRoleDetails({ ...roleDetails, rolename: formData.rolename, is_active: formData.is_active });
        setDetailsError(null);
      } else {
        setDetailsError(result.error);
      }
    } catch (err) {
      setDetailsError(err.message);
    }
  };

  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFeatureEdit = () => {
    setEditingFeatures(true);
  };

  const handleFeatureSave = async () => {
    const formDataToSubmit = new FormData();
    formDataToSubmit.append('roleid', formData.roleid);
    // Ensure unique permissions before sending
    const uniquePermissions = Array.from(
      new Set(
        permissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)
      ),
      key => {
        const [menuid, submenuid] = key.split(':');
        return {
          menuid: parseInt(menuid),
          submenuid: submenuid === 'null' ? null : parseInt(submenuid),
        };
      }
    );
    formDataToSubmit.append('permissions', JSON.stringify(uniquePermissions));
    console.log('Submitting permissions:', uniquePermissions);
    try {
      const result = await updateRole({}, formDataToSubmit);
      if (result.success) {
        setEditingFeatures(false);
        const roleData = await fetchRoleById(selectedRole.roleid);
        setPermissions(roleData.permissions.map(p => ({
          menuid: p.menuid,
          submenuid: p.submenuid || null,
        })));
        setFeaturesError(null);
      } else {
        setFeaturesError(result.error);
      }
    } catch (err) {
      setFeaturesError(err.message);
    }
  };

  const handlePermissionToggle = (menuid, submenuid = null) => {
    const menu = availableMenus.find(m => m.menuid === menuid);
    if (!menu) return;

    setPermissions(prev => {
      // Create a set of current permissions to check for duplicates
      const permissionSet = new Set(prev.map(p => `${p.menuid}:${p.submenuid || 'null'}`));
      let updatedPermissions = [...prev];

      const permissionKey = `${menuid}:${submenuid || 'null'}`;
      const exists = permissionSet.has(permissionKey);

      if (submenuid) {
        if (exists) {
          // Remove submenu permission
          updatedPermissions = updatedPermissions.filter(
            p => !(p.menuid === menuid && p.submenuid === submenuid)
          );
        } else {
          // Add submenu permission if not already present
          updatedPermissions.push({ menuid, submenuid });
        }
        if (menu.hassubmenu === 'yes') {
          const remainingSubmenus = updatedPermissions.filter(p => p.menuid === menuid && p.submenuid);
          if (remainingSubmenus.length === 0) {
            // Remove menu permission if no submenus remain
            updatedPermissions = updatedPermissions.filter(p => p.menuid !== menuid);
          }
        }
      } else {
        if (exists) {
          // Remove menu permission and all its submenus
          updatedPermissions = updatedPermissions.filter(p => p.menuid !== menuid);
        } else {
          // Add menu permission
          updatedPermissions.push({ menuid, submenuid: null });
          if (menu.hassubmenu === 'yes') {
            // Add all submenus if menu has submenus
            const submenus = availableSubmenus
              .filter(sm => sm.menuid === menuid)
              .map(sm => ({ menuid, submenuid: sm.submenuid }))
              .filter(sm => !permissionSet.has(`${sm.menuid}:${sm.submenuid}`)); // Avoid duplicates
            updatedPermissions = [...updatedPermissions, ...submenus];
          }
        }
      }

      // Ensure unique permissions
      const uniquePermissions = Array.from(
        new Set(updatedPermissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)),
        key => {
          const [menuid, submenuid] = key.split(':');
          return {
            menuid: parseInt(menuid),
            submenuid: submenuid === 'null' ? null : parseInt(submenuid),
          };
        }
      );

      return uniquePermissions;
    });
  };

  const getDisplayRoleId = (roleid) => {
    return roleid.split('-')[1] || roleid;
  };

  const canEditRoles = accessibleItems.some(item => item.href === '/userscreens/roles/edit/:roleid');

  return (
    <div className="roles-overview-container">
      {detailsError && <div className="error-message">{detailsError}</div>}
      {!selectedRole && (
        <div className="roles-list">
          
          {roles.length === 0 && !detailsError ? (
            <p>No active roles found.</p>
          ) : (
            <table className="roles-table">
              <thead>
                <tr>
                  <th>Role ID</th>
                  <th>Role Name</th>
                  <th>Is Active</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={`${role.roleid}-${role.orgid}`} onClick={() => handleRoleClick(role)} style={{ cursor: 'pointer' }}>
                    <td>{getDisplayRoleId(role.roleid)}</td>
                    <td>{role.rolename}</td>
                    <td>{role.is_active ? 'Yes' : 'No'}</td>
                    <td>{new Date(role.CREATED_DATE).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {selectedRole && roleDetails && (
        <div className="role-details-container">
          <button className="back-button" onClick={handleBackClick}>Back</button>
          <div className="role-details-block">
            <h2>Role Details</h2>
            {detailsError && <div className="error-message">{detailsError}</div>}
            {editingDetails ? (
              <form onSubmit={(e) => { e.preventDefault(); handleDetailsSave(); }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role ID</label>
                    <input type="text" name="roleid" value={formData.roleid} readOnly className="bg-gray-100" />
                  </div>
                  <div className="form-group">
                    <label>Organization ID</label>
                    <input type="text" name="orgid" value={formData.orgid} readOnly className="bg-gray-100" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role Name</label>
                    <input type="text" name="rolename" value={formData.rolename} onChange={handleDetailsChange} required />
                  </div>
                  <div className="form-group">
                    <label>Is Active</label>
                    <select name="is_active" value={formData.is_active} onChange={handleDetailsChange}>
                      <option value="1">Yes</option>
                      <option value="0">No</option>
                    </select>
                  </div>
                </div>
                <div className="form-buttons">
                  <button type="submit" className="save-button">Save</button>
                  <button type="button" className="cancel-button" onClick={() => setEditingDetails(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="view-details">
                <div className="details-row">
                  <div className="details-group">
                    <label>Role ID</label>
                    <p>{formData.roleid}</p>
                  </div>
                  <div className="details-group">
                    <label>Organization ID</label>
                    <p>{formData.orgid}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-group">
                    <label>Role Name</label>
                    <p>{formData.rolename}</p>
                  </div>
                  <div className="details-group">
                    <label>Is Active</label>
                    <p>{formData.is_active === '1' ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                {canEditRoles && !roleDetails.isadmin && (
                  <div className="details-buttons">
                    <button className="edit-button" onClick={handleDetailsEdit}>Edit</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="features-block">
            <h2>Features</h2>
            {featuresError && <div className="error-message">{featuresError}</div>}
            {editingFeatures ? (
              <div className="permissions-container">
                {availableMenus.map((menu) => (
                  <div key={`menu-${menu.menuid}`} className="permission-item">
                    <label className="menu-label">
                      <input
                        type="checkbox"
                        checked={permissions.some((p) => p.menuid === menu.menuid && !p.submenuid)}
                        onChange={() => handlePermissionToggle(menu.menuid)}
                      />
                      {menu.menuname} ({menu.menuurl})
                    </label>
                    {menu.hassubmenu === 'yes' && availableSubmenus
                      .filter((sm) => sm.menuid === menu.menuid)
                      .map((submenu) => (
                        <div key={`submenu-${submenu.submenuid}`} className="permission-subitem">
                          <label className="submenu-label">
                            <input
                              type="checkbox"
                              checked={permissions.some(
                                (p) => p.menuid === menu.menuid && p.submenuid === submenu.submenuid
                              )}
                              onChange={() => handlePermissionToggle(menu.menuid, submenu.submenuid)}
                            />
                            {submenu.submenuname} ({submenu.submenuurl})
                          </label>
                        </div>
                      ))}
                  </div>
                ))}
                <div className="form-buttons">
                  <button className="save-button" onClick={handleFeatureSave}>Save</button>
                  <button className="cancel-button" onClick={() => setEditingFeatures(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="view-permissions">
                {permissions.length === 0 ? (
                  <p>No permissions assigned.</p>
                ) : (
                  availableMenus.map((menu) => {
                    const menuPerm = permissions.find(p => p.menuid === menu.menuid && !p.submenuid);
                    const subPerms = permissions.filter(p => p.menuid === menu.menuid && p.submenuid);
                    if (menuPerm || subPerms.length > 0) {
                      return (
                        <div key={`menu-${menu.menuid}`} className="permission-item">
                          <p><strong>{menu.menuname} ({menu.menuurl})</strong></p>
                          {menu.hassubmenu === 'yes' && subPerms.map((perm) => {
                            const submenu = availableSubmenus.find(sm => sm.submenuid === perm.submenuid);
                            return submenu ? (
                              <p key={`submenu-${perm.submenuid}`} className="permission-subitem">
                                - {submenu.submenuname} ({submenu.submenuurl})
                              </p>
                            ) : null;
                          })}
                        </div>
                      );
                    }
                    return null;
                  })
                )}
                {canEditRoles && !roleDetails.isadmin && (
                  <div className="details-buttons">
                    <button className="edit-button" onClick={handleFeatureEdit}>Edit</button>
                  </div>
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
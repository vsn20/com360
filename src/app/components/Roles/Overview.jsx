'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchRolesByOrgId, fetchRoleById, fetchMenusAndSubmenus, updateRole, addRole } from '@/app/serverActions/Roles/Overview';
import './rolesoverview.css';
import { useRouter } from 'next/navigation';

const Overview = ({ currentRole, orgid, error }) => {
  const router = useRouter();
  const formRef = useRef(null);
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
  const [isadd, setisadd] = useState(false);
  const [addform_formerror, addform_setFormError] = useState(error || null);
  const [addform_permissions, addform_setPermissions] = useState([]);
  const [addform_availableMenus, addform_setAvailableMenus] = useState([]);
  const [addform_availableSubmenus, addform_setAvailableSubmenus] = useState([]);
  const [addform_loading, addform_setLoading] = useState(true);
  const [addform_success, addform_setsuccess] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const roleData = await fetchRolesByOrgId(parseInt(orgid, 10));
        setRoles([...roleData]);
        setDetailsError(null);
        setFeaturesError(null);
      } catch (err) {
        console.error('Error loading roles:', err);
        setDetailsError(err.message);
        setFeaturesError(err.message);
        setRoles([]);
        setTimeout(() => {
          setDetailsError(null);
          setFeaturesError(null);
          router.refresh();
        }, 4000);
      }
    };
    loadData();
  }, [orgid]);

  useEffect(() => {
    const loadRoleData = async () => {
      if (selectedRole) {
        try {
          const roleData = await fetchRoleById(selectedRole.roleid);
          setRoleDetails(roleData.role);
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
          setTimeout(() => {
            setDetailsError(null);
            setFeaturesError(null);
            router.refresh();
          }, 4000);
        }
      }
    };
    loadRoleData();
  }, [selectedRole]);

  useEffect(() => {
    const addform_loadData = async () => {
      try {
        const addform_menuData = await fetchMenusAndSubmenus();
        console.log('Fetched menus:', addform_menuData.menus, 'Fetched submenus:', addform_menuData.submenus);
        addform_setAvailableMenus(addform_menuData.menus);
        addform_setAvailableSubmenus(addform_menuData.submenus);
        addform_setFormError(null);
        addform_setPermissions([]);
        if (formRef.current) formRef.current.reset();
      } catch (err) {
        console.error('Error loading menus and submenus:', err);
        addform_setFormError(err.message || 'Failed to load features.');
        addform_setPermissions([]);
        if (formRef.current) formRef.current.reset();
        setTimeout(() => addform_setFormError(null), 4000);
      } finally {
        addform_setLoading(false);
      }
    };
    addform_loadData();
  }, []);

  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setEditingDetails(false);
    setEditingFeatures(false);
    setDetailsError(null);
    setFeaturesError(null);
    setisadd(false);
  };

  const handleBackClick = () => {
     router.refresh();
    setSelectedRole(null);
    setRoleDetails(null);
    setPermissions([]);
    setEditingDetails(false);
    setEditingFeatures(false);
    setDetailsError(null);
    setFeaturesError(null);
    setisadd(false);
   
  };

  const handleaddrole = () => {
    setSelectedRole(null);
    setRoleDetails(null);
    setPermissions([]);
    setEditingDetails(false);
    setEditingFeatures(false);
    setDetailsError(null);
    setFeaturesError(null);
    addform_setPermissions([]);
    addform_setFormError(null);
    if (formRef.current) formRef.current.reset();
    setisadd(true);
  };

  const handleDetailsEdit = () => {
    setEditingDetails(true);
  };

  const handleDetailsSave = async () => {
    if (!formData.rolename.trim()) {
      setDetailsError('Role name is required.');
      setTimeout(() => {
        setDetailsError(null);
        router.refresh();
      }, 4000);
      return;
    }
    try {
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('roleid', formData.roleid);
      formDataToSubmit.append('rolename', formData.rolename);
      formDataToSubmit.append('is_active', formData.is_active);
      console.log('Submitting form data:', Object.fromEntries(formDataToSubmit));
      const result = await updateRole({}, formDataToSubmit);
      if (result.success) {
        setEditingDetails(false);
        setRoleDetails({ ...roleDetails, rolename: formData.rolename, is_active: formData.is_active });
        const updatedRoles = await fetchRolesByOrgId(parseInt(orgid, 10));
        setRoles([...updatedRoles]);
        setDetailsError(null);
      } else {
        setDetailsError(result.error);
        setTimeout(() => {
          setDetailsError(null);
          router.refresh();
        }, 4000);
      }
    } catch (err) {
      setDetailsError(err.message);
      setTimeout(() => {
        setDetailsError(null);
        router.refresh();
      }, 4000);
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
    try {
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('roleid', formData.roleid);
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
        setTimeout(() => {
          setFeaturesError(null);
          router.refresh();
        }, 4000);
      }
    } catch (err) {
      setFeaturesError(err.message);
      setTimeout(() => {
        setFeaturesError(null);
        router.refresh();
      }, 4000);
    }
  };

  const handlePermissionToggle = (menuid, submenuid = null) => {
    const menu = availableMenus.find(m => m.menuid === menuid);
    if (!menu) return;

    setPermissions(prev => {
      const permissionSet = new Set(prev.map(p => `${p.menuid}:${p.submenuid || 'null'}`));
      let updatedPermissions = [...prev];

      const permissionKey = `${menuid}:${submenuid || 'null'}`;
      const exists = permissionSet.has(permissionKey);

      if (submenuid) {
        if (exists) {
          updatedPermissions = updatedPermissions.filter(
            p => !(p.menuid === menuid && p.submenuid === submenuid)
          );
        } else {
          updatedPermissions.push({ menuid, submenuid });
        }
        if (menu.hassubmenu === 'yes') {
          const remainingSubmenus = updatedPermissions.filter(p => p.menuid === menuid && p.submenuid);
          if (remainingSubmenus.length === 0) {
            updatedPermissions = updatedPermissions.filter(p => p.menuid !== menuid);
          }
        }
      } else {
        if (exists) {
          updatedPermissions = updatedPermissions.filter(p => p.menuid !== menuid);
        } else {
          updatedPermissions.push({ menuid, submenuid: null });
          if (menu.hassubmenu === 'yes') {
            const submenus = availableSubmenus
              .filter(sm => sm.menuid === menuid)
              .map(sm => ({ menuid, submenuid: sm.submenuid }))
              .filter(sm => !permissionSet.has(`${sm.menuid}:${sm.submenuid}`));
            updatedPermissions = [...updatedPermissions, ...submenus];
          }
        }
      }

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

  const addform_handleSubmit = async (formData) => {
    addform_setLoading(true);
    addform_setFormError(null);
    addform_setsuccess(null);

    formData.append('currentRole', currentRole || '');
    formData.append('orgid', orgid || '');
    formData.append('permissions', JSON.stringify(addform_permissions));

    const addform_invalidSelections = addform_permissions
      .filter(p => !p.submenuid)
      .map(p => addform_availableMenus.find(m => m.menuid === p.menuid))
      .filter(menu => menu && menu.hassubmenu === 'yes')
      .filter(menu => {
        const selectedSubmenus = addform_permissions.filter(p => p.menuid === menu.menuid && p.submenuid);
        return selectedSubmenus.length === 0;
      });
    if (addform_invalidSelections.length > 0) {
      addform_setFormError('Please select at least one submenu for each feature with submenus.');
      addform_setPermissions([]);
      if (formRef.current) formRef.current.reset();
      addform_setLoading(false);
      return;
    }

    try {
      const result = await addRole(formData);
      if (result?.error) {
        addform_setFormError(result.error);
        addform_setPermissions([]);
        if (formRef.current) formRef.current.reset();
        setTimeout(() => addform_setFormError(null), 4000);
      } else {
        addform_setsuccess("Role added successfully");
        setTimeout(() => {
          addform_setsuccess(null);
          setisadd(true);
           addform_setPermissions([]);
          if (formRef.current) formRef.current.reset();
          router.refresh();
        }, 2000);
      }
    } catch (err) {
      addform_setFormError(err.message || 'An unexpected error occurred.');
      addform_setPermissions([]);
      if (formRef.current) formRef.current.reset();
      setTimeout(() => addform_setFormError(null), 4000);
    } finally {
      addform_setLoading(false);
    }
  };

  const addform_handlePermissionToggle = (menuid, submenuid = null) => {
    const menu = addform_availableMenus.find(m => m.menuid === menuid);
    if (!menu) return;

    addform_setPermissions(prev => {
      const permissionSet = new Set(prev.map(p => `${p.menuid}:${p.submenuid || 'null'}`));
      let updatedPermissions = [...prev];

      const permissionKey = `${menuid}:${submenuid || 'null'}`;
      const exists = permissionSet.has(permissionKey);

      if (submenuid) {
        if (exists) {
          updatedPermissions = updatedPermissions.filter(
            p => !(p.menuid === menuid && p.submenuid === submenuid)
          );
        } else {
          updatedPermissions.push({ menuid, submenuid });
        }
        if (menu.hassubmenu === 'yes') {
          const remainingSubmenus = updatedPermissions.filter(p => p.menuid === menuid && p.submenuid);
          if (remainingSubmenus.length === 0) {
            updatedPermissions = updatedPermissions.filter(p => p.menuid !== menuid);
          }
        }
      } else {
        if (exists) {
          updatedPermissions = updatedPermissions.filter(p => p.menuid !== menuid);
        } else {
          updatedPermissions.push({ menuid, submenuid: null });
          if (menu.hassubmenu === 'yes') {
            const submenus = addform_availableSubmenus
              .filter(sm => sm.menuid === menuid)
              .map(sm => ({ menuid, submenuid: sm.submenuid }))
              .filter(sm => !permissionSet.has(`${sm.menuid}:${sm.submenuid}`));
            updatedPermissions = [...updatedPermissions, ...submenus];
          }
        }
      }

      console.log('Updated permissions:', updatedPermissions);
      return updatedPermissions;
    });
  };

  const getDisplayRoleId = (roleid) => {
    return roleid.split('-')[1] || roleid;
  };

  const canEditRoles = true;

  if (addform_loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="roles-overview-container">
      {detailsError && <div className="error-message">{detailsError}</div>}
      {isadd && (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
          <button className="back-button" onClick={handleBackClick}>x</button>
          <h1>Add Role</h1>
          
          {addform_formerror && <p style={{ color: "red" }}>{addform_formerror}</p>}
          {addform_success && <p style={{ color: "green" }}>{addform_success}</p>}
          <form action={addform_handleSubmit} ref={formRef}>
            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="orgid" style={{ display: "block", marginBottom: "5px" }}>
                Organization ID:
              </label>
              <input
                type="text"
                id="orgid"
                name="orgid"
                value={orgid || ''}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "5px",
                  border: "1px solid #ccc",
                  backgroundColor: "#f0f0f0",
                }}
                disabled
              />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="roleName" style={{ display: "block", marginBottom: "5px" }}>
                Role Name: *
              </label>
              <input
                type="text"
                id="roleName"
                name="roleName"
                placeholder="Enter role name (e.g., Manager)"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "5px",
                  border: "1px solid #ccc",
                }}
                required
              />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <h3>Select Features: *</h3>
              {addform_availableMenus.length === 0 ? (
                <p>No features available.</p>
              ) : (
                addform_availableMenus.map((menu) => (
                  <div key={`menu-${menu.menuid}`} style={{ margin: "10px 0" }}>
                    <label style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={addform_permissions.some((p) => p.menuid === menu.menuid && !p.submenuid)}
                        onChange={() => addform_handlePermissionToggle(menu.menuid)}
                        style={{ marginRight: "10px" }}
                      />
                      {menu.menuname}
                    </label>
                    {menu.hassubmenu === 'yes' && addform_availableSubmenus
                      .filter((sm) => sm.menuid === menu.menuid)
                      .map((submenu) => (
                        <div key={`submenu-${submenu.submenuid}`} style={{ margin: "5px 0", marginLeft: "20px" }}>
                          <label style={{ display: "flex", alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={addform_permissions.some(
                                (p) => p.menuid === menu.menuid && p.submenuid === submenu.submenuid
                              )}
                              onChange={() => addform_handlePermissionToggle(menu.menuid, submenu.submenuid)}
                              style={{ marginRight: "10px" }}
                            />
                            {submenu.submenuname}
                          </label>
                        </div>
                      ))}
                  </div>
                ))
              )}
            </div>
            <button
              type="submit"
              disabled={addform_loading}
              style={{
                padding: "10px 20px",
                backgroundColor: addform_loading ? "#ccc" : "#0070f3",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: addform_loading ? "not-allowed" : "pointer",
              }}
            >
              Add Role
            </button>
          </form>
        </div>
      )}
      {!isadd && !selectedRole && (
        <div className="roles-list">
          <button
            onClick={() => { handleaddrole() }}
            style={{
              padding: "10px 20px",
              backgroundColor: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Add Role
          </button>
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
                    <td>Role-{getDisplayRoleId(role.roleid)}</td>
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
      {selectedRole && roleDetails && !isadd && (
        <div className="role-details-container">
          <button className="back-button" onClick={handleBackClick}>x</button>
          <div className="role-details-block">
            <h2>Role Details</h2>
            {detailsError && <div className="error-message">{detailsError}</div>}
            {editingDetails ? (
              <form onSubmit={(e) => { e.preventDefault(); handleDetailsSave(); }}>
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
                    <p>Role-{getDisplayRoleId(formData.roleid)}</p>
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
                          <p><strong>{menu.menuname}</strong></p>
                          {menu.hassubmenu === 'yes' && subPerms.map((perm) => {
                            const submenu = availableSubmenus.find(sm => sm.submenuid === perm.submenuid);
                            return submenu ? (
                              <p key={`submenu-${perm.submenuid}`} className="permission-subitem">
                                - {submenu.submenuname}
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
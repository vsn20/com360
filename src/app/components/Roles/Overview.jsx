'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchRolesByOrgId, fetchRoleById, fetchMenusAndSubmenus, updateRole, addRole } from '@/app/serverActions/Roles/Overview';
import './rolesoverview.css';
import { useRouter, useSearchParams } from 'next/navigation';

const Overview = ({ currentRole, orgid, error }) => {
  const searchparams = useSearchParams();
  const router = useRouter();
  const formRef = useRef(null);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleDetails, setRoleDetails] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [tempPermissions, setTempPermissions] = useState([]); // Temporary permissions for editing
  const [availableMenus, setAvailableMenus] = useState([]);
  const [availableSubmenus, setAvailableSubmenus] = useState([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editingFeatures, setEditingFeatures] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null); // Store original form data for reverting
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
  const [sortConfig, setSortConfig] = useState({ column: 'roleid', direction: 'asc' }); // Default sort

  useEffect(() => {
    const loadData = async () => {
      try {
        const roleData = await fetchRolesByOrgId(parseInt(orgid, 10));
        setRoles([...roleData].sort((a, b) => sortRoles(a, b, 'roleid', 'asc'))); // Initial sort by roleid asc
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
          setTempPermissions([...uniquePermissions]); // Initialize temp permissions
          const initialFormData = {
            roleid: roleData.role.roleid || '',
            orgid: roleData.role.orgid || '',
            rolename: roleData.role.rolename || '',
            is_active: roleData.role.is_active ? '1' : '0',
          };
          setFormData(initialFormData);
          setOriginalFormData(initialFormData); // Store original data for reverting
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
          setTempPermissions([]);
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

  useEffect(() => {
    // Sort roles when sortConfig changes
    if (roles.length > 0) {
      setRoles([...roles].sort((a, b) => sortRoles(a, b, sortConfig.column, sortConfig.direction)));
    }
  }, [sortConfig]);

  useEffect(() => {
    // Handle refresh from search params
    console.log("through handle back");
    handleBackClick();
  }, [searchparams.get('refresh')]);

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
    setTempPermissions([]);
    setEditingDetails(false);
    setEditingFeatures(false);
    setDetailsError(null);
    setFeaturesError(null);
    setisadd(false);
    router.refresh();
  };

  const handleaddrole = () => {
    setSelectedRole(null);
    setRoleDetails(null);
    setPermissions([]);
    setTempPermissions([]);
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
        setOriginalFormData({ ...formData }); // Update original data after save
        const updatedRoles = await fetchRolesByOrgId(parseInt(orgid, 10));
        setRoles([...updatedRoles].sort((a, b) => sortRoles(a, b, sortConfig.column, sortConfig.direction)));
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

  const handleDetailsCancel = () => {
    setEditingDetails(false);
    setFormData({ ...originalFormData }); // Revert to original form data
  };

  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFeatureEdit = () => {
    setEditingFeatures(true);
    setTempPermissions([...permissions]); // Copy current permissions to temp
  };

  const handleFeatureSave = async () => {
    try {
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('roleid', formData.roleid);
      const uniquePermissions = Array.from(
        new Set(
          tempPermissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)
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
        setPermissions([...tempPermissions]); // Update actual permissions
        const roleData = await fetchRoleById(selectedRole.roleid);
        const updatedPermissions = roleData.permissions.map(p => ({
          menuid: p.menuid,
          submenuid: p.submenuid || null,
        }));
        setPermissions(updatedPermissions);
        setTempPermissions([...updatedPermissions]);
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

  const handleFeatureCancel = () => {
    setEditingFeatures(false);
    setTempPermissions([...permissions]); // Reset temp permissions to original
  };

  const handlePermissionToggle = (menuid, submenuid = null) => {
    const menu = availableMenus.find(m => m.menuid === menuid);
    if (!menu) return;

    setTempPermissions(prev => {
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
          // Auto-check parent menu when submenu is checked
          if (!updatedPermissions.some(p => p.menuid === menuid && !p.submenuid)) {
            updatedPermissions.push({ menuid, submenuid: null });
          }
        }
        const remainingSubmenus = updatedPermissions.filter(p => p.menuid === menuid && p.submenuid);
        if (remainingSubmenus.length === 0) {
          updatedPermissions = updatedPermissions.filter(p => p.menuid !== menuid || p.submenuid !== null);
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
        // Reload the roles data to include the newly added role
        const updatedRoles = await fetchRolesByOrgId(parseInt(orgid, 10));
        setRoles([...updatedRoles].sort((a, b) => sortRoles(a, b, sortConfig.column, sortConfig.direction)));
        
        setTimeout(() => {
          addform_setsuccess(null);
          addform_setPermissions([]);
          if (formRef.current) formRef.current.reset();
          // Redirect back to the roles list
          setisadd(false);
          setSelectedRole(null);
          setRoleDetails(null);
          setPermissions([]);
          setTempPermissions([]);
          setEditingDetails(false);
          setEditingFeatures(false);
          setDetailsError(null);
          setFeaturesError(null);
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
          // Auto-check parent menu when submenu is checked
          if (!updatedPermissions.some(p => p.menuid === menuid && !p.submenuid)) {
            updatedPermissions.push({ menuid, submenuid: null });
          }
        }
        const remainingSubmenus = updatedPermissions.filter(p => p.menuid === menuid && p.submenuid);
        if (remainingSubmenus.length === 0) {
          updatedPermissions = updatedPermissions.filter(p => p.menuid !== menuid || p.submenuid !== null);
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

      return updatedPermissions;
    });
  };

  const handleSelectAllToggle = () => {
    const allPermissions = [
      ...addform_availableMenus.map(menu => ({ menuid: menu.menuid, submenuid: null })),
      ...addform_availableSubmenus.map(submenu => ({ menuid: submenu.menuid, submenuid: submenu.submenuid }))
    ];
    const allSelected = addform_permissions.length === allPermissions.length;
    addform_setPermissions(allSelected ? [] : [...new Map(allPermissions.map(p => [JSON.stringify(p), p])).values()]);
  };

  const isAllSelected = () => {
    const allPermissions = [
      ...addform_availableMenus.map(menu => ({ menuid: menu.menuid, submenuid: null })),
      ...addform_availableSubmenus.map(submenu => ({ menuid: submenu.menuid, submenuid: submenu.submenuid }))
    ];
    return addform_permissions.length === allPermissions.length;
  };

  const handleStandardFeaturesToggle = () => {
    const standardPermissions = menusWithoutSubmenus.map(menu => ({ menuid: menu.menuid, submenuid: null }));
    const allStandardSelected = standardPermissions.every(stdPerm => 
      addform_permissions.some(p => p.menuid === stdPerm.menuid && !p.submenuid)
    );
    
    if (allStandardSelected) {
      // Remove all standard features
      addform_setPermissions(prev => prev.filter(p => 
        !standardPermissions.some(stdPerm => stdPerm.menuid === p.menuid && !p.submenuid)
      ));
    } else {
      // Add all standard features
      addform_setPermissions(prev => {
        const existingPermissions = prev.filter(p => 
          !standardPermissions.some(stdPerm => stdPerm.menuid === p.menuid && !p.submenuid)
        );
        return [...existingPermissions, ...standardPermissions];
      });
    }
  };

  const handleAdvancedFeaturesToggle = () => {
    const advancedPermissions = [
      ...menusWithSubmenus.map(menu => ({ menuid: menu.menuid, submenuid: null })),
      ...addform_availableSubmenus.filter(submenu => 
        menusWithSubmenus.some(menu => menu.menuid === submenu.menuid)
      ).map(submenu => ({ menuid: submenu.menuid, submenuid: submenu.submenuid }))
    ];
    
    const allAdvancedSelected = advancedPermissions.every(advPerm => 
      addform_permissions.some(p => 
        p.menuid === advPerm.menuid && 
        ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
      )
    );
    
    if (allAdvancedSelected) {
      // Remove all advanced features
      addform_setPermissions(prev => prev.filter(p => 
        !advancedPermissions.some(advPerm => 
          p.menuid === advPerm.menuid && 
          ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
        )
      ));
    } else {
      // Add all advanced features
      addform_setPermissions(prev => {
        const existingPermissions = prev.filter(p => 
          !advancedPermissions.some(advPerm => 
            p.menuid === advPerm.menuid && 
            ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
          )
        );
        return [...existingPermissions, ...advancedPermissions];
      });
    }
  };

  // Helper functions for permissions editing
  const menusWithoutSubmenus = availableMenus.filter(menu => menu.hassubmenu !== 'yes');
  const menusWithSubmenus = availableMenus.filter(menu => menu.hassubmenu === 'yes');

  // Check if all permissions are selected (for editing)
  const isAllPermissionsSelected = () => {
    const allPermissions = [
      ...availableMenus.map(menu => ({ menuid: menu.menuid, submenuid: null })),
      ...availableSubmenus.map(submenu => ({ menuid: submenu.menuid, submenuid: submenu.submenuid }))
    ];
    return tempPermissions.length === allPermissions.length;
  };

  // Toggle all permissions (for editing)
  const handleAllPermissionsToggle = () => {
    const allPermissions = [
      ...availableMenus.map(menu => ({ menuid: menu.menuid, submenuid: null })),
      ...availableSubmenus.map(submenu => ({ menuid: submenu.menuid, submenuid: submenu.submenuid }))
    ];
    const allSelected = tempPermissions.length === allPermissions.length;
    setTempPermissions(allSelected ? [] : [...new Map(allPermissions.map(p => [JSON.stringify(p), p])).values()]);
  };

  // Toggle standard features (menus without submenus) for editing
  const handleStandardPermissionsToggle = () => {
    const standardPermissions = menusWithoutSubmenus.map(menu => ({ menuid: menu.menuid, submenuid: null }));
    const allStandardSelected = standardPermissions.every(stdPerm => 
      tempPermissions.some(p => p.menuid === stdPerm.menuid && !p.submenuid)
    );
    
    if (allStandardSelected) {
      // Remove all standard features
      setTempPermissions(prev => prev.filter(p => 
        !standardPermissions.some(stdPerm => stdPerm.menuid === p.menuid && !p.submenuid)
      ));
    } else {
      // Add all standard features
      setTempPermissions(prev => {
        const existingPermissions = prev.filter(p => 
          !standardPermissions.some(stdPerm => stdPerm.menuid === p.menuid && !p.submenuid)
        );
        return [...existingPermissions, ...standardPermissions];
      });
    }
  };

  // Toggle advanced features (menus with submenus) for editing
  const handleAdvancedPermissionsToggle = () => {
    const advancedPermissions = [
      ...menusWithSubmenus.map(menu => ({ menuid: menu.menuid, submenuid: null })),
      ...availableSubmenus.filter(submenu => 
        menusWithSubmenus.some(menu => menu.menuid === submenu.menuid)
      ).map(submenu => ({ menuid: submenu.menuid, submenuid: submenu.submenuid }))
    ];
    
    const allAdvancedSelected = advancedPermissions.every(advPerm => 
      tempPermissions.some(p => 
        p.menuid === advPerm.menuid && 
        ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
      )
    );
    
    if (allAdvancedSelected) {
      // Remove all advanced features
      setTempPermissions(prev => prev.filter(p => 
        !advancedPermissions.some(advPerm => 
          p.menuid === advPerm.menuid && 
          ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
        )
      ));
    } else {
      // Add all advanced features
      setTempPermissions(prev => {
        const existingPermissions = prev.filter(p => 
          !advancedPermissions.some(advPerm => 
            p.menuid === advPerm.menuid && 
            ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
          )
        );
        return [...existingPermissions, ...advancedPermissions];
      });
    }
  };

  const getDisplayRoleId = (roleid) => {
    return roleid.split('-')[1] || roleid;
  };

  const canEditRoles = true;

  const sortRoles = (a, b, column, direction) => {
    let aValue, bValue;
    switch (column) {
      case 'roleid':
        aValue = parseInt(a.roleid.split('-')[1] || a.roleid);
        bValue = parseInt(b.roleid.split('-')[1] || b.roleid);
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      case 'rolename':
        aValue = a.rolename || '';
        bValue = b.rolename || '';
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      case 'is_active':
        aValue = a.is_active ? 'Yes' : 'No';
        bValue = b.is_active ? 'Yes' : 'No';
        if (direction === 'asc') {
          return aValue === 'Yes' ? -1 : bValue === 'Yes' ? 1 : aValue.localeCompare(bValue);
        } else {
          return aValue === 'No' ? -1 : bValue === 'No' ? 1 : bValue.localeCompare(aValue);
        }
      case 'created_date':
        aValue = new Date(a.CREATED_DATE).getTime();
        bValue = new Date(b.CREATED_DATE).getTime();
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
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

  if (addform_loading) {
    return <div>Loading...</div>;
  }

  // Separate menus with and without submenus for add form
  const menusWithoutSubmenus_addform = addform_availableMenus.filter(menu => menu.hassubmenu !== 'yes');
  const menusWithSubmenus_addform = addform_availableMenus.filter(menu => menu.hassubmenu === 'yes');

  // Helper function to render permission grid
  const renderPermissionsGrid = (isEditing = false, permissionsToUse = permissions) => {
    return (
      <>
        {/* Features Header with Select All */}
        {isEditing && (
          <div className="permissions-header">
            <div className="permissions-title">Select Features:</div>
            <div className="permissions-toggle-buttons">
              <label className="permissions-toggle-checkbox-label">
                <input
                  type="checkbox"
                  checked={isAllPermissionsSelected()}
                  onChange={handleAllPermissionsToggle}
                  className="permissions-toggle-checkbox"
                />
              </label>
            </div>
          </div>
        )}

        {/* Menus without submenus */}
        {menusWithoutSubmenus.length > 0 && (
          <div className="permissions-menus-without-submenus">
            <div className="permissions-menu-category-header">
              <div className="permissions-menu-category-title">Standalone Features</div>
              {isEditing && (
                <label className="permissions-category-toggle-label">
                  <input
                    type="checkbox"
                    checked={menusWithoutSubmenus.every(menu => 
                      permissionsToUse.some(p => p.menuid === menu.menuid && !p.submenuid)
                    )}
                    onChange={handleStandardPermissionsToggle}
                    className="permissions-category-toggle-checkbox"
                  />
                </label>
              )}
            </div>
            <div className="permissions-grid">
              {Array.from({ length: Math.ceil(menusWithoutSubmenus.length / 5) }, (_, row) => (
                <div key={`no-submenu-row-${row}`} className="permissions-row">
                  {menusWithoutSubmenus.slice(row * 5, (row * 5) + 5).map((menu) => (
                    <div key={`menu-${menu.menuid}`} className="permission-item">
                      <label className="menu-label">
                        <span className="permission-name">{menu.menuname}</span>
                        <input
                          type="checkbox"
                          checked={permissionsToUse.some((p) => p.menuid === menu.menuid && !p.submenuid)}
                          onChange={isEditing ? () => handlePermissionToggle(menu.menuid) : undefined}
                          className="permission-checkbox"
                          disabled={!isEditing}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Menus with submenus */}
        {menusWithSubmenus.length > 0 && (
          <div className="permissions-menus-with-submenus">
            <div className="permissions-menu-category-header">
              <div className="permissions-menu-category-title">Expandable Features</div>
              {isEditing && (
                <label className="permissions-category-toggle-label">
                  <input
                    type="checkbox"
                    checked={(() => {
                      const advancedPermissions = [
                        ...menusWithSubmenus.map(menu => ({ menuid: menu.menuid, submenuid: null })),
                        ...availableSubmenus.filter(submenu => 
                          menusWithSubmenus.some(menu => menu.menuid === submenu.menuid)
                        ).map(submenu => ({ menuid: submenu.menuid, submenuid: submenu.submenuid }))
                      ];
                      return advancedPermissions.every(advPerm => 
                        permissionsToUse.some(p => 
                          p.menuid === advPerm.menuid && 
                          ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
                        )
                      );
                    })()}
                    onChange={handleAdvancedPermissionsToggle}
                    className="permissions-category-toggle-checkbox"
                  />
                </label>
              )}
            </div>
            <div className="permissions-grid">
              {Array.from({ length: Math.ceil(menusWithSubmenus.length / 5) }, (_, row) => (
                <div key={`submenu-row-${row}`} className="permissions-row">
                  {menusWithSubmenus.slice(row * 5, (row * 5) + 5).map((menu) => (
                    <div key={`menu-${menu.menuid}`} className="permission-item-with-submenus">
                      <label className="menu-label main-permission-feature">
                        <span className="permission-name">{menu.menuname}</span>
                        <input
                          type="checkbox"
                          checked={permissionsToUse.some((p) => p.menuid === menu.menuid && !p.submenuid)}
                          onChange={isEditing ? () => handlePermissionToggle(menu.menuid) : undefined}
                          className="permission-checkbox"
                          disabled={!isEditing}
                        />
                      </label>
                      <div className="permission-submenus-container">
                        {availableSubmenus
                          .filter((sm) => sm.menuid === menu.menuid)
                          .map((submenu) => (
                            <div key={`submenu-${submenu.submenuid}`} className="permission-subitem">
                              <label className="submenu-label">
                                <span className="submenu-name">{submenu.submenuname}</span>
                                <input
                                  type="checkbox"
                                  checked={permissionsToUse.some(
                                    (p) => p.menuid === menu.menuid && p.submenuid === submenu.submenuid
                                  )}
                                  onChange={isEditing ? () => handlePermissionToggle(menu.menuid, submenu.submenuid) : undefined}
                                  className="permission-checkbox"
                                  disabled={!isEditing}
                                />
                              </label>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="roles-overview-container">
      {detailsError && <div className="error-message">{detailsError}</div>}
      {isadd && (
        <div className="add-role-container">
          <div className="header-section">
            <h1 className="title">Add Role</h1>
            <button className="back-button" onClick={handleBackClick}></button>
          </div>
          
          {addform_formerror && <p style={{ color: "red" }}>{addform_formerror}</p>}
          {addform_success && <p style={{ color: "green" }}>{addform_success}</p>}
          <form action={addform_handleSubmit} ref={formRef} className="add-role-form">
            <div className="form-section">
              <div className="role-name-section">
                <label htmlFor="roleName" className="role-name-label">
                  Role Name: *
                </label>
                <input
                  type="text"
                  id="roleName"
                  name="roleName"
                  placeholder="Enter role name (e.g., Manager)"
                  className="role-name-input"
                  required
                />
              </div>
              
              <div className="features-section">
                <div className="features-header">
                  <div className="features-title">Select Features: *</div>
                  <div className="toggle-buttons">
                    <label className="toggle-checkbox-label">
                      <input
                        type="checkbox"
                        checked={isAllSelected()}
                        onChange={handleSelectAllToggle}
                        className="toggle-checkbox"
                      />
                    </label>
                  </div>
                </div>

                {/* Menus without submenus */}
                {menusWithoutSubmenus_addform.length > 0 && (
                  <div className="menus-without-submenus">
                    <div className="menu-category-header">
                      <div className="menu-category-title">Standalone Features</div>
                      <label className="category-toggle-label">
                        <input
                          type="checkbox"
                          checked={menusWithoutSubmenus_addform.every(menu => 
                            addform_permissions.some(p => p.menuid === menu.menuid && !p.submenuid)
                          )}
                          onChange={handleStandardFeaturesToggle}
                          className="category-toggle-checkbox"
                        />
                      </label>
                    </div>
                    <div className="features-grid">
                      {Array.from({ length: Math.ceil(menusWithoutSubmenus_addform.length / 5) }, (_, row) => (
                        <div key={`no-submenu-row-${row}`} className="features-row">
                          {menusWithoutSubmenus_addform.slice(row * 5, (row * 5) + 5).map((menu) => (
                            <div key={`menu-${menu.menuid}`} className="feature-item">
                              <label className="feature-label">
                                <span className="feature-name">{menu.menuname}</span>
                                <input
                                  type="checkbox"
                                  checked={addform_permissions.some((p) => p.menuid === menu.menuid && !p.submenuid)}
                                  onChange={() => addform_handlePermissionToggle(menu.menuid)}
                                  className="feature-checkbox"
                                />
                              </label>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Menus with submenus */}
                {menusWithSubmenus_addform.length > 0 && (
                  <div className="menus-with-submenus">
                    <div className="menu-category-header">
                      <div className="menu-category-title">Expandable Features</div>
                      <label className="category-toggle-label">
                        <input
                          type="checkbox"
                          checked={(() => {
                            const advancedPermissions = [
                              ...menusWithSubmenus_addform.map(menu => ({ menuid: menu.menuid, submenuid: null })),
                              ...addform_availableSubmenus.filter(submenu => 
                                menusWithSubmenus_addform.some(menu => menu.menuid === submenu.menuid)
                              ).map(submenu => ({ menuid: submenu.menuid, submenuid: submenu.submenuid }))
                            ];
                            return advancedPermissions.every(advPerm => 
                              addform_permissions.some(p => 
                                p.menuid === advPerm.menuid && 
                                ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
                              )
                            );
                          })()}
                          onChange={handleAdvancedFeaturesToggle}
                          className="category-toggle-checkbox"
                        />
                      </label>
                    </div>
                    <div className="features-grid">
                      {Array.from({ length: Math.ceil(menusWithSubmenus_addform.length / 5) }, (_, row) => (
                        <div key={`submenu-row-${row}`} className="features-row">
                          {menusWithSubmenus_addform.slice(row * 5, (row * 5) + 5).map((menu) => (
                            <div key={`menu-${menu.menuid}`} className="feature-item-with-submenus">
                              <label className="feature-label main-feature">
                                <span className="feature-name">{menu.menuname}</span>
                                <input
                                  type="checkbox"
                                  checked={addform_permissions.some((p) => p.menuid === menu.menuid && !p.submenuid)}
                                  onChange={() => addform_handlePermissionToggle(menu.menuid)}
                                  className="feature-checkbox"
                                />
                              </label>
                              <div className="submenus-container">
                                {addform_availableSubmenus
                                  .filter((sm) => sm.menuid === menu.menuid)
                                  .map((submenu) => (
                                    <label key={`submenu-${submenu.submenuid}`} className="feature-label submenu-label">
                                      <span className="submenu-name">{submenu.submenuname}</span>
                                      <input
                                        type="checkbox"
                                        checked={addform_permissions.some(
                                          (p) => p.menuid === menu.menuid && p.submenuid === submenu.submenuid
                                        )}
                                        onChange={() => addform_handlePermissionToggle(menu.menuid, submenu.submenuid)}
                                        className="feature-checkbox"
                                      />
                                    </label>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="submit-section">
              <button
                type="submit"
                disabled={addform_loading}
                className="button"
              >
                Add Role
              </button>
            </div>
          </form>
        </div>
      )}
      {!isadd && !selectedRole && (
  <div className="roles-list" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <div className="title">Existing Roles</div>
      <button
        className="button"
        onClick={() => handleaddrole()}
        style={{
          cursor: "pointer",
          marginLeft: "auto",
        }}
      >
        Add Role
      </button>
    </div>
    {roles.length === 0 && !detailsError ? (
      <p className="empty-state">No active roles found.</p>
    ) : (
      <div className="table-wrapper">
        <table className="roles-table four-column">
          <colgroup>
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className={sortConfig.column === 'roleid' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('roleid')}>
                Role ID
              </th>
              <th className={sortConfig.column === 'rolename' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('rolename')}>
                Role Name
              </th>
              <th className={sortConfig.column === 'is_active' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('is_active')}>
                Is Active
              </th>
              <th className={sortConfig.column === 'created_date' ? `sortable sort-${sortConfig.direction}` : 'sortable'} onClick={() => requestSort('created_date')}>
                Created Date
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={`${role.roleid}-${role.orgid}`} onClick={() => handleRoleClick(role)} style={{ cursor: 'pointer' }}>
                <td className="id-cell">
                  <span className="role-indicator"></span>Role-{getDisplayRoleId(role.roleid)}
                </td>
                <td className="name-cell">{role.rolename}</td>
                <td className={role.is_active ? 'status-badge active' : 'status-badge inactive'}>
                  {role.is_active ? 'Yes' : 'No'}
                </td>
                <td className="date-cell">
                  {role.CREATED_DATE ? new Date(role.CREATED_DATE).toLocaleDateString() : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}
      {selectedRole && roleDetails && !isadd && (
        <div className="role-details-container">
          <div className="header-section">
            <h1 className="title">Edit Role</h1>
            <button className="back-button" onClick={handleBackClick}></button>
          </div>
          <div className="role-details-block">
            <div className="roledetails-header">
              <div>Role Details</div>
              {canEditRoles && !roleDetails.isadmin && !editingDetails && (
                <button className="button" onClick={handleDetailsEdit}>Edit</button>
              )}
            </div>
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
                  <button type="submit" className="save">Save</button>
                  <button type="button" className="cancel" onClick={handleDetailsCancel}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="view-details">
                <div className="details-row">
                  <div className="details-g">
                    <label>Role ID</label>
                    <p>Role-{getDisplayRoleId(formData.roleid)}</p>
                  </div>
                  <div className="details-g">
                    <label>Role Name</label>
                    <p>{formData.rolename}</p>
                  </div>
                </div>
                <div className="details-row">
                  <div className="details-g">
                    <label>Is Active</label>
                    <p>{formData.is_active === '1' ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="features-block">
            <div className="features-header-block">
              <div>Features</div>
              {canEditRoles && !roleDetails.isadmin && !editingFeatures && (
                <button className="button" onClick={handleFeatureEdit}>Edit</button>
              )}
            </div>
            {featuresError && <div className="error-message">{featuresError}</div>}
            <div className="permissions-container">
              {renderPermissionsGrid(editingFeatures, editingFeatures ? tempPermissions : permissions)}
              
              {editingFeatures && (
                <div className="form-buttons">
                  <button className="save" onClick={handleFeatureSave}>Save</button>
                  <button className="cancel" onClick={handleFeatureCancel}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overview;
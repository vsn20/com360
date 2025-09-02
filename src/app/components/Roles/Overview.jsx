'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchRolesByOrgId, fetchRoleById, fetchMenusAndSubmenus, updateRole, addRole } from '@/app/serverActions/Roles/Overview';
import './rolesoverview.css';
import { useRouter, useSearchParams } from 'next/navigation';
import Loading from '../Loading/Loading';

const Overview = ({ currentRole, orgid, noofrows, error }) => {
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
  const [originalFormData, setOriginalFormData] = useState(null);
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
  const [sortConfig, setSortConfig] = useState({ column: 'roleid', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [rolesLoading, setRolesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rolesPerPage,setroleperpage]=useState(10);
  const [duplicate,setduplicate]=useState(10);

  useEffect(() => {
    const loadData = async () => {
      setRolesLoading(true);
      try {
        const roleData = await fetchRolesByOrgId(parseInt(orgid, 10));
        setRoles([...roleData].sort((a, b) => sortRoles(a, b, 'roleid', 'asc')));
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
      } finally {
        setRolesLoading(false);
      }
    };
    loadData();
  }, [orgid]);

  useEffect(() => {
    const loadRoleData = async () => {
      if (selectedRole) {
        setRolesLoading(true);
        try {
          const roleData = await fetchRoleById(selectedRole.roleid);
          setRoleDetails(roleData.role);
          const uniquePermissions = Array.from(
            new Set(
              roleData.permissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)
            ),
            key => {
              const [menuid, submenuid] = key.split(':');
              const perm = roleData.permissions.find(
                p => p.menuid === parseInt(menuid) && (submenuid === 'null' ? p.submenuid === null : p.submenuid === parseInt(submenuid))
              );
              return {
                menuid: parseInt(menuid),
                submenuid: submenuid === 'null' ? null : parseInt(submenuid),
                alldata: perm ? perm.alldata : 0, // Include alldata from fetched permissions
              };
            }
          );
          setPermissions(uniquePermissions);
          setTempPermissions([...uniquePermissions]);
          const initialFormData = {
            roleid: roleData.role.roleid || '',
            orgid: roleData.role.orgid || '',
            rolename: roleData.role.rolename || '',
            is_active: roleData.role.is_active ? '1' : '0',
          };
          setFormData(initialFormData);
          setOriginalFormData(initialFormData);
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
        } finally {
          setRolesLoading(false);
        }
      }
    };
    loadRoleData();
  }, [selectedRole]);

  useEffect(() => {
    const addform_loadData = async () => {
      try {
        const addform_menuData = await fetchMenusAndSubmenus();
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
    if (roles.length > 0) {
      setRoles([...roles].sort((a, b) => sortRoles(a, b, sortConfig.column, sortConfig.direction)));
    }
  }, [sortConfig]);

  useEffect(() => {
    handleBackClick();
  }, [searchparams.get('refresh')]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

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
    setCurrentPage(1);
    setPageInputValue('1');
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
    setRolesLoading(true);
    try {
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('roleid', formData.roleid);
      formDataToSubmit.append('rolename', formData.rolename);
      formDataToSubmit.append('is_active', formData.is_active);
      const result = await updateRole({}, formDataToSubmit);
      if (result.success) {
        setEditingDetails(false);
        setRoleDetails({ ...roleDetails, rolename: formData.rolename, is_active: formData.is_active });
        setOriginalFormData({ ...formData });
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
    } finally {
      setRolesLoading(false);
    }
  };

  const handleDetailsCancel = () => {
    setEditingDetails(false);
    setFormData({ ...originalFormData });
  };

  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFeatureEdit = () => {
    setEditingFeatures(true);
    setTempPermissions([...permissions]);
  };

  const handleFeatureSave = async () => {
    setRolesLoading(true);
    try {
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('roleid', formData.roleid);
      const uniquePermissions = Array.from(
        new Set(
          tempPermissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)
        ),
        key => {
          const [menuid, submenuid] = key.split(':');
          const perm = tempPermissions.find(
            p => p.menuid === parseInt(menuid) && (submenuid === 'null' ? p.submenuid === null : p.submenuid === parseInt(submenuid))
          );
          return {
            menuid: parseInt(menuid),
            submenuid: submenuid === 'null' ? null : parseInt(submenuid),
            alldata: perm.alldata || 0, // Include alldata in saved permissions
          };
        }
      );
      formDataToSubmit.append('permissions', JSON.stringify(uniquePermissions));
      const result = await updateRole({}, formDataToSubmit);
      if (result.success) {
        setEditingFeatures(false);
        setPermissions([...uniquePermissions]);
        setTempPermissions([...uniquePermissions]);
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
    } finally {
      setRolesLoading(false);
    }
  };

  const handleFeatureCancel = () => {
    setEditingFeatures(false);
    setTempPermissions([...permissions]);
  };

  const handlePermissionToggle = (menuid, submenuid = null) => {
    const C_MENU = availableMenus.find(m => m.menuid === menuid);
    if (!C_MENU) return;

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
          updatedPermissions.push({ menuid, submenuid, alldata: 0 });
          if (!updatedPermissions.some(p => p.menuid === menuid && !p.submenuid)) {
            updatedPermissions.push({ menuid, submenuid: null, alldata: 0 });
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
          updatedPermissions.push({ menuid, submenuid: null, alldata: menuid === 11 ? prev.find(p => p.menuid === 11 && !p.submenuid)?.alldata || 0 : 0 });
          if (C_MENU.hassubmenu === 'yes') {
            const submenus = availableSubmenus
              .filter(sm => sm.menuid === menuid)
              .map(sm => ({ menuid, submenuid: sm.submenuid, alldata: sm.submenuid === 17 ? prev.find(p => p.menuid === 12 && p.submenuid === 17)?.alldata || 0 : 0 }))
              .filter(sm => !permissionSet.has(`${sm.menuid}:${sm.submenuid}`));
            updatedPermissions = [...updatedPermissions, ...submenus];
          }
        }
      }

      const uniquePermissions = Array.from(
        new Set(updatedPermissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)),
        key => {
          const [menuid, submenuid] = key.split(':');
          const perm = updatedPermissions.find(
            p => p.menuid === parseInt(menuid) && (submenuid === 'null' ? p.submenuid === null : p.submenuid === parseInt(submenuid))
          );
          return {
            menuid: parseInt(menuid),
            submenuid: submenuid === 'null' ? null : parseInt(submenuid),
            alldata: perm.alldata || 0,
          };
        }
      );

      return uniquePermissions;
    });
  };

  const handleAllDataToggle = (menuid, submenuid = null) => {
    if ((menuid !== 11 && submenuid === null) && (menuid !== 12 || submenuid !== 17)) return; // Only for Service Requests (menuid 11, no C_SUBMENU) and Interview (menuid 12, submenuid 17)

    setTempPermissions(prev => {
      const updatedPermissions = prev.map(p => {
        if (p.menuid === menuid && p.submenuid === submenuid) {
          return { ...p, alldata: p.alldata === 1 ? 0 : 1 };
        }
        return p;
      });
      return updatedPermissions;
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
      .filter(C_MENU => C_MENU && C_MENU.hassubmenu === 'yes')
      .filter(C_MENU => {
        const selectedSubmenus = addform_permissions.filter(p => p.menuid === C_MENU.menuid && p.submenuid);
        return selectedSubmenus.length === 0;
      });
    if (addform_invalidSelections.length > 0) {
      addform_setFormError('Please select at least one C_SUBMENU for each feature with submenus.');
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
        const updatedRoles = await fetchRolesByOrgId(parseInt(orgid, 10));
        setRoles([...updatedRoles].sort((a, b) => sortRoles(a, b, sortConfig.column, sortConfig.direction)));
        setTimeout(() => {
          addform_setsuccess(null);
          addform_setPermissions([]);
          if (formRef.current) formRef.current.reset();
          setisadd(false);
          setSelectedRole(null);
          setRoleDetails(null);
          setPermissions([]);
          setTempPermissions([]);
          setEditingDetails(false);
          setEditingFeatures(false);
          setDetailsError(null);
          setFeaturesError(null);
          setCurrentPage(1);
          setPageInputValue('1');
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
    const C_MENU = addform_availableMenus.find(m => m.menuid === menuid);
    if (!C_MENU) return;

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
          updatedPermissions.push({ menuid, submenuid, alldata: 0 });
          if (!updatedPermissions.some(p => p.menuid === menuid && !p.submenuid)) {
            updatedPermissions.push({ menuid, submenuid: null, alldata: 0 });
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
          updatedPermissions.push({ menuid, submenuid: null, alldata: menuid === 11 ? prev.find(p => p.menuid === 11 && !p.submenuid)?.alldata || 0 : 0 });
          if (C_MENU.hassubmenu === 'yes') {
            const submenus = addform_availableSubmenus
              .filter(sm => sm.menuid === menuid)
              .map(sm => ({ menuid, submenuid: sm.submenuid, alldata: sm.submenuid === 17 ? prev.find(p => p.menuid === 12 && p.submenuid === 17)?.alldata || 0 : 0 }))
              .filter(sm => !permissionSet.has(`${sm.menuid}:${sm.submenuid}`));
            updatedPermissions = [...updatedPermissions, ...submenus];
          }
        }
      }

      return updatedPermissions;
    });
  };

  const addform_handleAllDataToggle = (menuid, submenuid = null) => {
    if ((menuid !== 11 && submenuid === null) && (menuid !== 12 || submenuid !== 17)) return; // Only for Service Requests (menuid 11, no C_SUBMENU) and Interview (menuid 12, submenuid 17)

    addform_setPermissions(prev => {
      const updatedPermissions = prev.map(p => {
        if (p.menuid === menuid && p.submenuid === submenuid) {
          return { ...p, alldata: p.alldata === 1 ? 0 : 1 };
        }
        return p;
      });
      return updatedPermissions;
    });
  };

  const handleSelectAllToggle = () => {
    const allPermissions = [
      ...addform_availableMenus.map(C_MENU => ({ menuid: C_MENU.menuid, submenuid: null, alldata: C_MENU.menuid === 11 ? 0 : 0 })),
      ...addform_availableSubmenus.map(C_SUBMENU => ({ menuid: C_SUBMENU.menuid, submenuid: C_SUBMENU.submenuid, alldata: C_SUBMENU.submenuid === 17 ? 0 : 0 }))
    ];
    const allSelected = addform_permissions.length === allPermissions.length;
    addform_setPermissions(allSelected ? [] : [...new Map(allPermissions.map(p => [JSON.stringify(p), p])).values()]);
  };

  const isAllSelected = () => {
    const allPermissions = [
      ...addform_availableMenus.map(C_MENU => ({ menuid: C_MENU.menuid, submenuid: null })),
      ...addform_availableSubmenus.map(C_SUBMENU => ({ menuid: C_SUBMENU.menuid, submenuid: C_SUBMENU.submenuid }))
    ];
    return addform_permissions.length === allPermissions.length;
  };

  const handleStandardFeaturesToggle = () => {
    const standardPermissions = menusWithoutSubmenus.map(C_MENU => ({
      menuid: C_MENU.menuid,
      submenuid: null,
      alldata: C_MENU.menuid === 11 ? addform_permissions.find(p => p.menuid === 11 && !p.submenuid)?.alldata || 0 : 0
    }));
    const allStandardSelected = standardPermissions.every(stdPerm => 
      addform_permissions.some(p => p.menuid === stdPerm.menuid && !p.submenuid)
    );
    addform_setPermissions(prev => {
      if (allStandardSelected) {
        return prev.filter(p => !standardPermissions.some(stdPerm => stdPerm.menuid === p.menuid && !p.submenuid));
      } else {
        const existingPermissions = prev.filter(p => !standardPermissions.some(stdPerm => stdPerm.menuid === p.menuid && !p.submenuid));
        return [...existingPermissions, ...standardPermissions];
      }
    });
  };

  const handleAdvancedFeaturesToggle = () => {
    const advancedPermissions = [
      ...menusWithSubmenus.map(C_MENU => ({ menuid: C_MENU.menuid, submenuid: null, alldata: 0 })),
      ...addform_availableSubmenus.filter(C_SUBMENU => 
        menusWithSubmenus.some(C_MENU => C_MENU.menuid === C_SUBMENU.menuid)
      ).map(C_SUBMENU => ({ menuid: C_SUBMENU.menuid, submenuid: C_SUBMENU.submenuid, alldata: C_SUBMENU.submenuid === 17 ? 0 : 0 }))
    ];
    const allAdvancedSelected = advancedPermissions.every(advPerm => 
      addform_permissions.some(p => 
        p.menuid === advPerm.menuid && 
        ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
      )
    );
    addform_setPermissions(prev => {
      if (allAdvancedSelected) {
        return prev.filter(p => 
          !advancedPermissions.some(advPerm => 
            p.menuid === advPerm.menuid && 
            ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
          )
        );
      } else {
        const existingPermissions = prev.filter(p => 
          !advancedPermissions.some(advPerm => 
            p.menuid === advPerm.menuid && 
            ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
          )
        );
        return [...existingPermissions, ...advancedPermissions];
      }
    });
  };

  const menusWithoutSubmenus = availableMenus.filter(C_MENU => C_MENU.hassubmenu !== 'yes');
  const menusWithSubmenus = availableMenus.filter(C_MENU => C_MENU.hassubmenu === 'yes');

  const isAllPermissionsSelected = () => {
    const allPermissions = [
      ...availableMenus.map(C_MENU => ({ menuid: C_MENU.menuid, submenuid: null })),
      ...availableSubmenus.map(C_SUBMENU => ({ menuid: C_SUBMENU.menuid, submenuid: C_SUBMENU.submenuid }))
    ];
    return tempPermissions.length === allPermissions.length;
  };

  const handleAllPermissionsToggle = () => {
    const allPermissions = [
      ...availableMenus.map(C_MENU => ({ menuid: C_MENU.menuid, submenuid: null, alldata: C_MENU.menuid === 11 ? tempPermissions.find(p => p.menuid === 11 && !p.submenuid)?.alldata || 0 : 0 })),
      ...availableSubmenus.map(C_SUBMENU => ({ menuid: C_SUBMENU.menuid, submenuid: C_SUBMENU.submenuid, alldata: C_SUBMENU.submenuid === 17 ? tempPermissions.find(p => p.menuid === 12 && p.submenuid === 17)?.alldata || 0 : 0 }))
    ];
    const allSelected = tempPermissions.length === allPermissions.length;
    setTempPermissions(allSelected ? [] : [...new Map(allPermissions.map(p => [JSON.stringify(p), p])).values()]);
  };

  const handleStandardPermissionsToggle = () => {
    const standardPermissions = menusWithoutSubmenus.map(C_MENU => ({
      menuid: C_MENU.menuid,
      submenuid: null,
      alldata: C_MENU.menuid === 11 ? tempPermissions.find(p => p.menuid === 11 && !p.submenuid)?.alldata || 0 : 0
    }));
    const allStandardSelected = standardPermissions.every(stdPerm => 
      tempPermissions.some(p => p.menuid === stdPerm.menuid && !p.submenuid)
    );
    setTempPermissions(prev => {
      if (allStandardSelected) {
        return prev.filter(p => !standardPermissions.some(stdPerm => stdPerm.menuid === p.menuid && !p.submenuid));
      } else {
        const existingPermissions = prev.filter(p => !standardPermissions.some(stdPerm => stdPerm.menuid === p.menuid && !p.submenuid));
        return [...existingPermissions, ...standardPermissions];
      }
    });
  };

  const handleAdvancedPermissionsToggle = () => {
    const advancedPermissions = [
      ...menusWithSubmenus.map(C_MENU => ({ menuid: C_MENU.menuid, submenuid: null, alldata: 0 })),
      ...availableSubmenus.filter(C_SUBMENU => 
        menusWithSubmenus.some(C_MENU => C_MENU.menuid === C_SUBMENU.menuid)
      ).map(C_SUBMENU => ({ menuid: C_SUBMENU.menuid, submenuid: C_SUBMENU.submenuid, alldata: C_SUBMENU.submenuid === 17 ? tempPermissions.find(p => p.menuid === 12 && p.submenuid === 17)?.alldata || 0 : 0 }))
    ];
    const allAdvancedSelected = advancedPermissions.every(advPerm => 
      tempPermissions.some(p => 
        p.menuid === advPerm.menuid && 
        ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
      )
    );
    setTempPermissions(prev => {
      if (allAdvancedSelected) {
        return prev.filter(p => 
          !advancedPermissions.some(advPerm => 
            p.menuid === advPerm.menuid && 
            ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
          )
        );
      } else {
        const existingPermissions = prev.filter(p => 
          !advancedPermissions.some(advPerm => 
            p.menuid === advPerm.menuid && 
            ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
          )
        );
        return [...existingPermissions, ...advancedPermissions];
      }
    });
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

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleIsActiveFilterChange = (e) => {
    setIsActiveFilter(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
    setCurrentPage(1);
    setPageInputValue('1');
  };

  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.rolename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = isActiveFilter === 'all' ||
                         (isActiveFilter === 'yes' && role.is_active) ||
                         (isActiveFilter === 'no' && !role.is_active);
    let matchesDate = true;
    if (role.CREATED_DATE && (startDate || endDate)) {
      const createdDate = new Date(role.CREATED_DATE);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (start && end && start > end) {
        return false;
      }
      if (start) {
        start.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && createdDate >= start;
      }
      if (end) {
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && createdDate <= end;
      }
    }
    return matchesSearch && matchesFilter && matchesDate;
  });

  const totalPages = Math.ceil(filteredRoles.length / rolesPerPage);
  const indexOfLastRole = currentPage * rolesPerPage;
  const indexOfFirstRole = indexOfLastRole - rolesPerPage;
  const currentRoles = filteredRoles.slice(indexOfFirstRole, indexOfLastRole);

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

    const handlerolesInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(duplicate, 10);
      if (!isNaN(value) && value >= 1) {
       setroleperpage(value);
       setduplicate(value);
        setCurrentPage(1);
    setPageInputValue('1');
      } else {
       setduplicate(10);
        setCurrentPage(1);
    setPageInputValue('1');
      }
    }
  };

  const pagechanging=(e)=>{
   setduplicate(e.target.value)
  }

  if (addform_loading || rolesLoading) {
    return (
      <div>
        <Loading />
      </div>
    );
  }

  const renderPermissionsGrid = (isEditing = false, permissionsToUse = permissions) => {
    return (
      <>
        {isEditing && (
          <div className="roles_permissions-header">
            <div className="roles_permissions-title">Select Features:</div>
            <div className="roles_permissions-toggle-buttons">
              <label className="roles_permissions-toggle-checkbox-label">
                <input
                  type="checkbox"
                  checked={isAllPermissionsSelected()}
                  onChange={handleAllPermissionsToggle}
                  className="roles_permissions-toggle-checkbox"
                />
              </label>
            </div>
          </div>
        )}

        {menusWithoutSubmenus.length > 0 && (
          <div className="roles_permissions-menus-without-submenus">
            <div className="roles_permissions-menu-category-header">
              <div className="roles_permissions-menu-category-title">Standalone Features</div>
              {isEditing && (
                <label className="roles_permissions-category-toggle-label">
                  <input
                    type="checkbox"
                    checked={menusWithoutSubmenus.every(C_MENU => 
                      permissionsToUse.some(p => p.menuid === C_MENU.menuid && !p.submenuid)
                    )}
                    onChange={handleStandardPermissionsToggle}
                    className="roles_permissions-category-toggle-checkbox"
                  />
                </label>
              )}
            </div>
            <div className="roles_permissions-grid">
              {Array.from({ length: Math.ceil(menusWithoutSubmenus.length / 5) }, (_, row) => (
                <div key={`no-submenu-row-${row}`} className="roles_permissions-row">
                  {menusWithoutSubmenus.slice(row * 5, (row * 5) + 5).map((C_MENU) => (
                    <div key={`menu-${C_MENU.menuid}`} className="roles_permission-item">
                      <label className="roles_menu-label">
                        <span className="roles_permission-name">{C_MENU.menuname}</span>
                        <input
                          type="checkbox"
                          checked={permissionsToUse.some((p) => p.menuid === C_MENU.menuid && !p.submenuid)}
                          onChange={isEditing ? () => handlePermissionToggle(C_MENU.menuid) : undefined}
                          className="roles_permission-checkbox"
                          disabled={!isEditing}
                        />
                      </label>
                      {C_MENU.menuid === 11 && permissionsToUse.some(p => p.menuid === 11 && !p.submenuid) && (
                        <label className="roles_menu-label" style={{ marginLeft: '20px' }}>
                          <span className="roles_permission-name">All Data</span>
                          <input
                            type="checkbox"
                            checked={permissionsToUse.find(p => p.menuid === 11 && !p.submenuid)?.alldata === 1}
                            onChange={isEditing ? () => handleAllDataToggle(C_MENU.menuid) : undefined}
                            className="roles_permission-checkbox"
                            disabled={!isEditing}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {menusWithSubmenus.length > 0 && (
          <div className="roles_permissions-menus-with-submenus">
            <div className="roles_permissions-menu-category-header">
              <div className="roles_permissions-menu-category-title">Expandable Features</div>
              {isEditing && (
                <label className="roles_permissions-category-toggle-label">
                  <input
                    type="checkbox"
                    checked={(() => {
                      const advancedPermissions = [
                        ...menusWithSubmenus.map(C_MENU => ({ menuid: C_MENU.menuid, submenuid: null })),
                        ...availableSubmenus.filter(C_SUBMENU => 
                          menusWithSubmenus.some(C_MENU => C_MENU.menuid === C_SUBMENU.menuid)
                        ).map(C_SUBMENU => ({ menuid: C_SUBMENU.menuid, submenuid: C_SUBMENU.submenuid }))
                      ];
                      return advancedPermissions.every(advPerm => 
                        permissionsToUse.some(p => 
                          p.menuid === advPerm.menuid && 
                          ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
                        )
                      );
                    })()}
                    onChange={handleAdvancedPermissionsToggle}
                    className="roles_permissions-category-toggle-checkbox"
                  />
                </label>
              )}
            </div>
            <div className="roles_permissions-grid">
              {Array.from({ length: Math.ceil(menusWithSubmenus.length / 5) }, (_, row) => (
                <div key={`submenu-row-${row}`} className="roles_permissions-row">
                  {menusWithSubmenus.slice(row * 5, (row * 5) + 5).map((C_MENU) => (
                    <div key={`menu-${C_MENU.menuid}`} className="roles_permission-item-with-submenus">
                      <label className="roles_menu-label roles_main-permission-feature">
                        <span className="roles_permission-name">{C_MENU.menuname}</span>
                        <input
                          type="checkbox"
                          checked={permissionsToUse.some((p) => p.menuid === C_MENU.menuid && !p.submenuid)}
                          onChange={isEditing ? () => handlePermissionToggle(C_MENU.menuid) : undefined}
                          className="roles_permission-checkbox"
                          disabled={!isEditing}
                        />
                      </label>
                      <div className="roles_permission-submenus-container">
                        {availableSubmenus
                          .filter((sm) => sm.menuid === C_MENU.menuid)
                          .map((C_SUBMENU) => (
                            <div key={`submenu-${C_SUBMENU.submenuid}`} className="roles_permission-subitem">
                              <label className="roles_submenu-label">
                                <span className="roles_submenu-name">{C_SUBMENU.submenuname}</span>
                                <input
                                  type="checkbox"
                                  checked={permissionsToUse.some(
                                    (p) => p.menuid === C_MENU.menuid && p.submenuid === C_SUBMENU.submenuid
                                  )}
                                  onChange={isEditing ? () => handlePermissionToggle(C_MENU.menuid, C_SUBMENU.submenuid) : undefined}
                                  className="roles_permission-checkbox"
                                  disabled={!isEditing}
                                />
                              </label>
                              {C_SUBMENU.submenuid === 17 && permissionsToUse.some(p => p.menuid === 12 && p.submenuid === 17) && (
                                <label className="roles_submenu-label" style={{ marginLeft: '20px' }}>
                                  <span className="roles_submenu-name">All Data</span>
                                  <input
                                    type="checkbox"
                                    checked={permissionsToUse.find(p => p.menuid === 12 && p.submenuid === 17)?.alldata === 1}
                                    onChange={isEditing ? () => handleAllDataToggle(C_MENU.menuid, C_SUBMENU.submenuid) : undefined}
                                    className="roles_permission-checkbox"
                                    disabled={!isEditing}
                                  />
                                </label>
                              )}
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
    <div className="roles_roles-overview-container">
      {detailsError && <div className="roles_error-message">{detailsError}</div>}
      {isadd && (
        <div className="roles_add-role-container">
          <div className="roles_header-section">
            <h1 className="roles_title">Add Role</h1>
            <button className="roles_back-button" onClick={handleBackClick}></button>
          </div>
          {addform_formerror && <p style={{ color: "red" }}>{addform_formerror}</p>}
          {addform_success && <p style={{ color: "green" }}>{addform_success}</p>}
          <form action={addform_handleSubmit} ref={formRef} className="roles_add-role-form">
            <div className="roles_form-section">
              <div className="roles_role-name-section">
                <label htmlFor="roleName" className="roles_role-name-label">
                  Role Name: *
                </label>
                <input
                  type="text"
                  id="roleName"
                  name="roleName"
                  placeholder="Enter role name (e.g., Manager)"
                  className="roles_role-name-input"
                  required
                />
              </div>
              <div className="roles_features-section">
                <div className="roles_features-header">
                  <div className="roles_features-title">Select Features: *</div>
                  <div className="roles_toggle-buttons">
                    <label className="roles_toggle-checkbox-label">
                      <input
                        type="checkbox"
                        checked={isAllSelected()}
                        onChange={handleSelectAllToggle}
                        className="roles_toggle-checkbox"
                      />
                    </label>
                  </div>
                </div>
                {(() => {
                  const menusWithoutSubmenus_addform = addform_availableMenus.filter(C_MENU => C_MENU.hassubmenu !== 'yes');
                  const menusWithSubmenus_addform = addform_availableMenus.filter(C_MENU => C_MENU.hassubmenu === 'yes');
                  return (
                    <>
                      {menusWithoutSubmenus_addform.length > 0 && (
                        <div className="roles_menus-without-submenus">
                          <div className="roles_menu-category-header">
                            <div className="roles_menu-category-title">Standalone Features</div>
                            <label className="roles_category-toggle-label">
                              <input
                                type="checkbox"
                                checked={menusWithoutSubmenus_addform.every(C_MENU => 
                                  addform_permissions.some(p => p.menuid === C_MENU.menuid && !p.submenuid)
                                )}
                                onChange={handleStandardFeaturesToggle}
                                className="roles_category-toggle-checkbox"
                              />
                            </label>
                          </div>
                          <div className="roles_features-grid">
                            {Array.from({ length: Math.ceil(menusWithoutSubmenus_addform.length / 5) }, (_, row) => (
                              <div key={`no-submenu-row-${row}`} className="roles_features-row">
                                {menusWithoutSubmenus_addform.slice(row * 5, (row * 5) + 5).map((C_MENU) => (
                                  <div key={`menu-${C_MENU.menuid}`} className="roles_feature-item">
                                    <label className="roles_feature-label">
                                      <span className="roles_feature-name">{C_MENU.menuname}</span>
                                      <input
                                        type="checkbox"
                                        checked={addform_permissions.some((p) => p.menuid === C_MENU.menuid && !p.submenuid)}
                                        onChange={() => addform_handlePermissionToggle(C_MENU.menuid)}
                                        className="roles_feature-checkbox"
                                      />
                                    </label>
                                    {C_MENU.menuid === 11 && addform_permissions.some(p => p.menuid === 11 && !p.submenuid) && (
                                      <label className="roles_feature-label" style={{ marginLeft: '20px' }}>
                                        <span className="roles_feature-name">All Data</span>
                                        <input
                                          type="checkbox"
                                          checked={addform_permissions.find(p => p.menuid === 11 && !p.submenuid)?.alldata === 1}
                                          onChange={() => addform_handleAllDataToggle(C_MENU.menuid)}
                                          className="roles_feature-checkbox"
                                        />
                                      </label>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {menusWithSubmenus_addform.length > 0 && (
                        <div className="roles_menus-with-submenus">
                          <div className="roles_menu-category-header">
                            <div className="roles_menu-category-title">Expandable Features</div>
                            <label className="roles_category-toggle-label">
                              <input
                                type="checkbox"
                                checked={(() => {
                                  const advancedPermissions = [
                                    ...menusWithSubmenus_addform.map(C_MENU => ({ menuid: C_MENU.menuid, submenuid: null })),
                                    ...addform_availableSubmenus.filter(C_SUBMENU => 
                                      menusWithSubmenus_addform.some(C_MENU => C_MENU.menuid === C_SUBMENU.menuid)
                                    ).map(C_SUBMENU => ({ menuid: C_SUBMENU.menuid, submenuid: C_SUBMENU.submenuid }))
                                  ];
                                  return advancedPermissions.every(advPerm => 
                                    addform_permissions.some(p => 
                                      p.menuid === advPerm.menuid && 
                                      ((advPerm.submenuid === null && !p.submenuid) || (p.submenuid === advPerm.submenuid))
                                    )
                                  );
                                })()}
                                onChange={handleAdvancedFeaturesToggle}
                                className="roles_category-toggle-checkbox"
                              />
                            </label>
                          </div>
                          <div className="roles_features-grid">
                            {Array.from({ length: Math.ceil(menusWithSubmenus_addform.length / 5) }, (_, row) => (
                              <div key={`submenu-row-${row}`} className="roles_features-row">
                                {menusWithSubmenus_addform.slice(row * 5, (row * 5) + 5).map((C_MENU) => (
                                  <div key={`menu-${C_MENU.menuid}`} className="roles_feature-item-with-submenus">
                                    <label className="roles_feature-label roles_main-feature">
                                      <span className="roles_feature-name">{C_MENU.menuname}</span>
                                      <input
                                        type="checkbox"
                                        checked={addform_permissions.some((p) => p.menuid === C_MENU.menuid && !p.submenuid)}
                                        onChange={() => addform_handlePermissionToggle(C_MENU.menuid)}
                                        className="roles_feature-checkbox"
                                      />
                                    </label>
                                    <div className="roles_submenus-container">
                                      {addform_availableSubmenus
                                        .filter((sm) => sm.menuid === C_MENU.menuid)
                                        .map((C_SUBMENU) => (
                                          <label key={`submenu-${C_SUBMENU.submenuid}`} className="roles_feature-label roles_submenu-label">
                                            <span className="roles_submenu-name">{C_SUBMENU.submenuname}</span>
                                            <input
                                              type="checkbox"
                                              checked={addform_permissions.some(
                                                (p) => p.menuid === C_MENU.menuid && p.submenuid === C_SUBMENU.submenuid
                                              )}
                                              onChange={() => addform_handlePermissionToggle(C_MENU.menuid, C_SUBMENU.submenuid)}
                                              className="roles_feature-checkbox"
                                              />
                                            {C_SUBMENU.submenuid === 17 && addform_permissions.some(p => p.menuid === 12 && p.submenuid === 17) && (
                                              <label className="roles_feature-label roles_submenu-label" style={{ marginLeft: '20px' }}>
                                                <span className="roles_submenu-name">All Data</span>
                                                <input
                                                  type="checkbox"
                                                  checked={addform_permissions.find(p => p.menuid === 12 && p.submenuid === 17)?.alldata === 1}
                                                  onChange={() => addform_handleAllDataToggle(C_MENU.menuid, C_SUBMENU.submenuid)}
                                                  className="roles_feature-checkbox"
                                                />
                                              </label>
                                            )}
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
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="roles_submit-section">
              <button
                type="submit"
                disabled={addform_loading}
                className="roles_button"
              >
                Add Role
              </button>
            </div>
          </form>
        </div>
      )}
      {!isadd && !selectedRole && (
        <div className="roles_roles-list" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div className="roles_title">Existing Roles</div>
            <button
              className="roles_button"
              onClick={() => handleaddrole()}
              style={{
                cursor: "pointer",
                marginLeft: "auto",
              }}
            >
              Add Role
            </button>
          </div>
          <div className="roles_search-filter-container">
            <input
              type="text"
              placeholder="Search by Role Name"
              value={searchQuery}
              onChange={handleSearchChange}
              className="roles_search-input"
            />
            <select
              value={isActiveFilter}
              onChange={handleIsActiveFilterChange}
              className="roles_filter-select"
            >
              <option value="all">All Status</option>
              <option value="yes">Active (Yes)</option>
              <option value="no">Inactive (No)</option>
            </select>
            <div className="roles_date-filter-container">
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                className="roles_date-input"
                placeholder="Start Date"
              />
              <input
                type="date"
                value={endDate}
                onChange={handleEndDateChange}
                className="roles_date-input"
                placeholder="End Date"
              />
            </div>
          </div>
          {filteredRoles.length === 0 && !detailsError ? (
            <p className="roles_empty-state">No roles found.</p>
          ) : (
            <>
              <div className="roles_table-wrapper">
                <table className="roles_roles-table roles_four-column">
                  <colgroup>
                    <col />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={sortConfig.column === 'roleid' ? `roles_sortable roles_sort-${sortConfig.direction}` : 'roles_sortable'} onClick={() => requestSort('roleid')}>
                        Role ID
                      </th>
                      <th className={sortConfig.column === 'rolename' ? `roles_sortable roles_sort-${sortConfig.direction}` : 'roles_sortable'} onClick={() => requestSort('rolename')}>
                        Role Name
                      </th>
                      <th className={sortConfig.column === 'is_active' ? `roles_sortable roles_sort-${sortConfig.direction}` : 'roles_sortable'} onClick={() => requestSort('is_active')}>
                        Is Active
                      </th>
                      <th className={sortConfig.column === 'created_date' ? `roles_sortable roles_sort-${sortConfig.direction}` : 'roles_sortable'} onClick={() => requestSort('created_date')}>
                        Created Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRoles.map((role) => (
                      <tr key={`${role.roleid}-${role.orgid}`} onClick={() => handleRoleClick(role)} style={{ cursor: 'pointer' }}>
                        <td className="roles_id-cell">
                          <span className={role.is_active ? 'roles_role-indicator-active' : 'roles_role-indicator-inactive'}></span>Role-{getDisplayRoleId(role.roleid)}
                        </td>
                        <td className="roles_name-cell">{role.rolename}</td>
                        <td className={role.is_active ? 'roles_status-badge roles_active' : 'roles_status-badge roles_inactive'}>
                          {role.is_active ? 'Yes' : 'No'}
                        </td>
                        <td className="roles_date-cell">
                          {role.CREATED_DATE ? new Date(role.CREATED_DATE).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
              </div>
              {filteredRoles.length > rolesPerPage && (
                <div className="roles_pagination-container">
                  <button
                    className="roles_button"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  <span className="roles_pagination-text">
                    Page{' '}
                    <input
                      type="text"
                      value={pageInputValue}
                      onChange={handlePageInputChange}
                      onKeyPress={handlePageInputKeyPress}
                      className="roles_pagination-input"
                    />{' '}
                    of {totalPages}
                  </span>
                  <button
                    className="roles_button"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>

                
              )}
            </>
          )}
              {filteredRoles.length > 0 && (
                <div className="roles_rows-per-page-container">
                  <label className="roles_rows-per-page-label">Rows/ Page</label>
                  <input
                    type="text"
                    value={duplicate}
                    onChange={pagechanging}
                    onKeyPress={handlerolesInputKeyPress}
                    className="roles_rows-per-page-input"
                    aria-label="Number of rows per page"
                  />
                </div>
              )}
        </div>
      )}
      {selectedRole && roleDetails && !isadd && (
        <div className="roles_role-details-container">
          <div className="roles_header-section">
            <h1 className="roles_title">Edit Role</h1>
            <button className="roles_back-button" onClick={handleBackClick}></button>
          </div>
          <div className="roles_role-details-block">
            <div className="roles_roledetails-header">
              <div>Role Details</div>
              {canEditRoles && !roleDetails.isadmin && !editingDetails && (
                <button className="roles_button" onClick={handleDetailsEdit}>Edit</button>
              )}
            </div>
            {detailsError && <div className="roles_error-message">{detailsError}</div>}
            {editingDetails ? (
              <form onSubmit={(e) => { e.preventDefault(); handleDetailsSave(); }}>
                <div className="roles_form-row">
                  <div className="roles_form-group">
                    <label>Role Name</label>
                    <input type="text" name="rolename" value={formData.rolename} onChange={handleDetailsChange} required />
                  </div>
                  <div className="roles_form-group">
                    <label>Is Active</label>
                    <select name="is_active" value={formData.is_active} onChange={handleDetailsChange}>
                      <option value="1">Yes</option>
                      <option value="0">No</option>
                    </select>
                  </div>
                </div>
                <div className="roles_form-buttons">
                  <button type="submit" className="roles_save">Save</button>
                  <button type="button" className="roles_cancel" onClick={handleDetailsCancel}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="roles_view-details">
                <div className="roles_details-row">
                  <div className="roles_details-g">
                    <label>Role ID</label>
                    <p>Role-{getDisplayRoleId(formData.roleid)}</p>
                  </div>
                  <div className="roles_details-g">
                    <label>Role Name</label>
                    <p>{formData.rolename}</p>
                  </div>
                </div>
                <div className="roles_details-row">
                  <div className="roles_details-g">
                    <label>Is Active</label>
                    <p>{formData.is_active === '1' ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="roles_features-block">
            <div className="roles_features-header-block">
              <div>Features</div>
              {canEditRoles && !roleDetails.isadmin && !editingFeatures && (
                <button className="roles_button" onClick={handleFeatureEdit}>Edit</button>
              )}
            </div>
            {featuresError && <div className="roles_error-message">{featuresError}</div>}
            <div className="roles_permissions-container">
              {renderPermissionsGrid(editingFeatures, editingFeatures ? tempPermissions : permissions)}
              {editingFeatures && (
                <div className="roles_form-buttons">
                  <button className="roles_save" onClick={handleFeatureSave}>Save</button>
                  <button className="roles_cancel" onClick={handleFeatureCancel}>Cancel</button>
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
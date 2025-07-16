'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { addRole, fetchMenusAndSubmenus } from '@/app/serverActions/Roles/Overview';

export default function AddRole({ currentRole, orgid, error }) {
  const router = useRouter();
  const [addform_formerror, addform_setFormError] = useState(error || null);
  const [addform_permissions, addform_setPermissions] = useState([]);
  const [addform_availableMenus, addform_setAvailableMenus] = useState([]);
  const [addform_availableSubmenus, addform_setAvailableSubmenus] = useState([]);
  const [addform_loading, addform_setLoading] = useState(true);
  const [addform_success,addform_setsuccess]=useState(true);

  useEffect(() => {
    const addform_loadData = async () => {
      try {
        const addform_menuData = await fetchMenusAndSubmenus();
        console.log('Fetched menus:', addform_menuData.menus, 'Fetched submenus:', addform_menuData.submenus);
        addform_setAvailableMenus(addform_menuData.menus);
        addform_setAvailableSubmenus(addform_menuData.submenus);
      } catch (err) {
        console.error('Error loading menus and submenus:', err);
        addform_setFormError(err.message || 'Failed to load features.');
      } finally {
        addform_setLoading(false);
      }
    };
    addform_loadData();
  }, []);

  const addform_handleSubmit = async (formData) => {
    formData.append('currentRole', currentRole || '');
    formData.append('orgid', orgid || '');
    formData.append('permissions', JSON.stringify(addform_permissions));

    // Client-side validation: Ensure at least one submenu is selected for menus with hassubmenu='yes'
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
      return;
    }

    const result = await addRole(formData);
    if (result?.error) {
      addform_setFormError(result.error);

      setTimeout(addform_setFormError(null),4000);
    }else{
      addform_setsuccess("Role added successfully");

      setTimeout(addform_setsuccess(null),4000);
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

  if (addform_loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Add Role</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {addform_formerror && <p style={{ color: "red" }}>{addform_formerror}</p>}
      {addform_success && <p style={{ color: "green" }}>{addform_success}</p>}
      <form action={addform_handleSubmit}>
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
                  {menu.menuname} ({menu.menuurl})
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
      </form>
    </div>
  );
}
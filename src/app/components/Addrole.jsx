'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { addRole, fetchMenusAndSubmenus } from '@/app/serverActions/Roles/Overview';

export default function AddRole({ currentRole, orgid, error }) {
  const router = useRouter();
  const [formError, setFormError] = useState(error || null);
  const [permissions, setPermissions] = useState([]); // Track selected menus and submenus
  const [availableMenus, setAvailableMenus] = useState([]);
  const [availableSubmenus, setAvailableSubmenus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const menuData = await fetchMenusAndSubmenus();
        console.log('Fetched menus:', menuData.menus, 'Fetched submenus:', menuData.submenus);
        setAvailableMenus(menuData.menus);
        setAvailableSubmenus(menuData.submenus);
      } catch (err) {
        console.error('Error loading menus and submenus:', err);
        setFormError(err.message || 'Failed to load features.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (formData) => {
    formData.append('currentRole', currentRole || '');
    formData.append('permissions', JSON.stringify(permissions));

    // Client-side validation: Ensure at least one submenu is selected for menus with hassubmenu='yes'
    const invalidSelections = permissions
      .filter(p => !p.submenuid) // Filter menu-level permissions
      .map(p => availableMenus.find(m => m.menuid === p.menuid))
      .filter(menu => menu && menu.hassubmenu === 'yes')
      .filter(menu => {
        const selectedSubmenus = permissions.filter(p => p.menuid === menu.menuid && p.submenuid);
        return selectedSubmenus.length === 0;
      });
    if (invalidSelections.length > 0) {
      setFormError('Please select at least one submenu for each feature with submenus.');
      return;
    }

    const result = await addRole(formData);
    if (result?.error) {
      setFormError(result.error);
    } else {
      router.push(`/userscreens/roles/addroles?success=Role%20added%20successfully`);
    }
  };

  const handlePermissionToggle = (menuid, submenuid = null) => {
    const menu = availableMenus.find(m => m.menuid === menuid);
    if (!menu) return;

    setPermissions(prev => {
      const exists = prev.some(
        (p) => p.menuid === menuid && p.submenuid === submenuid
      );
      let updatedPermissions;
      if (submenuid) {
        // Handle submenu toggle
        if (exists) {
          updatedPermissions = prev.filter(
            (p) => !(p.menuid === menuid && p.submenuid === submenuid)
          );
        } else {
          updatedPermissions = [...prev, { menuid, submenuid }];
        }
        // If no submenus are selected for this menu, remove the menu permission
        if (menu.hassubmenu === 'yes') {
          const remainingSubmenus = updatedPermissions.filter(p => p.menuid === menuid && p.submenuid);
          if (remainingSubmenus.length === 0) {
            updatedPermissions = updatedPermissions.filter(p => p.menuid !== menuid);
          }
        }
      } else {
        // Handle menu toggle
        if (exists) {
          // Remove menu and all its submenus
          updatedPermissions = prev.filter(p => p.menuid !== menuid);
        } else {
          // Add menu and all its submenus (if hassubmenu='yes')
          updatedPermissions = [...prev, { menuid, submenuid: null }];
          if (menu.hassubmenu === 'yes') {
            const submenus = availableSubmenus
              .filter(sm => sm.menuid === menuid)
              .map(sm => ({ menuid, submenuid: sm.submenuid }));
            updatedPermissions = [...updatedPermissions, ...submenus];
          }
        }
      }
      console.log('Updated permissions:', updatedPermissions);
      return updatedPermissions;
    });
  };

  console.log('Available Menus:', JSON.stringify(availableMenus, null, 2));
  console.log('Available Submenus:', JSON.stringify(availableSubmenus, null, 2));
  console.log('Permissions:', JSON.stringify(permissions, null, 2));

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Add Role</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {formError && <p style={{ color: "red" }}>{formError}</p>}
      <form action={handleSubmit}>
        {/* Organization ID (Non-editable) */}
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

        {/* Required Fields */}
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

        {/* Feature Checkboxes with Submenus */}
        <div style={{ marginBottom: "20px" }}>
          <h3>Select Features: *</h3>
          {availableMenus.length === 0 ? (
            <p>No features available.</p>
          ) : (
            availableMenus.map((menu) => (
              <div key={`menu-${menu.menuid}`} style={{ margin: "10px 0" }}>
                <label style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={permissions.some((p) => p.menuid === menu.menuid && !p.submenuid)}
                    onChange={() => handlePermissionToggle(menu.menuid)}
                    style={{ marginRight: "10px" }}
                  />
                  {menu.menuname} ({menu.menuurl})
                </label>
                {menu.hassubmenu === 'yes' && availableSubmenus
                  .filter((sm) => sm.menuid === menu.menuid)
                  .map((submenu) => (
                    <div key={`submenu-${submenu.submenuid}`} style={{ margin: "5px 0", marginLeft: "20px" }}>
                      <label style={{ display: "flex", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={permissions.some(
                            (p) => p.menuid === menu.menuid && p.submenuid === submenu.submenuid
                          )}
                          onChange={() => handlePermissionToggle(menu.menuid, submenu.submenuid)}
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
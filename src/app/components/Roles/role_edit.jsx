'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchRoleById, fetchMenusAndSubmenus, updateRole } from '@/app/serverActions/Roles/Overview';
import './editrole.css';

const EditRole = () => {
  const router = useRouter();
  const params = useParams();
  const roleid = params.roleid;

  const [formData, setFormData] = useState({
    roleid: '',
    orgid: '',
    rolename: '',
    is_active: '1',
    salaryrange: '',
    type: '',
    description: '',
    vacantposts: '',
    jobtitle: '',
    keyresponsibilities: '',
  });
  const [permissions, setPermissions] = useState([]);
  const [availableMenus, setAvailableMenus] = useState([]);
  const [availableSubmenus, setAvailableSubmenus] = useState([]);
  const [state, setState] = useState({ error: null, success: false });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [roleData, menuData] = await Promise.all([
          fetchRoleById(roleid),
          fetchMenusAndSubmenus(),
        ]);
        console.log('Role data permissions:', roleData.permissions);
        console.log('Available menus:', menuData.menus);
        console.log('Available submenus:', menuData.submenus);

        setFormData({
          roleid: roleData.role.roleid || '',
          orgid: roleData.role.orgid || '',
          rolename: roleData.role.rolename || '',
          is_active: roleData.role.is_active ? '1' : '0',
          salaryrange: roleData.role.salaryrange || '',
          type: roleData.role.type || '',
          description: roleData.role.description || '',
          vacantposts: roleData.role.vacantposts || '',
          jobtitle: roleData.role.jobtitle || '',
          keyresponsibilities: roleData.role.keyresponsibilities || '',
        });

        // Map roleData.permissions to match availableMenus and availableSubmenus
        const validMenuIds = new Set(menuData.menus.map(m => m.menuid));
        const validSubmenuIds = new Set(menuData.submenus.map(sm => sm.submenuid));
        const mappedPermissions = roleData.permissions
          .filter(p => validMenuIds.has(p.menuid))
          .map(p => ({
            menuid: p.menuid,
            submenuid: p.submenuid && validSubmenuIds.has(p.submenuid) ? p.submenuid : null,
          }));
        setPermissions(mappedPermissions);

        setAvailableMenus(menuData.menus);
        setAvailableSubmenus(menuData.submenus);
        setState({ error: null, success: false });
      } catch (err) {
        console.error('Error loading data:', err);
        setState({ error: err.message, success: false });
      }
    };
    if (roleid) loadData();
  }, [roleid]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (menuid, submenuid = null) => {
    const validSubmenuIds = new Set(availableSubmenus.map(sm => sm.submenuid));
    if (submenuid && !validSubmenuIds.has(submenuid)) {
      console.warn(`Invalid submenuid ${submenuid} ignored for menuid ${menuid}`);
      return;
    }

    setPermissions((prev) => {
      const exists = prev.some(
        (p) => p.menuid === menuid && p.submenuid === submenuid
      );
      if (exists) {
        return prev.filter(
          (p) => !(p.menuid === menuid && p.submenuid === submenuid)
        );
      } else {
        return [...prev, { menuid, submenuid }];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting permissions:', permissions);
    const formDataToSubmit = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSubmit.append(key, value);
    });
    formDataToSubmit.append('permissions', JSON.stringify(permissions));
    const result = await updateRole({}, formDataToSubmit);
    setState(result);
    if (result.success) {
      router.push('/roles');
    }
  };

  return (
    <div className="edit-role-container">
      <h2>Edit Role</h2>
      {state.success && <div className="success-message">Role updated successfully!</div>}
      {state.error && <div className="error-message">{state.error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Role ID*:</label>
          <input
            type="text"
            name="roleid"
            value={formData.roleid}
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div>
          <label>Organization ID*:</label>
          <input
            type="number"
            name="orgid"
            value={formData.orgid}
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div>
          <label>Role Name*:</label>
          <input
            type="text"
            name="rolename"
            value={formData.rolename}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Is Active:</label>
          <select
            name="is_active"
            value={formData.is_active}
            onChange={handleChange}
          >
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </div>
        <div>
          <label>Salary Range:</label>
          <input
            type="text"
            name="salaryrange"
            value={formData.salaryrange}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Type:</label>
          <input
            type="text"
            name="type"
            value={formData.type}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Description:</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Vacant Posts:</label>
          <input
            type="number"
            name="vacantposts"
            value={formData.vacantposts}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Job Title:</label>
          <input
            type="text"
            name="jobtitle"
            value={formData.jobtitle}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Key Responsibilities:</label>
          <textarea
            name="keyresponsibilities"
            value={formData.keyresponsibilities}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Permissions:</label>
          <div className="permissions-container">
            {availableMenus.map((menu, index) => (
              <div key={`menu-${index}`} className="permission-item">
                <label>
                  <input
                    type="checkbox"
                    checked={permissions.some((p) => p.menuid === menu.menuid && !p.submenuid)}
                    onChange={() => handlePermissionToggle(menu.menuid)}
                  />
                  {menu.menuname} ({menu.menuurl})
                </label>
                {availableSubmenus
                  .filter((sm) => sm.menuid === menu.menuid)
                  .map((submenu) => (
                    <div key={submenu.submenuid} className="permission-subitem">
                      <label>
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
          </div>
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default EditRole;
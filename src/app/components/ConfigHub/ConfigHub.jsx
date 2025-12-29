'use client';

import React, { useState, useEffect } from 'react';
import { 
  fetchConfigData, 
  fetchGenericNames, 
  addConfigValue, 
  updateConfigValue,
  updateDisplayOrder 
} from '@/app/serverActions/Confighub/Overview';
import {
  fetchDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment
} from '@/app/serverActions/Confighub/DepartmentActions';
import './ConfigHub.css';

const ConfigHub = () => {
  const [view, setView] = useState('menu'); // 'menu', 'category-list', 'values', 'departments'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedGenericName, setSelectedGenericName] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [genericNames, setGenericNames] = useState([]);
  const [genericValues, setGenericValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', isactive: true });
  const [draggedItem, setDraggedItem] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', isactive: true });
  const [parentValueId, setParentValueId] = useState(null);
  const [navigationStack, setNavigationStack] = useState([]);
  
  // Department-specific state
  const [departments, setDepartments] = useState([]);
  const [deptEditingId, setDeptEditingId] = useState(null);
  const [deptEditForm, setDeptEditForm] = useState({ name: '', isactive: true });
  const [isDeptAdding, setIsDeptAdding] = useState(false);
  const [deptAddForm, setDeptAddForm] = useState({ name: '', isactive: true });

  // UPDATED CATEGORIES LIST
  const categories = [
    { id: 'company', name: 'Company', dbCategory: null },
    { id: 'employment', name: 'Employment', dbCategory: 'Employment' },
    { id: 'immigration', name: 'Immigration', dbCategory: 'Immigration' }, // Added Immigration
    { id: 'documents', name: 'Documents', dbCategory: 'Documents' },
    { id: 'account', name: 'Account', dbCategory: 'Account' },
    { id: 'expense', name: 'Expense', dbCategory: 'Expense' },
    { id: 'jobs', name: 'Jobs', dbCategory: 'Jobs' },
    { id: 'project', name: 'Project', dbCategory: 'Project' },
    { id: 'service', name: 'Service', dbCategory: 'Service' },
    { id: 'reports', name: 'Reports', dbCategory: 'Reports' },
    { id: 'pafdocuments', name: 'PAF Documents', dbCategory: 'pafdocuments' },
    { id: 'fdnsdocuments', name: 'FDNS Documents', dbCategory: 'fdnsdocuments' },
    { id: 'orgdocuments', name: 'Organization', dbCategory: 'orgdocuments' }
  ];

  // Jobs submenu items
  const jobsSubItems = [
    { id: 'departments', name: 'Departments', type: 'departments' }
  ];

  const handleCategoryClick = async (category) => {
    if (category.id === 'company') {
      setView('company-submenu');
      setSelectedCategory(category);
      setBreadcrumbs([{ label: 'Menu', action: () => goToMenu() }, { label: category.name }]);
      return;
    }
    if (category.id === 'jobs') {
      setView('jobs-submenu');
      setSelectedCategory(category);
      setBreadcrumbs([{ label: 'Menu', action: () => goToMenu() }, { label: category.name }]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setSelectedCategory(category);
      const allGenericNames = await fetchGenericNames(category.dbCategory);
      
      // Build parent-child display and filter out children
      const display = allGenericNames
        .filter(gn => ![15, 16, 17].includes(gn.g_id))
        .map(gn => {
          const child = gn.child_gid ? allGenericNames.find(c => c.g_id === gn.child_gid) : null;
          return {
            ...gn,
            displayName: child ? `${gn.Name} → ${child.Name}` : gn.Name,
            hasChild: !!child,
            childInfo: child
          };
        })
        .filter(item => {
          // Don't show items that are children of others
          return !allGenericNames.some(other => other.child_gid === item.g_id);
        });

      setGenericNames(display);
      setView('category-list');
      setBreadcrumbs([
        { label: 'Menu', action: () => goToMenu() },
        { label: category.name }
      ]);
      setNavigationStack([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenericNameClick = async (genericName, parentValueIdParam = null, parentValueName = null) => {
    setLoading(true);
    setError(null);
    try {
      setSelectedGenericName(genericName);
      setParentValueId(parentValueIdParam);
      
      // Fetch values for this generic name
      const allValues = await fetchConfigData();
      let filtered = allValues.filter(v => v.g_id === genericName.g_id);
      
      // If we're in nested view, filter by parent_value_id
      if (parentValueIdParam) {
        filtered = filtered.filter(v => v.parent_value_id === parentValueIdParam);
      } else {
        // Top level - only show items without parent
        filtered = filtered.filter(v => v.parent_value_id === null);
      }
      
      // Sort by display_order
      filtered.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
      
      setGenericValues(filtered);
      setView('values');
      
      // Update breadcrumbs
      const newBreadcrumbs = [
        { label: 'Menu', action: () => goToMenu() },
        { label: selectedCategory.name, action: () => handleCategoryClick(selectedCategory) }
      ];
      
      if (navigationStack.length > 0) {
        navigationStack.forEach((nav, idx) => {
          newBreadcrumbs.push({
            label: nav.label,
            action: () => restoreNavigationLevel(idx)
          });
        });
      }
      
      if (parentValueName) {
        newBreadcrumbs.push({ label: parentValueName });
      } else {
        newBreadcrumbs.push({ label: genericName.displayName || genericName.Name });
      }
      
      setBreadcrumbs(newBreadcrumbs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValueClick = (value) => {
    if (!selectedGenericName.hasChild) return;
    
    // Save current state to navigation stack
    const newStack = [
      ...navigationStack,
      {
        label: selectedGenericName.displayName || selectedGenericName.Name,
        genericName: selectedGenericName,
        parentValueId: parentValueId
      }
    ];
    setNavigationStack(newStack);
    
    // Navigate to child values
    const childGenericName = {
      ...selectedGenericName.childInfo,
      displayName: selectedGenericName.childInfo.Name,
      hasChild: false
    };
    
    handleGenericNameClick(childGenericName, value.id, value.Name);
  };

  const restoreNavigationLevel = (index) => {
    const nav = navigationStack[index];
    const newStack = navigationStack.slice(0, index);
    setNavigationStack(newStack);
    handleGenericNameClick(nav.genericName, nav.parentValueId);
  };

  const goToMenu = () => {
    setView('menu');
    setSelectedCategory(null);
    setSelectedGenericName(null);
    setBreadcrumbs([]);
    setGenericNames([]);
    setGenericValues([]);
    setNavigationStack([]);
    setParentValueId(null);
    setEditingId(null);
    setIsAdding(false);
  };

  const goBack = () => {
    if (breadcrumbs.length <= 2) {
      goToMenu();
    } else {
      const previousAction = breadcrumbs[breadcrumbs.length - 2].action;
      if (previousAction) {
        previousAction();
      }
    }
  };

  // Department handlers
  const handleDepartmentsClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const deptList = await fetchDepartments();
      setDepartments(deptList);
      setView('departments');
      setBreadcrumbs([
        { label: 'Menu', action: () => goToMenu() },
        { label: 'Jobs', action: () => handleCategoryClick({ id: 'jobs', name: 'Jobs' }) },
        { label: 'Departments' }
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeptEdit = (dept) => {
    setDeptEditingId(dept.id);
    setDeptEditForm({ name: dept.name, isactive: dept.isactive === 1 });
  };

  const handleDeptSave = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('id', deptEditingId);
    formData.append('name', deptEditForm.name);
    formData.append('isactive', deptEditForm.isactive);

    try {
      const result = await updateDepartment(null, formData);
      if (result.error) {
        setError(result.error);
      } else {
        // Refresh departments
        const deptList = await fetchDepartments();
        setDepartments(deptList);
        setDeptEditingId(null);
      }
    } catch (err) {
      setError(`Failed to save: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeptCancel = () => {
    setDeptEditingId(null);
  };

  const handleDeptAddNew = () => {
    setIsDeptAdding(true);
    setDeptAddForm({ name: '', isactive: true });
  };

  const handleDeptCancelAdd = () => {
    setIsDeptAdding(false);
    setDeptAddForm({ name: '', isactive: true });
  };

  const handleDeptSaveAdd = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('name', deptAddForm.name);
    formData.append('isactive', deptAddForm.isactive);

    try {
      const result = await addDepartment(null, formData);
      if (result.error) {
        setError(result.error);
      } else {
        // Refresh departments
        const deptList = await fetchDepartments();
        setDepartments(deptList);
        setIsDeptAdding(false);
        setDeptAddForm({ name: '', isactive: true });
      }
    } catch (err) {
      setError(`Failed to add: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeptDelete = async (deptId) => {
    if (!confirm('Are you sure you want to deactivate this department?')) return;
    
    setLoading(true);
    setError(null);

    try {
      const result = await deleteDepartment(deptId);
      if (result.error) {
        setError(result.error);
      } else {
        // Refresh departments
        const deptList = await fetchDepartments();
        setDepartments(deptList);
      }
    } catch (err) {
      setError(`Failed to delete: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (value) => {
    setEditingId(value.id);
    setEditForm({ name: value.Name, isactive: value.isactive === 1 });
  };

  const handleSave = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('id', editingId);
    formData.append('g_id', selectedGenericName.g_id);
    formData.append('valueName', editForm.name);
    formData.append('isactive', editForm.isactive);
    if (parentValueId) {
      formData.append('parent_value_id', parentValueId);
    }

    try {
      const result = await updateConfigValue(null, formData);
      if (result.error) {
        setError(result.error);
      } else {
        // Refresh values
        await handleGenericNameClick(selectedGenericName, parentValueId);
        setEditingId(null);
      }
    } catch (err) {
      setError(`Failed to save: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleAddNew = () => {
    // Check if single_value restriction applies
    if (selectedGenericName?.single_value === 1) {
      setError('Cannot add new values. This configuration allows only a single value.');
      return;
    }
    setIsAdding(true);
    setAddForm({ name: '', isactive: true });
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setAddForm({ name: '', isactive: true });
  };

  const handleSaveAdd = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('g_id', selectedGenericName.g_id);
    formData.append('valueName', addForm.name);
    formData.append('isactive', addForm.isactive);
    if (parentValueId) {
      formData.append('parent_value_id', parentValueId);
    }

    try {
      const result = await addConfigValue(null, formData);
      if (result.error) {
        setError(result.error);
      } else {
        // Refresh values
        await handleGenericNameClick(selectedGenericName, parentValueId);
        setIsAdding(false);
        setAddForm({ name: '', isactive: true });
      }
    } catch (err) {
      setError(`Failed to add: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;
    
    const items = [...genericValues];
    const draggedContent = items[draggedItem];
    items.splice(draggedItem, 1);
    items.splice(index, 0, draggedContent);
    
    // Update display_order
    items.forEach((item, idx) => {
      item.display_order = idx + 1;
    });
    
    setGenericValues(items);
    setDraggedItem(index);
  };

  const handleDragEnd = async () => {
    setDraggedItem(null);
    
    // Save updated order to database
    const orderUpdates = genericValues.map((v, idx) => ({
      id: v.id,
      display_order: idx + 1
    }));

    try {
      const result = await updateDisplayOrder(orderUpdates);
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(`Failed to update order: ${err.message}`);
    }
  };

  return (
    <div className="config-container-new">
      <div className="config-wrapper">
        {/* Header */}
        <div className="config-header-new">
          <h1 className="config-main-title">Configuration Hub</h1>
          
          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <div className="breadcrumb-container">
              <button onClick={goBack} className="back-button-new">
                <span className="back-arrow">←</span>
                Back
              </button>
              <span className="breadcrumb-separator">|</span>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {crumb.action ? (
                    <button 
                      onClick={crumb.action}
                      className="breadcrumb-link"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="breadcrumb-current">{crumb.label}</span>
                  )}
                  {idx < breadcrumbs.length - 1 && <span className="breadcrumb-arrow">›</span>}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {loading && view !== 'values' && (
          <div className="loading-message">Loading...</div>
        )}

        {/* Main Content */}
        {view === 'menu' && (
          <div className="menu-grid">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category)}
                className="menu-card"
              >
                <h3 className="menu-card-title">{category.name}</h3>
              </button>
            ))}
          </div>
        )}

        {view === 'company-submenu' && (
          <div className="list-container">
            <div className="list-header">
              <h2 className="list-title">Company</h2>
              <p className="list-subtitle">Select a configuration type to manage values</p>
            </div>
            <div className="list-items">
              {companySubItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.type === 'departments') {
                      handleDepartmentsClick();
                    }
                  }}
                  className="list-item-button"
                >
                  <span className="list-item-text">{item.name}</span>
                  <span className="list-item-arrow">›</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
          {view === 'jobs-submenu' && (
            <div className="list-container">
              <div className="list-header">
                <h2 className="list-title">Jobs</h2>
                <p className="list-subtitle">Select a configuration type to manage values</p>
              </div>
              <div className="list-items">
                {jobsSubItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.type === 'departments') {
                        handleDepartmentsClick();
                      }
                    }}
                    className="list-item-button"
                  >
                    <span className="list-item-text">{item.name}</span>
                    <span className="list-item-arrow">›</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        {view === 'departments' && (
          <div className="values-container">
            <div className="values-header">
              <div className="values-header-info">
                <h2 className="values-title">Departments</h2>
                <p className="values-count">
                  {departments.length} department{departments.length !== 1 ? 's' : ''}
                </p>
              </div>
              {!isDeptAdding && (
                <button
                  onClick={handleDeptAddNew}
                  disabled={loading || deptEditingId !== null}
                  className="add-button"
                >
                  <span className="add-icon">+</span>
                  Add New
                </button>
              )}
            </div>

            <div className="values-table-wrapper">
              <table className="values-table">
                <thead>
                  <tr>
                    <th className="values-th">Department Name</th>
                    <th className="values-th status-col">Active</th>
                    <th className="values-th action-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept.id} className="values-row">
                      <td className="values-td">
                        {deptEditingId === dept.id ? (
                          <input
                            type="text"
                            value={deptEditForm.name}
                            onChange={(e) => setDeptEditForm({ ...deptEditForm, name: e.target.value })}
                            disabled={loading}
                            className="value-input"
                          />
                        ) : (
                          <span>{dept.name}</span>
                        )}
                      </td>
                      <td className="values-td">
                        {deptEditingId === dept.id ? (
                          <select
                            value={deptEditForm.isactive ? 'true' : 'false'}
                            onChange={(e) => setDeptEditForm({ ...deptEditForm, isactive: e.target.value === 'true' })}
                            disabled={loading}
                            className="active-select"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : (
                          <span className={`status-badge ${dept.isactive === 1 ? 'status-active' : 'status-inactive'}`}>
                            {dept.isactive === 1 ? 'Yes' : 'No'}
                          </span>
                        )}
                      </td>
                      <td className="values-td">
                        {deptEditingId === dept.id ? (
                          <div className="action-buttons">
                            <button
                              onClick={handleDeptSave}
                              disabled={loading}
                              className="save-button"
                            >
                              {loading ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleDeptCancel}
                              disabled={loading}
                              className="cancel-button"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="action-buttons">
                            <button
                              onClick={() => handleDeptEdit(dept)}
                              disabled={loading || isDeptAdding}
                              className="edit-button"
                              title="Edit department"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeptDelete(dept.id)}
                              disabled={loading || isDeptAdding}
                              className="delete-button"
                              title="Deactivate department"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {isDeptAdding && (
                    <tr className="values-row add-row">
                      <td className="values-td">
                        <input
                          type="text"
                          value={deptAddForm.name}
                          onChange={(e) => setDeptAddForm({ ...deptAddForm, name: e.target.value })}
                          disabled={loading}
                          placeholder="Enter department name"
                          className="value-input"
                        />
                      </td>
                      <td className="values-td">
                        <select
                          value={deptAddForm.isactive ? 'true' : 'false'}
                          onChange={(e) => setDeptAddForm({ ...deptAddForm, isactive: e.target.value === 'true' })}
                          disabled={loading}
                          className="active-select"
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </td>
                      <td className="values-td">
                        <div className="action-buttons">
                          <button
                            onClick={handleDeptSaveAdd}
                            disabled={loading || !deptAddForm.name}
                            className="save-button"
                          >
                            {loading ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleDeptCancelAdd}
                            disabled={loading}
                            className="cancel-button"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'category-list' && (
          <div className="list-container">
            <div className="list-header">
              <h2 className="list-title">{selectedCategory?.name}</h2>
              <p className="list-subtitle">Select a configuration type to manage values</p>
            </div>
            <div className="list-items">
              {genericNames.map(gn => (
                <button
                  key={gn.g_id}
                  onClick={() => handleGenericNameClick(gn)}
                  className="list-item-button"
                >
                  <span className="list-item-text">{gn.displayName}</span>
                  <span className="list-item-arrow">›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'values' && (
          <div className="values-container">
            <div className="values-header">
              <div className="values-header-info">
                <h2 className="values-title">
                  {selectedGenericName?.displayName || selectedGenericName?.Name}
                </h2>
                <p className="values-count">
                  {genericValues.length} value{genericValues.length !== 1 ? 's' : ''}
                </p>
              </div>
              {!isAdding && (
                <button
                  onClick={handleAddNew}
                  disabled={loading || editingId !== null || (selectedGenericName?.single_value === 1 && genericValues.length > 0)}
                  className="add-button"
                  title={selectedGenericName?.single_value === 1 && genericValues.length > 0 ? 'Single value allowed - edit existing value instead' : 'Add new value'}
                >
                  <span className="add-icon">+</span>
                  Add New
                </button>
              )}
            </div>

            <div className="values-table-wrapper">
              <table className="values-table">
                <thead>
                  <tr>
                    <th className="values-th drag-col"></th>
                    <th className="values-th">Value</th>
                    <th className="values-th status-col">Active</th>
                    <th className="values-th order-col">Order</th>
                    <th className="values-th action-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {genericValues.map((value, index) => (
                    <tr
                      key={value.id}
                      draggable={editingId !== value.id && !isAdding && !value.isDefault}
                      onDragStart={(e) => !value.isDefault && handleDragStart(e, index)}
                      onDragOver={(e) => !value.isDefault && handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`values-row ${
                        draggedItem === index ? 'dragging' : ''
                      } ${selectedGenericName?.hasChild && editingId !== value.id ? 'clickable-row' : ''} ${value.isDefault ? 'default-row' : ''}`}
                      onClick={() => editingId !== value.id && !isAdding && handleValueClick(value)}
                    >
                      <td className="values-td drag-handle-cell">
                        {editingId !== value.id && !isAdding && !value.isDefault && (
                          <span className="drag-handle">⋮⋮</span>
                        )}
                      </td>
                      <td className="values-td" onClick={(e) => editingId === value.id && e.stopPropagation()}>
                        {editingId === value.id ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            disabled={loading}
                            className="value-input"
                          />
                        ) : (
                          <div className="value-display">
                            <span>{value.Name}</span>
                            {value.isDefault && (
                              <span className="default-badge" title="System default - cannot be edited">Default</span>
                            )}
                            {selectedGenericName?.hasChild && (
                              <span className="value-arrow">›</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="values-td" onClick={(e) => editingId === value.id && e.stopPropagation()}>
                        {editingId === value.id ? (
                          <select
                            value={editForm.isactive ? 'true' : 'false'}
                            onChange={(e) => setEditForm({ ...editForm, isactive: e.target.value === 'true' })}
                            disabled={loading}
                            className="active-select"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : (
                          <span className={`status-badge ${value.isactive === 1 ? 'status-active' : 'status-inactive'}`}>
                            {value.isactive === 1 ? 'Yes' : 'No'}
                          </span>
                        )}
                      </td>
                      <td className="values-td order-cell">
                        {value.display_order || '-'}
                      </td>
                      <td className="values-td" onClick={(e) => e.stopPropagation()}>
                        {editingId === value.id ? (
                          <div className="action-buttons">
                            <button
                              onClick={handleSave}
                              disabled={loading}
                              className="save-button"
                            >
                              {loading ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancel}
                              disabled={loading}
                              className="cancel-button"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : value.isDefault ? (
                          <span className="default-lock" title="System default - cannot be edited">🔒</span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(value);
                            }}
                            disabled={loading || isAdding}
                            className="edit-button"
                          >
                            ✏️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {isAdding && (
                    <tr className="values-row add-row">
                      <td className="values-td"></td>
                      <td className="values-td">
                        <input
                          type="text"
                          value={addForm.name}
                          onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                          disabled={loading}
                          placeholder="Enter value name"
                          className="value-input"
                        />
                      </td>
                      <td className="values-td">
                        <select
                          value={addForm.isactive ? 'true' : 'false'}
                          onChange={(e) => setAddForm({ ...addForm, isactive: e.target.value === 'true' })}
                          disabled={loading}
                          className="active-select"
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </td>
                      <td className="values-td order-cell">Auto</td>
                      <td className="values-td">
                        <div className="action-buttons">
                          <button
                            onClick={handleSaveAdd}
                            disabled={loading || !addForm.name}
                            className="save-button"
                          >
                            {loading ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelAdd}
                            disabled={loading}
                            className="cancel-button"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigHub;
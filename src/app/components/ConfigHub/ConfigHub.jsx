'use client';

import React, { useState, useEffect } from 'react';
import { fetchConfigData, addConfigValue, updateConfigValue } from '@/app/serverActions/Confighub/Overview';
import './ConfigHub.css';

const ConfigHub = () => {
  const [configData, setConfigData] = useState({});
  const [error, setError] = useState(null);
  const [newRow, setNewRow] = useState({});
  const [editRow, setEditRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const rows = await fetchConfigData();
        const configData = {};
        rows.forEach(row => {
          if (!configData[row.category]) {
            configData[row.category] = { g_id: row.g_id, values: [] };
          }
          if (row.value && row.id) {
            configData[row.category].values.push({ 
              id: row.id, 
              value: row.value, 
              isactive: row.isactive === 1 
            });
          }
        });
        setConfigData(configData);
        // All categories closed by default
        setExpandedCategories(new Set());
      } catch (err) {
        setError(err.message);
      }
    };
    fetchData();
  }, []);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleAddRow = (category) => {
    if (!newRow[category] && !editRow && !loading) {
      setNewRow(prev => ({ ...prev, [category]: { value: '', isactive: true } }));
      // Auto-expand category when adding
      if (!expandedCategories.has(category)) {
        toggleCategory(category);
      }
    }
  };

  const handleCancelAdd = (category) => {
    setNewRow(prev => {
      const updated = { ...prev };
      delete updated[category];
      return updated;
    });
  };

  const handleEditRow = (category, index) => {
    if (!newRow[category] && !editRow && !loading) {
      const { id, value, isactive } = configData[category].values[index];
      setEditRow({ category, index, id, value, isactive });
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleCancelEdit = () => {
    setEditRow(null);
  };

  const handleSaveRow = async (category, isEdit = false, index = null) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    let value, isactive, id;
    if (isEdit) {
      ({ id, value, isactive } = editRow || {});
    } else {
      ({ value, isactive } = newRow[category] || {});
    }
    
    const g_id = configData[category]?.g_id || '';
    if (!g_id) {
      setError('Category ID not found.');
      setLoading(false);
      return;
    }
    if (!value) {
      setError('Value name is required.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('g_id', g_id);
    formData.append('valueName', value);
    formData.append('isactive', isactive);
    if (isEdit) formData.append('id', id);

    try {
      const result = isEdit ? await updateConfigValue(null, formData) : await addConfigValue(null, formData);
      if (result.error) {
        setError(result.error);
      } else {
        const rows = await fetchConfigData();
        const updatedConfigData = {};
        rows.forEach(row => {
          if (!updatedConfigData[row.category]) {
            updatedConfigData[row.category] = { g_id: row.g_id, values: [] };
          }
          if (row.value && row.id) {
            updatedConfigData[row.category].values.push({ 
              id: row.id, 
              value: row.value, 
              isactive: row.isactive === 1 
            });
          }
        });
        setConfigData(updatedConfigData);

        if (isEdit) {
          setEditRow(null);
        } else {
          setNewRow(prev => {
            const updated = { ...prev };
            delete updated[category];
            return updated;
          });
        }
      }
    } catch (err) {
      setError(`Failed to save: ${err.message}`);
      console.error(`Save error for ${category}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (category, field, value, isEdit = false) => {
    if (isEdit) {
      setEditRow(prev => ({
        ...prev,
        [field]: field === 'isactive' ? value === 'true' : value
      }));
    } else {
      setNewRow(prev => ({
        ...prev,
        [category]: { ...prev[category], [field]: field === 'isactive' ? value === 'true' : value }
      }));
    }
  };

  return (
    <div className="config-container">
      {error && <p className="error-message">{error}</p>}
      {Object.keys(configData || {}).length === 0 && !error && <p>Loading configuration data...</p>}
      
      {Object.entries(configData || {}).map(([category]) => (
        <div key={category} className="category-section">
          <div className="category-header">
            <button 
              className="collapse-arrow"
              onClick={() => toggleCategory(category)}
              aria-label={expandedCategories.has(category) ? "Collapse" : "Expand"}
            >
              <span className={`arrow ${expandedCategories.has(category) ? 'expanded' : ''}`}>
                ▶
              </span>
            </button>
            <div className="category-header-content">
              <h3>{category}</h3>
              <span className="category-count">
                {configData[category]?.values.length || 0} {configData[category]?.values.length === 1 ? 'value' : 'values'}
              </span>
            </div>
            <button 
              onClick={() => handleAddRow(category)} 
              disabled={loading || editRow || newRow[category]} 
              className="add-button"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>

          {expandedCategories.has(category) && (
            <div className="category-content">
              <table className="config-table">
                <thead>
                  <tr>
                    <th>Value</th>
                    <th>Active</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {configData[category]?.values.length > 0 ? (
                    configData[category].values.map((item, index) => (
                      <tr key={index}>
                        {editRow && editRow.category === category && editRow.index === index ? (
                          <>
                            <td>
                              <input
                                type="text"
                                value={editRow.value || ''}
                                onChange={(e) => handleInputChange(category, 'value', e.target.value, true)}
                                disabled={loading}
                                className="value-input"
                              />
                            </td>
                            <td>
                              <select
                                key={refreshKey}
                                value={editRow.isactive.toString()}
                                onChange={(e) => handleInputChange(category, 'isactive', e.target.value, true)}
                                disabled={loading}
                                className="active-select"
                              >
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </td>
                            <td>
                              <button onClick={() => handleSaveRow(category, true, index)} disabled={loading} className="save-button">
                                {loading ? 'Saving...' : 'Save'}
                              </button>
                              <button onClick={handleCancelEdit} disabled={loading} className="cancel-button">
                                Cancel
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{item.value}</td>
                            <td>{item.isactive ? 'Yes' : 'No'}</td>
                            <td>
                              <button
                                onClick={() => handleEditRow(category, index)}
                                disabled={loading || editRow || newRow[category]}
                                className="edit-button"
                                title="Edit"
                              >
                                ✏️
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3">No active values available</td>
                    </tr>
                  )}
                  {newRow[category] && (
                    <tr>
                      <td>
                        <input
                          type="text"
                          value={newRow[category].value || ''}
                          onChange={(e) => handleInputChange(category, 'value', e.target.value)}
                          disabled={loading}
                          className="value-input"
                        />
                      </td>
                      <td>
                        <select
                          value={newRow[category].isactive.toString()}
                          onChange={(e) => handleInputChange(category, 'isactive', e.target.value)}
                          disabled={loading}
                          className="active-select"
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </td>
                      <td>
                        <button onClick={() => handleSaveRow(category)} disabled={loading} className="save-button">
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => handleCancelAdd(category)} disabled={loading} className="cancel-button">
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ConfigHub;
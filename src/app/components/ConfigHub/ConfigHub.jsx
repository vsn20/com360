'use client';

import React, { useState, useEffect } from 'react';
import { fetchConfigData, addConfigValue, updateConfigValue } from '@/app/serverActions/Confighub/Overview';
import './ConfigHub.css'; // Import the CSS file

const ConfigHub = () => {
  console.log('ConfigHub rendering'); // Debug render count
  const [configData, setConfigData] = useState({});
  const [error, setError] = useState(null);
  const [newRow, setNewRow] = useState({});
  const [editRow, setEditRow] = useState(null); // Track editing row { category, index, value, isactive }
  const [loading, setLoading] = useState(false); // Add loading state
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render key

  useEffect(() => {
    console.log('useEffect triggered');
    const fetchData = async () => {
      try {
        const rows = await fetchConfigData();
        const configData = {};
        rows.forEach(row => {
          if (!configData[row.category]) {
            configData[row.category] = { g_id: row.g_id, values: [] };
          }
          if (row.value && row.id) {
            configData[row.category].values.push({ id: row.id, value: row.value, isactive: row.isactive === 1 });
          }
        });
        setConfigData(configData);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchData();
  }, []);

  const handleAddRow = (category) => {
    console.log(`Adding row for category: ${category}`);
    if (!newRow[category] && !editRow && !loading) {
      setNewRow(prev => ({ ...prev, [category]: { value: '', isactive: true } }));
    }
  };

  const handleEditRow = (category, index) => {
    console.log(`Editing row for category: ${category}, index: ${index}, isactive: ${configData[category].values[index].isactive}`);
    if (!newRow[category] && !editRow && !loading) {
      const { id, value, isactive } = configData[category].values[index];
      setEditRow({ category, index, id, value, isactive });
      setRefreshKey(prev => prev + 1); // Force re-render
    }
  };

  const handleSaveRow = async (category, isEdit = false, index = null) => {
    console.log(`Saving row for category: ${category}, isEdit: ${isEdit}, index: ${index}, isactive: ${isEdit ? editRow?.isactive : newRow[category]?.isactive}`);
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
            updatedConfigData[row.category].values.push({ id: row.id, value: row.value, isactive: row.isactive === 1 });
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
    console.log(`Input change for ${category}, ${field}: ${value}, isEdit: ${isEdit}`);
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
          <h3>{category}</h3>
          <button onClick={() => handleAddRow(category)} disabled={loading || editRow || newRow[category]} className="add-button">
            {loading ? 'Adding...' : 'Add'}
          </button>
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
                            key={refreshKey} // Force re-render
                            value={editRow.isactive.toString()} // Ensure boolean is converted to string
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
                      value={newRow[category].isactive.toString()} // Ensure boolean is converted to string
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
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default ConfigHub;
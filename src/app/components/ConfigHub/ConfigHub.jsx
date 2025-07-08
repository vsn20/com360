'use client'
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
            configData[row.category].values.push({ id: row.id, value: row.value, isactive: row.isactive });
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
    if (!newRow[category] && !editRow && !loading) { // Prevent adding if editing or loading
      setNewRow(prev => ({ ...prev, [category]: { value: '', isactive: true } }));
    }
  };

  const handleEditRow = (category, index) => {
    console.log(`Editing row for category: ${category}, index: ${index}`);
    if (!newRow[category] && !editRow && !loading) { // Prevent editing if adding or loading
      const { id, value, isactive } = configData[category].values[index];
      setEditRow({ category, index, id, value, isactive });
    }
  };

  const handleSaveRow = async (category, isEdit = false, index = null) => {
    console.log(`Saving row for category: ${category}, isEdit: ${isEdit}, index: ${index}`);
    if (loading) return; // Prevent multiple saves
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
        setConfigData(prev => {
          const newData = { ...prev };
          if (!isEdit && !newData[category]) newData[category] = { g_id, values: [] };
          if (isEdit) {
            newData[category].values[index] = { id, value, isactive };
          } else {
            newData[category].values.push({ value, isactive });
          }
          return newData;
        });
        if (isEdit) {
          setEditRow(null);
        } else {
          setNewRow(prev => {
            const updated = { ...prev };
            delete updated[category];
            return updated;
          });
        }
        window.location.reload(); // Refresh page on successful save
      }
    } catch (err) {
      setError(`Failed to save: ${err.message}`);
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
                            value={editRow.isactive}
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
                      value={newRow[category].isactive}
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
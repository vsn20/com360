'use client';

import React, { useState, useEffect } from 'react';
import { 
  fetchEducationByEmpId, 
  addEducation, 
  updateEducation, 
  deleteEducation 
} from '@/app/serverActions/Employee/experienceEducation';
import './overview.css';

const EmployeeEducation = ({ empid, countries, states, canEdit }) => {
  const [educationList, setEducationList] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    degree_name: '',
    major: '',
    institution: '',
    country: '185',
    state: '',
    custom_state_name: '',
    location_city: '',
    start_date: '',
    end_date: '',
    graduated: false,
    honors: '',
    transcript_url: '',
    notes: ''
  });

  useEffect(() => {
    loadEducation();
  }, [empid]);

  const loadEducation = async () => {
    try {
      const data = await fetchEducationByEmpId(empid);
      setEducationList(data);
    } catch (err) {
      setError('Failed to load education records');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append('employee_id', empid);
    Object.keys(formData).forEach(key => {
      data.append(key, formData[key]);
    });

    const result = editingId 
      ? await updateEducation(data)
      : await addEducation(data);

    if (result.error) {
      setError(result.error);
    } else {
      await loadEducation();
      resetForm();
    }
  };

  const handleEdit = (edu) => {
    setFormData({
      id: edu.id,
      degree_name: edu.degree_name || '',
      major: edu.major || '',
      institution: edu.institution || '',
      country: edu.country || '185',
      state: edu.state || '',
      custom_state_name: edu.custom_state_name || '',
      location_city: edu.location_city || '',
      start_date: edu.start_date || '',
      end_date: edu.end_date || '',
      graduated: Boolean(edu.graduated),
      honors: edu.honors || '',
      transcript_url: edu.transcript_url || '',
      notes: edu.notes || ''
    });
    setEditingId(edu.id);
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this education record?')) return;
    const result = await deleteEducation(id);
    if (result.success) {
      await loadEducation();
    }
  };

  const resetForm = () => {
    setFormData({
      degree_name: '',
      major: '',
      institution: '',
      country: '185',
      state: '',
      custom_state_name: '',
      location_city: '',
      start_date: '',
      end_date: '',
      graduated: false,
      honors: '',
      transcript_url: '',
      notes: ''
    });
    setIsAdding(false);
    setEditingId(null);
    setError(null);
  };

  const getCountryName = (countryId) => {
    const country = countries.find(c => c.ID == countryId);
    return country ? country.VALUE : '-';
  };

  const getStateName = (stateId) => {
    const state = states.find(s => s.ID == stateId);
    return state ? state.VALUE : '-';
  };

  return (
    <div className="role-details-block96">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Education</h3>
        {canEdit && !isAdding && (
          <button className="button" onClick={() => setIsAdding(true)}>
            Add Education
          </button>
        )}
      </div>

      {error && <p className="error-message">{error}</p>}

      {isAdding && (
        <form onSubmit={handleSubmit} style={{ marginTop: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
          <h4>{editingId ? 'Edit Education' : 'Add Education'}</h4>
          
          <div className="form-row">
            <div className="form-group">
              <label>Degree Name</label>
              <input
                type="text"
                name="degree_name"
                value={formData.degree_name}
                onChange={handleInputChange}
                placeholder="e.g., Bachelor of Science"
              />
            </div>
            <div className="form-group">
              <label>Major/Field of Study</label>
              <input
                type="text"
                name="major"
                value={formData.major}
                onChange={handleInputChange}
                placeholder="e.g., Computer Science"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Institution</label>
              <input
                type="text"
                name="institution"
                value={formData.institution}
                onChange={handleInputChange}
                placeholder="University name"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="location_city"
                value={formData.location_city}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Country</label>
              <select name="country" value={formData.country} onChange={handleInputChange}>
                <option value="">Select Country</option>
                {countries.map(c => (
                  <option key={c.ID} value={c.ID}>{c.VALUE}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>State</label>
              <select 
                name="state" 
                value={formData.state} 
                onChange={handleInputChange}
                disabled={formData.country !== '185'}
              >
                <option value="">Select State</option>
                {states.map(s => (
                  <option key={s.ID} value={s.ID}>{s.VALUE}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Custom State Name</label>
              <input
                type="text"
                name="custom_state_name"
                value={formData.custom_state_name}
                onChange={handleInputChange}
                disabled={formData.country === '185'}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                className="date-input"
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                className="date-input"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="graduated"
                  checked={formData.graduated}
                  onChange={handleInputChange}
                  style={{ marginRight: '8px' }}
                />
                Graduated
              </label>
            </div>
            <div className="form-group">
              <label>Honors/Awards</label>
              <input
                type="text"
                name="honors"
                value={formData.honors}
                onChange={handleInputChange}
                placeholder="e.g., Summa Cum Laude"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Transcript URL</label>
              <input
                type="url"
                name="transcript_url"
                value={formData.transcript_url}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                style={{ width: '100%', padding: '8px' }}
              />
            </div>
          </div>

          <div className="form-buttons">
            <button type="submit" className="save">
              {editingId ? 'Update' : 'Add'}
            </button>
            <button type="button" className="cancel" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: '20px' }}>
        {educationList.length === 0 ? (
          <p>No education records found.</p>
        ) : (
          educationList.map((edu) => (
            <div key={edu.id} className="view-details" style={{ marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
              <div className="details-row">
                <div className="details-g">
                  <label>Degree</label>
                  <p>{edu.degree_name || '-'}</p>
                </div>
                <div className="details-g">
                  <label>Major</label>
                  <p>{edu.major || '-'}</p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-g">
                  <label>Institution</label>
                  <p>{edu.institution || '-'}</p>
                </div>
                <div className="details-g">
                  <label>Location</label>
                  <p>
                    {edu.location_city && `${edu.location_city}, `}
                    {edu.state ? getStateName(edu.state) : edu.custom_state_name || ''}
                    {edu.country && `, ${getCountryName(edu.country)}`}
                  </p>
                </div>
              </div>
              <div className="details-row">
                <div className="details-g">
                  <label>Duration</label>
                  <p>
                    {edu.start_date && new Date(edu.start_date).toLocaleDateString()} - 
                    {edu.end_date ? new Date(edu.end_date).toLocaleDateString() : 'Present'}
                  </p>
                </div>
                <div className="details-g">
                  <label>Graduated</label>
                  <p>{edu.graduated ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {edu.honors && (
                <div className="details-row">
                  <div className="details-g">
                    <label>Honors</label>
                    <p>{edu.honors}</p>
                  </div>
                </div>
              )}
              {edu.notes && (
                <div className="details-row">
                  <div className="details-g">
                    <label>Notes</label>
                    <p>{edu.notes}</p>
                  </div>
                </div>
              )}
              {canEdit && (
                <div style={{ marginTop: '10px' }}>
                  <button className="button" onClick={() => handleEdit(edu)} style={{ marginRight: '10px' }}>
                    Edit
                  </button>
                  <button className="button cancel" onClick={() => handleDelete(edu.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EmployeeEducation;
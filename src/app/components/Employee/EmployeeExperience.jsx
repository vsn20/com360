'use client';

import React, { useState, useEffect } from 'react';
import { 
  fetchExperienceByEmpId, 
  addExperience, 
  updateExperience, 
  deleteExperience 
} from '@/app/serverActions/Employee/experienceEducation';
import './overview.css';

const EmployeeExperience = ({ empid, countries, canEdit }) => {
  const [experienceList, setExperienceList] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    location_city: '',
    location_country: '185',
    start_date: '',
    end_date: '',
    currently_working: false,
    description: '',
    achievements: '',
    supervisor_name: '',
    supervisor_email: ''
  });

  useEffect(() => {
    loadExperience();
  }, [empid]);

  const loadExperience = async () => {
    try {
      const data = await fetchExperienceByEmpId(empid);
      setExperienceList(data);
    } catch (err) {
      setError('Failed to load experience records');
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
      ? await updateExperience(data)
      : await addExperience(data);

    if (result.error) {
      setError(result.error);
    } else {
      await loadExperience();
      resetForm();
    }
  };

  const handleEdit = (exp) => {
    setFormData({
      id: exp.id,
      location_city: exp.location_city || '',
      location_country: exp.location_country || '185',
      start_date: exp.start_date || '',
      end_date: exp.end_date || '',
      currently_working: Boolean(exp.currently_working),
      description: exp.description || '',
      achievements: exp.achievements || '',
      supervisor_name: exp.supervisor_name || '',
      supervisor_email: exp.supervisor_email || ''
    });
    setEditingId(exp.id);
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this experience record?')) return;
    const result = await deleteExperience(id);
    if (result.success) {
      await loadExperience();
    }
  };

  const resetForm = () => {
    setFormData({
      location_city: '',
      location_country: '185',
      start_date: '',
      end_date: '',
      currently_working: false,
      description: '',
      achievements: '',
      supervisor_name: '',
      supervisor_email: ''
    });
    setIsAdding(false);
    setEditingId(null);
    setError(null);
  };

  const getCountryName = (countryId) => {
    const country = countries.find(c => c.ID == countryId);
    return country ? country.VALUE : '-';
  };

  return (
    <div className="role-details-block96">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Work Experience</h3>
        {canEdit && !isAdding && (
          <button className="button" onClick={() => setIsAdding(true)}>
            Add Experience
          </button>
        )}
      </div>

      {error && <p className="error-message">{error}</p>}

      {isAdding && (
        <form onSubmit={handleSubmit} style={{ marginTop: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
          <h4>{editingId ? 'Edit Experience' : 'Add Experience'}</h4>
          
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="location_city"
                value={formData.location_city}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>Country</label>
              <select name="location_country" value={formData.location_country} onChange={handleInputChange}>
                <option value="">Select Country</option>
                {countries.map(c => (
                  <option key={c.ID} value={c.ID}>{c.VALUE}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date *</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                className="date-input"
                required
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
                disabled={formData.currently_working}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="currently_working"
                  checked={formData.currently_working}
                  onChange={handleInputChange}
                  style={{ marginRight: '8px' }}
                />
                Currently Working Here
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Job Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                style={{ width: '100%', padding: '8px' }}
                placeholder="Describe your role and responsibilities"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Key Achievements</label>
              <textarea
                name="achievements"
                value={formData.achievements}
                onChange={handleInputChange}
                rows="3"
                style={{ width: '100%', padding: '8px' }}
                placeholder="Notable accomplishments in this role"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Supervisor Name</label>
              <input
                type="text"
                name="supervisor_name"
                value={formData.supervisor_name}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>Supervisor Email</label>
              <input
                type="email"
                name="supervisor_email"
                value={formData.supervisor_email}
                onChange={handleInputChange}
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
        {experienceList.length === 0 ? (
          <p>No work experience records found.</p>
        ) : (
          experienceList.map((exp) => (
            <div key={exp.id} className="view-details" style={{ marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
              <div className="details-row">
                <div className="details-g">
                  <label>Location</label>
                  <p>
                    {exp.location_city && `${exp.location_city}, `}
                    {getCountryName(exp.location_country)}
                  </p>
                </div>
                <div className="details-g">
                  <label>Duration</label>
                  <p>
                    {exp.start_date && new Date(exp.start_date).toLocaleDateString()} - 
                    {exp.currently_working ? 'Present' : (exp.end_date ? new Date(exp.end_date).toLocaleDateString() : '-')}
                  </p>
                </div>
              </div>
              {exp.description && (
                <div className="details-row">
                  <div className="details-g">
                    <label>Description</label>
                    <p>{exp.description}</p>
                  </div>
                </div>
              )}
              {exp.achievements && (
                <div className="details-row">
                  <div className="details-g">
                    <label>Achievements</label>
                    <p>{exp.achievements}</p>
                  </div>
                </div>
              )}
              {(exp.supervisor_name || exp.supervisor_email) && (
                <div className="details-row">
                  <div className="details-g">
                    <label>Supervisor</label>
                    <p>
                      {exp.supervisor_name}
                      {exp.supervisor_email && ` (${exp.supervisor_email})`}
                    </p>
                  </div>
                </div>
              )}
              {canEdit && (
                <div style={{ marginTop: '10px' }}>
                  <button className="button" onClick={() => handleEdit(exp)} style={{ marginRight: '10px' }}>
                    Edit
                  </button>
                  <button className="button cancel" onClick={() => handleDelete(exp.id)}>
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

export default EmployeeExperience;
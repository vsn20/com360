'use client';

import React, { useState, useEffect } from 'react';
import { 
  addExperience, 
  updateExperience, 
  deleteExperience 
} from '@/app/serverActions/Employee/experienceEducation';
import './overview.css';


const EmployeeExperience = ({ 
  empid, 
  countries, 
  canEdit, 
  employeeName, 
  organizationName,
  employeeDetails,
  superiorName,
  experienceList: initialExperienceList, // Receive from parent
  onUpdate // Receive callback from parent
}) => {
  // Use prop as initial state or sync via effect
  const [experienceList, setExperienceList] = useState(Array.isArray(initialExperienceList) ? initialExperienceList : []);
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

  // Sync state when parent prop changes
  useEffect(() => {
    setExperienceList(Array.isArray(initialExperienceList) ? initialExperienceList : []);
  }, [initialExperienceList]);

  const formatDateForDisplay = (date) => {
     if (!date || isNaN(new Date(date))) return '';
  const d = new Date(date);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${month}/${day}/${d.getUTCFullYear()}`;

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
    
    if (editingId) {
      data.append('id', editingId);
    }
    
    Object.keys(formData).forEach(key => {
      data.append(key, formData[key]);
    });

    const result = editingId 
      ? await updateExperience(data)
      : await addExperience(data);

    if (result.error) {
      setError(result.error);
    } else {
      // Call parent update function instead of local fetch
      if (onUpdate) await onUpdate();
      resetForm();
    }
  };

  const handleEdit = (exp) => {
    setFormData({
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
      // Call parent update function instead of local fetch
      if (onUpdate) await onUpdate();
    } else {
      setError(result.error || 'Failed to delete record');
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

  const generateWorkExperiencePDF = () => {
    // Create a new window for PDF generation
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
      <!DOCTYPE html>
<html>
<head>
  <title>Work Experience - ${employeeName}</title>
  <style>
    @media print {
      @page { margin: 0.5in; }
    }
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #0fd46c;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #0fd46c;
      font-size: 28px;
    }
    .header p {
      margin: 5px 0;
      color: #666;
      font-size: 14px;
    }
    .company-info {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid #0fd46c;
    }
    .company-info h2 {
      margin: 0 0 10px 0;
      color: #333;
      font-size: 20px;
    }
    .company-info p {
      margin: 5px 0;
      color: #666;
    }
    .experience-record {
      page-break-inside: avoid;
      margin-bottom: 30px;
      padding: 30px;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      background-color: #fff;
      font-size: 16px;
      line-height: 2;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e9ecef;
      color: #999;
      font-size: 12px;
    }
    .no-records {
      text-align: center;
      padding: 40px;
      color: #999;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Work Experience Certificate</h1>
    <p>This document certifies the work experience of</p>
    <p style="font-size: 18px; font-weight: bold; color: #333;">${employeeName}</p>
  </div>

  <div class="company-info">
    <h2>${organizationName || 'Organization'}</h2>
    <p><strong>Employee:</strong> ${employeeName}</p>
    <p><strong>Generated Date:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>

  ${experienceList.length === 0 ? `
    <div class="no-records">
      No work experience records available.
    </div>
  ` : `
    <div class="experience-record">
      <p>
        <strong>${employeeName}</strong> worked in <strong>${organizationName || 'the organization'}</strong> 
        from <strong>${formatDateForDisplay(employeeDetails.HIRE)}</strong> 
        to <strong>${formatDateForDisplay(employeeDetails.LAST_WORK_DATE)}</strong> 
        in <strong>${employeeDetails.WORK_CITY ? `${employeeDetails.WORK_CITY}, ` : ''}${getCountryName(employeeDetails.WORK_COUNTRY_ID)}</strong>
        ${employeeDetails.superior ? ` under <strong>${superiorName}</strong>` : ''}.
      </p>
    </div>
  `}

  <div class="footer">
    <p>This document was generated electronically and is valid without signature.</p>
    <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load then trigger print
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
    };
  };

  return (
    <div className="role-details-block96">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Work Experience</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          {experienceList.length > 0 && (
            <button 
              className="button" 
              onClick={generateWorkExperiencePDF}
              style={{ backgroundColor: '#3b82f6' }}
            >
              Generate PDF
            </button>
          )}
          {canEdit && !isAdding && (
            <button className="button" onClick={() => setIsAdding(true)}>
              Add Experience
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}

      {isAdding && (
        <form onSubmit={handleSubmit} className="add-edit-form-container">
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
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label>Job Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                placeholder="Describe your role and responsibilities"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label>Key Achievements</label>
              <textarea
                name="achievements"
                value={formData.achievements}
                onChange={handleInputChange}
                rows="3"
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
          <p className="empty-records-message">No work experience records found.</p>
        ) : (
          experienceList.map((exp) => (
            <div key={exp.id} className="experience-record-card">
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
                    {formatDateForDisplay(exp.start_date)} - 
                    {exp.currently_working ? ' Present' : ` ${formatDateForDisplay(exp.end_date)}`}
                    {exp.currently_working && (
                      <span className="status-badge-small success">Currently Working</span>
                    )}
                  </p>
                </div>
              </div>
              {exp.description && (
                <div className="details-row">
                  <div className="details-g" style={{ flex: '1 1 100%' }}>
                    <label>Description</label>
                    <p>{exp.description}</p>
                  </div>
                </div>
              )}
              {exp.achievements && (
                <div className="details-row">
                  <div className="details-g" style={{ flex: '1 1 100%' }}>
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
                <div className="record-actions">
                  <button className="button" onClick={() => handleEdit(exp)}>
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
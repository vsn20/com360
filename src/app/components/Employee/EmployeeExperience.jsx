'use client';

import React, { useState, useEffect } from 'react';
import { 
  addExperience, 
  updateExperience, 
  deleteExperience,
  generateExperienceLetterPDF 
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
  jobTitleName,
  superiorEmail,
  experienceList: initialExperienceList, 
  onUpdate 
}) => {
  const [experienceList, setExperienceList] = useState(Array.isArray(initialExperienceList) ? initialExperienceList : []);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [formData, setFormData] = useState({
    organization_name: '',
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
    setExperienceList(Array.isArray(initialExperienceList) ? initialExperienceList : []);
  }, [initialExperienceList]);

  const formatDateForDisplay = (date) => {
     if (!date || isNaN(new Date(date))) return '';
     const d = new Date(date);
     const month = String(d.getUTCMonth() + 1).padStart(2, '0');
     const day = String(d.getUTCDate()).padStart(2, '0');
     return `${month}/${day}/${d.getUTCFullYear()}`;
  };
  
  const formatDateForLetter = (date) => {
    if (!date || isNaN(new Date(date))) return 'Present';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const generateWorkExperiencePDF = async () => {
    setIsGeneratingPdf(true);
    setError(null);

    try {
      const jobTitle = jobTitleName || employeeDetails.JOB_TITLE || 'Employee';
      const startDate = formatDateForLetter(employeeDetails.HIRE);
      const endDate = employeeDetails.STATUS?.toLowerCase() === 'active' 
        ? 'Present' 
        : formatDateForLetter(employeeDetails.TERMINATED_DATE || employeeDetails.LAST_WORK_DATE);

      // Prepare data for server action
      const pdfData = {
        employeeName: `${employeeDetails.EMP_FST_NAME} ${employeeDetails.EMP_LAST_NAME}`,
        orgid: employeeDetails.orgid, 
        orgName: organizationName || 'Organization',
        jobTitle: jobTitle,
        startDate: startDate,
        endDate: endDate,
        gender: employeeDetails.GENDER,
        supervisorName: superiorName || 'Manager',
        supervisorEmail: superiorEmail,
        superiorRole: 'Manager', 
      };

      // Call server action
      const response = await generateExperienceLetterPDF(pdfData);

      if (response.success && response.pdfBase64) {
        // Convert Base64 back to PDF Blob
        const byteCharacters = atob(response.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // Open PDF
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        setError(response.error || 'Failed to generate PDF.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while generating the PDF.');
    } finally {
      setIsGeneratingPdf(false);
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
    setIsSaving(true);
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

    setIsSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      if (onUpdate) await onUpdate();
      resetForm();
    }
  };

  const handleEdit = (exp) => {
    setFormData({
      organization_name: exp.organization_name || '',
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
      if (onUpdate) await onUpdate();
    } else {
      setError(result.error || 'Failed to delete record');
    }
  };

  const resetForm = () => {
    setFormData({
      organization_name: '',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Work Experience</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="button" 
            onClick={generateWorkExperiencePDF}
            disabled={isGeneratingPdf}
            style={{ 
              backgroundColor: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              cursor: isGeneratingPdf ? 'wait' : 'pointer',
              opacity: isGeneratingPdf ? 0.7 : 1
            }}
          >
            {isGeneratingPdf ? 'Generating...' : 'Generate Experience Letter'}
          </button>
          
          {canEdit && !isAdding && (
            <button className="button" onClick={() => setIsAdding(true)}>
              Add Past Experience
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
              <label>Company Name</label>
              <input
                type="text"
                name="organization_name"
                value={formData.organization_name}
                onChange={handleInputChange}
                placeholder="Company Name"
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
              <select name="location_country" value={formData.location_country} onChange={handleInputChange}>
                <option value="">Select Country</option>
                {countries.map(c => (
                  <option key={c.ID} value={c.ID}>{c.VALUE}</option>
                ))}
              </select>
            </div>
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
          </div>

          <div className="form-row">
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
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '30px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
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
            <button type="submit" className="save" disabled={isSaving}>
              {isSaving ? 'Saving...' : (editingId ? 'Update' : 'Add')}
            </button>
            <button type="button" className="cancel" onClick={resetForm} disabled={isSaving}>
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
                  <label>Company</label>
                  <p>{exp.organization_name || '-'}</p>
                </div>
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
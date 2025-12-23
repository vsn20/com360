'use client';

import React, { useState, useEffect } from 'react';
import { addH1BRegistration, updateH1BRegistration } from '@/app/serverActions/Immigration/H1Bimmigration/H1Bimmigration';
import styles from './H1Immigration.module.css';

const AddEditH1BReg = ({ record, suborgs, countries, onClose, onSuccess }) => {
  
  const getDefaultYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const aprilFirst = new Date(currentYear, 3, 1); 
    return now >= aprilFirst ? currentYear + 2 : currentYear + 1;
  };

  const initialForm = {
    first_name: '', middle_name: '', last_name: '',
    gender: '', dob: '', email: '',
    country_of_birth: '', country_of_citizenship: '',
    passport_number: '', passport_expiry: '', passport_issuing_country: '',
    has_valid_passport: 'Y', us_masters_cap: 'N',
    suborgid: '', year: getDefaultYear()
  };

  const [formData, setFormData] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(!record);

  useEffect(() => {
    if (record) {
      setFormData({
        ...record,
        // These are already in YYYY-MM-DD format from the server
        dob: record.dob || '',
        passport_expiry: record.passport_expiry || ''
      });
      setIsEditing(false);
    }
  }, [record]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (record) {
      setFormData({
        ...record,
        dob: record.dob || '',
        passport_expiry: record.passport_expiry || ''
      });
      setIsEditing(false);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    let res;
    if (record) {
      res = await updateH1BRegistration(formData);
    } else {
      res = await addH1BRegistration(formData);
    }
    setSaving(false);

    if (res.success) {
      onSuccess();
    } else {
      alert("Error: " + res.error);
    }
  };

  const yearOptions = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);

  const getCountryName = (countryValue) => {
    const country = countries.find(c => c.VALUE === countryValue);
    return country ? country.VALUE : countryValue || '-';
  };

  const getSuborgName = (suborgId) => {
    const suborg = suborgs.find(s => s.suborgid === suborgId);
    return suborg ? suborg.suborgname : suborgId || '-';
  };

  return (
    <div className={styles.h1bimmigrationreg_modalOverlay}>
      <div className={styles.h1bimmigrationreg_modalContent}>
        <div className={styles.h1bimmigrationreg_modalHeader}>
            <h3 className={styles.h1bimmigrationreg_title}>
              {record ? (isEditing ? 'Edit H1B Registration' : 'H1B Registration Details') : 'Add H1B Registration'}
            </h3>
            <button onClick={onClose} className={styles.h1bimmigrationreg_closeBtn}>&times;</button>
        </div>

        {record && !isEditing ? (
          // VIEW MODE - Use display format
          <div className={styles.h1bimmigrationreg_viewDetails}>
            <div className={styles.h1bimmigrationreg_detailsRow}>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Organization</label>
                <p>{getSuborgName(formData.suborgid)}</p>
              </div>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Fiscal Year</label>
                <p>{formData.year}</p>
              </div>
            </div>

            <div className={styles.h1bimmigrationreg_detailsRow}>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>First Name</label>
                <p>{formData.first_name}</p>
              </div>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Middle Name</label>
                <p>{formData.middle_name || '-'}</p>
              </div>
            </div>

            <div className={styles.h1bimmigrationreg_detailsRow}>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Last Name</label>
                <p>{formData.last_name}</p>
              </div>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Gender</label>
                <p>{formData.gender}</p>
              </div>
            </div>

            <div className={styles.h1bimmigrationreg_detailsRow}>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Date of Birth</label>
                <p>{formData.dob_display || formData.dob || '-'}</p>
              </div>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Email</label>
                <p>{formData.email}</p>
              </div>
            </div>

            <div className={styles.h1bimmigrationreg_detailsRow}>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Country of Birth</label>
                <p>{getCountryName(formData.country_of_birth)}</p>
              </div>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Country of Citizenship</label>
                <p>{getCountryName(formData.country_of_citizenship)}</p>
              </div>
            </div>

            <div className={styles.h1bimmigrationreg_detailsRow}>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Passport Number</label>
                <p>{formData.passport_number}</p>
              </div>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Passport Expiry</label>
                <p>{formData.passport_expiry_display || formData.passport_expiry || '-'}</p>
              </div>
            </div>

            <div className={styles.h1bimmigrationreg_detailsRow}>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Passport Issuing Country</label>
                <p>{getCountryName(formData.passport_issuing_country)}</p>
              </div>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Has Valid Passport?</label>
                <p>{formData.has_valid_passport === 'Y' ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div className={styles.h1bimmigrationreg_detailsRow}>
              <div className={styles.h1bimmigrationreg_detailsGroup}>
                <label>Eligible for US Masters Cap?</label>
                <p>{formData.us_masters_cap === 'Y' ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div className={styles.h1bimmigrationreg_modalActions}>
              <button type="button" className={`${styles.h1bimmigrationreg_button} ${styles.h1bimmigrationreg_save}`} onClick={handleEdit}>
                Edit
              </button>
              <button type="button" className={`${styles.h1bimmigrationreg_button} ${styles.h1bimmigrationreg_btnCancel}`} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          // EDIT/ADD MODE - Uses YYYY-MM-DD format for inputs
          <form onSubmit={handleSubmit}>
            <div className={styles.h1bimmigrationreg_formGrid}>
              
              <div className={styles.h1bimmigrationreg_formGroup}>
                  <label className={styles.h1bimmigrationreg_label}>Organization <span style={{color:'red'}}>*</span></label>
                  <select name="suborgid" value={formData.suborgid} onChange={handleChange} className={styles.h1bimmigrationreg_select} required>
                      <option value="">Select Organization</option>
                      {suborgs.map(s => (
                          <option key={s.suborgid} value={s.suborgid}>{s.suborgname}</option>
                      ))}
                  </select>
              </div>
              <div className={styles.h1bimmigrationreg_formGroup}>
                  <label className={styles.h1bimmigrationreg_label}>Fiscal Year</label>
                  <select name="year" value={formData.year} onChange={handleChange} className={styles.h1bimmigrationreg_select}>
                      {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
              </div>

              <div className={styles.h1bimmigrationreg_formGroup}>
                <label className={styles.h1bimmigrationreg_label}>First Name</label>
                <input name="first_name" value={formData.first_name} onChange={handleChange} className={styles.h1bimmigrationreg_input} required />
              </div>
              <div className={styles.h1bimmigrationreg_formGroup}>
                <label className={styles.h1bimmigrationreg_label}>Middle Name</label>
                <input name="middle_name" value={formData.middle_name || ''} onChange={handleChange} className={styles.h1bimmigrationreg_input} />
              </div>
              <div className={styles.h1bimmigrationreg_formGroup}>
                <label className={styles.h1bimmigrationreg_label}>Last Name</label>
                <input name="last_name" value={formData.last_name} onChange={handleChange} className={styles.h1bimmigrationreg_input} required />
              </div>
              <div className={styles.h1bimmigrationreg_formGroup}>
                  <label className={styles.h1bimmigrationreg_label}>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className={styles.h1bimmigrationreg_select} required>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                  </select>
              </div>
              <div className={styles.h1bimmigrationreg_formGroup}>
                <label className={styles.h1bimmigrationreg_label}>Date of Birth</label>
                <input type="date" name="dob" value={formData.dob} onChange={handleChange} className={styles.h1bimmigrationreg_input} required />
              </div>
              <div className={styles.h1bimmigrationreg_formGroup}>
                <label className={styles.h1bimmigrationreg_label}>Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className={styles.h1bimmigrationreg_input} required />
              </div>

              <div className={styles.h1bimmigrationreg_formGroup}>
                <label className={styles.h1bimmigrationreg_label}>Country of Birth</label>
                <select name="country_of_birth" value={formData.country_of_birth} onChange={handleChange} className={styles.h1bimmigrationreg_select} required>
                  <option value="">Select Country</option>
                  {countries.map(c => (
                    <option key={c.ID} value={c.VALUE}>{c.VALUE}</option>
                  ))}
                </select>
              </div>

              <div className={styles.h1bimmigrationreg_formGroup}>
                <label className={styles.h1bimmigrationreg_label}>Country of Citizenship</label>
                <select name="country_of_citizenship" value={formData.country_of_citizenship} onChange={handleChange} className={styles.h1bimmigrationreg_select} required>
                  <option value="">Select Country</option>
                  {countries.map(c => (
                    <option key={c.ID} value={c.VALUE}>{c.VALUE}</option>
                  ))}
                </select>
              </div>

              <div className={styles.h1bimmigrationreg_formGroup}>
                <label className={styles.h1bimmigrationreg_label}>Passport Number</label>
                <input name="passport_number" value={formData.passport_number} onChange={handleChange} className={styles.h1bimmigrationreg_input} required />
              </div>
              <div className={styles.h1bimmigrationreg_formGroup}>
                <label className={styles.h1bimmigrationreg_label}>Passport Expiry</label>
                <input type="date" name="passport_expiry" value={formData.passport_expiry} onChange={handleChange} className={styles.h1bimmigrationreg_input} required />
              </div>

              <div className={styles.h1bimmigrationreg_formGroup}>
                <label className={styles.h1bimmigrationreg_label}>Passport Issuing Country</label>
                <select name="passport_issuing_country" value={formData.passport_issuing_country} onChange={handleChange} className={styles.h1bimmigrationreg_select} required>
                  <option value="">Select Country</option>
                  {countries.map(c => (
                    <option key={c.ID} value={c.VALUE}>{c.VALUE}</option>
                  ))}
                </select>
              </div>
              
              <div className={styles.h1bimmigrationreg_formGroup}>
                  <label className={styles.h1bimmigrationreg_label}>Has Valid Passport?</label>
                  <select name="has_valid_passport" value={formData.has_valid_passport} onChange={handleChange} className={styles.h1bimmigrationreg_select}>
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                  </select>
              </div>
              <div className={styles.h1bimmigrationreg_formGroup}>
                  <label className={styles.h1bimmigrationreg_label}>Eligible for US Masters Cap?</label>
                  <select name="us_masters_cap" value={formData.us_masters_cap} onChange={handleChange} className={styles.h1bimmigrationreg_select}>
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                  </select>
              </div>

            </div>

            <div className={styles.h1bimmigrationreg_modalActions}>
              <button type="submit" className={`${styles.h1bimmigrationreg_button} ${styles.h1bimmigrationreg_save}`} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className={`${styles.h1bimmigrationreg_button} ${styles.h1bimmigrationreg_btnCancel}`} onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddEditH1BReg;
'use client';
import React, { useState } from 'react';
import { addorganization } from '@/app/serverActions/Organizations/Actions';
import { useRouter } from 'next/navigation';
import './organizations.css';

const AddOrganization = ({ orgid, empid, countries, states }) => {
  const router = useRouter();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const usaCountryId = '185'; // USA country ID
  const [form, setForm] = useState({
    suborgname: '',
    isstatus: 'Active',
    addresslane1: '',
    addresslane2: '',
    country: '',
    state: '',
    customStateName: '',
    postalcode: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      let newForm = { ...prev, [name]: value };
      if (name === 'country') {
        const isUSA = value === usaCountryId;
        newForm.state = isUSA ? prev.state : ''; // Reset state if not USA
        newForm.customStateName = isUSA ? '' : prev.customStateName; // Reset custom state if USA
      }
      return newForm;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!form.suborgname) {
      setError('Organization Name is required.');
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('org_id', orgid);
    formData.append('createdby', empid);

    try {
      const result = await addorganization(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        setForm({
          suborgname: '',
          isstatus: 'Active',
          addresslane1: '',
          addresslane2: '',
          country: '',
          state: '',
          customStateName: '',
          postalcode: '',
        });
        setSuccess('Organization added successfully.');
        setTimeout(() => {
          setSuccess('');
          router.refresh();
        }, 3000);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isUSA = form.country === usaCountryId;

  return (
    <div>
      {success && <div className="organization_success_message">{success}</div>}
      {error && <div className="organization_error_message">{error}</div>}
      {isLoading && <div className="organization_loading_message">Saving...</div>}
      
      <div className="organization_details_block">
        <h3 className="organization_details_header_title">Add Organization</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="organization_form_row">
            <div className="organization_form_group">
              <label>Organization Name*</label>
              <input
                type="text"
                name="suborgname"
                value={form.suborgname}
                onChange={handleChange}
                placeholder="Enter Organization Name"
                required
              />
            </div>
            <div className="organization_form_group">
              <label>Status</label>
              <select name="isstatus" value={form.isstatus} onChange={handleChange}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          
          <div className="organization_form_row">
            <div className="organization_form_group">
              <label>Address Line 1</label>
              <input
                type="text"
                name="addresslane1"
                value={form.addresslane1}
                onChange={handleChange}
                placeholder="Enter Address Line 1"
              />
            </div>
            <div className="organization_form_group">
              <label>Address Line 2</label>
              <input
                type="text"
                name="addresslane2"
                value={form.addresslane2}
                onChange={handleChange}
                placeholder="Enter Address Line 2"
              />
            </div>
          </div>
          
          <div className="organization_form_row">
            <div className="organization_form_group">
              <label>Country</label>
              <select name="country" value={form.country} onChange={handleChange}>
                <option value="">Select Country</option>
                {countries.map((country) => (
                  <option key={country.ID} value={country.ID}>
                    {country.VALUE}
                  </option>
                ))}
              </select>
            </div>
            <div className="organization_form_group">
              <label>State</label>
              <select name="state" value={form.state} onChange={handleChange} disabled={!isUSA}>
                <option value="">Select State</option>
                {states.map((state) => (
                  <option key={state.ID} value={state.ID}>
                    {state.VALUE}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="organization_form_row">
            <div className="organization_form_group">
              <label>Custom State Name</label>
              <input
                type="text"
                name="customStateName"
                value={form.customStateName}
                onChange={handleChange}
                disabled={isUSA}
                placeholder="Enter Custom State Name"
              />
            </div>
            <div className="organization_form_group">
              <label>Postal Code</label>
              <input
                type="text"
                name="postalcode"
                value={form.postalcode}
                onChange={handleChange}
                placeholder="Enter Postal Code"
              />
            </div>
          </div>
          
          <div className="organization_form_buttons">
            <button type="submit" className="organization_submit_button" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Add Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddOrganization;

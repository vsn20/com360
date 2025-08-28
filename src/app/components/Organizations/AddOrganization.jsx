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
    <div className="organization-details-container89">
      {success && <div className="success-message89">{success}</div>}
      {error && <div className="error-message89">{error}</div>}
      {isLoading && <div className="loading-message89">Saving...</div>}
      
      <div className="details-block89">
        <div className="orgdetails-header89">
          <div>Add Organization</div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-row89">
            <div className="form-group89">
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
            <div className="form-group89">
              <label>Status</label>
              <select name="isstatus" value={form.isstatus} onChange={handleChange}>
                <option value="Active">Yes</option>
                <option value="Inactive">No</option>
              </select>
            </div>
          </div>
          
          <div className="form-row89">
            <div className="form-group89">
              <label>Address Line 1</label>
              <input
                type="text"
                name="addresslane1"
                value={form.addresslane1}
                onChange={handleChange}
                placeholder="Enter Address Line 1"
              />
            </div>
            <div className="form-group89">
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
          
          <div className="form-row89">
            <div className="form-group89">
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
            <div className="form-group89">
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
          
          <div className="form-row89">
            <div className="form-group89">
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
            <div className="form-group89">
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
          
          <div className="form-buttons89">
            <button type="submit" className="save89" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Add Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddOrganization;
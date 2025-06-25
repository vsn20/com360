'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { addAccount } from '@/app/serverActions/Account/AddAccountServerAction';
import { fetchCountryStateData } from '@/app/serverActions/getcountry';
import './addaccount.css';


export default function Addaccount({ orgid, error }) {
  const router = useRouter();
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);

  const [formData, setFormData] = useState({
    accountName: '',
    activeFlag: false,
    acctTypeCd: '',
    branchType: '',
    email: '',
    aliasName: '',
   
    businessAddrLine1: '',
    businessAddrLine2: '',
    businessAddrLine3: '',
    businessCity: '',
    businessStateId: '',
    businessCountryId: '',
    businessPostalCode: '',
    mailingAddrLine1: '',
    mailingAddrLine2: '',
    mailingAddrLine3: '',
    mailingCity: '',
    mailingStateId: '',
    mailingCountryId: '',
    mailingPostalCode: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const { countries: countryData, states: stateData } = await fetchCountryStateData();
        setCountries(countryData);
        setStates(stateData);
      } catch (err) {
        console.error('Error loading country/state data:', err);
        setFormError('Failed to load country/state data.');
      }
    };
    loadData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formData.acctTypeCd) {
      setFormError('Please select an account type.');
      return;
    }
    if (!formData.branchType) {
      setFormError('Please select a branch type.');
      return;
    }

    const formDataToSend = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSend.append(key, value);
    });

    const result = await addAccount(formDataToSend);
    if (result?.error) {
      setFormError(result.error);
    } else if (result?.success) {
      // Reset form state
      setFormData({
        accountName: '',
        activeFlag: false,
        acctTypeCd: '',
        branchType: '',
        email: '',
        aliasName: '',
       
        businessAddrLine1: '',
        businessAddrLine2: '',
        businessAddrLine3: '',
        businessCity: '',
        businessStateId: '',
        businessCountryId: '',
        businessPostalCode: '',
        mailingAddrLine1: '',
        mailingAddrLine2: '',
        mailingAddrLine3: '',
        mailingCity: '',
        mailingStateId: '',
        mailingCountryId: '',
        mailingPostalCode: '',
      });
      setFormSuccess('Account added successfully.');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Add Account</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {formError && <p style={{ color: 'red' }}>{formError}</p>}
      {formSuccess && <p style={{ color: 'green' }}>{formSuccess}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="orgid" style={{ display: 'block', marginBottom: '5px' }}>
            Organization ID:
          </label>
          <input
            type="text"
            id="orgid"
            name="orgid"
            value={orgid || ''}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              backgroundColor: '#f0f0f0',
            }}
            disabled
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="accountName" style={{ display: 'block', marginBottom: '5px' }}>
            Account Name: *
          </label>
          <input
            type="text"
            id="accountName"
            name="accountName"
            value={formData.accountName}
            onChange={handleChange}
            placeholder="Enter Account Name"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="activeFlag" style={{ display: 'block', marginBottom: '5px' }}>
            Active:
          </label>
          <input
            type="checkbox"
            id="activeFlag"
            name="activeFlag"
            checked={formData.activeFlag}
            onChange={handleChange}
            style={{ marginLeft: '5px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="acctTypeCd" style={{ display: 'block', marginBottom: '5px' }}>
            Account Type: *
          </label>
          <select
            id="acctTypeCd"
            name="acctTypeCd"
            value={formData.acctTypeCd}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
            required
          >
            <option value="">Select Account Type</option>
            <option value="CHECKING">Checking</option>
            <option value="SAVING">Saving</option>
            <option value="CREDIT">Credit</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="branchType" style={{ display: 'block', marginBottom: '5px' }}>
            Branch Type: *
          </label>
          <select
            id="branchType"
            name="branchType"
            value={formData.branchType}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
            required
          >
            <option value="">Select Branch Type</option>
            <option value="SUB">Sub</option>
            <option value="MAIN">Main</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>
            Email: *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter Email"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="aliasName" style={{ display: 'block', marginBottom: '5px' }}>
            Alias Name:
          </label>
          <input
            type="text"
            id="aliasName"
            name="aliasName"
            value={formData.aliasName}
            onChange={handleChange}
            placeholder="Enter Alias Name"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        {/* <div style={{ marginBottom: '20px' }}>
          <label htmlFor="name" style={{ display: 'block', marginBottom: '5px' }}>
            Name: *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter Name"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
            required
          />
        </div> */}

        <div style={{ marginBottom: '20px' }}>
          <h3>Business Address</h3>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="businessAddrLine1" style={{ display: 'block', marginBottom: '5px' }}>
              Address Line 1:
            </label>
            <input
              type="text"
              id="businessAddrLine1"
              name="businessAddrLine1"
              value={formData.businessAddrLine1}
              onChange={handleChange}
              placeholder="Enter Address Line 1"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="businessAddrLine2" style={{ display: 'block', marginBottom: '5px' }}>
              Address Line 2:
            </label>
            <input
              type="text"
              id="businessAddrLine2"
              name="businessAddrLine2"
              value={formData.businessAddrLine2}
              onChange={handleChange}
              placeholder="Enter Address Line 2"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="businessAddrLine3" style={{ display: 'block', marginBottom: '5px' }}>
              Address Line 3:
            </label>
            <input
              type="text"
              id="businessAddrLine3"
              name="businessAddrLine3"
              value={formData.businessAddrLine3}
              onChange={handleChange}
              placeholder="Enter Address Line 3"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="businessCity" style={{ display: 'block', marginBottom: '5px' }}>
              City:
            </label>
            <input
              type="text"
              id="businessCity"
              name="businessCity"
              value={formData.businessCity}
              onChange={handleChange}
              placeholder="Enter City"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="businessStateId" style={{ display: 'block', marginBottom: '5px' }}>
              State:
            </label>
            <select
              id="businessStateId"
              name="businessStateId"
              value={formData.businessStateId}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            >
              <option value="">Select State</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="businessCountryId" style={{ display: 'block', marginBottom: '5px' }}>
              Country:
            </label>
            <select
              id="businessCountryId"
              name="businessCountryId"
              value={formData.businessCountryId}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            >
              <option value="">Select Country</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="businessPostalCode" style={{ display: 'block', marginBottom: '5px' }}>
              Postal Code:
            </label>
            <input
              type="text"
              id="businessPostalCode"
              name="businessPostalCode"
              value={formData.businessPostalCode}
              onChange={handleChange}
              placeholder="Enter Postal Code"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3>Mailing Address</h3>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="mailingAddrLine1" style={{ display: 'block', marginBottom: '5px' }}>
              Address Line 1:
            </label>
            <input
              type="text"
              id="mailingAddrLine1"
              name="mailingAddrLine1"
              value={formData.mailingAddrLine1}
              onChange={handleChange}
              placeholder="Enter Address Line 1"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="mailingAddrLine2" style={{ display: 'block', marginBottom: '5px' }}>
              Address Line 2:
            </label>
            <input
              type="text"
              id="mailingAddrLine2"
              name="mailingAddrLine2"
              value={formData.mailingAddrLine2}
              onChange={handleChange}
              placeholder="Enter Address Line 2"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="mailingAddrLine3" style={{ display: 'block', marginBottom: '5px' }}>
              Address Line 3:
            </label>
            <input
              type="text"
              id="mailingAddrLine3"
              name="mailingAddrLine3"
              value={formData.mailingAddrLine3}
              onChange={handleChange}
              placeholder="Enter Address Line 3"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="mailingCity" style={{ display: 'block', marginBottom: '5px' }}>
              City:
            </label>
            <input
              type="text"
              id="mailingCity"
              name="mailingCity"
              value={formData.mailingCity}
              onChange={handleChange}
              placeholder="Enter City"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="mailingStateId" style={{ display: 'block', marginBottom: '5px' }}>
              State:
            </label>
            <select
              id="mailingStateId"
              name="mailingStateId"
              value={formData.mailingStateId}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            >
              <option value="">Select State</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="mailingCountryId" style={{ display: 'block', marginBottom: '5px' }}>
              Country:
            </label>
            <select
              id="mailingCountryId"
              name="mailingCountryId"
              value={formData.mailingCountryId}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            >
              <option value="">Select Country</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="mailingPostalCode" style={{ display: 'block', marginBottom: '5px' }}>
              Postal Code:
            </label>
            <input
              type="text"
              id="mailingPostalCode"
              name="mailingPostalCode"
              value={formData.mailingPostalCode}
              onChange={handleChange}
              placeholder="Enter Postal Code"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          style={{
            padding: '10px 20px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Add Account
        </button>
      </form>
    </div>
  );
}
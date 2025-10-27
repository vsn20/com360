'use client';
import React, { useEffect, useState } from 'react';
import { getorgdetailsbyid, updateorganization } from '@/app/serverActions/Organizations/Actions';
import './organizations.css';
import { useRouter } from 'next/navigation';

const EditOrganization = ({ selectedorgid, orgid, empid, countries, states, aiPrefilledData }) => {
  const router = useRouter();
  const [orgDetails, setOrgDetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const usaCountryId = '185';
  const [form, setForm] = useState({
    suborgname: '',
    isstatus: 'Active',
    addresslane1: '',
    addresslane2: '',
    country: '',
    state: '',
    customStateName: '',
    postalcode: '',
    suborgid: '',
    org_id: '',
    createdby: '',
    createddate: '',
    updatedby: '',
    updateddate: '',
    trade_name: '',
    registration_number: '',
    company_type: '',
    industry: '',
  });

  const getdisplayorgid = (orgid) => {
    return orgid.split('-')[1] || orgid;
  };

  useEffect(() => {
    const loadOrgDetails = async () => {
      if (!selectedorgid) {
        setOrgDetails(null);
        setForm({
          suborgname: '',
          isstatus: 'Active',
          addresslane1: '',
          addresslane2: '',
          country: '',
          state: '',
          customStateName: '',
          postalcode: '',
          suborgid: '',
          org_id: '',
          createdby: '',
          createddate: '',
          updatedby: '',
          updateddate: '',
          trade_name: '',
          registration_number: '',
          company_type: '',
          industry: '',
        });
        return;
      }
      try {
        setIsLoading(true);
        const details = await getorgdetailsbyid(selectedorgid);
        setOrgDetails(details);
        const isUSA = details.country === usaCountryId;
        setForm({
          suborgname: details.suborgname || '',
          isstatus: details.isstatus ? 'Active' : 'Inactive',
          addresslane1: details.addresslane1 || '',
          addresslane2: details.addresslane2 || '',
          country: details.country ? String(details.country) : '',
          state: isUSA && details.state ? String(details.state) : '',
          customStateName: !isUSA ? details.CUSTOME_STATE_NAME || '' : '',
          postalcode: details.postalcode || '',
          suborgid: details.suborgid || '',
          org_id: details.orgid || '',
          createdby: details.created_by || '',
          createddate: details.created_date ? new Date(details.created_date).toISOString().split('T')[0] : '',
          updatedby: details.updated_by || '',
          updateddate: details.updated_date ? new Date(details.updated_date).toISOString().split('T')[0] : '',
          trade_name: details.trade_name || '',
          registration_number: details.registration_number || '',
          company_type: details.company_type || '',
          industry: details.industry || '',
        });
        setError(null);
      } catch (error) {
        setError(error.message);
        setOrgDetails(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadOrgDetails();
  }, [selectedorgid]);

  // Apply AI prefilled data when available
  useEffect(() => {
    if (aiPrefilledData && orgDetails) {
      setIsEditing(true);
      setForm(prev => {
        const newForm = {
          ...prev,
          suborgname: aiPrefilledData.suborgname !== null ? aiPrefilledData.suborgname : prev.suborgname,
          addresslane1: aiPrefilledData.addresslane1 !== null ? aiPrefilledData.addresslane1 : prev.addresslane1,
          addresslane2: aiPrefilledData.addresslane2 !== null ? aiPrefilledData.addresslane2 : prev.addresslane2,
          country: aiPrefilledData.country !== null ? aiPrefilledData.country : prev.country,
          postalcode: aiPrefilledData.postalcode !== null ? aiPrefilledData.postalcode : prev.postalcode,
          isstatus: aiPrefilledData.isstatus !== null ? aiPrefilledData.isstatus : prev.isstatus,
          trade_name: aiPrefilledData.trade_name !== null ? aiPrefilledData.trade_name : prev.trade_name,
          registration_number: aiPrefilledData.registration_number !== null ? aiPrefilledData.registration_number : prev.registration_number,
          company_type: aiPrefilledData.company_type !== null ? aiPrefilledData.company_type : prev.company_type,
          industry: aiPrefilledData.industry !== null ? aiPrefilledData.industry : prev.industry,
        };

        // Handle state/customStateName based on country
        const isUSA = (aiPrefilledData.country !== null ? aiPrefilledData.country : prev.country) === usaCountryId;
        if (isUSA) {
          newForm.state = aiPrefilledData.state !== null ? aiPrefilledData.state : prev.state;
          newForm.customStateName = '';
        } else {
          newForm.state = '';
          newForm.customStateName = prev.customStateName;
        }

        return newForm;
      });
    }
  }, [aiPrefilledData, orgDetails]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      let newForm = { ...prev, [name]: value };
      if (name === 'country') {
        const isUSA = value === usaCountryId;
        newForm.state = isUSA ? prev.state : '';
        newForm.customStateName = isUSA ? '' : prev.customStateName;
      }
      return newForm;
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (!form.suborgname) {
      setError('Organization Name is required.');
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value);
    });

    try {
      const result = await updateorganization(formData);
      if (result?.success) {
        setSuccess('Organization updated successfully.');
        setIsEditing(false);
        const updatedDetails = await getorgdetailsbyid(selectedorgid);
        const isUSA = updatedDetails.country === usaCountryId;
        setOrgDetails(updatedDetails);
        setForm({
          suborgname: updatedDetails.suborgname || '',
          isstatus: updatedDetails.isstatus ? 'Active' : 'Inactive',
          addresslane1: updatedDetails.addresslane1 || '',
          addresslane2: updatedDetails.addresslane2 || '',
          country: updatedDetails.country ? String(updatedDetails.country) : '',
          state: isUSA && updatedDetails.state ? String(updatedDetails.state) : '',
          customStateName: !isUSA ? updatedDetails.CUSTOME_STATE_NAME || '' : '',
          postalcode: updatedDetails.postalcode || '',
          suborgid: updatedDetails.suborgid || '',
          org_id: updatedDetails.orgid || '',
          createdby: updatedDetails.created_by || '',
          createddate: updatedDetails.created_date ? new Date(updatedDetails.created_date).toISOString().split('T')[0] : '',
          updatedby: updatedDetails.updated_by || '',
          updateddate: updatedDetails.updated_date ? new Date(updatedDetails.updated_date).toISOString().split('T')[0] : '',
          trade_name: updatedDetails.trade_name || '',
          registration_number: updatedDetails.registration_number || '',
          company_type: updatedDetails.company_type || '',
          industry: updatedDetails.industry || '',
        });
        setTimeout(() => {
          setSuccess(null);
          router.refresh();
        }, 3000);
      } else {
        setError(result?.error || 'Failed to update organization.');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    const isUSA = orgDetails?.country === usaCountryId;
    setForm({
      suborgname: orgDetails?.suborgname || '',
      isstatus: orgDetails?.isstatus ? 'Active' : 'Inactive',
      addresslane1: orgDetails?.addresslane1 || '',
      addresslane2: orgDetails?.addresslane2 || '',
      country: orgDetails?.country ? String(orgDetails.country) : '',
      state: isUSA && orgDetails?.state ? String(orgDetails.state) : '',
      customStateName: !isUSA ? orgDetails?.CUSTOME_STATE_NAME || '' : '',
      postalcode: orgDetails?.postalcode || '',
      suborgid: orgDetails?.suborgid || '',
      org_id: orgDetails?.orgid || '',
      createdby: orgDetails?.created_by || '',
      createddate: orgDetails?.created_date ? new Date(orgDetails.created_date).toISOString().split('T')[0] : '',
      updatedby: orgDetails?.updated_by || '',
      updateddate: orgDetails?.updated_date ? new Date(orgDetails.updated_date).toISOString().split('T')[0] : '',
      trade_name: orgDetails?.trade_name || '',
      registration_number: orgDetails?.registration_number || '',
      company_type: orgDetails?.company_type || '',
      industry: orgDetails?.industry || '',
    });
    setError(null);
  };

  const formatDate = (date) => {
    if (!date) return '';
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
      return date.split('T')[0];
    }
    return '';
  };

  const isUSA = form.country === usaCountryId;

  return (
    <div className="organization_details_container">
      {isLoading && <div className="organization_loading_message">Loading...</div>}
      {error && <div className="organization_error_message">{error}</div>}
      {success && <div className="organization_success_message">{success}</div>}
      {orgDetails && (
        <div className="organization_details_block">
          <div className="organization_details_header">
            <h3 className="organization_details_header_title">Organization Details</h3>
            {!isEditing && (
              <div className="organization_details_buttons">
                <button className="organization_edit_button" onClick={handleEdit}>
                  Edit
                </button>
              </div>
            )}
          </div>
          {isEditing ? (
            <form onSubmit={handleSave}>
              <div className="organization_form_row">
                <div className="organization_form_group">
                  <label>Organization Name*</label>
                  <input
                    type="text"
                    name="suborgname"
                    value={form.suborgname}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="organization_form_group">
                  <label>Status</label>
                  <select name="isstatus" value={form.isstatus} onChange={handleFormChange}>
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
                    onChange={handleFormChange}
                  />
                </div>
                <div className="organization_form_group">
                  <label>Address Line 2</label>
                  <input
                    type="text"
                    name="addresslane2"
                    value={form.addresslane2}
                    onChange={handleFormChange}
                  />
                </div>
              </div>
              <div className="organization_form_row">
                <div className="organization_form_group">
                  <label>Country</label>
                  <select name="country" value={form.country} onChange={handleFormChange}>
                    <option value="">Select Country</option>
                    {countries.map((country) => (
                      <option key={country.ID} value={String(country.ID)}>
                        {country.VALUE}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="organization_form_group">
                  <label>State</label>
                  <select name="state" value={form.state} onChange={handleFormChange} disabled={!isUSA}>
                    <option value="">Select State</option>
                    {states.map((state) => (
                      <option key={state.ID} value={String(state.ID)}>
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
                    onChange={handleFormChange}
                    disabled={isUSA}
                  />
                </div>
                <div className="organization_form_group">
                  <label>Postal Code</label>
                  <input
                    type="text"
                    name="postalcode"
                    value={form.postalcode}
                    onChange={handleFormChange}
                  />
                </div>
              </div>
              <div className="organization_form_row">
                <div className="organization_form_group">
                  <label>Trade Name</label>
                  <input
                    type="text"
                    name="trade_name"
                    value={form.trade_name}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="organization_form_group">
                  <label>Registration Number</label>
                  <input
                    type="text"
                    name="registration_number"
                    value={form.registration_number}
                    onChange={handleFormChange}
                  />
                </div>
              </div>
              <div className="organization_form_row">
                <div className="organization_form_group">
                  <label>Company Type</label>
                  <input
                    type="text"
                    name="company_type"
                    value={form.company_type}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="organization_form_group">
                  <label>Industry</label>
                  <input
                    type="text"
                    name="industry"
                    value={form.industry}
                    onChange={handleFormChange}
                  />
                </div>
              </div>
              <div className="organization_form_buttons">
                <button type="submit" className="organization_submit_button" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="organization_cancel_button" onClick={handleCancel} disabled={isLoading}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="organization_view_details">
              <div className="organization_details_row">
                <div className="organization_details_group">
                  <label>Organization ID</label>
                  <p>{getdisplayorgid(form.suborgid)}</p>
                </div>
                <div className="organization_details_group">
                  <label>Organization Name</label>
                  <p>{form.suborgname || '-'}</p>
                </div>
              </div>
              <div className="organization_details_row">
                <div className="organization_details_group">
                  <label>Status</label>
                  <p>{form.isstatus}</p>
                </div>
                <div className="organization_details_group">
                  <label>Address Line 1</label>
                  <p>{form.addresslane1 || '-'}</p>
                </div>
              </div>
              <div className="organization_details_row">
                <div className="organization_details_group">
                  <label>Address Line 2</label>
                  <p>{form.addresslane2 || '-'}</p>
                </div>
                <div className="organization_details_group">
                  <label>Country</label>
                  <p>{form.country ? (countries.find(c => String(c.ID) === form.country)?.VALUE || 'Unknown Country') : '-'}</p>
                </div>
              </div>
              <div className="organization_details_row">
                <div className="organization_details_group">
                  <label>State</label>
                  <p>{isUSA && form.state ? (states.find(s => String(s.ID) === form.state)?.VALUE || 'Unknown State') : form.customStateName || '-'}</p>
                </div>
                <div className="organization_details_group">
                  <label>Postal Code</label>
                  <p>{form.postalcode || '-'}</p>
                </div>
              </div>
              <div className="organization_details_row">
                <div className="organization_details_group">
                  <label>Trade Name</label>
                  <p>{form.trade_name || '-'}</p>
                </div>
                <div className="organization_details_group">
                  <label>Registration Number</label>
                  <p>{form.registration_number || '-'}</p>
                </div>
              </div>
              <div className="organization_details_row">
                <div className="organization_details_group">
                  <label>Company Type</label>
                  <p>{form.company_type || '-'}</p>
                </div>
                <div className="organization_details_group">
                  <label>Industry</label>
                  <p>{form.industry || '-'}</p>
                </div>
              </div>
              <div className="organization_details_row">
                <div className="organization_details_group">
                  <label>Created By</label>
                  <p>{form.createdby || '-'}</p>
                </div>
                <div className="organization_details_group">
                  <label>Created Date</label>
                  <p>{formatDate(form.createddate) || '-'}</p>
                </div>
              </div>
              <div className="organization_details_row">
                <div className="organization_details_group">
                  <label>Updated By</label>
                  <p>{form.updatedby || '-'}</p>
                </div>
                <div className="organization_details_group">
                  <label>Updated Date</label>
                  <p>{formatDate(form.updateddate) || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditOrganization;
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addRole } from '../serverActions/addRole';

export default function AddRole({ features, currentRole, orgid, error }) {
  const router = useRouter();
  const [formError, setFormError] = useState(error || null);
  const [expandedFeatures, setExpandedFeatures] = useState({}); // Track which features are expanded
  const [selectedSubmenus, setSelectedSubmenus] = useState({}); // Track multiple selected submenus per menuid

  const handleSubmit = async (formData) => {
    formData.append('currentRole', currentRole || ''); // Ensure currentRole is a string
    // Append all selected submenus
    Object.entries(selectedSubmenus).forEach(([menuid, submenuIds]) => {
      submenuIds.forEach(submenuId => {
        if (submenuId) {
          formData.append('submenus', `${menuid}:${submenuId}`);
        }
      });
    });

    // Client-side validation: Ensure at least one submenu is selected for menus with hassubmenu='yes'
    const selectedFeaturesIds = Object.keys(expandedFeatures).filter(id => expandedFeatures[id]);
    const invalidSelections = features
      .filter(feature => selectedFeaturesIds.includes(String(feature.id)) && feature.hassubmenu === 'yes')
      .filter(feature => {
        const selected = selectedSubmenus[feature.id] || [];
        return selected.length === 0;
      });
    if (invalidSelections.length > 0) {
      setFormError('Please select at least one submenu for each feature with submenus.');
      return;
    }

    const result = await addRole(formData);
    if (result?.error) {
      setFormError(result.error);
    } else {
      router.push(`/userscreens/roles/addroles?success=Role%20added%20successfully`);
    }
  };

  const handleFeatureChange = (menuid) => {
    setExpandedFeatures(prev => ({
      ...prev,
      [menuid]: !prev[menuid] // Toggle expansion
    }));
    // If unchecking, clear selected submenus for this feature
    if (!expandedFeatures[menuid] || !selectedSubmenus[menuid]) {
      setSelectedSubmenus(prev => ({
        ...prev,
        [menuid]: []
      }));
    }
  };

  const handleSubmenuChange = (menuid, submenuId) => {
    const feature = features.find(f => f.id === menuid);
    if (feature && feature.hassubmenu !== 'yes') {
      return; // Disable submenu selection if hassubmenu != 'yes'
    }
    setSelectedSubmenus(prev => {
      const currentSubmenus = prev[menuid] || [];
      if (currentSubmenus.includes(submenuId)) {
        return {
          ...prev,
          [menuid]: currentSubmenus.filter(id => id !== submenuId)
        };
      } else {
        return {
          ...prev,
          [menuid]: [...currentSubmenus, submenuId]
        };
      }
    });
  };

  console.log('Features received:', JSON.stringify(features, null, 2)); // Debug features data
  console.log('Selected Submenus:', JSON.stringify(selectedSubmenus, null, 2)); // Debug selected submenus

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Add Role</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {formError && <p style={{ color: "red" }}>{formError}</p>}
      <form action={handleSubmit}>
        {/* Organization ID (Non-editable) */}
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="orgid" style={{ display: "block", marginBottom: "5px" }}>
            Organization ID:
          </label>
          <input
            type="text"
            id="orgid"
            name="orgid"
            value={orgid || ''}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
              backgroundColor: "#f0f0f0",
            }}
            disabled
          />
        </div>

        {/* Required Fields */}
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="roleName" style={{ display: "block", marginBottom: "5px" }}>
            Role Name: *
          </label>
          <input
            type="text"
            id="roleName"
            name="roleName"
            placeholder="Enter role name (e.g., Manager)"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
            required
          />
        </div>

        {/* Feature Checkboxes with Submenus */}
        <div style={{ marginBottom: "20px" }}>
          <h3>Select Features: *</h3>
          {features.length === 0 ? (
            <p>No features available.</p>
          ) : (
            features.map((feature) => (
              <div key={feature.id} style={{ margin: "10px 0" }}>
                <label style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    name="features"
                    value={feature.id}
                    onChange={() => handleFeatureChange(feature.id)}
                    style={{ marginRight: "10px" }}
                  />
                  {feature.name}
                </label>
                {expandedFeatures[feature.id] && feature.hassubmenu === 'yes' && feature.submenu && feature.submenu.length > 0 && (
                  <div style={{ marginLeft: "20px" }}>
                    {feature.submenu.map((sub) => (
                      <div key={sub.id} style={{ margin: "5px 0" }}>
                        <label style={{ display: "flex", alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={(selectedSubmenus[feature.id] || []).includes(sub.id)}
                            onChange={() => handleSubmenuChange(feature.id, sub.id)}
                            style={{ marginRight: "10px" }}
                          />
                          {sub.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                {/* {expandedFeatures[feature.id] && feature.hassubmenu !== 'yes' && (
                  <p style={{ marginLeft: "20px", color: "gray" }}>No submenus available.</p>
                )} */}
              </div>
            ))
          )}
        </div>

        <button
          type="submit"
          style={{
            padding: "10px 20px",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Add Role
        </button>
      </form>
    </div>
  );
}
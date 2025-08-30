'use client';

import { useState } from 'react';
import PrioritySettingComponent from '@/app/components/PrioritySetting';
import { savePriorities } from '@/app/serverActions/priorityAction';
import styles from '../../../components/prioritysettings.module.css';

export default function PrioritySettingClient({ initialMenus, orgid }) {
  const [saveStatus, setSaveStatus] = useState(null);

  const handleSave = async (priorityData) => {
    try {
      setSaveStatus('saving');
      await savePriorities(priorityData);
      setSaveStatus('success');
      
      // Reload the entire page to refresh sidebar and all components
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  return (
    <div>
      {saveStatus === 'success' && (
        <div className={styles.alphaSuccessAlert}>
          ✅ Priorities saved successfully!
        </div>
      )}
      {saveStatus === 'error' && (
        <div className={styles.alphaErrorAlert}>
          ❌ Failed to save priorities. Please try again.
        </div>
      )}
      
      <PrioritySettingComponent 
        initialMenus={initialMenus} 
        orgid={orgid}
        onSave={handleSave}
      />
    </div>
  );
}
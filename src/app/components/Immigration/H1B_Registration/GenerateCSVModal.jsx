'use client';

import React, { useState } from 'react';
import { fetchH1BDataForCSV } from '@/app/serverActions/Immigration/H1Bimmigration/H1Bimmigration';
import styles from './H1Immigration.module.css';

const GenerateCSVModal = ({ suborgs, onClose }) => {
  
  const getDefaultYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const aprilFirst = new Date(currentYear, 3, 1);
    return now >= aprilFirst ? currentYear + 2 : currentYear + 1;
  };

  const [year, setYear] = useState(getDefaultYear());
  const [suborg, setSuborg] = useState('');
  const [generating, setGenerating] = useState(false);

  const yearOptions = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);

  const convertToCSV = (objArray) => {
    if (!objArray || objArray.length === 0) return '';
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    const header = Object.keys(array[0]).join(',') + '\n';
    const body = array.map(item => {
        return Object.values(item).map(val => {
            const stringVal = String(val === null ? '' : val);
            return `"${stringVal.replace(/"/g, '""')}"`;
        }).join(',');
    }).join('\n');
    return header + body;
  };

  const handleGenerate = async () => {
    if (!suborg) {
        alert("Please select a sub-organization.");
        return;
    }

    setGenerating(true);
    try {
        const data = await fetchH1BDataForCSV({ year, suborgid: suborg });
        
        if (data.length === 0) {
            alert("No records found for the selected criteria.");
            setGenerating(false);
            return;
        }

        const csvString = convertToCSV(data);
        const suborgName = suborgs.find(s => String(s.suborgid) === String(suborg))?.suborgname || 'Org';
        const fileName = `${suborgName}_H1B_Registrations_FY${year}.csv`;

        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        onClose();
    } catch (err) {
        console.error(err);
        alert("Failed to generate CSV.");
    } finally {
        setGenerating(false);
    }
  };

  return (
    <div className={styles.h1bimmigrationreg_modalOverlay}>
      <div className={styles.h1bimmigrationreg_modalContent} style={{ width: '400px' }}>
        <div className={styles.h1bimmigrationreg_modalHeader}>
            <h3 className={styles.h1bimmigrationreg_title}>Generate H1B CSV</h3>
            <button onClick={onClose} className={styles.h1bimmigrationreg_closeBtn}>&times;</button>
        </div>
        
        <div className={styles.h1bimmigrationreg_formGroup}>
            <label className={styles.h1bimmigrationreg_label}>Select Fiscal Year</label>
            <select value={year} onChange={e => setYear(e.target.value)} className={styles.h1bimmigrationreg_select}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>

        <div className={styles.h1bimmigrationreg_formGroup} style={{marginTop:'15px'}}>
            <label className={styles.h1bimmigrationreg_label}>Select Sub-Organization</label>
            <select value={suborg} onChange={e => setSuborg(e.target.value)} className={styles.h1bimmigrationreg_select}>
                <option value="">-- Select --</option>
                {suborgs.map(s => (
                    <option key={s.suborgid} value={s.suborgid}>{s.suborgname}</option>
                ))}
            </select>
        </div>

        <div className={styles.h1bimmigrationreg_modalActions}>
            <button className={`${styles.h1bimmigrationreg_button} ${styles.h1bimmigrationreg_save}`} onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating...' : 'Download CSV'}
            </button>
            <button className={`${styles.h1bimmigrationreg_button} ${styles.h1bimmigrationreg_btnCancel}`} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default GenerateCSVModal
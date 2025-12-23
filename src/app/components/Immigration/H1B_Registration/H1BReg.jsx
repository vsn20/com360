'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchH1BRegistrations } from '@/app/serverActions/Immigration/H1Bimmigration/H1Bimmigration';
import AddEditH1BReg from './AddEditH1BReg';
import GenerateCSVModal from './GenerateCSVModal';
import styles from './H1Immigration.module.css';

const H1BReg = ({ initialRecords, suborgs, countries }) => {
  const [records, setRecords] = useState(initialRecords);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filterYear, setFilterYear] = useState('all');
  const [filterSuborg, setFilterSuborg] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState('1');
  const [rowsPerPageInput, setRowsPerPageInput] = useState('10');

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const refreshData = async () => {
    setLoading(true);
    try {
      const data = await fetchH1BRegistrations({ 
        year: filterYear, 
        suborgid: filterSuborg 
      });
      setRecords(data);
      setCurrentPage(1); 
      setPageInput('1');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [filterYear, filterSuborg]);

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setRowsPerPageInput(rowsPerPage.toString());
  }, [rowsPerPage]);

  const handleAddClick = () => {
    setSelectedRecord(null);
    setShowAddEditModal(true);
  };

  const handleRowClick = (record) => {
    setSelectedRecord(record);
    setShowAddEditModal(true);
  };

  const getSuborgName = (id) => {
    const s = suborgs.find(x => String(x.suborgid) === String(id));
    return s ? s.suborgname : id;
  };

  const { paginatedRecords, totalPages } = useMemo(() => {
    const pages = Math.ceil(records.length / rowsPerPage);
    const start = (currentPage - 1) * rowsPerPage;
    return {
      paginatedRecords: records.slice(start, start + rowsPerPage),
      totalPages: pages || 1
    };
  }, [records, currentPage, rowsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setPageInput(String(newPage));
    }
  };

  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(pageInput, 10);
      if (!isNaN(value) && value >= 1 && value <= totalPages) {
        setCurrentPage(value);
        setPageInput(value.toString());
      } else {
        setPageInput(currentPage.toString());
      }
    }
  };

  const handleRowsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(rowsPerPageInput, 10);
      if (!isNaN(value) && value >= 1) {
        setRowsPerPage(value);
        setRowsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInput('1');
      } else {
        setRowsPerPageInput(rowsPerPage.toString());
      }
    }
  };

  return (
    <div className={styles.h1bimmigrationreg_container}>
      <div className={styles.h1bimmigrationreg_header}>
        <h2 className={styles.h1bimmigrationreg_title}>H1B Registration</h2>
        <div className={styles.h1bimmigrationreg_headerButtons}>
          <button 
            className={`${styles.h1bimmigrationreg_button} ${styles.h1bimmigrationreg_btnSecondary}`}
            onClick={() => setShowCSVModal(true)}
          >
            Generate CSV for H1B Filing
          </button>
          <button 
            className={`${styles.h1bimmigrationreg_button} ${styles.h1bimmigrationreg_btnPrimary}`}
            onClick={handleAddClick}
          >
            Add Record
          </button>
        </div>
      </div>

      <div className={styles.h1bimmigrationreg_filterContainer}>
        <select 
          className={styles.h1bimmigrationreg_select}
          value={filterSuborg}
          onChange={(e) => setFilterSuborg(e.target.value)}
        >
          <option value="all">All Organizations</option>
          {suborgs.map(s => (
            <option key={s.suborgid} value={s.suborgid}>{s.suborgname}</option>
          ))}
        </select>

        <select 
          className={styles.h1bimmigrationreg_select}
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
        >
          <option value="all">All Years</option>
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className={styles.h1bimmigrationreg_tableWrapper}>
        <table className={styles.h1bimmigrationreg_table}>
          <thead>
            <tr>
              <th className={styles.h1bimmigrationreg_th}>Name</th>
              <th className={styles.h1bimmigrationreg_th}>Passport Number</th>
              <th className={styles.h1bimmigrationreg_th}>US Masters Cap</th>
              <th className={styles.h1bimmigrationreg_th}>Email</th>
              <th className={styles.h1bimmigrationreg_th}>Year</th>
              <th className={styles.h1bimmigrationreg_th}>Organization</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className={styles.h1bimmigrationreg_td} style={{textAlign:'center'}}>Loading...</td></tr>
            ) : paginatedRecords.length === 0 ? (
              <tr><td colSpan="6" className={styles.h1bimmigrationreg_td} style={{textAlign:'center'}}>No records found.</td></tr>
            ) : paginatedRecords.map(row => (
              <tr key={row.id} onClick={() => handleRowClick(row)} className={styles.h1bimmigrationreg_tableRow}>
                <td className={styles.h1bimmigrationreg_td}>
                  <span className={styles.h1bimmigrationreg_roleIndicator}></span>
                  {row.first_name} {row.last_name}
                </td>
                <td className={styles.h1bimmigrationreg_td} style={{fontFamily:'monospace', color:'#0056b3'}}>{row.passport_number}</td>
                <td className={styles.h1bimmigrationreg_td}>{row.us_masters_cap === 'Y' ? 'Yes' : 'No'}</td>
                <td className={styles.h1bimmigrationreg_td}>{row.email}</td>
                <td className={styles.h1bimmigrationreg_td}>{row.year}</td>
                <td className={styles.h1bimmigrationreg_td}>{getSuborgName(row.suborgid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.h1bimmigrationreg_pagination}>
        <button 
          className={styles.h1bimmigrationreg_button} 
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ← Previous
        </button>
        <span className={styles.h1bimmigrationreg_pageInfo}>
          Page 
          <input 
            type="text" 
            value={pageInput} 
            className={styles.h1bimmigrationreg_pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyPress={handlePageInputKeyPress}
          /> of {totalPages}
        </span>
        <button 
          className={styles.h1bimmigrationreg_button} 
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next →
        </button>
      </div>

      <div className={styles.h1bimmigrationreg_rowsPerPageContainer}>
        <label className={styles.h1bimmigrationreg_rowsPerPageLabel}>Rows per Page:</label>
        <input
          type="text"
          value={rowsPerPageInput}
          onChange={(e) => setRowsPerPageInput(e.target.value)}
          onKeyPress={handleRowsPerPageInputKeyPress}
          placeholder="Rows per page"
          className={styles.h1bimmigrationreg_rowsPerPageInput}
          aria-label="Number of rows per page"
        />
      </div>

      {showAddEditModal && (
        <AddEditH1BReg 
          record={selectedRecord}
          suborgs={suborgs}
          countries={countries}
          onClose={() => setShowAddEditModal(false)}
          onSuccess={() => { setShowAddEditModal(false); refreshData(); }}
        />
      )}

      {showCSVModal && (
        <GenerateCSVModal 
          suborgs={suborgs}
          onClose={() => setShowCSVModal(false)}
        />
      )}
    </div>
  );
};

export default H1BReg;
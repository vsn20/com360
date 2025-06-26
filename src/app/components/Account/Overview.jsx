'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAccountByOrgId } from '@/app/serverActions/Account/Overview';

const Overview = () => {
  const router = useRouter();
  const [accountData, setAccountData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchAccountByOrgId();
        setAccountData(data);
        setError(null);
      } catch (err) {
        console.error('Error loading account data:', err);
        setError(err.message);
      }
    };
    loadData();
  }, []);

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (accountData.length === 0) {
    return <div>Loading...</div>;
  }

  const handleEdit = (accntId) => {
    router.push(`/userscreens/account/edit/${accntId}`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Account Overview</h2>
      {accountData.map((account) => (
        <div key={account.ACCNT_ID} style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '10px', borderRadius: '5px' }}>
          <p><strong>Account ID:</strong> {account.ACCNT_ID}</p>
          <p><strong>Account Type:</strong> {account.ACCT_TYPE_CD}</p>
          <p><strong>Email:</strong> {account.EMAIL}</p>
          <p><strong>Alias Name:</strong> {account.ALIAS_NAME}</p>
          <button
            onClick={() => handleEdit(account.ACCNT_ID)}
            style={{ padding: '5px 10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Edit
          </button>
        </div>
      ))}
    </div>
  );
};

export default Overview;
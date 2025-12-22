import React from 'react';
import Immigration from '@/app/components/Immigration/Immigration';
import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import { 
  fetchGlobalImmigrationRecords, 
  fetchEmployeesForDropdown, 
  fetchSuborgsForDropdown, 
  getUserContext 
} from '@/app/serverActions/Immigration/ImmigrationFeature';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

const ImmigrationPage = async () => {
  let records = [];
  let employees = [];
  let suborgs = [];
  let document_types = [];
  let document_subtypes = [];
  let immigrationStatuses = [];
  let isAdmin = false;
  let userSuborgId = null;
  let error = null;

  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    
    if (!token) throw new Error("Authentication required");
    const decoded = decodeJwt(token);
    const orgid = decoded?.orgid;

    if (!orgid) throw new Error("Invalid Token Data");

    // 1. Fetch User Context
    const context = await getUserContext();
    isAdmin = context.isAdmin;
    userSuborgId = context.userSuborgId;

    // 2. Parallel Data Fetching
    const pool = await DBconnection();
    
    const [
        docTypesRows, 
        docSubtypesRows, 
        statusRows, 
        recordData, 
        empData, 
        suborgData
    ] = await Promise.all([
        pool.query('SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 30 AND isactive = 1 AND (orgid = ? OR orgid = -1)', [orgid]),
        pool.query('SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 31 AND isactive = 1 AND (orgid = ? OR orgid = -1)', [orgid]),
        pool.query('SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 29 AND isactive = 1 AND (orgid = ? OR orgid = -1)', [orgid]),
        fetchGlobalImmigrationRecords(),
        fetchEmployeesForDropdown(),
        fetchSuborgsForDropdown()
    ]);

    document_types = docTypesRows[0];
    document_subtypes = docSubtypesRows[0];
    immigrationStatuses = statusRows[0];
    records = recordData.records;
    employees = empData;
    suborgs = suborgData;

  } catch (err) {
    console.error("Error loading immigration page:", err);
    error = err.message;
  }

  if (error) {
    return <div style={{padding: '20px', color: 'red'}}>Error: {error}</div>;
  }

  return (
    <div>
      <Immigration 
        initialRecords={records}
        employees={employees}
        suborgs={suborgs}
        document_types={document_types}
        document_subtypes={document_subtypes}
        immigrationStatuses={immigrationStatuses}
        isAdmin={isAdmin}
        userSuborgId={userSuborgId}
      />
    </div>
  );
};

export default ImmigrationPage;
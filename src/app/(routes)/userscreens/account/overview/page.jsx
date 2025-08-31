import React from 'react';
import Overview from '@/app/components/Account/Overview';
import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';

// Simple function to decode JWT without verification
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

export default async function OverviewPage({ searchParams }) {
  const { error: queryError } = searchParams || {};
  const error = queryError ? decodeURIComponent(queryError) : null;

  let orgid = null;
  let accounts = [];
  let accountTypes = [];
  let branchTypes = [];
  let countries = [];
  let states = [];
  let suborgid=[];
  try {
    const pool = await DBconnection();
    console.log("1234")
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.orgid) {
        orgid = decoded.orgid;

        [accounts] = await pool.query(
          'SELECT ACCNT_ID, ACCT_TYPE_CD, EMAIL, ALIAS_NAME, BRANCH_TYPE,ACTIVE_FLAG FROM C_ACCOUNT WHERE ORGID = ?',
          [orgid]
        );
        
        [accountTypes] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 5 AND orgid = ? AND isactive = 1',
          [orgid]
        );

        [branchTypes] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 6 AND orgid = ? AND isactive = 1',
          [orgid]
        );

        [countries] = await pool.query(
          'SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1'
        );

        [states] = await pool.query(
          'SELECT ID, VALUE FROM C_STATE WHERE ACTIVE = 1'
        );
        [suborgid] = await pool.query(
          'SELECT suborgid, suborgname FROM C_SUB_ORG WHERE orgid = ? AND isstatus = 1',
          [orgid]
        );
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }

  return (
    <Overview
      accountTypes={accountTypes}
      branchTypes={branchTypes}
      countries={countries}
      states={states}
      orgid={orgid}
      error={error}
      accounts={accounts}
      suborgs={suborgid}
    />
  );
}
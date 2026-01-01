
export const dynamic = 'force-dynamic';

import React from 'react';
import Overview from '@/app/components/Organizations/Overview';
import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';


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

const Page = async () => {
  let orgid = null;
  let empid = null;
  let countries = [];
  let states = [];
  let organizations = [];
  let documenttypes=[];

  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.empid) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    orgid = decoded.orgid;
    empid = decoded.empid;

    const pool = await DBconnection();
    try {
      const [orgRows] = await pool.query(
        `SELECT suborgid, orgid, suborgname, isstatus, country, state, CUSTOME_STATE_NAME, 
         addresslane1, addresslane2, postalcode, created_by, created_date, updated_by, updated_date,
         trade_name, registration_number, company_type, industry
         FROM C_SUB_ORG WHERE orgid = ?`,
        [orgid]
      );
      organizations = orgRows;

      const [countryRows] = await pool.query(
        'SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1'
      );
      countries = countryRows;

      const [stateRows] = await pool.query(
        'SELECT ID, VALUE FROM C_STATE WHERE ACTIVE = 1'
      );
      states = stateRows;

      // Fetch only W-9 (id=6 with g_id=18 and orgid=-1) + Organization Documents (g_id=39)
      const [documenttypesrows]=await pool.query(
        `SELECT id, Name, orgid FROM C_GENERIC_VALUES 
         WHERE isactive = 1 AND (
           (g_id = 18 AND id = 6 AND orgid = -1) OR 
           (g_id = 39 AND orgid = ?)
         )
         ORDER BY orgid DESC, Name`,
      [orgid]
      );
      // Mark W-9 (orgid=-1) as isDefault so it can't be edited
      documenttypes = documenttypesrows.map(row => ({
        ...row,
        isDefault: row.orgid === -1
      }));
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  } catch (error) {
    console.error('Error in page function:', error);
  }

  return (
    <Overview
      orgid={orgid}
      empid={empid}
      organizations={organizations}
      countries={countries}
      states={states}
      documenttypes={documenttypes}
    />
  );
};

export default Page;
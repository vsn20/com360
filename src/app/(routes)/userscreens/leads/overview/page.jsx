'use server';

import Overview from '@/app/components/Leads/Overview';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import DBconnection from '@/app/utils/config/db';

const page = async () => {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value || '';
  const JWT_SECRET = process.env.JWT_SECRET;

  let orgId = null;
  let leads = [];
  let billTypes = [];
  let otBillTypes = [];
  let payTerms = [];
  let accounts = [];
  let industries = [];

  if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      orgId = decoded.orgid ? decoded.orgid.toString() : null;
    } catch (error) {
      console.error('Invalid JWT token:', error);
      orgId = null;
    }
  }

  if (orgId) {
    let pool;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        pool = await DBconnection();
        console.log('MySQL connection pool acquired');

        // Fetch leads with suborgname
        const [leadRows] = await pool.execute(
          `SELECT l.LEAD_ID, l.LEAD_NAME, l.LEAD_DESC, l.ACCNT_ID, l.ORG_ID, l.COST, l.OT_COST,
                  l.START_DT, l.END_DT, l.CLIENT_ID, l.PAY_TERM, l.suborgid, l.Industries, 
                  l.CREATED_BY, l.LAST_UPDATED_BY, s.suborgname
           FROM C_LEADS l
           LEFT JOIN C_SUB_ORG s ON l.suborgid = s.suborgid AND l.ORG_ID = s.orgid
           WHERE l.ORG_ID = ?`,
          [orgId]
        );
        leads = leadRows;
        console.log('Fetched leads:', leads.map(row => ({
          LEAD_ID: row.LEAD_ID,
          ACCNT_ID: row.ACCNT_ID,
          suborgid: row.suborgid,
          suborgname: row.suborgname,
          Industries: row.Industries
        })));

        // Fetch billTypes (g_id = 7)
        const [billTypeRows] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
          [7, orgId]
        );
        billTypes = billTypeRows;
        console.log('Fetched billTypes:', billTypes);

        // Fetch otBillTypes (g_id = 8)
        const [otBillTypeRows] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
          [8, orgId]
        );
        otBillTypes = otBillTypeRows;
        console.log('Fetched otBillTypes:', otBillTypes);

        // Fetch payTerms (g_id = 9)
        const [payTermRows] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
          [9, orgId]
        );
        payTerms = payTermRows;
        console.log('Fetched payTerms:', payTerms);

        // Fetch industries (g_id = 40)
        const [industryRows] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
          [40, orgId]
        );
        industries = industryRows;
        console.log('Fetched industries:', industries);

        // Fetch accounts with suborgid and suborgname
        const [accountRows] = await pool.execute(
          `SELECT a.ACCNT_ID, a.ALIAS_NAME, a.suborgid, s.suborgname
           FROM C_ACCOUNT a
           LEFT JOIN C_SUB_ORG s ON a.suborgid = s.suborgid AND a.ORGID = s.orgid
           WHERE a.ORGID = ? AND a.ACTIVE_FLAG = 1`,
          [orgId]
        );
        accounts = accountRows;
        console.log('Fetched accounts:', accounts.map(row => ({
          ACCNT_ID: row.ACCNT_ID,
          ALIAS_NAME: row.ALIAS_NAME,
          suborgid: row.suborgid,
          suborgname: row.suborgname
        })));

        break;
      } catch (error) {
        console.error('Error fetching data:', error.message);
        if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
          console.log('Pool is closed, retrying connection...');
          retryCount++;
          continue;
        }
        break;
      }
    }
  } else {
    console.warn('No valid orgId, skipping data fetch');
  }

  return (
    <div>
      <Overview
        orgId={orgId}
        leads={leads}
        billTypes={billTypes}
        otBillTypes={otBillTypes}
        payTerms={payTerms}
        accounts={accounts}
        industries={industries}
      />
    </div>
  );
};

export default page;
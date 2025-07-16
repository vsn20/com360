import Overview from '@/app/components/Project/Overview';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import DBconnection from '@/app/utils/config/db';

const page = async () => {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value || '';
  const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is set in .env

  let orgId = null;
  let projects = [];
  let billTypes = [];
  let otBillTypes = [];
  let payTerms = [];
  let accounts = [];

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

        // Fetch projects
        const [projectRows] = await pool.execute(
          `SELECT PRJ_ID, PRJ_NAME, PRS_DESC, ACCNT_ID, ORG_ID, BILL_RATE, BILL_TYPE, OT_BILL_RATE, OT_BILL_TYPE,
                  BILLABLE_FLAG, START_DT, END_DT, CLIENT_ID, PAY_TERM, INVOICE_EMAIL, INVOICE_FAX, INVOICE_PHONE,
                  Createdby, Updatedby
           FROM C_PROJECT WHERE ORG_ID = ?`,
          [orgId]
        );
        projects = projectRows;

        // Fetch billTypes (g_id = 7)
        const [billTypeRows] = await pool.query(
          'SELECT id, Name FROM generic_values WHERE g_id = ? AND orgid = ? AND isactive = 1',
          [7, orgId]
        );
        billTypes = billTypeRows;

        // Fetch otBillTypes (g_id = 8)
        const [otBillTypeRows] = await pool.query(
          'SELECT id, Name FROM generic_values WHERE g_id = ? AND orgid = ? AND isactive = 1',
          [8, orgId]
        );
        otBillTypes = otBillTypeRows;

        // Fetch payTerms (g_id = 9)
        const [payTermRows] = await pool.query(
          'SELECT id, Name FROM generic_values WHERE g_id = ? AND orgid = ? AND isactive = 1',
          [9, orgId]
        );
        payTerms = payTermRows;

        // Fetch accounts for ACCNT_ID and CLIENT_ID mapping
        const [accountRows] = await pool.execute(
          'SELECT ACCNT_ID, ALIAS_NAME FROM C_ACCOUNT WHERE ORGID = ? AND ACTIVE_FLAG = 1',
          [orgId]
        );
        accounts = accountRows;

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

  console.log('Fetched data:', { projects, billTypes, otBillTypes, payTerms, accounts });

  return (
    <div>
      <Overview
      orgId={orgId}
        projects={projects}
        billTypes={billTypes}
        otBillTypes={otBillTypes}
        payTerms={payTerms}
        accounts={accounts}
      />
    </div>
  );
};

export default page;
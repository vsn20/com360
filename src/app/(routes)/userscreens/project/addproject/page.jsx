import Addproject from '@/app/components/Project/Addproject';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import DBconnection from '@/app/utils/config/db';

const page = async () => {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value || '';
  const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is set in .env

  let orgId = null;
  let billTypes = [];
  let otBillTypes = [];
  let payTerms = [];

  if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      orgId = decoded.orgid ? decoded.orgid.toString() : null; // Ensure orgId is a string
    } catch (error) {
      console.error('Invalid JWT token:', error);
      orgId = null; // Fallback to null if decoding fails
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

        // Fetch billTypes (g_id = 7)
        const [billTypeRows] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
          [7, orgId]
        );
        billTypes = billTypeRows;

        // Fetch otBillTypes (g_id = 8)
        const [otBillTypeRows] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
          [8, orgId]
        );
        otBillTypes = otBillTypeRows;

        // Fetch payTerms (g_id = 9)
        const [payTermRows] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
          [9, orgId]
        );
        payTerms = payTermRows;

        break; // Exit retry loop on success
      } catch (error) {
        console.error('Error fetching generic values:', error.message);
        if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
          console.log('Pool is closed, retrying connection...');
          retryCount++;
          continue;
        }
        break; // Exit on non-retryable error
      } 
    }
  } else {
    console.warn('No valid orgId, skipping generic values fetch');
  }

  console.log('Fetched generic values:', { billTypes, otBillTypes, payTerms });

  return (
    <div>
      <Addproject
        orgId={orgId}
        billTypes={billTypes}
        otBillTypes={otBillTypes}
        payTerms={payTerms}
      />
    </div>
  );
};

export default page;
import Overview from '@/app/components/Lead_Assignment/Overview';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import DBconnection from '@/app/utils/config/db';

const page = async () => {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value || '';
  const JWT_SECRET = process.env.JWT_SECRET;

  let orgId = '';
  let billTypes = [];
  let otBillTypes = [];
  let payTerms = [];

  if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      orgId = decoded.orgid ? decoded.orgid.toString() : '';
    } catch (error) {
      console.error('Invalid JWT token:', error);
    }
  }

  if (orgId) {
    try {
      const pool = await DBconnection();
      
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
    } catch (error) {
      console.log('Error fetching generic values:', error);
    }
  }

  return (
    <div>
      <Overview
        orgId={orgId}
        billTypes={billTypes}
        otBillTypes={otBillTypes}
        payTerms={payTerms}
      />
    </div>
  );
};

export default page;
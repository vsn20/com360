import Overview from '@/app/components/Project_Assignment/Overview';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import DBconnection from '@/app/utils/config/db';

const page = async () => {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value || '';
  const JWT_SECRET = process.env.JWT_SECRET;

  let orgId = '';
  let billTypes = [];
  let otBillType = [];
  let payTerms = [];
  if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      orgId = decoded.orgid ? decoded.orgid.toString() : '';
    } catch (error) {
      console.error('Invalid JWT token:', error);
    }
  }

  try {
    const pool = await DBconnection();
    const [billTypeRows] = await pool.query(
      'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
      [7, orgId]
    );
    billTypes = billTypeRows;

    const [otBillTypeRows] = await pool.query(
      'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
      [8, orgId]
    );
    otBillType = otBillTypeRows;

    const [payTermRows] = await pool.query(
      'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
      [9, orgId]
    );
    payTerms = payTermRows;
  } catch (error) {
    console.log('Error fetching generic values:', error);
  }

  return (
    <div>
      <Overview
        orgId={orgId}
        billTypes={billTypes}
        otBillType={otBillType}
        payTerms={payTerms}
      />
    </div>
  );
};

export default page;

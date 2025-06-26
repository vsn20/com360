import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import DBconnection from '@/app/utils/config/db';
import EditAccount from '@/app/components/Account/Account_Edit';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function EditAccountPage({ params }) {
  const accntId = params.accntId;
  const token = cookies().get('jwt_token')?.value;

  if (!token) {
    return <div>Unauthorized: No token found. Please log in.</div>;
  }

  try {
    jwt.verify(token, JWT_SECRET); // Basic token validation

    const pool = await DBconnection();
    const [rows] = await pool.query(
      'SELECT * FROM C_ACCOUNT WHERE ACCNT_ID = ?',
      [accntId]
    );

    if (rows.length === 0) {
      return <div>Account not found.</div>;
    }

    const accountData = rows[0];

    return <EditAccount accountData={accountData} />;
  } catch (error) {
    console.error('Error loading edit page:', error.message);
    return <div>Error: {error.message}</div>;
  }
}
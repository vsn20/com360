// src/app/(routes)/userscreens/expenses/submission/page.jsx
import ExpenseSubmission from '@/app/components/expenses/ExpenseSubmission';
import { cookies } from 'next/headers';

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

export default async function ExpenseSubmissionPage({ searchParams }) {
  const { error: queryError } = searchParams || {};
  const error = queryError ? decodeURIComponent(queryError) : null;

  let orgid = null;
  let empid = null;

  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Expense Submission</h1>
          <p style={{ color: 'red' }}>Authentication token is missing. Please log in again.</p>
        </div>
      );
    }

    const decoded = decodeJwt(token);
    
    // Validate that both orgid and empid exist in token
    if (!decoded || !decoded.orgid || !decoded.empid) {
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Expense Submission</h1>
          <p style={{ color: 'red' }}>Invalid authentication token. Please log in again.</p>
        </div>
      );
    }

    // Extract both orgid and empid from JWT
    orgid = decoded.orgid;
    empid = decoded.empid;

    console.log('🔍 Logged in user - OrgID:', orgid, 'EmpID:', empid);

  } catch (error) {
    console.error('Error fetching data:', error);
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>Expense Submission</h1>
        <p style={{ color: 'red' }}>An error occurred while loading data: {error.message}</p>
      </div>
    );
  }

  return (
    <ExpenseSubmission
      empid={empid}
      orgid={orgid}
      error={error}
    />
  );
}
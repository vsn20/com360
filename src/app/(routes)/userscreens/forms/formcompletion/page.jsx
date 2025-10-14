// /userscreens/forms/formcompletion/page.js
import I9Forms from '@/app/components/Employee/I9Forms';
import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';
import { getAllroles } from "@/app/serverActions/getAllroles";

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

export default async function FormCompletionPage({ searchParams }) {
  const { error: queryError } = searchParams || {};
  const error = queryError ? decodeURIComponent(queryError) : null;

  let orgid = null;
  let empid = null; // ✅ Changed from hardcoded to null
  let roles = [];
  let countries = [];
  let states = [];
  let timestamp = new Date().getTime();

  try {
    const pool = await DBconnection();

    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Form Completion</h1>
          <p style={{ color: 'red' }}>Authentication token is missing. Please log in again.</p>
        </div>
      );
    }

    const decoded = decodeJwt(token);
    
    // ✅ Validate that both orgid and empid exist in token
    if (!decoded || !decoded.orgid || !decoded.empid) {
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Form Completion</h1>
          <p style={{ color: 'red' }}>Invalid authentication token. Please log in again.</p>
        </div>
      );
    }

    // ✅ Extract both orgid and empid from JWT
    orgid = decoded.orgid;
    empid = decoded.empid;

    console.log('🔍 Logged in user - OrgID:', orgid, 'EmpID:', empid);

    // Fetch countries and states
    [countries] = await pool.query('SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1');
    [states] = await pool.query('SELECT ID, VALUE FROM C_STATE WHERE ACTIVE = 1');

    // Fetch roles
    const { success, roles: fetchedRoles, error: fetchError } = await getAllroles();
    if (!success) {
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Form Completion</h1>
          <p style={{ color: 'red' }}>{fetchError || 'Failed to load roles.'}</p>
        </div>
      );
    }
    roles = fetchedRoles;

  } catch (error) {
    console.error('Error fetching data:', error);
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>Form Completion</h1>
        <p style={{ color: 'red' }}>An error occurred while loading data: {error.message}</p>
      </div>
    );
  }

  return (
    <I9Forms
      roles={roles}
      empid={empid}
      orgid={orgid}
      error={error}
      countries={countries}
      states={states}
      timestamp={timestamp}
    />
  );
}
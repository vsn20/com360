// src/app/(routes)/userscreens/forms/documentverification/page.jsx
import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';
import VerificationContainer from '@/app/components/Employee/VerificationContainer';
// ✅ Import the new W-9 function
import { getPendingI9Approvals, getPendingW9Approvals } from '@/app/serverActions/forms/verification/actions';

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

// Get all subordinates recursively for team data
async function getAllSubordinates(pool, empid, orgid) {
  const subordinates = [];
  
  const getDirectReports = async (managerId) => {
    const [reports] = await pool.query(
      'SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, superior FROM C_EMP WHERE superior = ? AND orgid = ? AND STATUS = "ACTIVE"',
      [managerId, orgid]
    );
    
    for (const report of reports) {
      subordinates.push(report);
      // Recursively get their subordinates
      await getDirectReports(report.empid);
    }
  };
  
  await getDirectReports(empid);
  return subordinates;
}

export default async function DocumentVerificationPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>Document Verification</h1>
        <p style={{ color: 'red' }}>Authentication token is missing. Please log in again.</p>
      </div>
    );
  }

  const decoded = decodeJwt(token);
  
  if (!decoded || !decoded.orgid || !decoded.empid) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>Document Verification</h1>
        <p style={{ color: 'red' }}>Invalid authentication token. Please log in again.</p>
      </div>
    );
  }

  const { orgid, empid } = decoded;

  try {
    const pool = await DBconnection();

    // Check if user is admin
    const [roleRows] = await pool.query(
      'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
      [empid, orgid]
    );
    const roleids = roleRows.map(row => row.roleid);

    let isAdmin = false;
    if (roleids.length > 0) {
      const [adminRows] = await pool.query(
        'SELECT isadmin FROM C_ORG_ROLE_TABLE WHERE roleid IN (?) AND orgid = ?',
        [roleids, orgid]
      );
      isAdmin = adminRows.some(row => row.isadmin === 1);
    }

    // Check data access level (alldata vs teamdata)
    let hasAllData = false;
    let hasTeamData = false;

    if (roleids.length > 0) {
      // Assuming menuid = 15, submenuid = 20 is for 'Document Verification'
      const [permissionRows] = await pool.query(
        'SELECT alldata, teamdata FROM C_ROLE_MENU_PERMISSIONS WHERE roleid IN (?) AND menuid = 15 AND submenuid = 20',
        [roleids]
      );
      
      hasAllData = permissionRows.some(row => row.alldata === 1);
      if (!hasAllData) {
        hasTeamData = permissionRows.every(row => row.teamdata === 1) && permissionRows.length > 0;
      }
    }

    // Get employee list based on permissions
    let employees = [];
    let subordinateIds = [];
    
    if (isAdmin) {
      // Admin ALWAYS has all data - can verify ALL employees INCLUDING self
      const [allEmps] = await pool.query(
        'SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, superior FROM C_EMP WHERE orgid = ? AND STATUS = "ACTIVE" ORDER BY EMP_FST_NAME',
        [orgid]
      );
      employees = allEmps;
      // Set hasAllData to true for admins (override any other setting)
      hasAllData = true;
      hasTeamData = false;
    } else {
      // Non-admin
      if (hasAllData) {
        // Non-admin with all data: show all employees EXCEPT self
        const [allEmps] = await pool.query(
          'SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, superior FROM C_EMP WHERE orgid = ? AND empid != ? AND STATUS = "ACTIVE" ORDER BY EMP_FST_NAME',
          [orgid, empid]
        );
        employees = allEmps;
      } else if (hasTeamData) {
        // Non-admin with team data: show only subordinates (nested)
        employees = await getAllSubordinates(pool, empid, orgid);
        subordinateIds = employees.map(e => e.empid);
      }
    }

    // ✅ FIX: Get pending counts for BOTH I-9 and W-9
    const i9Pending = await getPendingI9Approvals(orgid, empid, isAdmin, hasAllData, subordinateIds);
    const w9Pending = await getPendingW9Approvals(orgid, empid, isAdmin, hasAllData, subordinateIds);
    const totalPendingCount = i9Pending.length + w9Pending.length;


    // Get organization name
    const [orgRows] = await pool.query(
      'SELECT orgname FROM C_ORG WHERE orgid = ?',
      [orgid]
    );
    const orgName = orgRows.length > 0 ? orgRows[0].orgname : 'Organization'; // Fixed: .orgname

    return (
      <VerificationContainer
        employees={employees}
        isAdmin={isAdmin}
        hasAllData={hasAllData}
        hasTeamData={hasTeamData}
        currentEmpId={empid}
        orgId={orgid}
        orgName={orgName}
        pendingCount={totalPendingCount} // ✅ Pass the combined count
      />
    );

  } catch (error) {
    console.error('Error loading verification page:', error);
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>Document Verification</h1>
        <p style={{ color: 'red' }}>An error occurred while loading data: {error.message}</p>
      </div>
    );
  }
}
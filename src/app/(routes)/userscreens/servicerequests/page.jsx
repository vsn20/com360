export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';
import Overview from '@/app/components/Service Requests/Overview';

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

export default async function ServiceRequestsPage() {
  let orgid = null;
  let empid = null;
  let serviceRequests = [];
  let employees = [];
  let type = [];
  let subtype = [];
  let priority = [];
  let accountRows=[];
  let employeename=[];
  let empname;
  let teamdata = 0;
  let individualdata = 0;
  let alldata = 0;
  let directReports = [];

  try {
    const pool = await DBconnection();
    console.log('connection established for userscreens/servicerequests/page.jsx');
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.orgid && decoded.empid) {
        orgid = decoded.orgid;
        empid = decoded.empid;

        [type] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 12 AND orgid = ? AND isactive = 1',
          [orgid]
        );
        [subtype] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 13 AND orgid = ? AND isactive = 1',
          [orgid]
        );
        [priority] = await pool.query(
          'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 11 AND orgid = ? AND isactive = 1',
          [orgid]
        );
        [employees] = await pool.query(
          'SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE orgid = ?',
          [orgid]
        );
        [serviceRequests] = await pool.query(
          'SELECT SR_NUM, SERVICE_NAME, STATUS_CD,PRIORITY_CD FROM C_SRV_REQ WHERE CREATED_BY = ? AND ORG_ID = ?',
          [empid, orgid]
        );
        [accountRows] = await pool.execute(
          'SELECT ACCNT_ID, ALIAS_NAME FROM C_ACCOUNT WHERE ORGID = ? ',
          [orgid]
        );

         [employeename] = await pool.query(
          'SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE orgid = ? and empid=?',
          [orgid,empid]
        );
        empname=`${employeename[0].EMP_FST_NAME} ${employeename[0].EMP_LAST_NAME}`;

        // Fetch permissions for Service Requests (menuid=11)
        const [permissions] = await pool.query(
          'SELECT alldata, teamdata, individualdata FROM C_ROLE_MENU_PERMISSIONS WHERE menuid = 11 AND roleid IN (SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ?)',
          [empid]
        );
        if (permissions && permissions.length > 0) {
          alldata = permissions[0].alldata || 0;
          teamdata = permissions[0].teamdata || 0;
          individualdata = permissions[0].individualdata || 0;
        }

        // Fetch direct reports if team data access is available
        if (teamdata === 1 || alldata === 1) {
          const [reports] = await pool.query(
            'SELECT empid FROM C_EMP WHERE REPORTING_MGR = ? AND orgid = ?',
            [empid, orgid]
          );
          directReports = reports.map(r => r.empid);
        }

      } else {
        throw new Error('Invalid token: orgid or empid missing');
      }
    } else {
      throw new Error('No token provided');
    }
  } catch (error) {
    console.error('Error in service requests userscreens page:', error);
    return <div>Error loading service requests: {error.message}</div>;
  }

  return (
    <Overview
      orgid={orgid}
      empid={empid}
      employees={employees}
      type={type}
      subtype={subtype}
      priority={priority}
      serviceRequests={serviceRequests}
      previousServiceRequests={serviceRequests} // Used for parRowId dropdown
      accountRows={accountRows}
      empname={empname}
      teamdata={teamdata}
      individualdata={individualdata}
      alldata={alldata}
      directReports={directReports}
      />
  );
}
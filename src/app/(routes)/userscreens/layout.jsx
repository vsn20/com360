import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/screenbar';
import SubmenuBar from '../../components/SubmenuBar';
import { cookies } from 'next/headers';
import DBconnection from '../../utils/config/db';
import styles from './userscreens.module.css';

// Function to decode JWT (server-side)
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

export default async function userscreenLayout({ children }) {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  console.log('Server-side JWT token:', token);

  let userData = {
    username: 'Unknown',
    rolename: 'Unknown',
    orgName: 'Unknown',
    logoLetter: 'M',
    orglogo_url: null,
    is_logo_set: 0,
    isAdmin: false,
  };

  if (token) {
    const decoded = decodeJwt(token);
    if (decoded) {
      userData = {
        username: decoded.username || decoded.sub || 'Unknown',
        rolename: decoded.rolename || decoded.role || 'Unknown',
        orgName: decoded.orgname || decoded.orgid || 'Unknown',
        logoLetter: (decoded.username || 'M')[0].toUpperCase(),
        empid: decoded.empid,
        orgid: decoded.orgid,
      };

      // Fetch isAdmin and org details from database
      try {
        const pool = await DBconnection();

        // Fetch isAdmin from database based on employee's roles
        const [roleRows] = await pool.query(
          'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
          [decoded.empid, decoded.orgid]
        );
        const roleids = roleRows.map(row => row.roleid);

        const [employee]=await pool.query(
          'select EMP_FST_NAME,EMP_LAST_NAME from C_EMP where empid=?',[decoded.empid]
        );

         userData.username=`${employee[0].EMP_FST_NAME} ${employee[0].EMP_LAST_NAME}`;
         userData.logoLetter=(userData.username || 'M')[0].toUpperCase();

        if (roleids.length > 0) {
          const [adminRows] = await pool.query(
            'SELECT isadmin FROM C_ORG_ROLE_TABLE WHERE roleid IN (?) AND orgid = ?',
            [roleids, decoded.orgid]
          );
          userData.isAdmin = adminRows.some(row => row.isadmin === 1);
        }

        // Fetch orglogo_url and is_logo_set from C_ORG table
        const [orgRows] = await pool.query(
          'SELECT orglogo_url, is_logo_set FROM C_ORG WHERE orgid = ?',
          [decoded.orgid]
        );

        if (orgRows.length > 0) {
          userData.orglogo_url = orgRows[0].orglogo_url || null;
          userData.is_logo_set = orgRows[0].is_logo_set; // Keep as 1 or 0
        }
      } catch (error) {
        console.error('Error fetching data from database:', error.message);
        userData.isAdmin = false;
        userData.orglogo_url = null;
        userData.is_logo_set = 0;
      }
    }
  }

  //console.log('Decoded user data:', userData);

  return (
    <div>
      <Sidebar isAdmin={userData.isAdmin} />
      <div className={styles.rightContent}>
        <Navbar
          orgName={userData.orgName}
          logoLetter={userData.logoLetter}
          username={userData.username}
          rolename={userData.rolename}
          orglogo_url={userData.orglogo_url}
          is_logo_set={userData.is_logo_set}
        />
        <SubmenuBar />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
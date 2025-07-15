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

  let userData = { username: 'Unknown', rolename: 'Unknown', orgName: 'Unknown', logoLetter: 'M', isAdmin: false };
  if (token) {
    const decoded = decodeJwt(token);
    if (decoded) {
      userData = {
        username: decoded.username || decoded.sub || 'Unknown',
        rolename: decoded.rolename || decoded.role || 'Unknown',
        orgName: decoded.orgname || decoded.orgid || 'Unknown',
        logoLetter: (decoded.username || 'M')[0].toUpperCase(),
        empid: decoded.empid,
      };

      // Fetch isAdmin from database based on employee's roles
      try {
        const pool = await DBconnection();
        const [roleRows] = await pool.query(
          'SELECT roleid FROM emp_role_assign WHERE empid = ? AND orgid = ?',
          [decoded.empid, decoded.orgid]
        );
        const roleids = roleRows.map(row => row.roleid);

        if (roleids.length > 0) {
          const [adminRows] = await pool.query(
            'SELECT isadmin FROM org_role_table WHERE roleid IN (?) AND orgid = ?',
            [roleids, decoded.orgid]
          );
          userData.isAdmin = adminRows.some(row => row.isadmin === 1);
        }
      } catch (error) {
        console.error('Error fetching isadmin from database:', error.message);
        userData.isAdmin = false;
      }
    }
  }

  console.log('Decoded user data:', userData);

  return (
    <div>
      <Sidebar isAdmin={userData.isAdmin} />
      <div className={styles.rightContent}>
        <Navbar
          orgName={userData.orgName}
          logoLetter={userData.logoLetter}
          username={userData.username}
          rolename={userData.rolename}
        />
        <SubmenuBar />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
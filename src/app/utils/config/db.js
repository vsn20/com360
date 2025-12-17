import mysql from 'mysql2/promise';
import { cookies } from 'next/headers';

// Remote MySQL credentials (META DB)
const pools = mysql.createPool({
  host: '132.148.221.65', 
  port: 3306, 
  user:'SAINAMAN',
  password: 'SAInaman$8393',
  database: 'Com360_Meta',
  waitForConnections: true,
  connectionLimit: 5, 
  queueLimit: 0,
});

// Cache for tenant DB pools
const dbPools = new Map();

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

function createpoolusingdatabasename(databasename,privileged_password,privileged_user_access) {
  if (dbPools.has(databasename)) {
    return dbPools.get(databasename);
  }

  const pool = mysql.createPool({
    host: '132.148.221.65',
    port: 3306,
    user: privileged_user_access,
    password: privileged_password,
    database: databasename,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  dbPools.set(databasename, pool);
  return pool;
}

export function MetaDBconnection() {
  return pools;
}

async function DBconnection() {
  let metaConnection;

  try {
    // 🔹 1) Read JWT from cookies (Added await for Next.js 15+ compatibility)
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found in JWT');
      return { error: 'Invalid token or orgid not found.' };
    }

    const username = decoded.username;

    // 🔹 2) Get connection from META pool
    metaConnection = await pools.getConnection();

    // 🔹 3) Get employee row using username (UPDATED COLUMNS)
    // Fixed: organizationid -> org_id, status -> active
    const [rows] = await metaConnection.query(
      `
      SELECT 
          sp.subscriber_database AS databasename,
          sp.privileged_user_access,
          sp.password
      FROM C_EMP e
      JOIN C_SUBSCRIBER s
          ON e.org_id = s.org_id
      JOIN C_SUBSCRIBER_PLAN sp
          ON s.subscriber_id = sp.subscriber_id
      WHERE e.username = ?
        AND e.active = 'Y'
        AND s.active = 'Y'
        AND sp.active = 'Y'
      `,
      [username]
    );

    // Always release META connection
    metaConnection.release();
    metaConnection = null;

    if (rows.length === 0) {
      throw new Error(`No active subscription found for username: ${username}`);
    }

    const dbName = rows[0].databasename;
    const privileged_user_access=rows[0].privileged_user_access;
    const privileged_password=rows[0].password;
    
    // 🔹 5) Get (or create) pool for that database
    const pool = createpoolusingdatabasename(dbName,privileged_password,privileged_user_access);

    return pool;
  } catch (error) {
    if (metaConnection) {
      metaConnection.release();
    }
    console.error('Error connecting to remote MySQL:', error);
    throw new Error('Failed to connect to remote MySQL');
  }
}

export default DBconnection;
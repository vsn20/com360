// app/utils/config/db.js
// ✅ UPDATED WITH HARDCODED RDS CREDENTIALS

import mysql from 'mysql2/promise';
import { cookies } from 'next/headers';

// ---------------------------------------------------------
// RDS CONNECTION CREDENTIALS
// ---------------------------------------------------------
const RDS_CONFIG = {
  host: 'database-1.cvscmsgqsmyw.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'SaiLpgCsg$8393',
};

// ---------------------------------------------------------
// 1. GLOBAL CACHE SETUP (Shared with logindb.js)
// ---------------------------------------------------------
if (!globalThis.dbCache) {
  globalThis.dbCache = {
    users: new Map(), // Maps 'username' -> Creds
    pools: new Map(), // Maps 'dbName' -> Pool
  };
}

const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes
const POOL_CONNECTION_LIMIT = 5;  // Limit connections per Tenant DB

// ---------------------------------------------------------
// 2. META DATABASE CONNECTION
// ✅ USING HARDCODED CREDENTIALS
// ---------------------------------------------------------
const metaPool = mysql.createPool({
  host: RDS_CONFIG.host,
  port: RDS_CONFIG.port,
  user: RDS_CONFIG.user,
  password: RDS_CONFIG.password,
  database: 'Com360_Meta',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  connectTimeout: 10000,
});

export function MetaDBconnection() {
  return metaPool;
}

// ---------------------------------------------------------
// 3. HELPER: GET TENANT POOL (Layer 2 Cache)
// ✅ USING HARDCODED CREDENTIALS
// ---------------------------------------------------------
function getTenantPool(dbName, dbUser, dbPass) {
  if (globalThis.dbCache.pools.has(dbName)) {
    console.log(`[db.js] 🟢 POOL HIT: Reusing active pool for '${dbName}'`);
    return globalThis.dbCache.pools.get(dbName);
  }

  console.log(`[db.js] 🔴 POOL MISS: Creating NEW pool for '${dbName}'`);

  const pool = mysql.createPool({
    host: RDS_CONFIG.host,
    port: RDS_CONFIG.port,
    user: dbUser || RDS_CONFIG.user,
    password: dbPass || RDS_CONFIG.password,
    database: dbName,
    waitForConnections: true,
    connectionLimit: POOL_CONNECTION_LIMIT,
    queueLimit: 0,
    enableKeepAlive: true,
    connectTimeout: 10000,
  });

  globalThis.dbCache.pools.set(dbName, pool);
  return pool;
}

// ---------------------------------------------------------
// 4. HELPER: JWT DECODER
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// 5. MAIN CONNECTION FUNCTION
// ---------------------------------------------------------
async function DBconnection() {
  let metaConnection;

  try {
    // A. Get Token & Username
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) return { error: 'No token found. Please log in.' };

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.username) return { error: 'Invalid token.' };

    const username = decoded.username;
    const now = Date.now();

    // ---------------------------------------------------------
    // B. LAYER 1: CHECK CACHE (User Credentials)
    // ---------------------------------------------------------
    let userCreds = globalThis.dbCache.users.get(username);
    let isCacheValid = userCreds && (now - userCreds.timestamp < CACHE_TTL);

    if (isCacheValid) {
      // 🟢 HIT: Skip Meta DB entirely!
      console.log(`[db.js] 🟢 CRED HIT: Found credentials for '${username}'`);
      return getTenantPool(userCreds.dbName, userCreds.dbUser, userCreds.dbPass);
    }

    console.log(`[db.js] 🔴 CRED MISS: Querying Meta DB for '${username}'...`);

    // ---------------------------------------------------------
    // C. CACHE MISS: QUERY META DB
    // ---------------------------------------------------------
    metaConnection = await metaPool.getConnection();

    const [rows] = await metaConnection.query(
      `SELECT 
          sp.subscriber_database AS databasename,
          sp.privileged_user_access,
          sp.password
       FROM C_EMP e
       JOIN C_SUBSCRIBER s ON e.org_id = s.org_id
       JOIN C_SUBSCRIBER_PLAN sp ON s.subscriber_id = sp.subscriber_id
       WHERE e.username = ?
         AND e.active = 'Y'
         AND s.active = 'Y'
         AND sp.active = 'Y'`,
      [username]
    );

    metaConnection.release();
    metaConnection = null;

    if (rows.length === 0) {
      throw new Error(`No active subscription found for username: ${username}`);
    }

    const { databasename: dbName, privileged_user_access: dbUser, password: dbPass } = rows[0];

    // ---------------------------------------------------------
    // D. UPDATE CACHE
    // ---------------------------------------------------------
    console.log(`[db.js] 💾 SAVING: Caching credentials for '${username}'`);
    
    globalThis.dbCache.users.set(username, {
      dbName,
      dbUser,
      dbPass,
      timestamp: now
    });

    // ---------------------------------------------------------
    // E. RETURN POOL
    // ---------------------------------------------------------
    return getTenantPool(dbName, dbUser, dbPass);

  } catch (error) {
    if (metaConnection) metaConnection.release();
    console.error('[db.js] ❌ Error in DBconnection:', error);
    throw new Error('Database connection failed');
  }
}

export default DBconnection;

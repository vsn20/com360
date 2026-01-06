// app/utils/config/logindb.js
// ✅ HARDCODED FOR AWS RDS (NO ENV, NO CODE LOGIC CHANGE)

import mysql from 'mysql2/promise';

// ---------------------------------------------------------
// 1. GLOBAL CACHE SETUP
// ---------------------------------------------------------
if (!globalThis.dbCache) {
  globalThis.dbCache = {
    users: new Map(),
    pools: new Map(),
  };
}

const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes
const POOL_CONNECTION_LIMIT = 10;

// ---------------------------------------------------------
// 2. RDS MASTER CONFIG (HARDCODED)
// ---------------------------------------------------------
const RDS_CONFIG = {
  host: 'database-1.cvscmsgqsmyw.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'SaiLpgCsg$8393',
};

// ---------------------------------------------------------
// 3. META DATABASE POOL (Com360_Meta)
// ---------------------------------------------------------
export const metaPool = mysql.createPool({
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

// ---------------------------------------------------------
// 4. HELPER: GET TENANT POOL (Layer 2 Cache)
// ---------------------------------------------------------
function getTenantPool(dbName, dbUser, dbPass) {
  if (globalThis.dbCache.pools.has(dbName)) {
    console.log(`[Cache] 🟢 POOL HIT: Reusing pool for '${dbName}'`);
    return globalThis.dbCache.pools.get(dbName);
  }

  console.log(`[Cache] 🔴 POOL MISS: Creating NEW pool for '${dbName}'`);

  const pool = mysql.createPool({
    host: RDS_CONFIG.host,
    port: RDS_CONFIG.port,
    user: dbUser,          // tenant user
    password: dbPass,      // tenant password
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
// 5. MAIN LOGIN DB CONNECTION FUNCTION
// ---------------------------------------------------------
async function loginDBconnection(identifier, lookupType = 'username') {
  let metaConnection;

  try {
    if (!identifier) {
      throw new Error(`${lookupType} is required`);
    }

    const now = Date.now();
    const cacheKey = `${lookupType}:${identifier}`;

    // ---------------------------------------------------------
    // A. CACHE CHECK
    // ---------------------------------------------------------
    const cached = globalThis.dbCache.users.get(cacheKey);
    const isValid = cached && (now - cached.timestamp < CACHE_TTL);

    if (isValid) {
      console.log(`[Cache] 🟢 CREDENTIAL HIT for '${identifier}'`);
      return getTenantPool(cached.dbName, cached.dbUser, cached.dbPass);
    }

    console.log(`[Cache] 🔴 CREDENTIAL MISS: Querying Meta DB for '${identifier}'`);

    // ---------------------------------------------------------
    // B. QUERY META DB
    // ---------------------------------------------------------
    metaConnection = await metaPool.getConnection();

    const baseQuery = `
      SELECT 
        sp.subscriber_database AS databasename,
        sp.privileged_user_access,
        sp.password
      FROM C_EMP e
      JOIN C_SUBSCRIBER s ON e.org_id = s.org_id
      JOIN C_SUBSCRIBER_PLAN sp ON s.subscriber_id = sp.subscriber_id
      WHERE 
        e.active = 'Y'
        AND s.active = 'Y'
        AND sp.active = 'Y'
    `;

    const sql =
      lookupType === 'email'
        ? `${baseQuery} AND e.email = ?`
        : `${baseQuery} AND e.username = ?`;

    const [rows] = await metaConnection.query(sql, [identifier]);

    metaConnection.release();
    metaConnection = null;

    if (rows.length === 0) {
      console.warn(`[DB] ❌ No active subscription for '${identifier}'`);
      return null;
    }

    const {
      databasename: dbName,
      privileged_user_access: dbUser,
      password: dbPass,
    } = rows[0];

    // ---------------------------------------------------------
    // C. SAVE TO CACHE
    // ---------------------------------------------------------
    console.log(`[Cache] 💾 SAVING credentials for '${identifier}'`);

    globalThis.dbCache.users.set(cacheKey, {
      dbName,
      dbUser,
      dbPass,
      timestamp: now,
    });

    // ---------------------------------------------------------
    // D. RETURN TENANT POOL
    // ---------------------------------------------------------
    return getTenantPool(dbName, dbUser, dbPass);

  } catch (error) {
    if (metaConnection) metaConnection.release();
    console.error('[DB] ❌ Error in loginDBconnection:', error);
    throw new Error('Failed to connect to remote MySQL');
  }
}

export default loginDBconnection;

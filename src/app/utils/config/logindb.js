import mysql from 'mysql2/promise';

// ---------------------------------------------------------
// 1. GLOBAL CACHE SETUP
// ---------------------------------------------------------
// We use globalThis to ensure the cache survives hot-reloads in development
if (!globalThis.dbCache) {
  globalThis.dbCache = {
    // Layer 1: User Cache -> Maps 'email' or 'username' to Database Credentials
    users: new Map(),
    // Layer 2: Pool Cache -> Maps 'dbName' to an active Connection Pool
    pools: new Map(),
  };
}

// Settings
const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes
const POOL_CONNECTION_LIMIT = 10; 

// ---------------------------------------------------------
// 2. META DATABASE CONNECTION
// ---------------------------------------------------------
export const metaPool = mysql.createPool({
  host: '132.148.221.65',
  port: 3306,
  user: 'SAINAMAN',
  password: 'SAInaman$8393',
  database: 'Com360_Meta',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
});

// ---------------------------------------------------------
// 3. HELPER: GET TENANT POOL (Layer 2 Cache)
// ---------------------------------------------------------
function getTenantPool(dbName, dbUser, dbPass) {
  // Check if we already have a pool for this specific database
  if (globalThis.dbCache.pools.has(dbName)) {
    console.log(`[Cache] 🟢 POOL HIT: Reusing active connection pool for '${dbName}'`);
    return globalThis.dbCache.pools.get(dbName);
  }

  console.log(`[Cache] 🔴 POOL MISS: Creating NEW connection pool for '${dbName}'`);

  const pool = mysql.createPool({
    host: '132.148.221.65',
    port: 3306,
    user: dbUser,
    password: dbPass,
    database: dbName,
    waitForConnections: true,
    connectionLimit: POOL_CONNECTION_LIMIT,
    queueLimit: 0,
    enableKeepAlive: true,
  });

  // Save to Pool Cache
  globalThis.dbCache.pools.set(dbName, pool);
  return pool;
}

// ---------------------------------------------------------
// 4. MAIN LOGIN CONNECTION FUNCTION
// ---------------------------------------------------------
/**
 * Connect to tenant DB using Username OR Email.
 * @param {string} identifier - The value (e.g., 'john' or 'john@gmail.com')
 * @param {string} lookupType - 'username' or 'email'
 */
async function loginDBconnection(identifier, lookupType = 'username') {
  let metaConnection;

  try {
    if (!identifier) {
      throw new Error(`${lookupType} is required for database connection`);
    }

    const now = Date.now();
    const cacheKey = `${lookupType}:${identifier}`; 

    // ---------------------------------------------------------
    // A. LAYER 1: CHECK CACHE (User Credentials)
    // ---------------------------------------------------------
    let cachedCreds = globalThis.dbCache.users.get(cacheKey);
    let isCacheValid = cachedCreds && (now - cachedCreds.timestamp < CACHE_TTL);

    if (isCacheValid) {
      // 🟢 HIT: We know the DB details from memory. No Meta Query needed.
      console.log(`[Cache] 🟢 CREDENTIAL HIT: Found ${lookupType} '${identifier}' in memory.`);
      return getTenantPool(cachedCreds.dbName, cachedCreds.dbUser, cachedCreds.dbPass);
    }

    // Log why we missed (Expired or First Time)
    if (cachedCreds && !isCacheValid) {
      console.log(`[Cache] ⚠️ CREDENTIAL EXPIRED: Data for '${identifier}' is too old. Refreshing...`);
    } else {
      console.log(`[Cache] 🔴 CREDENTIAL MISS: No data for '${identifier}'. Querying Meta DB...`);
    }

    // ---------------------------------------------------------
    // B. CACHE MISS: QUERY META DB (Only happens once per 10 mins)
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

    // Dynamic query depending on if we are looking up Email or Username
    const query = lookupType === 'email' 
      ? `${baseQuery} AND e.email = ?` 
      : `${baseQuery} AND e.username = ?`;

    const [rows] = await metaConnection.query(query, [identifier]);

    metaConnection.release();
    metaConnection = null;

    if (rows.length === 0) {
      console.warn(`[DB] ❌ No active subscription found in Meta DB for: ${identifier}`);
      return null;
    }

    const { databasename: dbName, privileged_user_access: dbUser, password: dbPass } = rows[0];

    // ---------------------------------------------------------
    // C. UPDATE USER CACHE
    // ---------------------------------------------------------
    console.log(`[Cache] 💾 SAVING: Caching credentials for '${identifier}' (Valid for 10 mins).`);
    
    globalThis.dbCache.users.set(cacheKey, {
      dbName,
      dbUser,
      dbPass,
      timestamp: now
    });

    // ---------------------------------------------------------
    // D. RETURN POOL
    // ---------------------------------------------------------
    return getTenantPool(dbName, dbUser, dbPass);

  } catch (error) {
    if (metaConnection) metaConnection.release();
    console.error('[DB] ❌ Error in loginDBconnection:', error);
    throw new Error('Failed to connect to remote MySQL');
  }
}

export default loginDBconnection;
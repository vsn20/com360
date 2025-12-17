import mysql from 'mysql2/promise';

// Remote MySQL credentials (META DB)
const pools = mysql.createPool({
  host: '132.148.221.65',
  port: 3306,
  user: 'SAINAMAN',
  password: 'SAInaman$8393',
  database: 'Com360_Meta',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Cache for per-database pools
const dbPools = new Map();

function createpoolusingdatabasename(databasename,privileged_user_access,privilegedPassword) {
  if (dbPools.has(databasename)) {
    return dbPools.get(databasename);
  }

  const pool = mysql.createPool({
    host: '132.148.221.65',
    port: 3306,
    user: privileged_user_access,
    password: privilegedPassword,
    database: databasename,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  dbPools.set(databasename, pool);
  return pool;
}

/**
 * Connect to tenant DB.
 * @param {string} identifier - The Username or Email.
 * @param {string} lookupType - 'username' (default) or 'email'.
 */
async function loginDBconnection(identifier, lookupType = 'username') {
  let connection;

  try {
    if (!identifier) {
      throw new Error(`${lookupType} is required for database connection`);
    }

    // 1️⃣ Get connection from META DB pool
    connection = await pools.getConnection();

    let query = '';
    
    // 🔹 FIXED SCHEMA COLUMNS (org_id, active)
    const baseQuery = `
      SELECT 
          sp.subscriber_database AS databasename,
          sp.privileged_user_access,
          sp.password
      FROM C_EMP e
      JOIN C_SUBSCRIBER s
          ON e.org_id = s.org_id 
      JOIN C_SUBSCRIBER_PLAN sp
          ON s.subscriber_id = sp.subscriber_id
      WHERE 
          e.active = 'Y'
          AND s.active = 'Y'
          AND sp.active = 'Y'
    `;

    // 🔹 LOGIC SWITCH: Handle both Username and Email lookups
    if (lookupType === 'email') {
       query = `${baseQuery} AND e.email = ?`;
    } else {
       query = `${baseQuery} AND e.username = ?`;
    }

    // 2️⃣ Execute the selected query
    const [rows] = await connection.query(query, [identifier]);

    // 3️⃣ Release META connection ASAP
    connection.release();
    connection = null;

    // 4️⃣ Check if employee exists
    if (rows.length === 0) {
      console.warn(`No employee found for ${lookupType}: ${identifier}`);
      return null; 
    }

    const dbName = rows[0].databasename;
    const privilegedUser = rows[0].privileged_user_access;
    const privilegedPassword = rows[0].password;
    
    // 5️⃣ Get (or create) pool for that specific database
    const pool = createpoolusingdatabasename(dbName, privilegedUser, privilegedPassword);

    return pool;

  } catch (error) {
    if (connection) {
      connection.release();
    }
    console.error('Error connecting to remote MySQL:', error);
    throw new Error('Failed to connect to remote MySQL');
  }
}

// 🔹 EXPORT META POOL (Crucial for SignupAction to check C_EMP directly)
export const metaPool = pools;

export default loginDBconnection;
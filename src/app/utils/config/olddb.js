// app/utils/config/olddb.js
// ✅ HARDCODED FOR AWS RDS (NO ENV DEPENDENCY)

import mysql from 'mysql2/promise';

// ---------------------------------------------------------
// RDS MASTER CONFIG (HARDCODED)
// ---------------------------------------------------------
const RDS_CONFIG = {
  host: 'database-1.cvscmsgqsmyw.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'SaiLpgCsg$8393',
};

// ---------------------------------------------------------
// LEGACY DATABASE POOL (com360)
// ---------------------------------------------------------
const pool = mysql.createPool({
  host: RDS_CONFIG.host,
  port: RDS_CONFIG.port,
  user: RDS_CONFIG.user,
  password: RDS_CONFIG.password,
  database: 'com360',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

async function DBconnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL connected successfully to RDS (legacy com360)');
    connection.release();
    return pool;
  } catch (error) {
    console.error('❌ Error connecting to RDS MySQL:', error.message);
    throw new Error('Failed to connect to remote MySQL');
  }
}

export default DBconnection;

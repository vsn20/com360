// src/app/utils/config/com360db.js
import mysql from 'mysql2/promise';

// Existing: Hardcoded connection to 'com360'
export function getTenantConnection() {
  return mysql.createPool({
    host: '132.148.221.65',
    port: 3306,
    user: 'SAINAMAN',
    password: 'SAInaman$8393',
    database: 'com360',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
}

// NEW: Dynamic connection for any database name
export function getDynamicTenantConnection(dbName) {
  return mysql.createPool({
    host: '132.148.221.65',
    port: 3306,
    user: 'SAINAMAN',
    password: 'SAInaman$8393',
    database: dbName,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
}

// app/utils/config/com360db.js
// ✅ HARDCODED FOR AWS RDS (NO ENV DEPENDENCY)

// import mysql from 'mysql2/promise';

// // ---------------------------------------------------------
// // RDS MASTER CONFIG (HARDCODED)
// // ---------------------------------------------------------
// const RDS_CONFIG = {
//   host: 'database-1.cvscmsgqsmyw.us-east-1.rds.amazonaws.com',
//   port: 3306,
//   user: 'admin',
//   password: 'SaiLpgCsg$8393',
// };

// // ---------------------------------------------------------
// // 1. CONNECTION TO LEGACY `com360` DATABASE
// // ---------------------------------------------------------
// export function getTenantConnection() {
//   return mysql.createPool({
//     host: RDS_CONFIG.host,
//     port: RDS_CONFIG.port,
//     user: RDS_CONFIG.user,
//     password: RDS_CONFIG.password,
//     database: 'com360',
//     waitForConnections: true,
//     connectionLimit: 5,
//     queueLimit: 0,
//     enableKeepAlive: true,
//     connectTimeout: 10000,
//   });
// }

// // ---------------------------------------------------------
// // 2. DYNAMIC CONNECTION FOR ANY DATABASE
// // ---------------------------------------------------------
// export function getDynamicTenantConnection(dbName) {
//   return mysql.createPool({
//     host: RDS_CONFIG.host,
//     port: RDS_CONFIG.port,
//     user: RDS_CONFIG.user,
//     password: RDS_CONFIG.password,
//     database: dbName,
//     waitForConnections: true,
//     connectionLimit: 5,
//     queueLimit: 0,
//     enableKeepAlive: true,
//     connectTimeout: 10000,
//   });
// }
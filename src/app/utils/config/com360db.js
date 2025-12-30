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
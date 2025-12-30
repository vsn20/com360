import axios from 'axios';
import https from 'https';

// Load config from .env
const CPANEL_CONFIG = {
  host: process.env.CPANEL_HOST,      
  username: process.env.CPANEL_USER,  
  apiToken: process.env.CPANEL_TOKEN  
};

const client = axios.create({
  baseURL: `${CPANEL_CONFIG.host}/execute/`,
  timeout: 60000, 
  headers: {
    'Authorization': `cpanel ${CPANEL_CONFIG.username}:${CPANEL_CONFIG.apiToken}`
  },
  httpsAgent: new https.Agent({ rejectUnauthorized: false, keepAlive: false })
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Create DB and User
export async function createTenantDatabase(dbName, dbUser, dbPass) {
  try {
    console.log(`🚀 [cPanel] Creating Database: ${dbName}...`);
    await client.get('Mysql/create_database', { params: { name: dbName } });
    await delay(1000);

    console.log(`👤 [cPanel] Creating User: ${dbUser}...`);
    await client.get('Mysql/create_user', { params: { name: dbUser, password: dbPass } });
    await delay(1000);

    console.log(`🔗 [cPanel] Linking User to DB...`);
    await client.get('Mysql/set_privileges_on_database', {
      params: { user: dbUser, database: dbName, privileges: 'ALL PRIVILEGES' }
    });

    return { success: true };
  } catch (error) {
    const errorMsg = error.response?.data?.errors?.[0] || error.message;
    console.error('❌ cPanel API Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

// 2. Grant Admin Access (For Setup Operations)
export async function addPrivilegedUserToDatabase(dbName, adminUser) {
  try {
    console.log(`🔐 [cPanel] Granting Admin Access (${adminUser})...`);
    await client.get('Mysql/set_privileges_on_database', {
        params: { user: adminUser, database: dbName, privileges: 'ALL PRIVILEGES' }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 3. Allow Remote Access (CRITICAL FIX for New User)
export async function allowRemoteAccess(host) {
  try {
    console.log(`🌍 [cPanel] Whitelisting Remote Host: ${host}...`);
    // This adds the wildcard to "Remote MySQL" in cPanel, allowing the new user to connect remotely
    await client.get('Mysql/add_host', { params: { host: host } });
    return { success: true };
  } catch (error) {
    console.error('❌ Remote Access Error:', error.message);
    // Usually harmless if already added
    return { success: true }; 
  }
}



// app/utils/config/rdsApi.js
// ✅ AWS RDS DATABASE CREATION API (HARDCODED, NO ENV)

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

// /**
//  * Create a new tenant database on AWS RDS
//  * (Replacement for cpanelApi.js)
//  */
// export async function createTenantDatabase(dbName, dbUser, dbPass) {
//   let connection;

//   try {
//     console.log(`🚀 [RDS] Creating Database: ${dbName}...`);

//     connection = await mysql.createConnection({
//       host: RDS_CONFIG.host,
//       port: RDS_CONFIG.port,
//       user: RDS_CONFIG.user,
//       password: RDS_CONFIG.password,
//     });

//     // 1. Create database
//     await connection.query(
//       `CREATE DATABASE IF NOT EXISTS \`${dbName}\` 
//        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
//     );
//     console.log(`✅ [RDS] Database created: ${dbName}`);

//     // 2. Create tenant user (if provided)
//     if (dbUser && dbUser !== RDS_CONFIG.user) {
//       try {
//         await connection.query(
//           `CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPass}'`
//         );
//         console.log(`✅ [RDS] User created: ${dbUser}`);
//       } catch {
//         console.log(`⚠️  [RDS] User ${dbUser} already exists`);
//       }

//       // 3. Grant privileges
//       await connection.query(
//         `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'%'`
//       );
//       await connection.query(`FLUSH PRIVILEGES`);
//       console.log(`✅ [RDS] Privileges granted to ${dbUser}`);
//     }

//     await connection.end();
//     return { success: true };

//   } catch (error) {
//     console.error('❌ [RDS] Error:', error.message);
//     if (connection) await connection.end();
//     return { success: false, error: error.message };
//   }
// }

// /**
//  * Grant database access to a privileged user
//  */
// export async function addPrivilegedUserToDatabase(dbName, adminUser) {
//   let connection;

//   try {
//     console.log(`🔓 [RDS] Granting access to ${adminUser} on ${dbName}`);

//     connection = await mysql.createConnection({
//       host: RDS_CONFIG.host,
//       port: RDS_CONFIG.port,
//       user: RDS_CONFIG.user,
//       password: RDS_CONFIG.password,
//     });

//     await connection.query(
//       `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${adminUser}'@'%'`
//     );
//     await connection.query(`FLUSH PRIVILEGES`);

//     await connection.end();
//     return { success: true };

//   } catch (error) {
//     if (connection) await connection.end();
//     return { success: false, error: error.message };
//   }
// }

// /**
//  * Remote access handler (noop for RDS)
//  */
// export async function allowRemoteAccess(host) {
//   console.log(`ℹ️  [RDS] Remote access handled by AWS Security Groups`);
//   console.log(`ℹ️  Ensure ${host} is allowed in RDS SG`);
//   return { success: true };
// }

// /**
//  * Clone schema from template database
//  */
// export async function cloneDatabaseSchema(sourceDB, targetDB) {
//   let connection;

//   try {
//     console.log(`📦 [RDS] Cloning schema from ${sourceDB} → ${targetDB}`);

//     connection = await mysql.createConnection({
//       host: RDS_CONFIG.host,
//       port: RDS_CONFIG.port,
//       user: RDS_CONFIG.user,
//       password: RDS_CONFIG.password,
//       database: sourceDB,
//     });

//     await connection.query(`SET SESSION innodb_strict_mode=0`);

//     const [tables] = await connection.query('SHOW TABLES');
//     const tableNames = tables.map(t => Object.values(t)[0]);

//     for (const table of tableNames) {
//       try {
//         await connection.query(
//           `CREATE TABLE IF NOT EXISTS \`${targetDB}\`.\`${table}\` 
//            LIKE \`${sourceDB}\`.\`${table}\``
//         );
//         console.log(`  ✅ Cloned: ${table}`);
//       } catch (err) {
//         if (err.code === 'ER_TOO_BIG_ROWSIZE' || err.errno === 1118) {
//           const [createInfo] = await connection.query(
//             `SHOW CREATE TABLE \`${sourceDB}\`.\`${table}\``
//           );

//           let createSQL = Object.values(createInfo[0])[1];
//           createSQL = createSQL.replace(
//             `\`${table}\``,
//             `\`${targetDB}\`.\`${table}\``
//           );

//           if (createSQL.includes('ROW_FORMAT=')) {
//             createSQL = createSQL.replace(/ROW_FORMAT=\w+/i, 'ROW_FORMAT=DYNAMIC');
//           } else {
//             createSQL += ' ROW_FORMAT=DYNAMIC';
//           }

//           await connection.query(createSQL);
//           console.log(`  ✅ Cloned with ROW_FORMAT=DYNAMIC: ${table}`);
//         } else {
//           throw err;
//         }
//       }
//     }

//     // Copy constant tables
//     const constantTables = [
//       'C_MENU',
//       'C_SUBMENU',
//       'C_COUNTRY',
//       'C_STATE',
//       'C_GENERIC_NAMES',
//     ];

//     for (const table of constantTables) {
//       if (tableNames.includes(table)) {
//         await connection.query(
//           `INSERT INTO \`${targetDB}\`.\`${table}\`
//            SELECT * FROM \`${sourceDB}\`.\`${table}\``
//         );
//         console.log(`  📄 Copied data: ${table}`);
//       }
//     }

//     await connection.end();
//     console.log(`✅ [RDS] Schema clone complete`);
//     return { success: true };

//   } catch (error) {
//     console.error('❌ [RDS] Clone error:', error.message);
//     if (connection) await connection.end();
//     return { success: false, error: error.message };
//   }
// }

// /**
//  * Full workflow: create DB + clone schema
//  */
// export async function createAndSetupTenantDatabase(
//   orgId,
//   templateDB = 'Common_Basic'
// ) {
//   try {
//     const safeOrgId = orgId.toString().replace(/[^a-zA-Z0-9_]/g, '');
//     const dbName = `Pro_Org_${safeOrgId}`;

//     console.log(`🎯 [RDS] Setting up DB for Org ${orgId}`);

//     const created = await createTenantDatabase(dbName);
//     if (!created.success) throw new Error(created.error);

//     const cloned = await cloneDatabaseSchema(templateDB, dbName);
//     if (!cloned.success) throw new Error(cloned.error);

//     return {
//       success: true,
//       database: dbName,
//       message: 'Database created and schema cloned',
//     };

//   } catch (error) {
//     console.error('❌ [RDS] Setup failed:', error.message);
//     return { success: false, error: error.message };
//   }
// }

// // ---------------------------------------------------------
// // BACKWARD COMPATIBILITY EXPORT
// // ---------------------------------------------------------
// export default {
//   createTenantDatabase,
//   addPrivilegedUserToDatabase,
//   allowRemoteAccess,
//   cloneDatabaseSchema,
//   createAndSetupTenantDatabase,
// };
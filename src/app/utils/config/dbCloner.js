import mysql from 'mysql2/promise';

// Helper to get a connection for a specific DB
async function getDBConnection(database) {
  return await mysql.createConnection({
    host: '132.148.221.65',
    user: 'SAINAMAN',         // Use privileged user to perform cloning
    password: 'SAInaman$8393',
    database: database
  });
}

export async function cloneDatabaseSchema(sourceDB, targetDB) {
  let connection;
  try {
    console.log(`📦 Cloning tables from ${sourceDB} to ${targetDB}...`);
    
    // Connect to the SOURCE database
    connection = await getDBConnection(sourceDB);
    
    // 🔴 CRITICAL FIX: Disable strict mode for this session.
    // This allows creating tables with many columns that would otherwise fail the row size check.
    await connection.query("SET SESSION innodb_strict_mode=0");
    console.log("🔓 Disabled innodb_strict_mode for cloning session.");
    
    // 1. Get List of Tables
    const [tables] = await connection.query('SHOW TABLES');
    const allTables = tables.map(row => Object.values(row)[0]);

    if (allTables.length === 0) {
      throw new Error(`Source database ${sourceDB} is empty.`);
    }

    // 2. REORDER TABLES
    // Create "Parent" tables first, then "Child" tables to avoid Foreign Key errors.
    const firstTables = [
        'C_COUNTRY', 
        'C_STATE', 
        'C_ORG', 
        'C_ORG_ROLE_TABLE', 
        'C_GENERIC_NAMES', 
        'C_MENU', 
        'C_SUBMENU'
    ];
    
    const lastTables = [
        'C_EMP', 
        'C_USER', 
        'C_EMP_ROLE_ASSIGN', 
        'C_ROLE_MENU_PERMISSIONS',
        'C_ORG_MENU_PRIORITY'
    ];

    const sortedTables = [
        ...allTables.filter(t => firstTables.includes(t)),       // 1. Priority
        ...allTables.filter(t => !firstTables.includes(t) && !lastTables.includes(t)), // 2. Others
        ...allTables.filter(t => lastTables.includes(t))         // 3. Delayed (C_EMP is here)
    ];

    console.log("📝 Table Creation Order:", sortedTables.join(', '));

    // 3. Clone Structure & Specific Data
    for (const table of sortedTables) {
      try {
        // Try standard create
        await connection.query(`CREATE TABLE ${targetDB}.${table} LIKE ${sourceDB}.${table}`);
      } catch (err) {
        // If "Row size too large" error occurs, try forcing ROW_FORMAT=DYNAMIC
        if (err.code === 'ER_TOO_BIG_ROWSIZE' || err.errno === 1118) {
             console.log(`⚠️  Table ${table} hit row size limit. Retrying with ROW_FORMAT=DYNAMIC...`);
             
             const [showCreate] = await connection.query(`SHOW CREATE TABLE ${sourceDB}.${table}`);
             let createStmt = Object.values(showCreate[0])[1];
             
             // Adjust for new DB and force DYNAMIC format
             createStmt = createStmt.replace(`\`${table}\``, `\`${targetDB}\`.\`${table}\``);
             
             if (createStmt.includes('ROW_FORMAT=')) {
                createStmt = createStmt.replace(/ROW_FORMAT=\w+/i, 'ROW_FORMAT=DYNAMIC');
             } else {
                createStmt += ' ROW_FORMAT=DYNAMIC';
             }

             await connection.query(createStmt);
        } else {
            console.error(`❌ Failed to create table ${table}: ${err.message}`);
            throw err; 
        }
      }
      
      // B. Copy Data for CONSTANT tables only
      const configTables = ['C_MENU', 'C_SUBMENU', 'C_COUNTRY', 'C_STATE', 'C_GENERIC_NAMES']; 
      
      if (configTables.includes(table)) {
         await connection.query(`INSERT INTO ${targetDB}.${table} SELECT * FROM ${sourceDB}.${table}`);
         console.log(`   -> Copied Data: ${table}`);
      } else {
         console.log(`   -> Copied Schema: ${table}`);
      }
    }

    console.log(`✅ Cloning Complete.`);
    return { success: true };

  } catch (error) {
    console.error("❌ Cloning Error:", error);
    return { success: false, error: error.message };
  } finally {
    if (connection) await connection.end();
  }
}




// app/utils/config/dbCloner.js
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

// /**
//  * Helper to get a connection for a specific DB
//  */
// async function getDBConnection(database) {
//   return await mysql.createConnection({
//     host: RDS_CONFIG.host,
//     port: RDS_CONFIG.port,
//     user: RDS_CONFIG.user,
//     password: RDS_CONFIG.password,
//     database: database,
//     connectTimeout: 10000,
//   });
// }

// /**
//  * Clone database schema from source to target database
//  * (LOGIC UNCHANGED)
//  */
// export async function cloneDatabaseSchema(sourceDB, targetDB) {
//   let connection;

//   try {
//     console.log(`📦 Cloning tables from ${sourceDB} → ${targetDB}`);

//     // Connect to SOURCE database
//     connection = await getDBConnection(sourceDB);

//     // 🔴 IMPORTANT: Disable strict mode for this session
//     await connection.query('SET SESSION innodb_strict_mode=0');
//     console.log('🔓 innodb_strict_mode disabled');

//     // 1. Fetch tables
//     const [tables] = await connection.query('SHOW TABLES');
//     const allTables = tables.map(row => Object.values(row)[0]);

//     if (allTables.length === 0) {
//       throw new Error(`Source database ${sourceDB} has no tables`);
//     }

//     // 2. Table ordering
//     const firstTables = [
//       'C_COUNTRY',
//       'C_STATE',
//       'C_ORG',
//       'C_ORG_ROLE_TABLE',
//       'C_GENERIC_NAMES',
//       'C_MENU',
//       'C_SUBMENU',
//     ];

//     const lastTables = [
//       'C_EMP',
//       'C_USER',
//       'C_EMP_ROLE_ASSIGN',
//       'C_ROLE_MENU_PERMISSIONS',
//       'C_ORG_MENU_PRIORITY',
//     ];

//     const sortedTables = [
//       ...allTables.filter(t => firstTables.includes(t)),
//       ...allTables.filter(t => !firstTables.includes(t) && !lastTables.includes(t)),
//       ...allTables.filter(t => lastTables.includes(t)),
//     ];

//     console.log('📋 Table order:', sortedTables.join(', '));

//     // 3. Clone tables
//     for (const table of sortedTables) {
//       try {
//         await connection.query(
//           `CREATE TABLE \`${targetDB}\`.\`${table}\` 
//            LIKE \`${sourceDB}\`.\`${table}\``
//         );
//       } catch (err) {
//         // Handle row size issues
//         if (err.code === 'ER_TOO_BIG_ROWSIZE' || err.errno === 1118) {
//           console.log(`⚠️  ${table}: retrying with ROW_FORMAT=DYNAMIC`);

//           const [showCreate] = await connection.query(
//             `SHOW CREATE TABLE \`${sourceDB}\`.\`${table}\``
//           );

//           let createSQL = Object.values(showCreate[0])[1];
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
//         } else {
//           console.error(`❌ Failed creating table ${table}: ${err.message}`);
//           throw err;
//         }
//       }

//       // 4. Copy data for constant tables only
//       const configTables = [
//         'C_MENU',
//         'C_SUBMENU',
//         'C_COUNTRY',
//         'C_STATE',
//         'C_GENERIC_NAMES',
//       ];

//       if (configTables.includes(table)) {
//         await connection.query(
//           `INSERT INTO \`${targetDB}\`.\`${table}\`
//            SELECT * FROM \`${sourceDB}\`.\`${table}\``
//         );
//         console.log(`   📄 Copied data: ${table}`);
//       } else {
//         console.log(`   🧱 Schema cloned: ${table}`);
//       }
//     }

//     console.log('✅ Database cloning completed');
//     return { success: true };

//   } catch (error) {
//     console.error('❌ Cloning error:', error.message);
//     return { success: false, error: error.message };
//   } finally {
//     if (connection) await connection.end();
//   }
// }
// test-db-connection.js
// Standalone script to test database connection with HARDCODED credentials
// Run with: node test-db-connection.js

const mysql = require('mysql2/promise');

// ---------------------------------------------------------
// RDS CONNECTION CREDENTIALS (HARDCODED - TEMP ONLY)
// ---------------------------------------------------------
const RDS_CONFIG = {
  host: 'database-1.cvscmsgqsmyw.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'SaiLpgCsg$8393',
  database: 'Com360_Meta'
};

// ---------------------------------------------------------
// SIMPLE COLOR LOGGER
// ---------------------------------------------------------
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

// ---------------------------------------------------------
// MAIN TEST FUNCTION
// ---------------------------------------------------------
async function testDatabaseConnection() {
  section('🔍 DATABASE CONNECTION TEST');

  // 1️⃣ Show configuration
  section('1️⃣  Connection Configuration');
  log(`Host     : ${RDS_CONFIG.host}`, 'green');
  log(`Port     : ${RDS_CONFIG.port}`, 'green');
  log(`User     : ${RDS_CONFIG.user}`, 'green');
  log(`Password : ${'*'.repeat(RDS_CONFIG.password.length)} (hidden)`, 'green');
  log(`Database : ${RDS_CONFIG.database}`, 'green');

  let connection;

  // 2️⃣ Connect to DB
  section('2️⃣  Database Connection Test');
  try {
    log('Connecting to RDS...', 'yellow');

    connection = await mysql.createConnection({
      host: RDS_CONFIG.host,
      port: RDS_CONFIG.port,
      user: RDS_CONFIG.user,
      password: RDS_CONFIG.password,
      database: RDS_CONFIG.database,
      connectTimeout: 10000
    });

    log('✅ Successfully connected to RDS!', 'green');
  } catch (err) {
    log('❌ Connection failed', 'red');
    log(err.message, 'red');
    process.exit(1);
  }

  // 3️⃣ Basic queries
  section('3️⃣  Basic Query Test');
  try {
    await connection.execute('SELECT 1');
    log('✅ SELECT 1 works', 'green');

    const [v] = await connection.execute('SELECT VERSION() AS v');
    log(`✅ MySQL Version : ${v[0].v}`, 'green');

    const [db] = await connection.execute('SELECT DATABASE() AS db');
    log(`✅ Current DB    : ${db[0].db}`, 'green');

    const [u] = await connection.execute(
      'SELECT CURRENT_USER() AS current_user, @@hostname AS host'
    );
    log(`✅ Current User  : ${u[0].current_user}`, 'green');
    log(`✅ Hostname      : ${u[0].host}`, 'green');
  } catch (err) {
    log('❌ Basic query failed', 'red');
    log(err.message, 'red');
    await connection.end();
    process.exit(1);
  }

  // 4️⃣ List tables
  section('4️⃣  Tables in Com360_Meta');
  try {
    const [tables] = await connection.execute('SHOW TABLES');
    tables.forEach((t, i) => {
      log(`${i + 1}. ${Object.values(t)[0]}`, 'blue');
    });
  } catch (err) {
    log('❌ Failed to list tables', 'red');
    log(err.message, 'red');
  }

  // 5️⃣ Check important tables
  section('5️⃣  Important Table Counts');
  const tablesToCheck = ['C_EMP', 'C_ORG', 'C_SUBSCRIBER', 'C_SUBSCRIBER_PLAN'];

  for (const table of tablesToCheck) {
    try {
      const [rows] = await connection.execute(
        `SELECT COUNT(*) AS count FROM ${table}`
      );
      log(`✅ ${table}: ${rows[0].count} rows`, 'green');
    } catch {
      log(`❌ ${table}: not found or error`, 'red');
    }
  }

  // 6️⃣ Login query test
  section('6️⃣  Login Query Test (user: siva)');
  try {
    const identifier = 'siva';

    const [rows] = await connection.execute(
      `SELECT 
          e.username,
          e.email,
          e.active AS emp_active,
          s.subscriber_name,
          s.active AS subscriber_active,
          sp.subscriber_database,
          sp.privileged_user_access,
          sp.active AS plan_active
       FROM C_EMP e
       JOIN C_SUBSCRIBER s ON e.org_id = s.org_id
       JOIN C_SUBSCRIBER_PLAN sp ON s.subscriber_id = sp.subscriber_id
       WHERE (e.username = ? OR e.email = ?)
         AND e.active = 'Y'
         AND s.active = 'Y'
         AND sp.active = 'Y'`,
      [identifier, identifier]
    );

    if (rows.length === 0) {
      log(`⚠️  User '${identifier}' NOT found / inactive`, 'yellow');
    } else {
      const u = rows[0];
      log(`✅ User '${identifier}' FOUND`, 'green');
      log(`   Tenant DB : ${u.subscriber_database}`, 'blue');
      log(`   DB User   : ${u.privileged_user_access}`, 'blue');
    }
  } catch (err) {
    log('❌ Login query failed', 'red');
    log(err.message, 'red');
  }

  // Close connection
  await connection.end();
  log('\n✅ Connection closed', 'green');

  section('✅ TEST COMPLETE');
  log('Database connection & queries are working!', 'green');
}

// Run
testDatabaseConnection().catch(err => {
  console.error(err);
  process.exit(1);
});

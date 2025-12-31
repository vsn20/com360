// app/utils/config/jobsdb.js
// ✅ OPTIMIZED FOR GODADDY (Prevent max_user_connections error)

import mysql from 'mysql2/promise';

// ---------------------------------------------------------
// GODADDY CONFIGURATION
// ---------------------------------------------------------
const DB_CONFIG = {
  host: '132.148.221.65',
  port: 3306,
  user: 'SAINAMAN',
  password: 'SAInaman$8393',
};

// ---------------------------------------------------------
// META DATABASE CONNECTION
// ---------------------------------------------------------
const metaPool = mysql.createPool({
  host: DB_CONFIG.host,
  port: DB_CONFIG.port,
  user: DB_CONFIG.user,
  password: DB_CONFIG.password,
  database: 'Com360_Meta',
  waitForConnections: true,
  connectionLimit: 5, // Keep low for shared hosting
  queueLimit: 0,
});

// Cache for LONG-LIVED tenant DB pools (Only for active user sessions)
const tenantPools = new Map();

// Cache for aggregated jobs data
let jobsCache = {
  jobs: [],
  orgs: [],
  lastUpdated: null,
  isRefreshing: false
};

// Cache refresh interval: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// Auto refresh
setInterval(() => {
  refreshJobsCache().catch((err) => {
    console.error('Automatic jobs cache refresh failed:', err);
  });
}, CACHE_TTL);

// ---------------------------------------------------------
// GET / CREATE TENANT POOL
// ---------------------------------------------------------
/**
 * @param {string} databaseName 
 * @param {string} username 
 * @param {string} password 
 * @param {boolean} useCache - If false, creates a temporary pool that MUST be closed manually
 */
function getTenantPool(databaseName, username, password, useCache = true) {
  // 1. If caching is enabled, check if we already have an open pool
  if (useCache && tenantPools.has(databaseName)) {
    return tenantPools.get(databaseName);
  }

  // 2. Create new pool
  // OPTIMIZATION: Very low limit (2) because GoDaddy shared hosting has strict limits
  const pool = mysql.createPool({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: username || DB_CONFIG.user,
    password: password || DB_CONFIG.password,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: 2, 
    queueLimit: 0,
  });

  // 3. Store in cache ONLY if requested (for recurring operations like applying)
  if (useCache) {
    tenantPools.set(databaseName, pool);
  }

  return pool;
}

// ---------------------------------------------------------
// FETCH ALL ACTIVE SUBSCRIBER DATABASES
// ---------------------------------------------------------
async function getAllSubscriberDatabases() {
  try {
    const [rows] = await metaPool.execute(`
      SELECT DISTINCT
        sp.subscriber_database AS databasename,
        sp.privileged_user_access AS username,
        sp.password,
        s.org_id
      FROM C_SUBSCRIBER s
      JOIN C_SUBSCRIBER_PLAN sp ON s.subscriber_id = sp.subscriber_id
      WHERE s.active = 'Y' AND sp.active = 'Y'
      GROUP BY sp.subscriber_database
    `);
    return rows;
  } catch (error) {
    console.error('Error fetching subscriber databases:', error.message);
    return [];
  }
}

// ---------------------------------------------------------
// FETCH JOBS FROM ONE DATABASE
// ---------------------------------------------------------
async function fetchJobsFromDatabase(pool, databaseName) {
  try {
    const [tables] = await pool.query(`
      SELECT TABLE_NAME FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('C_EXTERNAL_JOBS', 'C_ORG')
    `, [databaseName]);
    
    const tableNames = tables.map(t => t.TABLE_NAME);
    if (!tableNames.includes('C_EXTERNAL_JOBS') || !tableNames.includes('C_ORG')) {
      return { jobs: [], orgs: [] };
    }

    const [orgs] = await pool.query('SELECT orgid, orgname FROM C_ORG');
    const [jobs] = await pool.query(`
      SELECT 
        ej.jobid, ej.orgid, ej.lastdate_for_application, ej.active,
        ej.display_job_name, ej.job_type AS job_type_id, ej.description,
        ej.countryid, ej.stateid, ej.custom_state_name,
        o.orgname, c.value AS country_value, s.value AS state_value,
        g.Name AS job_type
      FROM C_EXTERNAL_JOBS ej
      JOIN C_ORG o ON ej.orgid = o.orgid
      LEFT JOIN C_COUNTRY c ON ej.countryid = c.ID
      LEFT JOIN C_STATE s ON ej.stateid = s.ID
      LEFT JOIN C_GENERIC_VALUES g ON ej.job_type = g.id
      WHERE ej.active = 1
    `);

    return {
      jobs: jobs.map(j => ({ ...j, _databaseName: databaseName })),
      orgs: orgs.map(o => ({ ...o, _databaseName: databaseName })),
    };
  } catch (error) {
    console.error(`Error fetching jobs from ${databaseName}:`, error.message);
    return { jobs: [], orgs: [] };
  }
}

// ---------------------------------------------------------
// REFRESH JOB CACHE (OPTIMIZED)
// ---------------------------------------------------------
async function refreshJobsCache() {
  if (jobsCache.isRefreshing) return jobsCache;

  jobsCache.isRefreshing = true;
  console.log('Refreshing jobs cache...');

  try {
    const databases = await getAllSubscriberDatabases();
    const allJobs = [];
    const allOrgs = [];
    const jobSet = new Set();
    const orgSet = new Set();

    // OPTIMIZATION: Process in batches of 3 (Lower than AWS due to shared hosting limits)
    const batchSize = 3;
    for (let i = 0; i < databases.length; i += batchSize) {
      const batch = databases.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (db) => {
          // KEY CHANGE: useCache = false. Open, Fetch, Close.
          const pool = getTenantPool(db.databasename, db.username, db.password, false);
          try {
            return await fetchJobsFromDatabase(pool, db.databasename);
          } finally {
            await pool.end(); // FORCE CLOSE CONNECTION
          }
        })
      );

      for (const res of results) {
        for (const job of res.jobs) {
          const key = `${job._databaseName}_${job.jobid}`;
          if (!jobSet.has(key)) {
            jobSet.add(key);
            allJobs.push(job);
          }
        }
        for (const org of res.orgs) {
          const key = `${org._databaseName}_${org.orgid}`;
          if (!orgSet.has(key)) {
            orgSet.add(key);
            allOrgs.push(org);
          }
        }
      }
    }

    jobsCache = {
      jobs: allJobs,
      orgs: allOrgs,
      lastUpdated: Date.now(),
      isRefreshing: false
    };

    console.log(`Jobs cache refreshed: ${allJobs.length} jobs from ${databases.length} databases`);
    return jobsCache;
  } catch (error) {
    console.error('Error refreshing jobs cache:', error.message);
    jobsCache.isRefreshing = false;
    return jobsCache;
  }
}

// ---------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------

export async function getAllExternalJobs() {
  const now = Date.now();
  if (jobsCache.lastUpdated && (now - jobsCache.lastUpdated) < CACHE_TTL) {
    return { ...jobsCache, fromCache: true };
  }
  await refreshJobsCache();
  return { ...jobsCache, fromCache: false };
}

export async function forceRefreshJobsCache() {
  return await refreshJobsCache();
}

/**
 * Get pool for a specific database (Used for APPLYING)
 * This KEEPS the connection open (cached) because the user is interacting with it.
 */
export async function getPoolForDatabase(databaseName) {
  const [rows] = await metaPool.execute(`
    SELECT 
      sp.subscriber_database AS databasename,
      sp.privileged_user_access AS username,
      sp.password
    FROM C_SUBSCRIBER_PLAN sp
    WHERE sp.subscriber_database = ? AND sp.active = 'Y'
    LIMIT 1
  `, [databaseName]);

  if (rows.length === 0) {
    throw new Error(`Database ${databaseName} not found or inactive`);
  }

  const { username, password } = rows[0];
  // useCache = true (Default)
  return getTenantPool(databaseName, username, password, true);
}

export async function findJobDatabase(jobId, orgId) {
  const { jobs } = await getAllExternalJobs();
  const job = jobs.find(j => j.jobid === parseInt(jobId) && j.orgid === parseInt(orgId));
  return job ? job._databaseName : null;
}

/**
 * Get applications for a candidate across all databases (basic info)
 * ✅ OPTIMIZED: Uses transient connections + Batching
 */
export async function getCandidateApplications(candidateId) {
  try {
    const databases = await getAllSubscriberDatabases();
    const allApplications = [];
    
    // Batch processing (Lower limit for GoDaddy)
    const batchSize = 3;
    
    for (let i = 0; i < databases.length; i += batchSize) {
      const batch = databases.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (db) => {
          // useCache = false: Create temporary connection
          const pool = getTenantPool(db.databasename, db.username, db.password, false);
          
          try {
            const [tables] = await pool.query(`
              SELECT TABLE_NAME FROM information_schema.TABLES 
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'C_APPLICATIONS'
            `, [db.databasename]);
            
            if (tables.length === 0) return [];

            const [applications] = await pool.query(
              `SELECT jobid, applicationid, status, applieddate FROM C_APPLICATIONS WHERE candidate_id = ?`,
              [candidateId]
            );
            
            return applications.map(app => ({
              ...app,
              _databaseName: db.databasename
            }));
          } catch (error) {
            console.error(`Error fetching applications from ${db.databasename}:`, error.message);
            return [];
          } finally {
            // CRITICAL: Close the pool immediately after use
            await pool.end();
          }
        })
      );

      for (const apps of results) {
        allApplications.push(...apps);
      }
    }

    return allApplications;
  } catch (error) {
    console.error('Error fetching candidate applications:', error.message);
    return [];
  }
}

/**
 * Get applications for a candidate with full details (For "My Applications" Page)
 * ✅ OPTIMIZED: Uses transient connections + Batching
 */
export async function getCandidateApplicationsWithDetails(candidateId) {
  try {
    const databases = await getAllSubscriberDatabases();
    const allApplications = [];
    
    const batchSize = 3;
    
    for (let i = 0; i < databases.length; i += batchSize) {
      const batch = databases.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (db) => {
          // useCache = false: Create temporary connection
          const pool = getTenantPool(db.databasename, db.username, db.password, false);
          
          try {
            const [tables] = await pool.query(`
              SELECT TABLE_NAME FROM information_schema.TABLES 
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('C_APPLICATIONS', 'C_ORG', 'C_EXTERNAL_JOBS')
            `, [db.databasename]);
            
            const tableNames = tables.map(t => t.TABLE_NAME);
            if (!tableNames.includes('C_APPLICATIONS')) return [];

            const [applications] = await pool.query(`
              SELECT 
                a.applicationid, a.orgid, a.jobid, a.applieddate,
                a.status, a.resumepath, a.candidate_id, a.salary_expected,
                o.orgname, ej.display_job_name
              FROM C_APPLICATIONS a
              LEFT JOIN C_ORG o ON a.orgid = o.orgid
              LEFT JOIN C_EXTERNAL_JOBS ej ON a.jobid = ej.jobid
              WHERE a.candidate_id = ?
            `, [candidateId]);
            
            return applications.map(app => ({
              ...app,
              _databaseName: db.databasename
            }));
          } catch (error) {
            console.error(`Error fetching details from ${db.databasename}:`, error.message);
            return [];
          } finally {
            // CRITICAL: Close the pool immediately after use
            await pool.end();
          }
        })
      );

      for (const apps of results) {
        allApplications.push(...apps);
      }
    }

    console.log(`Found ${allApplications.length} applications for candidate ${candidateId}`);
    return allApplications;
  } catch (error) {
    console.error('Error fetching candidate applications with details:', error.message);
    return [];
  }
}

export { metaPool };



// // app/utils/config/jobsdb.js
// // ✅ OPTIMIZED FOR AWS RDS & HIGH TRAFFIC SCANS

// import mysql from 'mysql2/promise';

// // ---------------------------------------------------------
// // RDS MASTER CONFIG
// // ---------------------------------------------------------
// const RDS_CONFIG = {
//   host: 'database-1.cvscmsgqsmyw.us-east-1.rds.amazonaws.com',
//   port: 3306,
//   user: 'admin',
//   password: 'SaiLpgCsg$8393',
// };

// // ---------------------------------------------------------
// // META DATABASE CONNECTION
// // ---------------------------------------------------------
// const metaPool = mysql.createPool({
//   host: RDS_CONFIG.host,
//   port: RDS_CONFIG.port,
//   user: RDS_CONFIG.user,
//   password: RDS_CONFIG.password,
//   database: 'Com360_Meta',
//   waitForConnections: true,
//   connectionLimit: 10, // Meta needs higher availability
//   queueLimit: 0,
//   connectTimeout: 10000,
// });

// // Cache for LONG-LIVED tenant DB pools (Only for active specific operations)
// const tenantPools = new Map();

// // Cache for aggregated jobs data
// let jobsCache = {
//   jobs: [],
//   orgs: [],
//   lastUpdated: null,
//   isRefreshing: false
// };

// // Cache refresh interval: 5 minutes
// const CACHE_TTL = 5 * 60 * 1000;

// // Auto refresh
// setInterval(() => {
//   refreshJobsCache().catch((err) => {
//     console.error('Automatic jobs cache refresh failed:', err);
//   });
// }, CACHE_TTL);

// // ---------------------------------------------------------
// // GET / CREATE TENANT POOL
// // ---------------------------------------------------------
// /**
//  * @param {string} databaseName 
//  * @param {string} username 
//  * @param {string} password 
//  * @param {boolean} useCache - If false, creates a temporary pool that MUST be closed manually
//  */
// function getTenantPool(databaseName, username, password, useCache = true) {
//   // 1. If caching is enabled, check if we already have an open pool
//   if (useCache && tenantPools.has(databaseName)) {
//     return tenantPools.get(databaseName);
//   }

//   // 2. Create new pool
//   // OPTIMIZATION: Limit connections to 2 per tenant to prevent RDS exhaustion
//   const pool = mysql.createPool({
//     host: RDS_CONFIG.host,
//     port: RDS_CONFIG.port,
//     user: username || RDS_CONFIG.user,
//     password: password || RDS_CONFIG.password,
//     database: databaseName,
//     waitForConnections: true,
//     connectionLimit: 2, 
//     queueLimit: 0,
//     connectTimeout: 10000,
//   });

//   // 3. Store in cache ONLY if requested (for recurring operations like applying)
//   if (useCache) {
//     tenantPools.set(databaseName, pool);
//   }

//   return pool;
// }

// // ---------------------------------------------------------
// // FETCH ALL ACTIVE SUBSCRIBER DATABASES
// // ---------------------------------------------------------
// async function getAllSubscriberDatabases() {
//   try {
//     const [rows] = await metaPool.execute(`
//       SELECT DISTINCT
//         sp.subscriber_database AS databasename,
//         sp.privileged_user_access AS username,
//         sp.password,
//         s.org_id
//       FROM C_SUBSCRIBER s
//       JOIN C_SUBSCRIBER_PLAN sp ON s.subscriber_id = sp.subscriber_id
//       WHERE s.active = 'Y' AND sp.active = 'Y'
//       GROUP BY sp.subscriber_database
//     `);
//     return rows;
//   } catch (error) {
//     console.error('Error fetching subscriber databases:', error.message);
//     return [];
//   }
// }

// // ---------------------------------------------------------
// // FETCH JOBS FROM ONE DATABASE
// // ---------------------------------------------------------
// async function fetchJobsFromDatabase(pool, databaseName) {
//   try {
//     const [tables] = await pool.query(`
//       SELECT TABLE_NAME FROM information_schema.TABLES 
//       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('C_EXTERNAL_JOBS', 'C_ORG')
//     `, [databaseName]);
    
//     const tableNames = tables.map(t => t.TABLE_NAME);
//     if (!tableNames.includes('C_EXTERNAL_JOBS') || !tableNames.includes('C_ORG')) {
//       return { jobs: [], orgs: [] };
//     }

//     const [orgs] = await pool.query('SELECT orgid, orgname FROM C_ORG');
//     const [jobs] = await pool.query(`
//       SELECT 
//         ej.jobid, ej.orgid, ej.lastdate_for_application, ej.active,
//         ej.display_job_name, ej.job_type AS job_type_id, ej.description,
//         ej.countryid, ej.stateid, ej.custom_state_name,
//         o.orgname, c.value AS country_value, s.value AS state_value,
//         g.Name AS job_type
//       FROM C_EXTERNAL_JOBS ej
//       JOIN C_ORG o ON ej.orgid = o.orgid
//       LEFT JOIN C_COUNTRY c ON ej.countryid = c.ID
//       LEFT JOIN C_STATE s ON ej.stateid = s.ID
//       LEFT JOIN C_GENERIC_VALUES g ON ej.job_type = g.id
//       WHERE ej.active = 1
//     `);

//     return {
//       jobs: jobs.map(j => ({ ...j, _databaseName: databaseName })),
//       orgs: orgs.map(o => ({ ...o, _databaseName: databaseName })),
//     };
//   } catch (error) {
//     console.error(`Error fetching jobs from ${databaseName}:`, error.message);
//     return { jobs: [], orgs: [] };
//   }
// }

// // ---------------------------------------------------------
// // REFRESH JOB CACHE (OPTIMIZED)
// // ---------------------------------------------------------
// async function refreshJobsCache() {
//   if (jobsCache.isRefreshing) return jobsCache;

//   jobsCache.isRefreshing = true;
//   console.log('Refreshing jobs cache...');

//   try {
//     const databases = await getAllSubscriberDatabases();
//     const allJobs = [];
//     const allOrgs = [];
//     const jobSet = new Set();
//     const orgSet = new Set();

//     // OPTIMIZATION: Process in batches of 5
//     const batchSize = 5;
//     for (let i = 0; i < databases.length; i += batchSize) {
//       const batch = databases.slice(i, i + batchSize);

//       const results = await Promise.all(
//         batch.map(async (db) => {
//           // KEY CHANGE: useCache = false. Open, Fetch, Close.
//           const pool = getTenantPool(db.databasename, db.username, db.password, false);
//           try {
//             return await fetchJobsFromDatabase(pool, db.databasename);
//           } finally {
//             await pool.end(); // FORCE CLOSE CONNECTION
//           }
//         })
//       );

//       for (const res of results) {
//         for (const job of res.jobs) {
//           const key = `${job._databaseName}_${job.jobid}`;
//           if (!jobSet.has(key)) {
//             jobSet.add(key);
//             allJobs.push(job);
//           }
//         }
//         for (const org of res.orgs) {
//           const key = `${org._databaseName}_${org.orgid}`;
//           if (!orgSet.has(key)) {
//             orgSet.add(key);
//             allOrgs.push(org);
//           }
//         }
//       }
//     }

//     jobsCache = {
//       jobs: allJobs,
//       orgs: allOrgs,
//       lastUpdated: Date.now(),
//       isRefreshing: false
//     };

//     console.log(`Jobs cache refreshed: ${allJobs.length} jobs from ${databases.length} databases`);
//     return jobsCache;
//   } catch (error) {
//     console.error('Error refreshing jobs cache:', error.message);
//     jobsCache.isRefreshing = false;
//     return jobsCache;
//   }
// }

// // ---------------------------------------------------------
// // PUBLIC API
// // ---------------------------------------------------------

// export async function getAllExternalJobs() {
//   const now = Date.now();
//   if (jobsCache.lastUpdated && (now - jobsCache.lastUpdated) < CACHE_TTL) {
//     return { ...jobsCache, fromCache: true };
//   }
//   await refreshJobsCache();
//   return { ...jobsCache, fromCache: false };
// }

// export async function forceRefreshJobsCache() {
//   return await refreshJobsCache();
// }

// /**
//  * Get pool for a specific database (Used for APPLYING)
//  * This KEEPS the connection open (cached) because the user is interacting with it.
//  */
// export async function getPoolForDatabase(databaseName) {
//   const [rows] = await metaPool.execute(`
//     SELECT 
//       sp.subscriber_database AS databasename,
//       sp.privileged_user_access AS username,
//       sp.password
//     FROM C_SUBSCRIBER_PLAN sp
//     WHERE sp.subscriber_database = ? AND sp.active = 'Y'
//     LIMIT 1
//   `, [databaseName]);

//   if (rows.length === 0) {
//     throw new Error(`Database ${databaseName} not found or inactive`);
//   }

//   const { username, password } = rows[0];
//   // useCache = true (Default)
//   return getTenantPool(databaseName, username, password, true);
// }

// export async function findJobDatabase(jobId, orgId) {
//   const { jobs } = await getAllExternalJobs();
//   const job = jobs.find(j => j.jobid === parseInt(jobId) && j.orgid === parseInt(orgId));
//   return job ? job._databaseName : null;
// }

// /**
//  * Get applications for a candidate across all databases (basic info)
//  * ✅ OPTIMIZED: Uses transient connections + Batching
//  */
// export async function getCandidateApplications(candidateId) {
//   try {
//     const databases = await getAllSubscriberDatabases();
//     const allApplications = [];
    
//     // Batch processing to control connection spikes
//     const batchSize = 5;
    
//     for (let i = 0; i < databases.length; i += batchSize) {
//       const batch = databases.slice(i, i + batchSize);
      
//       const results = await Promise.all(
//         batch.map(async (db) => {
//           // useCache = false: Create temporary connection
//           const pool = getTenantPool(db.databasename, db.username, db.password, false);
          
//           try {
//             const [tables] = await pool.query(`
//               SELECT TABLE_NAME FROM information_schema.TABLES 
//               WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'C_APPLICATIONS'
//             `, [db.databasename]);
            
//             if (tables.length === 0) return [];

//             const [applications] = await pool.query(
//               `SELECT jobid, applicationid, status, applieddate FROM C_APPLICATIONS WHERE candidate_id = ?`,
//               [candidateId]
//             );
            
//             return applications.map(app => ({
//               ...app,
//               _databaseName: db.databasename
//             }));
//           } catch (error) {
//             console.error(`Error fetching applications from ${db.databasename}:`, error.message);
//             return [];
//           } finally {
//             // CRITICAL: Close the pool immediately after use
//             await pool.end();
//           }
//         })
//       );

//       for (const apps of results) {
//         allApplications.push(...apps);
//       }
//     }

//     return allApplications;
//   } catch (error) {
//     console.error('Error fetching candidate applications:', error.message);
//     return [];
//   }
// }

// /**
//  * Get applications for a candidate with full details (For "My Applications" Page)
//  * ✅ OPTIMIZED: Uses transient connections + Batching
//  */
// export async function getCandidateApplicationsWithDetails(candidateId) {
//   try {
//     const databases = await getAllSubscriberDatabases();
//     const allApplications = [];
    
//     const batchSize = 5;
    
//     for (let i = 0; i < databases.length; i += batchSize) {
//       const batch = databases.slice(i, i + batchSize);
      
//       const results = await Promise.all(
//         batch.map(async (db) => {
//           // useCache = false: Create temporary connection
//           const pool = getTenantPool(db.databasename, db.username, db.password, false);
          
//           try {
//             const [tables] = await pool.query(`
//               SELECT TABLE_NAME FROM information_schema.TABLES 
//               WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('C_APPLICATIONS', 'C_ORG', 'C_EXTERNAL_JOBS')
//             `, [db.databasename]);
            
//             const tableNames = tables.map(t => t.TABLE_NAME);
//             if (!tableNames.includes('C_APPLICATIONS')) return [];

//             const [applications] = await pool.query(`
//               SELECT 
//                 a.applicationid, a.orgid, a.jobid, a.applieddate,
//                 a.status, a.resumepath, a.candidate_id, a.salary_expected,
//                 o.orgname, ej.display_job_name
//               FROM C_APPLICATIONS a
//               LEFT JOIN C_ORG o ON a.orgid = o.orgid
//               LEFT JOIN C_EXTERNAL_JOBS ej ON a.jobid = ej.jobid
//               WHERE a.candidate_id = ?
//             `, [candidateId]);
            
//             return applications.map(app => ({
//               ...app,
//               _databaseName: db.databasename
//             }));
//           } catch (error) {
//             console.error(`Error fetching details from ${db.databasename}:`, error.message);
//             return [];
//           } finally {
//             // CRITICAL: Close the pool immediately after use
//             await pool.end();
//           }
//         })
//       );

//       for (const apps of results) {
//         allApplications.push(...apps);
//       }
//     }

//     console.log(`Found ${allApplications.length} applications for candidate ${candidateId}`);
//     return allApplications;
//   } catch (error) {
//     console.error('Error fetching candidate applications with details:', error.message);
//     return [];
//   }
// }

// export { metaPool };
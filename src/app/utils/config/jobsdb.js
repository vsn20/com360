import mysql from 'mysql2/promise';

// Remote MySQL credentials (META DB)
const metaPool = mysql.createPool({
  host: '132.148.221.65',
  port: 3306,
  user: 'SAINAMAN',
  password: 'SAInaman$8393',
  database: 'Com360_Meta',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

// Cache for tenant DB pools
const tenantPools = new Map();

// Cache for aggregated jobs data
let jobsCache = {
  jobs: [],
  orgs: [],
  lastUpdated: null,
  isRefreshing: false
};

// Cache refresh interval: 5 minutes (300000 ms)
const CACHE_TTL = 5 * 60 * 1000;

// Automatically refresh jobs cache every 5 minutes
setInterval(() => {
  refreshJobsCache().catch((err) => {
    console.error('Automatic jobs cache refresh failed:', err);
  });
}, CACHE_TTL);

/**
 * Get or create a pool for a specific tenant database
 */
function getTenantPool(databaseName, username, password) {
  const key = databaseName;
  
  if (tenantPools.has(key)) {
    return tenantPools.get(key);
  }

  const pool = mysql.createPool({
    host: '132.148.221.65',
    port: 3306,
    user: username,
    password: password,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: 3,
    queueLimit: 0,
  });

  tenantPools.set(key, pool);
  return pool;
}

/**
 * Fetch all active subscriber databases from Com360_Meta
 */
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
    
    console.log(`Found ${rows.length} active subscriber databases`);
    return rows;
  } catch (error) {
    console.error('Error fetching subscriber databases:', error.message);
    return [];
  }
}

/**
 * Fetch external jobs from a single tenant database
 */
async function fetchJobsFromDatabase(pool, databaseName) {
  try {
    // First check if the required tables exist
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('C_EXTERNAL_JOBS', 'C_ORG')
    `, [databaseName]);
    
    const tableNames = tables.map(t => t.TABLE_NAME);
    if (!tableNames.includes('C_EXTERNAL_JOBS') || !tableNames.includes('C_ORG')) {
      console.log(`Database ${databaseName} missing required tables, skipping`);
      return { jobs: [], orgs: [] };
    }

    // Fetch organizations
    const [orgs] = await pool.query('SELECT orgid, orgname FROM C_ORG');

    // Fetch external jobs with all required data
    const [jobs] = await pool.query(`
      SELECT ej.jobid, ej.orgid, ej.lastdate_for_application, ej.active,
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

    // Add database reference to each job for later use (applying, etc.)
    const jobsWithDb = jobs.map(job => ({
      ...job,
      _databaseName: databaseName
    }));

    // Add database reference to orgs too
    const orgsWithDb = orgs.map(org => ({
      ...org,
      _databaseName: databaseName
    }));

    console.log(`Fetched ${jobs.length} jobs from ${databaseName}`);
    return { jobs: jobsWithDb, orgs: orgsWithDb };
  } catch (error) {
    console.error(`Error fetching jobs from ${databaseName}:`, error.message);
    return { jobs: [], orgs: [] };
  }
}

/**
 * Refresh the jobs cache by fetching from all databases
 */
async function refreshJobsCache() {
  if (jobsCache.isRefreshing) {
    console.log('Cache refresh already in progress, skipping');
    return jobsCache;
  }

  jobsCache.isRefreshing = true;
  console.log('Starting jobs cache refresh...');

  try {
    const databases = await getAllSubscriberDatabases();
    
    const allJobs = [];
    const allOrgs = [];
    const orgSet = new Set(); // To deduplicate orgs
    const jobSet = new Set(); // To deduplicate jobs

    // Fetch jobs from all databases in parallel (with concurrency limit)
    const batchSize = 5;
    for (let i = 0; i < databases.length; i += batchSize) {
      const batch = databases.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (db) => {
          const pool = getTenantPool(db.databasename, db.username, db.password);
          return fetchJobsFromDatabase(pool, db.databasename);
        })
      );

      for (const result of results) {
        // Deduplicate jobs based on databaseName + jobid
        for (const job of result.jobs) {
          const key = `${job._databaseName}_${job.jobid}`;
          if (!jobSet.has(key)) {
            jobSet.add(key);
            allJobs.push(job);
          }
        }
        
        // Deduplicate orgs based on orgid + database
        for (const org of result.orgs) {
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

    console.log(`Jobs cache refreshed: ${allJobs.length} total jobs from ${databases.length} databases`);
    return jobsCache;
  } catch (error) {
    console.error('Error refreshing jobs cache:', error.message);
    jobsCache.isRefreshing = false;
    return jobsCache;
  }
}

/**
 * Get all external jobs (from cache if valid, otherwise refresh)
 */
export async function getAllExternalJobs() {
  const now = Date.now();
  
  // Check if cache is valid (less than 5 minutes old)
  if (jobsCache.lastUpdated && (now - jobsCache.lastUpdated) < CACHE_TTL) {
    console.log('Returning cached jobs data');
    return {
      jobs: jobsCache.jobs,
      orgs: jobsCache.orgs,
      fromCache: true,
      lastUpdated: jobsCache.lastUpdated
    };
  }

  // Cache expired or doesn't exist, refresh
  await refreshJobsCache();
  
  return {
    jobs: jobsCache.jobs,
    orgs: jobsCache.orgs,
    fromCache: false,
    lastUpdated: jobsCache.lastUpdated
  };
}

/**
 * Force refresh the cache (bypasses TTL check)
 */
export async function forceRefreshJobsCache() {
  return await refreshJobsCache();
}

/**
 * Get pool for a specific database (used for applications)
 */
export async function getPoolForDatabase(databaseName) {
  // First get the database credentials from meta
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
  return getTenantPool(databaseName, username, password);
}

/**
 * Find which database a job belongs to
 */
export async function findJobDatabase(jobId, orgId) {
  const { jobs } = await getAllExternalJobs();
  const job = jobs.find(j => j.jobid === parseInt(jobId) && j.orgid === parseInt(orgId));
  
  if (!job) {
    return null;
  }
  
  return job._databaseName;
}

/**
 * Get applications for a candidate across all databases (basic info)
 */
export async function getCandidateApplications(candidateId) {
  try {
    const databases = await getAllSubscriberDatabases();
    const allApplications = [];

    // Fetch applications from all databases
    const batchSize = 5;
    for (let i = 0; i < databases.length; i += batchSize) {
      const batch = databases.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (db) => {
          try {
            const pool = getTenantPool(db.databasename, db.username, db.password);
            
            // Check if C_APPLICATIONS table exists
            const [tables] = await pool.query(`
              SELECT TABLE_NAME 
              FROM information_schema.TABLES 
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'C_APPLICATIONS'
            `, [db.databasename]);
            
            if (tables.length === 0) {
              return [];
            }

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
 * Get applications for a candidate with full details (org name, job name, etc.)
 * Used for the "My Applications" page
 */
export async function getCandidateApplicationsWithDetails(candidateId) {
  try {
    const databases = await getAllSubscriberDatabases();
    const allApplications = [];

    // Fetch applications from all databases in batches
    const batchSize = 5;
    for (let i = 0; i < databases.length; i += batchSize) {
      const batch = databases.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (db) => {
          try {
            const pool = getTenantPool(db.databasename, db.username, db.password);
            
            // Check if required tables exist
            const [tables] = await pool.query(`
              SELECT TABLE_NAME 
              FROM information_schema.TABLES 
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('C_APPLICATIONS', 'C_ORG', 'C_EXTERNAL_JOBS')
            `, [db.databasename]);
            
            const tableNames = tables.map(t => t.TABLE_NAME);
            if (!tableNames.includes('C_APPLICATIONS')) {
              return [];
            }

            // Fetch applications with org and job details
            const [applications] = await pool.query(`
              SELECT 
                a.applicationid,
                a.orgid,
                a.jobid,
                a.applieddate,
                a.status,
                a.resumepath,
                a.candidate_id,
                a.salary_expected,
                o.orgname,
                ej.display_job_name
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
            console.error(`Error fetching applications with details from ${db.databasename}:`, error.message);
            return [];
          }
        })
      );

      for (const apps of results) {
        allApplications.push(...apps);
      }
    }

    console.log(`Found ${allApplications.length} applications for candidate ${candidateId} across all databases`);
    return allApplications;
  } catch (error) {
    console.error('Error fetching candidate applications with details:', error.message);
    return [];
  }
}

export { metaPool };



// // app/utils/config/jobsdb.js
// // ✅ HARDCODED FOR AWS RDS (NO ENV DEPENDENCY)

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
// // META DATABASE CONNECTION
// // ---------------------------------------------------------
// const metaPool = mysql.createPool({
//   host: RDS_CONFIG.host,
//   port: RDS_CONFIG.port,
//   user: RDS_CONFIG.user,
//   password: RDS_CONFIG.password,
//   database: 'Com360_Meta',
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
//   connectTimeout: 10000,
// });

// // Cache for tenant DB pools
// const tenantPools = new Map();

// // Cache for aggregated jobs data
// let jobsCache = {
//   jobs: [],
//   orgs: [],
//   lastUpdated: null,
//   isRefreshing: false,
// };

// // Cache refresh interval: 5 minutes
// const CACHE_TTL = 5 * 60 * 1000;

// // Auto refresh
// setInterval(() => {
//   refreshJobsCache().catch(err =>
//     console.error('Automatic jobs cache refresh failed:', err)
//   );
// }, CACHE_TTL);

// // ---------------------------------------------------------
// // GET / CREATE TENANT POOL
// // ---------------------------------------------------------
// function getTenantPool(databaseName, username, password) {
//   if (tenantPools.has(databaseName)) {
//     return tenantPools.get(databaseName);
//   }

//   const pool = mysql.createPool({
//     host: RDS_CONFIG.host,
//     port: RDS_CONFIG.port,
//     user: username || RDS_CONFIG.user,
//     password: password || RDS_CONFIG.password,
//     database: databaseName,
//     waitForConnections: true,
//     connectionLimit: 5,
//     queueLimit: 0,
//     connectTimeout: 10000,
//   });

//   tenantPools.set(databaseName, pool);
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

//     console.log(`Found ${rows.length} active subscriber databases`);
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
//       SELECT TABLE_NAME 
//       FROM information_schema.TABLES 
//       WHERE TABLE_SCHEMA = ? 
//         AND TABLE_NAME IN ('C_EXTERNAL_JOBS', 'C_ORG')
//     `, [databaseName]);

//     const tableNames = tables.map(t => t.TABLE_NAME);
//     if (!tableNames.includes('C_EXTERNAL_JOBS') || !tableNames.includes('C_ORG')) {
//       console.log(`Skipping ${databaseName}, missing tables`);
//       return { jobs: [], orgs: [] };
//     }

//     const [orgs] = await pool.query(
//       'SELECT orgid, orgname FROM C_ORG'
//     );

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
// // REFRESH JOB CACHE
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

//     const batchSize = 5;
//     for (let i = 0; i < databases.length; i += batchSize) {
//       const batch = databases.slice(i, i + batchSize);

//       const results = await Promise.all(
//         batch.map(db => {
//           const pool = getTenantPool(db.databasename, db.username, db.password);
//           return fetchJobsFromDatabase(pool, db.databasename);
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
//       isRefreshing: false,
//     };

//     console.log(`Jobs cache refreshed (${allJobs.length} jobs)`);
//     return jobsCache;

//   } catch (error) {
//     console.error('Jobs cache refresh failed:', error.message);
//     jobsCache.isRefreshing = false;
//     return jobsCache;
//   }
// }

// // ---------------------------------------------------------
// // PUBLIC API
// // ---------------------------------------------------------
// export async function getAllExternalJobs() {
//   const now = Date.now();

//   if (jobsCache.lastUpdated && now - jobsCache.lastUpdated < CACHE_TTL) {
//     return { ...jobsCache, fromCache: true };
//   }

//   await refreshJobsCache();
//   return { ...jobsCache, fromCache: false };
// }

// export async function forceRefreshJobsCache() {
//   return await refreshJobsCache();
// }

// export async function getPoolForDatabase(databaseName) {
//   const [rows] = await metaPool.execute(`
//     SELECT 
//       sp.subscriber_database AS databasename,
//       sp.privileged_user_access AS username,
//       sp.password
//     FROM C_SUBSCRIBER_PLAN sp
//     WHERE sp.subscriber_database = ?
//       AND sp.active = 'Y'
//     LIMIT 1
//   `, [databaseName]);

//   if (!rows.length) {
//     throw new Error(`Database ${databaseName} not found`);
//   }

//   return getTenantPool(databaseName, rows[0].username, rows[0].password);
// }

// export async function findJobDatabase(jobId, orgId) {
//   const { jobs } = await getAllExternalJobs();
//   const job = jobs.find(
//     j => j.jobid === Number(jobId) && j.orgid === Number(orgId)
//   );
//   return job ? job._databaseName : null;
// }

// export { metaPool };
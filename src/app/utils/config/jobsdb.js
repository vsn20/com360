// app/utils/config/jobsdb.js
// ✅ AWS RDS VERSION: Central Meta Access + String Job IDs

import mysql from 'mysql2/promise';

// ---------------------------------------------------------
// RDS MASTER CONFIG
// ---------------------------------------------------------
const RDS_CONFIG = {
  host: 'database-1.cvscmsgqsmyw.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: 'SaiLpgCsg$8393',
};

// ---------------------------------------------------------
// META DATABASE CONNECTION (Central Source for Candidates)
// ---------------------------------------------------------
export const metaPool = mysql.createPool({
  host: RDS_CONFIG.host,
  port: RDS_CONFIG.port,
  user: RDS_CONFIG.user,
  password: RDS_CONFIG.password,
  database: 'Com360_Meta', // ✅ Candidates stored here
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

const tenantPools = new Map();

let jobsCache = {
  jobs: [],
  orgs: [],
  lastUpdated: null,
  isRefreshing: false
};

const CACHE_TTL = 5 * 60 * 1000;

setInterval(() => {
  refreshJobsCache().catch((err) => {
    console.error('Automatic jobs cache refresh failed:', err);
  });
}, CACHE_TTL);

function getTenantPool(databaseName, username, password, useCache = true) {
  if (useCache && tenantPools.has(databaseName)) {
    return tenantPools.get(databaseName);
  }

  const pool = mysql.createPool({
    host: RDS_CONFIG.host,
    port: RDS_CONFIG.port,
    user: username || RDS_CONFIG.user,
    password: password || RDS_CONFIG.password,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: 2, 
    queueLimit: 0,
    connectTimeout: 10000,
  });

  if (useCache) {
    tenantPools.set(databaseName, pool);
  }

  return pool;
}

// ---------------------------------------------------------
// FETCH ALL ACTIVE SUBSCRIBER DATABASES (+ MAIN DB)
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

    // ✅ Explicitly add legacy 'com360' database if missing
    const exists = rows.find(r => r.databasename === 'com360');
    if (!exists) {
        rows.push({
            databasename: 'com360',
            username: RDS_CONFIG.user,
            password: RDS_CONFIG.password
        });
    }

    return rows;
  } catch (error) {
    console.error('Error fetching subscriber databases:', error.message);
    return [{ databasename: 'com360', username: RDS_CONFIG.user, password: RDS_CONFIG.password }];
  }
}

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

    // ✅ Ensure jobid is mapped as String
    return {
      jobs: jobs.map(j => ({ ...j, jobid: String(j.jobid), _databaseName: databaseName })),
      orgs: orgs.map(o => ({ ...o, _databaseName: databaseName })),
    };
  } catch (error) {
    console.error(`Error fetching jobs from ${databaseName}:`, error.message);
    return { jobs: [], orgs: [] };
  }
}

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

    const batchSize = 5;
    for (let i = 0; i < databases.length; i += batchSize) {
      const batch = databases.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (db) => {
          const pool = getTenantPool(db.databasename, db.username, db.password, false);
          try {
            return await fetchJobsFromDatabase(pool, db.databasename);
          } finally {
            await pool.end();
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
 * Get pool for a specific database (Used for APPLYING & Fetching Names)
 */
export async function getPoolForDatabase(databaseName) {
  // ✅ Direct access for legacy com360 DB (if needed)
  if (databaseName === 'com360') {
    return getTenantPool('com360', RDS_CONFIG.user, RDS_CONFIG.password, true);
  }

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
  return getTenantPool(databaseName, username, password, true);
}

export async function findJobDatabase(jobId, orgId) {
  const { jobs } = await getAllExternalJobs();
  const job = jobs.find(j => String(j.jobid) === String(jobId) && j.orgid === parseInt(orgId));
  return job ? job._databaseName : null;
}

export async function getCandidateApplications(candidateId) {
  try {
    const databases = await getAllSubscriberDatabases();
    const allApplications = [];
    const batchSize = 5;
    
    for (let i = 0; i < databases.length; i += batchSize) {
      const batch = databases.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (db) => {
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
              jobid: String(app.jobid),
              _databaseName: db.databasename
            }));
          } catch (error) {
            console.error(`Error fetching applications from ${db.databasename}:`, error.message);
            return [];
          } finally {
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

export async function getCandidateApplicationsWithDetails(candidateId) {
  try {
    const databases = await getAllSubscriberDatabases();
    const allApplications = [];
    const batchSize = 5;
    
    for (let i = 0; i < databases.length; i += batchSize) {
      const batch = databases.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (db) => {
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
              jobid: String(app.jobid),
              _databaseName: db.databasename
            }));
          } catch (error) {
            console.error(`Error fetching details from ${db.databasename}:`, error.message);
            return [];
          } finally {
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
    console.error('Error fetching candidate applications with details:', error.message);
    return [];
  }
}

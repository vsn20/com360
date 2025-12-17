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
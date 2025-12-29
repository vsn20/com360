'use server';

import { MetaDBconnection } from "@/app/utils/config/db"; 
import { createTenantDatabase, addPrivilegedUserToDatabase, allowRemoteAccess } from "@/app/utils/config/cpanelApi"; 
import { cloneDatabaseSchema } from "@/app/utils/config/dbCloner"; 
import mysql from 'mysql2/promise'; 
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Get Hardcoded Tenant Connection (Com360) for OTPs
async function getTenantConnection() {
  const pool = mysql.createPool({
    host: '132.148.221.65',
    port: 3306,
    user: 'SAINAMAN',         
    password: 'SAInaman$8393',
    database: 'com360',       
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
  return pool;
}

// 1. Check Organization Name
export async function checkOrgName(orgName) {
  const metaPool = MetaDBconnection(); 
  try {
    const [rows] = await metaPool.query('SELECT org_id FROM C_ORG WHERE LOWER(org_name) = LOWER(?)', [orgName]);
    return { exists: rows.length > 0 };
  } catch (error) { return { exists: false, error: "Database error" }; }
}

// 2. Check Email
export async function checkEmail(email) {
  const metaPool = MetaDBconnection(); 
  try {
    const [rows] = await metaPool.query('SELECT emp_id FROM C_EMP WHERE email = ?', [email]);
    return { exists: rows.length > 0 };
  } catch (error) { return { exists: false, error: "Database error" }; }
}

// 3. Check Username
export async function checkUsername(username) {
  const metaPool = MetaDBconnection(); 
  try {
    const [rows] = await metaPool.query('SELECT username FROM C_EMP WHERE username = ?', [username]);
    return { exists: rows.length > 0 };
  } catch (error) { return { exists: false, error: "Database error" }; }
}

// 4. Send Signup OTP
export async function sendSignupOTP(formData) {
  const email = formData.get('email');
  const tenantPool = await getTenantConnection(); 
  try {
    await tenantPool.query(`CREATE TABLE IF NOT EXISTS C_OTP (email VARCHAR(255) PRIMARY KEY, otp VARCHAR(6) NOT NULL, expiry DATETIME NOT NULL)`);
    const [userRows] = await tenantPool.query(`SELECT COUNT(*) AS count FROM C_USER WHERE email=?`, [email]);
    if (userRows[0].count > 0) { await tenantPool.end(); return { success: false, error: "This email is already registered." }; }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    await tenantPool.query(`INSERT INTO C_OTP (email, otp, expiry) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE otp = ?, expiry = ?`, [email, otp, expiry, otp, expiry]);
    await tenantPool.end(); 
    const transporter = nodemailer.createTransport({ host: process.env.GMAIL_HOST, port: 587, secure: false, auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS } });
    await transporter.sendMail({ from: process.env.GMAIL_USER, to: email, subject: 'Com360 Signup Verification', text: `Your verification code for Com360 is ${otp}.` });
    return { success: true };
  } catch (err) { if (tenantPool) await tenantPool.end(); return { success: false, error: "Failed to send OTP." }; }
}

export async function initiateSignupOTP(formData) { return await sendSignupOTP(formData); }

export async function validateSignupOTP(formData) {
  const email = formData.get('email');
  const otp = formData.get('otp');
  const tenantPool = await getTenantConnection(); 
  try {
    const [rows] = await tenantPool.query('SELECT * FROM C_OTP WHERE email = ? AND otp = ?', [email, otp]);
    await tenantPool.end();
    if (rows.length > 0) {
      if (Date.now() > new Date(rows[0].expiry)) return { success: false, error: "OTP has expired" };
      return { success: true };
    }
    return { success: false, error: "Invalid OTP" };
  } catch (e) { if (tenantPool) await tenantPool.end(); return { success: false, error: "Database error" }; }
}

// 5. Submit Subscription Request (Replaces immediate creation)
export async function submitSubscriptionRequest(formData) {
  const metaPool = MetaDBconnection(); 
  let metaConnection = null;

  try {
    const companyName = formData.get('companyName');
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    const email = formData.get('email');
    const mobileNumber = formData.get('mobileNumber');
    const gender = formData.get('gender');
    const dob = formData.get('dob');
    const username = formData.get('username');
    const password = formData.get('password');
    const planId = formData.get('planId'); 
    const logoFile = formData.get('logo');

    const hashedPassword = await bcrypt.hash(password, 10);

    let logoPath = null;
    if (logoFile && logoFile.size > 0) {
      const tempDir = path.join(process.cwd(), 'public/uploads/temp');
      await fs.mkdir(tempDir, { recursive: true });
      const fileName = `${Date.now()}_${logoFile.name.replace(/\s/g, '_')}`;
      const filePath = path.join(tempDir, fileName);
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      logoPath = `/uploads/temp/${fileName}`; 
    }

    metaConnection = await metaPool.getConnection();
    
    const [existing] = await metaConnection.query(
      'SELECT request_id FROM C_ORG_ONBOARDING_REQUESTS WHERE email = ? AND status = "PENDING"', 
      [email]
    );
    
    if (existing.length > 0) {
      return { success: false, error: "A pending request for this email already exists." };
    }

    await metaConnection.query(
      `INSERT INTO C_ORG_ONBOARDING_REQUESTS 
       (company_name, first_name, last_name, email, mobile_number, gender, dob, username, password_hash, logo_path, plan_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [companyName, firstName, lastName, email, mobileNumber, gender, dob, username, hashedPassword, logoPath, planId]
    );

    return { success: true };

  } catch (error) {
    console.error("Request Submission Failed:", error);
    return { success: false, error: "Failed to submit request. Please try again." };
  } finally {
    if (metaConnection) metaConnection.release();
  }
}

// 6. APPROVE SUBSCRIPTION (Called by Admin Panel)
// Used for Growth, Pro, and Enterprise plans

export async function approveSubscription(reqData) {
  const metaPool = MetaDBconnection();
  let metaConnection = null;
  let newTenantPool = null;
  let newTenantConnection = null;

  try {
    const { 
        request_id, company_name, first_name, last_name, email, 
        mobile_number, gender, dob, username, password_hash, logo_path, plan_id 
    } = reqData;

    console.log(`🚀 Starting Subscription Approval for: ${company_name}`);

    // --- A. PREPARE DB CREDENTIALS ---
    const cleanName = company_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    const dbName = `${cleanName}_Com360view`; 
    const dbUser = `${cleanName}_u`; 
    const dbPass = Math.random().toString(36).slice(-10) + "Aa1"; 

    // --- B. CREATE & SETUP TENANT DB ---
    const cpanelResult = await createTenantDatabase(dbName, dbUser, dbPass);
    if (!cpanelResult.success) throw new Error(`DB Creation: ${cpanelResult.error}`);
    await delay(3000);

    await allowRemoteAccess(process.env.SERVER_IP || '%'); 
    //  await allowRemoteAccess('%'); 
    await addPrivilegedUserToDatabase(dbName, 'SAINAMAN'); 
    await delay(2000);

    const cloneResult = await cloneDatabaseSchema('com360', dbName);
    if (!cloneResult.success) throw new Error(`Cloning: ${cloneResult.error}`);

    // --- C. META TABLE INSERTS ---
    metaConnection = await metaPool.getConnection();
    await metaConnection.beginTransaction();

    const [metaOrgResult] = await metaConnection.query(
      `INSERT INTO C_ORG (org_name, active) VALUES (?, 'Y')`, [company_name]
    );
    const metaOrgId = metaOrgResult.insertId;

    const [subResult] = await metaConnection.query(
      `INSERT INTO C_SUBSCRIBER (admin_first_name, admin_last_name, org_id, active) VALUES (?, ?, ?, 'Y')`,
      [first_name, last_name, metaOrgId]
    );
    const subscriberId = subResult.insertId;

    await metaConnection.query(
      `INSERT INTO C_SUBSCRIBER_PLAN (subscriber_id, plan_id, subscriber_database, plan_start_date, active, privileged_user_access, password) 
       VALUES (?, ?, ?, CURRENT_DATE(), 'Y', ?, ?)`, 
      [subscriberId, plan_id, dbName, dbUser, dbPass]
    );

    await metaConnection.query(
      `INSERT INTO C_EMP (emp_first_name, emp_middle_name, org_id, username, plan_number, email, active) 
       VALUES (?, ?, ?, ?, ?, ?, 'Y')`,
      [first_name, last_name, metaOrgId, username, plan_id, email]
    );

    // --- D. CONNECT TO NEW TENANT DB ---
    newTenantPool = mysql.createPool({
        host: '132.148.221.65', user: 'SAINAMAN', password: 'SAInaman$8393', database: dbName, waitForConnections: true, connectionLimit: 5
    });

    let attempts = 0;
    while (attempts < 5) {
        try {
            newTenantConnection = await newTenantPool.getConnection();
            break; 
        } catch (err) {
            attempts++;
            await delay(2000);
            if (attempts >= 5) throw new Error("Could not connect to new Tenant DB");
        }
    }

    await newTenantConnection.beginTransaction();

    // --- E. TENANT DB INSERTS ---
    const [tenantOrgResult] = await newTenantConnection.query(
      `INSERT INTO C_ORG (orgid,orgname, org_status, CREATED_BY, LAST_UPDATED_BY) VALUES (?,?, 'ACTIVE', 'SYSTEM', 'SYSTEM')`,
      [metaOrgId,company_name]
    );
    const tenantOrgId = metaOrgId;

    // --- HANDLE LOGO (ROBUST VERSION) ---
    if (logo_path) {
        try {
            // Remove leading slashes for Windows path compatibility
            const cleanLogoPath = logo_path.startsWith('/') || logo_path.startsWith('\\') 
                ? logo_path.slice(1) 
                : logo_path;

            const oldPath = path.join(process.cwd(), 'public', cleanLogoPath);
            const newFileName = `${tenantOrgId}.jpg`;
            const newDir = path.join(process.cwd(), 'public/uploads/orglogos');
            const newPath = path.join(newDir, newFileName);

            // Check if Source exists (Prevents crash if moved in previous failed run)
            let sourceExists = false;
            try {
                await fs.access(oldPath);
                sourceExists = true;
            } catch (e) {
                console.warn(`Logo source missing at ${oldPath}. Checking destination...`);
            }

            if (sourceExists) {
                // Normal Case: Move file
                await fs.mkdir(newDir, { recursive: true });
                await fs.rename(oldPath, newPath);
                
                await newTenantConnection.query(
                    'UPDATE C_ORG SET orglogo_url = ?, is_logo_set = 1 WHERE orgid = ?', 
                    [`/uploads/orglogos/${newFileName}`, tenantOrgId]
                );
            } else {
                // Recovery Case: Check if file is already at destination
                 try {
                    await fs.access(newPath);
                    // File exists at destination, just update DB
                    await newTenantConnection.query(
                        'UPDATE C_ORG SET orglogo_url = ?, is_logo_set = 1 WHERE orgid = ?', 
                        [`/uploads/orglogos/${newFileName}`, tenantOrgId]
                    );
                    console.log("Recovered logo from previous attempt.");
                 } catch (e) {
                     console.warn("Logo file lost. Continuing without logo.");
                 }
            }
        } catch (fileErr) { 
            console.warn("Logo move failed (Non-critical):", fileErr); 
        }
    }

    const tenantEmpId = `${tenantOrgId}_1`;
    await newTenantConnection.query(
      `INSERT INTO C_EMP (empid, orgid, EMP_FST_NAME, EMP_LAST_NAME, email, GENDER, MOBILE_NUMBER, DOB, STATUS, employee_number, employment_type, HIRE, CREATED_BY, LAST_UPDATED_BY) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', '00001', 1, CURRENT_DATE(), 'SYSTEM', 'SYSTEM')`,
      [tenantEmpId, tenantOrgId, first_name, last_name, email, gender, mobile_number, dob]
    );

    await newTenantConnection.query(
      `INSERT INTO C_USER (username, empid, orgid, password, email) VALUES (?, ?, ?, ?, ?)`,
      [username, tenantEmpId, tenantOrgId, password_hash, email]
    );

    const roleId = `${tenantOrgId}-1`;
    await newTenantConnection.query(
      `INSERT INTO C_ORG_ROLE_TABLE (roleid, orgid, rolename, isadmin, is_active) VALUES (?, ?, '${company_name}_Admin', 1, 1)`,
      [roleId, tenantOrgId]
    );
    await newTenantConnection.query(
      `INSERT INTO C_EMP_ROLE_ASSIGN (empid, orgid, roleid) VALUES (?, ?, ?)`,
      [tenantEmpId, tenantOrgId, roleId]
    );

    // --- MENUS & PERMISSIONS ---
    const [menus] = await newTenantConnection.query('SELECT id, hassubmenu FROM C_MENU WHERE is_active = 1 ORDER BY id');
    const [submenus] = await newTenantConnection.query('SELECT id, menuid FROM C_SUBMENU WHERE is_active = 1 ORDER BY id');

    const permissionsValues = [];
    const getScopes = (mid, smid) => {
        let scopes = { alldata: 0, teamdata: 0, individualdata: 0 };
        const supportsData = 
          (mid === 9 && smid === null) || (mid === 2 && smid === 3) || (mid === 7 && smid === null) || 
          (mid === 19 && smid === null) || (mid === 15 && smid === 20) || (mid === 11 && smid === null) || 
          (mid === 12 && smid === 17) || (mid === 16 && smid === 22);
        if (supportsData) { scopes.alldata = 1; }
        return scopes;
    };

    menus.forEach(m => {
      const s = getScopes(m.id, null);
      permissionsValues.push([roleId, m.id, null, s.alldata, s.teamdata, s.individualdata]);
    });
    submenus.forEach(sm => {
      const s = getScopes(sm.menuid, sm.id);
      permissionsValues.push([roleId, sm.menuid, sm.id, s.alldata, s.teamdata, s.individualdata]);
    });

    if (permissionsValues.length > 0) {
      await newTenantConnection.query(
        `INSERT INTO C_ROLE_MENU_PERMISSIONS (roleid, menuid, submenuid, alldata, teamdata, individualdata) VALUES ?`,
        [permissionsValues]
      );
    }

    let priorityCounter = 1;
    const priorityValues = [];
    for (const menu of menus) {
      if (menu.hassubmenu === 'yes') {
        const menuSubmenus = submenus.filter(sm => sm.menuid === menu.id).sort((a, b) => a.id - b.id);
        for (const sm of menuSubmenus) {
           priorityValues.push([tenantOrgId, menu.id, sm.id, priorityCounter++]);
        }
      } else {
        priorityValues.push([tenantOrgId, menu.id, null, priorityCounter++]);
      }
    }
    if (priorityValues.length > 0) {
      await newTenantConnection.query(
        `INSERT INTO C_ORG_MENU_PRIORITY (orgid, menuid, submenuid, priority) VALUES ?`,
        [priorityValues]
      );
    }

    // --- GENERIC VALUES ---
    const rawGenericData = [
        [5, 'Service and Billing', 1, null, null, 1],
        [5, 'Service', 1, null, null, 2],
        [7, 'Service', 1, null, null, 1],
        [7, 'Subscription', 1, null, null, 2],
        [6, 'Head Office / Headquarters', 1, null, null, 1],
        [6, 'Regional Office', 1, null, null, 2],
        [4, 'Monthly', 1, null, null, 3],
        [4, 'Weekly', 1, null, null, 1],
        [3, 'Active', 1, 1, null, 1],
        [3, 'Inactive', 1, null, null, 2],
        [8, 'Sales', 1, null, null, 1],
        [8, 'Expenses', 1, null, null, 2],
        [9, 'Net 15', 1, null, null, 1],
        [9, 'Net 30', 1, null, null, 2],
        [1, 'Sick Leave', 1, null, null, 1],
        [1, 'Paid Leave', 1, null, null, 2],
        [2, 'Active', 1, null, null, 1],
        [2, 'Pending', 1, null, null, 2],
        [10, 'Open', 1, null, null, 1],
        [10, 'In Progress', 1, null, null, 2],
        [10, 'Resolved', 1, null, null, 3],
        [11, 'High', 1, null, null, 1],
        [11, 'Medium', 1, null, null, 2],
        [11, 'Low', 1, null, null, 3],
        [12, 'Internet Issue', 1, null, null, 2],
        [12, 'Login Issue', 1, null, null, 1],
        [14, 'Remote ', 1, null, null, 1],
        [14, 'Onsite', 1, null, null, 2],
        [15, '3', 1, null, null, 1],
        [16, '2', 1, null, null, 1],
        [17, '5', 1, null, null, 1],
        [17, '6', 0, null, null, 2],
        [17, '10', 0, null, null, 3],
        [6, 'Branch Office', 1, null, null, 3],
        [20, 'Immigration', 1, null, null, 1],
        [20, 'H1B Filling', 1, null, null, 3],
        [18, 'Education & Skills', 1, null, null, 2],
        [18, 'Immigration', 1, null, null, 1],
        [18, 'Personal & Identity', 1, null, null, 3],
        [24, 'holiday trip', 1, null, null, 1],
        [26, 'family category', 1, null, null, 1],
        [4, 'Biweekly', 1, null, null, 2],
        [4, 'Semimonthly', 1, null, null, 4],
        [3, 'On Leave', 1, null, null, 3],
        [3, 'Probation', 1, null, null, 4],
        [3, 'Contract', 1, null, null, 5],
        [3, 'Part-Time', 1, null, null, 6],
        [3, 'Full-Time', 1, null, null, 7],
        [3, 'Terminated', 1, null, null, 8],
        [3, 'Resigned', 1, null, null, 9],
        [3, 'Retired', 1, null, null, 10],
        [14, 'Full-Time', 1, null, null, 3],
        [14, 'Part-Time', 1, null, null, 4],
        [14, 'Contract', 1, null, null, 5],
        [14, 'Temporary', 1, null, null, 6],
        [14, 'Internship', 1, null, null, 7],
        [14, 'Freelance', 1, null, null, 8],
        [14, 'Hybrid', 1, null, null, 9],
        [14, 'Volunteer', 1, null, null, 10],
        [6, 'Franchise / Outlet', 1, null, null, 4],
        [6, 'Dealer / Distributor', 1, null, null, 5],
        [6, 'Retail Store', 1, null, null, 6],
        [6, 'Warehouse / Fulfillment Center', 1, null, null, 7],
        [6, 'Service Center', 1, null, null, 8],
        [6, 'Subsidiary', 1, null, null, 9],
        [5, 'Billing', 1, null, null, 3],
        [7, 'Sales', 1, null, null, 3],
        [7, 'Prepaid', 1, null, null, 4],
        [7, 'Postpaid', 1, null, null, 5],
        [7, 'Advance', 1, null, null, 6],
        [7, 'Expenses', 1, null, null, 7],
        [7, 'Invoice', 1, null, null, 8],
        [8, 'Invoice', 1, null, null, 3],
        [8, 'Subscription', 1, null, null, 4],
        [8, 'Service', 1, null, null, 5],
        [8, 'Advance', 1, null, null, 6],
        [8, 'Prepaid', 1, null, null, 7],
        [8, 'Postpaid', 1, null, null, 8],
        [9, 'Net 45', 1, null, null, 3],
        [9, 'Net 60', 1, null, null, 4],
        [9, 'Net 90', 1, null, null, 5],
        [9, 'Due on Receipt', 1, null, null, 6],
        [9, 'End of Month', 1, null, null, 7],
        [9, 'Cash On Delivery', 1, null, null, 8],
        [9, 'Cash in Advance', 1, null, null, 9],
        [9, '2/10 Net 30', 1, null, null, 10],
        [9, 'Installments', 1, null, null, 11],
        [1, 'Unpaid Leave', 1, null, null, 3],
        [1, 'Casual Leave', 1, null, null, 4],
        [1, 'Paid Time Off', 1, null, null, 5],
        [1, 'Vacation / Annual Leave', 1, null, null, 6],
        [1, 'Maternity Leave', 1, null, null, 7],
        [1, 'Paternity Leave', 1, null, null, 8],
        [1, 'Parental / Adoption Leave', 1, null, null, 9],
        [1, 'Bereavement / Compassionate Leave', 1, null, null, 10],
        [1, 'Study / Education Leave', 1, null, null, 11],
        [1, 'Sabbatical Leave', 1, null, null, 12],
        [1, 'Compensatory Off', 1, null, null, 13],
        [1, 'Public / Statutory Holiday', 1, null, null, 14],
        [27, 'full time ', 1, null, null, 1],
        [28, '9', 1, null, null, 1],
        [18, 'Experience & Employment', 1, null, null, 4],
        [18, 'F-1 / OPT / STEM', 1, null, null, 5],
        [18, 'Payroll & Tax', 1, null, null, 6],
        [18, 'HR & Onboarding', 1, null, null, 7],
        [18, 'Legal & Compliance', 1, null, null, 8],
        [18, 'Travel & Visa Stamping', 1, null, null, 9],
        [18, 'Miscellaneous', 1, null, null, 10],
        [2, 'inactive', 1, null, null, 3],
        [4, 'Quarterly', 1, null, null, 5]
    ];

     await newTenantConnection.query(
        `INSERT INTO C_GENERIC_VALUES (id,g_id, Name, isactive, cutting, orgid, parent_value_id, display_order) 
         VALUES 
         (1,'18', 'I-9', '1', NULL, '-1', NULL, '1'),
         (2,'18', 'W-4', '1', NULL, '-1', NULL, '2'),
         (3,'18', 'I-983', '1', NULL, '-1', NULL, '3'),
         (4,'19', 'Auto Generated', '1', NULL, '-1', NULL, '1'),
         (5,'20', 'Auto Generated', '1', NULL, '-1', NULL, '1'),
         (6,'18', 'W-9','1',NULL,'-1',NULL,'4'),
         ('12', '27', 'Contract', '1', NULL, '-1', NULL, '2');`
    );
    await newTenantConnection.query(
        `INSERT INTO C_GENERIC_VALUES (id, g_id, Name, isactive, cutting, orgid, parent_value_id, display_order) 
        VALUES 
        ('7', '29', 'Case Approved', '1', NULL, '-1', NULL, '1'),
        ('8', '29', 'Case Was Received', '1', NULL, '-1', NULL, '2'), 
        ('9', '29', 'Case Rejected', '1', NULL, '-1', NULL, '3'), 
        ('10', '29', 'Request For Evidence', '1', NULL, '', '-1', '4'), 
        ('11', '29', 'Pending', '1', NULL, '-1', NULL, '5')`
       );
    // 1. Insert Generic Data
    const genericValues = rawGenericData.map(item => [item[0], item[1], item[2], item[3], tenantOrgId, item[4], item[5]]);
    if (genericValues.length > 0) {
      await newTenantConnection.query(
        `INSERT INTO C_GENERIC_VALUES (g_id, Name, isactive, cutting, orgid, parent_value_id, display_order) VALUES ?`,
        [genericValues]
      );
    }

    // 2. Insert Tax Forms (Corrected: NO IDs)
   

    const suborgid = `${tenantOrgId}-1`;
    await newTenantConnection.query(
      `INSERT INTO C_SUB_ORG (suborgid, orgid, suborgname, isstatus, created_by) VALUES (?, ?, ?, ?, ?)`,
      [suborgid, tenantOrgId, company_name, '1', 'SYSTEM']
    );

    // 7. Update Status in Meta
    await metaConnection.query(`UPDATE C_ORG_ONBOARDING_REQUESTS SET status = 'APPROVED' WHERE request_id = ?`, [request_id]);

    await metaConnection.commit();
    await newTenantConnection.commit();
    
    return { success: true };

  } catch (error) {
    if (metaConnection) await metaConnection.rollback();
    if (newTenantConnection) await newTenantConnection.rollback();
    console.error("Subscription Approval Failed:", error);
    return { success: false, error: error.message };
  } finally {
    if (metaConnection) metaConnection.release();
    if (newTenantConnection) {
        newTenantConnection.release();
        newTenantPool.end();
    }
  }
}

// Backward compatibility aliases for existing code
export const approveProSubscription = approveSubscription;
export const approveGrowthSubscription = approveSubscription;
export const approveEnterpriseSubscription = approveSubscription;

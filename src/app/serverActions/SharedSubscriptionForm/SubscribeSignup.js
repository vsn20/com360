'use server';

import { MetaDBconnection } from "@/app/utils/config/db"; 
import { createTenantDatabase, addPrivilegedUserToDatabase, allowRemoteAccess } from "@/app/utils/config/cpanelApi"; 
import { cloneDatabaseSchema } from "@/app/utils/config/dbCloner"; 
import { getTenantConnection, getDynamicTenantConnection } from "@/app/utils/config/com360db";
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';
// Added Import for Rate Limiter
import { checkEmailRateLimit } from "@/app/utils/rateLimiter";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create email transporter with optimized settings
function createEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.GMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 10,
  });
}

// 1. Check Organization Name
export async function checkOrgName(orgName) {
  const metaPool = MetaDBconnection(); 
  try {
    const [rows] = await metaPool.query('SELECT org_id FROM C_ORG WHERE LOWER(org_name) = LOWER(?)', [orgName]);
    return { exists: rows.length > 0 };
  } catch (error) { 
    console.error("Error checking org name in Meta:", error);
    return { exists: false, error: "Database error" }; 
  }
}

// 2. Check Email
export async function checkEmail(email) {
  const metaPool = MetaDBconnection(); 
  try {
    const [rows] = await metaPool.query('SELECT emp_id FROM C_EMP WHERE email = ?', [email]);
    return { exists: rows.length > 0 };
  } catch (error) { 
    console.error("Error checking email in Meta:", error);
    return { exists: false, error: "Database error" }; 
  }
}

// 3. Check Username
export async function checkUsername(username) {
  const metaPool = MetaDBconnection(); 
  try {
    const [rows] = await metaPool.query('SELECT username FROM C_EMP WHERE username = ?', [username]);
    return { exists: rows.length > 0 };
  } catch (error) { 
    console.error("Error checking username in Meta:", error);
    return { exists: false, error: "Database error" }; 
  }
}

// 4. Send Signup OTP (WITH RATE LIMITING AND HTML EMAIL)
export async function sendSignupOTP(formData) {
  const email = formData.get('email');
  
  // Rate limit check - 3 attempts per 10 minutes
  const rateCheck = checkEmailRateLimit(email, 3, 600000);
  if (!rateCheck.allowed) {
    return { 
      success: false, 
      error: `Too many OTP requests. Please wait ${rateCheck.waitTime} minutes before trying again.` 
    };
  }
  
  const tenantPool = getTenantConnection();
  
  try {
    await tenantPool.query(`
      CREATE TABLE IF NOT EXISTS C_OTP (
        email VARCHAR(255) PRIMARY KEY, 
        otp VARCHAR(6) NOT NULL, 
        expiry DATETIME NOT NULL
      )
    `);
    
    const [userRows] = await tenantPool.query(`SELECT COUNT(*) AS count FROM C_USER WHERE email=?`, [email]);
    if (userRows[0].count > 0) { 
      await tenantPool.end(); 
      return { success: false, error: "This email is already registered." }; 
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    
    await tenantPool.query(`
      INSERT INTO C_OTP (email, otp, expiry) VALUES (?, ?, ?) 
      ON DUPLICATE KEY UPDATE otp = ?, expiry = ?
    `, [email, otp, expiry, otp, expiry]);
    
    await tenantPool.end(); 
    
    // Send email with delay
    const transporter = createEmailTransporter();
    
    // Add delay to prevent rate limiting issues with SMTP
    await delay(2000);
    
    await transporter.sendMail({ 
      from: `"Com360 Support" <${process.env.GMAIL_USER}>`,
      to: email, 
      subject: 'Your OTP for Signup',
      text: `Your OTP is ${otp}, valid for 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Com360 Signup Verification</h2>
          <p style="font-size: 16px; color: #555;">Your OTP code is:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #666;">This code is valid for <strong>10 minutes</strong>.</p>
          <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `
    });
    
    return { success: true };
    
  } catch (err) {
    console.error('Signup OTP Error:', err);
    if (tenantPool) await tenantPool.end();
    
    if (err.responseCode === 550 || err.code === 'EMESSAGE') {
      return { 
        success: false, 
        error: "Email service temporarily busy. Please wait 2-3 minutes and try again." 
      };
    }
    
    if (err.code === 'EAUTH') {
      return { 
        success: false, 
        error: "Email authentication failed. Please contact support." 
      };
    }
    
    return { success: false, error: "Failed to send OTP email. Please try again later." };
  }
}

export async function initiateSignupOTP(formData) { return await sendSignupOTP(formData); }

export async function validateSignupOTP(formData) {
  const email = formData.get('email');
  const otp = formData.get('otp');
  const tenantPool = getTenantConnection();
  
  try {
    const [rows] = await tenantPool.query('SELECT * FROM C_OTP WHERE email = ? AND otp = ?', [email, otp]);
    await tenantPool.end();
    
    if (rows.length > 0) {
      if (Date.now() > new Date(rows[0].expiry)) {
        return { success: false, error: "OTP has expired" };
      }
      return { success: true };
    }
    return { success: false, error: "Invalid OTP" };
  } catch (e) { 
    if (tenantPool) await tenantPool.end(); 
    console.error("OTP validation error:", e);
    return { success: false, error: "Database error" }; 
  }
}

// 5. Submit Subscription Request
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

// 6. APPROVE SUBSCRIPTION
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

    // --- D. CONNECT TO NEW TENANT DB (Using Helper) ---
    newTenantPool = getDynamicTenantConnection(dbName);

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

    // --- HANDLE LOGO ---
    if (logo_path) {
        try {
            const cleanLogoPath = logo_path.startsWith('/') || logo_path.startsWith('\\') 
                ? logo_path.slice(1) 
                : logo_path;

            const oldPath = path.join(process.cwd(), 'public', cleanLogoPath);
            const newFileName = `${tenantOrgId}.jpg`;
            const newDir = path.join(process.cwd(), 'public/uploads/orglogos');
            const newPath = path.join(newDir, newFileName);

            let sourceExists = false;
            try {
                await fs.access(oldPath);
                sourceExists = true;
            } catch (e) {
                console.warn(`Logo source missing at ${oldPath}. Checking destination...`);
            }

            if (sourceExists) {
                await fs.mkdir(newDir, { recursive: true });
                await fs.rename(oldPath, newPath);
                
                await newTenantConnection.query(
                    'UPDATE C_ORG SET orglogo_url = ?, is_logo_set = 1 WHERE orgid = ?', 
                    [`/uploads/orglogos/${newFileName}`, tenantOrgId]
                );
            } else {
                 try {
                    await fs.access(newPath);
                    await newTenantConnection.query(
                        'UPDATE C_ORG SET orglogo_url = ?, is_logo_set = 1 WHERE orgid = ?', 
                        [`/uploads/orglogos/${newFileName}`, tenantOrgId]
                    );
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

    // --- GENERIC VALUES (Full Set with Explicit IDs) ---
    // [id, g_id, Name, isactive, cutting, parent_value_id, display_order]
    const comprehensiveGenericData = [
        [1, 18, 'I-9', 1, null, null, 1],
        [2, 18, 'W-4', 1, null, null, 2],
        [3, 18, 'I-983', 1, null, null, 3],
        [4, 19, 'Auto Generated', 1, null, null, 1],
        [5, 20, 'Auto Generated', 1, null, null, 1],
        [6, 39, 'W-9', 1, null, null, 4],
        [7, 29, 'Case Approved', 1, null, null, 1],
        [8, 29, 'Case Was Received', 1, null, null, 2],
        [9, 29, 'Case Rejected', 1, null, null, 3],
        [10, 29, 'Request For Evidence', 1, null, null, 4],
        [11, 29, 'Pending', 1, null, null, 5],
        [12, 27, 'Contract', 1, null, null, 2],
        [13, 27, '1099', 1, null, null, 3],
        [26, 5, 'Service and Billing', 1, null, null, 1],
        [27, 5, 'Service', 1, null, null, 2],
        [28, 7, 'Service', 1, null, null, 1],
        [29, 7, 'Subscription', 1, null, null, 2],
        [30, 6, 'Head Office / Headquarters', 1, null, null, 1],
        [31, 6, 'Regional Office', 1, null, null, 2],
        [32, 4, 'Monthly', 1, null, null, 3],
        [33, 4, 'Weekly', 1, null, null, 1],
        [34, 3, 'Active', 1, 1, null, 1],
        [35, 3, 'Inactive', 1, null, null, 2],
        [36, 8, 'Sales', 1, null, null, 1],
        [37, 8, 'Expenses', 1, null, null, 2],
        [38, 9, 'Net 15', 1, null, null, 1],
        [39, 9, 'Net 30', 1, null, null, 2],
        [40, 1, 'Sick Leave', 1, null, null, 1],
        [41, 1, 'Paid Leave', 1, null, null, 2],
        [42, 2, 'Active', 1, null, null, 1],
        [43, 2, 'Pending', 1, null, null, 2],
        [44, 10, 'Open', 1, null, null, 1],
        [45, 10, 'In Progress', 1, null, null, 2],
        [46, 10, 'Resolved', 1, null, null, 3],
        [47, 11, 'High', 1, null, null, 1],
        [48, 11, 'Medium', 1, null, null, 2],
        [49, 11, 'Low', 1, null, null, 3],
        [50, 12, 'Internet Issue', 1, null, null, 2],
        [51, 12, 'Login Issue', 1, null, null, 1],
        [52, 13, 'Password Issue', 1, null, 51, 2],
        [53, 13, 'Menu Issue', 1, null, 51, 1],
        [54, 14, 'Remote ', 1, null, null, 1],
        [55, 14, 'Onsite', 1, null, null, 2],
        [56, 15, '3', 1, null, null, 1],
        [57, 16, '2', 1, null, null, 1],
        [58, 17, '5', 1, null, null, 1],
        [59, 17, '6', 0, null, null, 2],
        [60, 17, '10', 0, null, null, 3],
        [61, 6, 'Branch Office', 1, null, null, 3],
        [62, 20, 'Immigration', 1, null, null, 1],
        [63, 20, 'auto generated', 1, null, null, 2],
        [64, 20, 'H1B Filling', 1, null, null, 3],
        [65, 3, 'Contract', 1, null, null, 5],
        [66, 18, 'Immigration', 1, null, null, 1],
        [67, 18, 'Personal & Identity', 1, null, null, 3],
        [68, 19, 'auto generated', 1, null, 135, 1],
        [69, 19, 'Immigration Check Point2', 1, null, 66, 1],
        [70, 24, 'holiday trip', 1, null, null, 1],
        [71, 25, 'family trip', 1, null, 70, 1],
        [72, 26, 'family category', 1, null, null, 1],
        [73, 4, 'Biweekly', 1, null, null, 2],
        [74, 4, 'Semimonthly', 1, null, null, 4],
        [75, 3, 'On Leave', 1, null, null, 3],
        [76, 3, 'Probation', 1, null, null, 4],
        [78, 3, 'Part-Time', 1, null, null, 6],
        [79, 3, 'Full-Time', 1, null, null, 7],
        [80, 3, 'Terminated', 1, null, null, 8],
        [81, 3, 'Resigned', 1, null, null, 9],
        [82, 3, 'Retired', 1, null, null, 10],
        [83, 14, 'Full-Time', 1, null, null, 3],
        [84, 14, 'Part-Time', 1, null, null, 4],
        [85, 14, 'Contract', 1, null, null, 5],
        [86, 14, 'Temporary', 1, null, null, 6],
        [87, 14, 'Internship', 1, null, null, 7],
        [88, 14, 'Freelance', 1, null, null, 8],
        [89, 14, 'Hybrid', 1, null, null, 9],
        [90, 14, 'Volunteer', 1, null, null, 10],
        [91, 6, 'Franchise / Outlet', 1, null, null, 4],
        [92, 6, 'Dealer / Distributor', 1, null, null, 5],
        [93, 6, 'Retail Store', 1, null, null, 6],
        [94, 6, 'Warehouse / Fulfillment Center', 1, null, null, 7],
        [95, 6, 'Service Center', 1, null, null, 8],
        [96, 6, 'Subsidiary', 1, null, null, 9],
        [97, 5, 'Billing', 1, null, null, 3],
        [98, 7, 'Sales', 1, null, null, 3],
        [99, 7, 'Prepaid', 1, null, null, 4],
        [100, 7, 'Postpaid', 1, null, null, 5],
        [101, 7, 'Advance', 1, null, null, 6],
        [102, 7, 'Expenses', 1, null, null, 7],
        [103, 7, 'Invoice', 1, null, null, 8],
        [104, 8, 'Invoice', 1, null, null, 3],
        [105, 8, 'Subscription', 1, null, null, 4],
        [106, 8, 'Service', 1, null, null, 5],
        [107, 8, 'Advance', 1, null, null, 6],
        [108, 8, 'Prepaid', 1, null, null, 7],
        [109, 8, 'Postpaid', 1, null, null, 8],
        [110, 9, 'Net 45', 1, null, null, 3],
        [111, 9, 'Net 60', 1, null, null, 4],
        [112, 9, 'Net 90', 1, null, null, 5],
        [113, 9, 'Due on Receipt', 1, null, null, 6],
        [114, 9, 'End of Month', 1, null, null, 7],
        [115, 9, 'Cash On Delivery', 1, null, null, 8],
        [116, 9, 'Cash in Advance', 1, null, null, 9],
        [117, 9, '2/10 Net 30', 1, null, null, 10],
        [118, 9, 'Installments', 1, null, null, 11],
        [119, 1, 'Unpaid Leave', 1, null, null, 3],
        [120, 1, 'Casual Leave', 1, null, null, 4],
        [121, 1, 'Paid Time Off', 1, null, null, 5],
        [122, 1, 'Vacation / Annual Leave', 1, null, null, 6],
        [123, 1, 'Maternity Leave', 1, null, null, 7],
        [124, 1, 'Paternity Leave', 1, null, null, 8],
        [125, 1, 'Parental / Adoption Leave', 1, null, null, 9],
        [126, 1, 'Bereavement / Compassionate Leave', 1, null, null, 10],
        [127, 1, 'Study / Education Leave', 1, null, null, 11],
        [128, 1, 'Sabbatical Leave', 1, null, null, 12],
        [129, 1, 'Compensatory Off', 1, null, null, 13],
        [130, 1, 'Public / Statutory Holiday', 1, null, null, 14],
        [131, 27, 'Full Time', 1, null, null, 1],
        [134, 28, '9', 1, null, null, 1],
        [135, 18, 'Experience & Employment', 1, null, null, 4],
        [136, 18, 'F-1 / OPT / STEM', 1, null, null, 5],
        [137, 18, 'Payroll & Tax', 1, null, null, 6],
        [138, 18, 'HR & Onboarding', 1, null, null, 7],
        [139, 18, 'Legal & Compliance', 1, null, null, 8],
        [140, 18, 'Travel & Visa Stamping', 1, null, null, 9],
        [141, 18, 'Miscellaneous', 1, null, null, 10],
        [142, 19, 'Medical', 1, null, 140, 3],
        [143, 2, 'inactive', 1, null, null, 3],
        [144, 4, 'Quarterly', 1, null, null, 5],
        [270, 39, 'Articles of Incorporation', 1, null, null, 1],
        [271, 40, 'Financial Services & Banking', 1, null, null, 1],
        [400, 18, 'Education & Skills', 1, null, null, 2],
        [404, 27, 'Part Time', 1, null, null, 4],
        [405, 27, 'Volunteer', 1, null, null, 5],
        [406, 32, 'Expected Role-1', 1, null, null, 1],
        [407, 41, '1-25', 1, null, null, 1],
        [408, 41, '26-50', 1, null, null, 2],
        [409, 41, '51-100', 1, null, null, 3],
        [410, 41, '101-500', 1, null, null, 4],
        [411, 41, '501-1000', 1, null, null, 5],
        [412, 41, '1001+', 1, null, null, 6],
        [413, 42, 'Gold', 1, null, null, 1],
        [414, 42, 'Silver', 1, null, null, 2],
        [415, 42, 'Bronze', 1, null, null, 3],
        [416, 40, 'Healthcare & Life Sciences', 1, null, null, 2],
        [417, 40, 'Retail & E-Commerce', 1, null, null, 3],
        [418, 40, 'Manufacturing & Industrial', 1, null, null, 4],
        [419, 40, 'Logistics, Transportation & Supply Chain', 1, null, null, 5],
        [420, 40, 'Telecom & Media', 1, null, null, 6],
        [421, 40, 'Education & E-Learning', 1, null, null, 7],
        [422, 40, 'Government & Public Sector', 1, null, null, 8],
        [423, 40, 'Energy, Utilities & Oil/Gas', 1, null, null, 9],
        [424, 40, 'Real Estate & PropTech', 1, null, null, 10],
        [425, 40, 'Travel, Hospitality & Tourism', 1, null, null, 11],
        [426, 40, 'Media, Entertainment & Gaming', 1, null, null, 12],
        [427, 40, 'Marketing, AdTech & MarTech', 1, null, null, 13],
        [428, 40, 'Professional Services', 1, null, null, 14],
        [429, 40, 'HRTech & Workforce Management', 1, null, null, 15],
        [430, 40, 'AI, Data & Analytics Platforms (Horizontal, cross-vertical)', 1, null, null, 16],
        [431, 40, 'Infrastructure, Cloud & DevOps', 1, null, null, 17],
        [432, 40, 'IT Staffing & Consulting', 1, null, null, 18],
        [433, 4, 'Daily', 1, null, null, 6],
        [434, 30, 'H1B', 1, null, null, 1],
        [435, 30, 'F1 / OPT / STEM OPT', 1, null, null, 2],
        [436, 30, 'EAD', 1, null, null, 3],
        [437, 30, 'Green Card', 1, null, null, 4],
        [438, 30, 'Dependent Visas', 1, null, null, 5],
        [439, 30, 'L1/L2', 1, null, null, 6],
        [440, 30, 'Citizenship', 1, null, null, 7],
        [441, 30, 'Compliance / Verification', 1, null, null, 8],
        [442, 30, 'General / Identity', 1, null, null, 9],
        [443, 33, 'LCA', 1, null, null, 1],
        [444, 33, 'Wage', 1, null, null, 2],
        [445, 33, 'Prevailing Wage', 1, null, null, 3],
        [446, 33, 'Employer Information', 1, null, null, 4],
        [447, 33, 'Position / Job Info', 1, null, null, 5],
        [448, 33, 'Notice of Filing', 1, null, null, 6],
        [449, 33, 'Benefits & Working Conditions', 1, null, null, 7],
        [450, 33, 'Dependency / Willful Violator', 1, null, null, 8],
        [451, 33, 'Worksite / Location', 1, null, null, 9],
        [452, 33, 'USCIS Notices', 1, null, null, 10],
        [453, 33, 'Employee Info', 1, null, null, 11],
        [454, 33, 'Misc / Audit Trail', 1, null, null, 12],
        [455, 34, 'Employer Profile', 1, null, null, 1],
        [456, 34, 'Petition Filings', 1, null, null, 2],
        [457, 34, 'Job Role', 1, null, null, 3],
        [458, 34, 'Wage / Payroll', 1, null, null, 4],
        [459, 34, 'Work site', 1, null, null, 5],
        [460, 34, 'Employee Info', 1, null, null, 6],
        [461, 34, 'PAF', 1, null, null, 7],
        [462, 34, 'Prewailing Wage', 1, null, null, 8],
        [463, 34, 'LCA Postings', 1, null, null, 9],
        [464, 34, 'Client / Vendor', 1, null, null, 10],
        [465, 34, 'Interview Prep', 1, null, null, 11],
        [466, 34, 'Correspondence', 1, null, null, 12],
        [467, 34, 'Misc', 1, null, null, 13],
        [468, 31, 'LCA (ETA-9035)', 1, null, 434, 1],
        [469, 31, 'I-129 Petition', 1, null, 434, 2],
        [470, 31, 'USCIS Receipt (I-797C)', 1, null, 434, 3],
        [471, 31, 'Approval Notice (I-797A/B)', 1, null, 434, 4],
        [472, 31, 'RFE Notice', 1, null, 434, 5],
        [473, 31, 'RFE Response', 1, null, 434, 6],
        [474, 31, 'Denial / Withdrawal Notice', 1, null, 434, 7],
        [475, 31, 'Amendment Petition', 1, null, 434, 8],
        [476, 31, 'Extension Petition', 1, null, 434, 9],
        [477, 31, 'Transfer Petition', 1, null, 434, 10],
        [478, 31, 'H1B Visa Stamp', 1, null, 434, 11],
        [479, 31, 'Passport ID Page', 1, null, 434, 12],
        [480, 31, 'I-94', 1, null, 434, 13],
        [481, 31, 'Offer / Client Letter', 1, null, 434, 14],
        [482, 31, 'End Client Letter', 1, null, 434, 15],
        [483, 31, 'Support Letter', 1, null, 434, 16],
        [484, 31, 'SOC / Wage Level Doc', 1, null, 434, 17],
        [485, 31, 'Public Access File (PAF)', 1, null, 434, 18],
        [486, 31, 'FDNS Site Visit Docs', 1, null, 434, 19],
        [487, 31, 'I-20', 1, null, 435, 1],
        [488, 31, 'OPT EAD Card', 1, null, 435, 2],
        [489, 31, 'STEM OPT I-20', 1, null, 435, 3],
        [490, 31, 'STEM OPT I-983 Training Plan', 1, null, 435, 4],
        [491, 31, 'SEVP Portal Screenshot', 1, null, 435, 5],
        [492, 31, 'OPT Receipt', 1, null, 435, 6],
        [493, 31, 'OPT Approval', 1, null, 435, 7],
        [494, 31, 'Employment Offer Letter', 1, null, 435, 8],
        [495, 31, 'Employer Letter', 1, null, 435, 9],
        [496, 31, 'Pay Stubs', 1, null, 435, 10],
        [497, 31, 'Evaluation (12/24 Month)', 1, null, 435, 11],
        [498, 31, 'Travel Endorsement', 1, null, 435, 12],
        [499, 31, 'Passport', 1, null, 435, 13],
        [500, 31, 'Visa Stamp', 1, null, 435, 14],
        [501, 31, 'I-94', 1, null, 435, 15],
        [502, 31, 'I-765 Application', 1, null, 436, 1],
        [503, 31, 'Receipt Notice', 1, null, 436, 2],
        [504, 31, 'Approval Notice', 1, null, 436, 3],
        [505, 31, 'EAD Card (Front)', 1, null, 436, 4],
        [506, 31, 'EAD Card (Back)', 1, null, 436, 5],
        [507, 31, 'Renewal Application', 1, null, 436, 6],
        [508, 31, 'Category Proof (e.g., C09, A12)', 1, null, 436, 7],
        [509, 31, 'I-797 Notice', 1, null, 436, 8],
        [510, 31, 'H4 EAD', 1, null, 438, 1],
        [511, 31, 'H4 I-539', 1, null, 438, 2],
        [512, 31, 'H4 Approval', 1, null, 438, 3],
        [513, 31, 'H4 EAD Card', 1, null, 438, 4],
        [514, 31, 'L2 EAD', 1, null, 438, 5],
        [515, 31, 'L2 Approval', 1, null, 438, 6],
        [516, 31, 'Spouse Passport/Visa', 1, null, 438, 7],
        [517, 31, 'Marriage Certificate', 1, null, 438, 8],
        [518, 31, 'Child Birth Certificate', 1, null, 438, 9],
        [519, 31, 'Prevailing Wage Request (PWD)', 1, null, 437, 1],
        [520, 31, 'PWD Approval', 1, null, 437, 2],
        [521, 31, 'Recruitment Report', 1, null, 437, 3],
        [522, 31, 'Ads / Posting Proof', 1, null, 437, 4],
        [523, 31, 'ETA-9089 (PERM)', 1, null, 437, 5],
        [524, 31, 'PERM Approval', 1, null, 437, 6],
        [525, 31, 'I-140 Petition', 1, null, 437, 7],
        [526, 31, 'I-140 Receipt', 1, null, 437, 8],
        [527, 31, 'I-140 Approval', 1, null, 437, 9],
        [528, 31, 'RFE / Response', 1, null, 437, 10],
        [529, 31, 'I-485 Application', 1, null, 437, 11],
        [530, 31, 'Medical (I-693)', 1, null, 437, 12],
        [531, 31, 'Biometrics Notice', 1, null, 437, 13],
        [532, 31, 'Interview Notice', 1, null, 437, 14],
        [533, 31, 'Approval (Green Card)', 1, null, 437, 15],
        [534, 31, 'Combo Card (EAD/AP)', 1, null, 437, 16],
        [535, 31, 'Priority Date Proof', 1, null, 437, 17],
        [536, 31, 'Birth Certificate', 1, null, 437, 18],
        [537, 31, 'Marriage Certificate', 1, null, 437, 19],
        [538, 31, 'Passport', 1, null, 437, 20],
        [539, 31, 'I-94', 1, null, 437, 21],
        [540, 31, 'LCA (if applicable)', 1, null, 439, 1],
        [541, 31, 'I-129 Petition', 1, null, 439, 2],
        [542, 31, 'Blanket Petition', 1, null, 439, 3],
        [543, 31, 'Approval Notice', 1, null, 439, 4],
        [544, 31, 'Visa Stamp', 1, null, 439, 5],
        [545, 31, 'I-94', 1, null, 439, 6],
        [546, 31, 'Support Letter', 1, null, 439, 7],
        [547, 31, 'Employer Letter', 1, null, 439, 8],
        [548, 31, 'N-400 Application', 1, null, 440, 1],
        [549, 31, 'Receipt Notice', 1, null, 440, 2],
        [550, 31, 'Biometrics Notice', 1, null, 440, 3],
        [551, 31, 'Interview Notice', 1, null, 440, 4],
        [552, 31, 'Civics Test Result', 1, null, 440, 5],
        [553, 31, 'Oath Ceremony Notice', 1, null, 440, 6],
        [554, 31, 'Naturalization Certificate', 1, null, 440, 7],
        [555, 31, 'Green Card Copy', 1, null, 440, 8],
        [556, 31, 'Passport Photos', 1, null, 440, 9],
        [557, 31, 'I-9 Form', 1, null, 441, 1],
        [558, 31, 'E-Verify Case', 1, null, 441, 2],
        [559, 31, 'SSA Verification', 1, null, 441, 3],
        [560, 31, 'Passport', 1, null, 441, 4],
        [561, 31, 'DL / State ID', 1, null, 441, 5],
        [562, 31, 'Work Authorization Proof', 1, null, 441, 6],
        [563, 31, 'Reverification Docs', 1, null, 441, 7],
        [564, 31, 'Passport', 1, null, 442, 1],
        [565, 31, 'Visa Stamp', 1, null, 442, 2],
        [566, 31, 'I-94', 1, null, 442, 3],
        [567, 31, 'SSN Card', 1, null, 442, 4],
        [568, 31, 'Birth Certificate', 1, null, 442, 5],
        [569, 31, 'Marriage Certificate', 1, null, 442, 6],
        [570, 31, 'Divorce Decree', 1, null, 442, 7],
        [571, 31, 'Address Proof', 1, null, 442, 8],
        [572, 31, 'Resume', 1, null, 442, 9],
        [573, 31, 'Degree Certificates', 1, null, 442, 10],
        [574, 31, 'Transcripts', 1, null, 442, 11],
        [575, 31, 'Experience Letters', 1, null, 442, 12],
        [576, 35, 'Certified LCA (ETA-9035/9035E)', 1, null, 443, 1],
        [577, 35, 'Signed LCA', 1, null, 443, 2],
        [578, 35, 'LCA Cover Page', 1, null, 443, 3],
        [579, 35, 'LCA Posting Notice', 1, null, 443, 4],
        [580, 35, 'Posting Locations Proof', 1, null, 443, 5],
        [581, 35, 'Posting Dates Evidence', 1, null, 443, 6],
        [582, 35, 'LCA Withdrawal (if any)', 1, null, 443, 7],
        [583, 35, 'LCA Denial/Correction', 1, null, 443, 8],
        [584, 35, 'Offered Wage Statement', 1, null, 444, 1],
        [585, 35, 'Wage Rate Explanation', 1, null, 444, 2],
        [586, 35, 'Payroll Summary (H-1B worker)', 1, null, 444, 3],
        [587, 35, 'Pay Stubs (Sample)', 1, null, 444, 4],
        [588, 35, 'W-2 (Redacted)', 1, null, 444, 5],
        [589, 35, 'Salary Revision History', 1, null, 444, 6],
        [590, 35, 'Annual Wage Increase Proof', 1, null, 444, 7],
        [591, 35, 'Benching Policy Statement', 1, null, 444, 8],
        [592, 35, 'Benefits Summary', 1, null, 449, 1],
        [593, 35, 'Benefits Eligibility Policy', 1, null, 449, 2],
        [594, 35, 'H-1B vs US Worker Benefits Comparison', 1, null, 449, 3],
        [595, 35, 'Leave Policy', 1, null, 449, 4],
        [596, 35, 'Holiday Policy', 1, null, 449, 5],
        [597, 35, 'Insurance Benefits Summary', 1, null, 449, 6],
        [598, 35, 'Equal Benefits Statement', 1, null, 449, 7],
        [599, 35, 'H-1B Dependency Calculation', 1, null, 450, 1],
        [600, 35, 'Employee Count Sheet', 1, null, 450, 2],
        [601, 35, 'Exempt H-1B Proof', 1, null, 450, 3],
        [602, 35, 'Willful Violator Attestation', 1, null, 450, 4],
        [603, 35, 'Recruitment Summary (if required)', 1, null, 450, 5],
        [604, 35, 'Non-Displacement Attestation', 1, null, 450, 6],
        [605, 35, 'US Worker Recruitment Proof', 1, null, 450, 7],
        [606, 35, 'Prevailing Wage Determination', 1, null, 445, 1],
        [607, 35, 'Wage Source Printout (FLC/OFLC)', 1, null, 445, 2],
        [608, 35, 'Wage Level Explanation', 1, null, 445, 3],
        [609, 35, 'SOC Code Explanation', 1, null, 445, 4],
        [610, 35, 'Skill Level Justification', 1, null, 445, 5],
        [611, 35, 'Alternate Wage Survey (if used)', 1, null, 445, 6],
        [612, 35, 'Survey Methodology', 1, null, 445, 7],
        [613, 35, 'Employer Attestation on Survey', 1, null, 445, 8],
        [614, 35, 'FEIN Proof (IRS Letter CP-575)', 1, null, 446, 1],
        [615, 35, 'Business License', 1, null, 446, 2],
        [616, 35, 'Articles of Incorporation', 1, null, 446, 3],
        [617, 35, 'Company Profile', 1, null, 446, 4],
        [618, 35, 'Employer Support Letter', 1, null, 446, 5],
        [619, 35, 'Company Brochure', 1, null, 446, 6],
        [620, 35, 'Website Screenshot', 1, null, 446, 7],
        [621, 35, 'Organizational Chart', 1, null, 446, 8],
        [622, 35, 'Worksite Address Proof', 1, null, 451, 1],
        [623, 35, 'Client Location Letter', 1, null, 451, 2],
        [624, 35, 'MSA Explanation', 1, null, 451, 3],
        [625, 35, 'Short-Term Placement Memo', 1, null, 451, 4],
        [626, 35, 'Itinerary of Services', 1, null, 451, 5],
        [627, 35, 'Multiple Worksite List', 1, null, 451, 6],
        [628, 35, 'Telecommuting Policy', 1, null, 451, 7],
        [629, 35, 'I-129 Petition Copy', 1, null, 452, 1],
        [630, 35, 'USCIS Receipt (I-797C)', 1, null, 452, 2],
        [631, 35, 'Approval Notice (I-797A/B)', 1, null, 452, 3],
        [632, 35, 'RFE Notice (Redacted)', 1, null, 452, 4],
        [633, 35, 'RFE Response (Redacted)', 1, null, 452, 5],
        [634, 35, 'Job Description', 1, null, 447, 1],
        [635, 35, 'SOC Code Assignment', 1, null, 447, 2],
        [636, 35, 'Job Duties Breakdown', 1, null, 447, 3],
        [637, 35, 'Minimum Requirements', 1, null, 447, 4],
        [638, 35, 'Degree Requirement Justification', 1, null, 447, 5],
        [639, 35, 'Work Location Details', 1, null, 447, 6],
        [640, 35, 'End Client Letter (if applicable)', 1, null, 447, 7],
        [641, 35, 'In-house Project Description', 1, null, 447, 8],
        [642, 35, 'Internal Posting Notice', 1, null, 448, 1],
        [643, 35, 'External Posting Notice', 1, null, 448, 2],
        [644, 35, 'Email Notice to Employees', 1, null, 448, 3],
        [645, 35, 'Union Notice (if applicable)', 1, null, 448, 4],
        [646, 35, 'Posting Acknowledgement', 1, null, 448, 5],
        [647, 35, 'Notice Dates Log', 1, null, 448, 6],
        [648, 35, 'Notice Location Photos', 1, null, 448, 7],
        [649, 35, 'Employee Offer Letter', 1, null, 453, 1],
        [650, 35, 'Redacted Resume', 1, null, 453, 2],
        [651, 35, 'Degree Certificates', 1, null, 453, 3],
        [652, 35, 'Experience Letters', 1, null, 453, 4],
        [653, 35, 'Passport ID (Redacted)', 1, null, 453, 5],
        [654, 35, 'I-94 (Redacted)', 1, null, 453, 6],
        [655, 35, 'PAF Index Sheet', 1, null, 454, 1],
        [656, 35, 'PAF Cover Letter', 1, null, 454, 2],
        [657, 35, 'Audit Response Letters', 1, null, 454, 3],
        [658, 35, 'DOL Correspondence', 1, null, 454, 4],
        [659, 35, 'Notes & Memos', 1, null, 454, 5],
        [660, 35, 'Internal Review Checklist', 1, null, 454, 6],
        [661, 35, 'PAF Closure Memo', 1, null, 454, 7],
        [662, 36, 'Articles of Incorporation', 1, null, 455, 1],
        [663, 36, 'Business License', 1, null, 455, 2],
        [664, 36, 'IRS EIN Letter (CP-575)', 1, null, 455, 3],
        [665, 36, 'Company Profile / Overview', 1, null, 455, 4],
        [666, 36, 'Org Chart', 1, null, 455, 5],
        [667, 36, 'Office Lease Agreement', 1, null, 455, 6],
        [668, 36, 'Utility Bill', 1, null, 455, 7],
        [669, 36, 'Photos of Office Premises', 1, null, 455, 8],
        [670, 36, 'Website Screenshot', 1, null, 455, 9],
        [671, 36, 'Recent Tax Return (Redacted)', 1, null, 455, 10],
        [672, 36, 'I-129 Petition Copy', 1, null, 456, 1],
        [673, 36, 'LCA (ETA-9035)', 1, null, 456, 2],
        [674, 36, 'USCIS Receipt (I-797C)', 1, null, 456, 3],
        [675, 36, 'Approval Notice (I-797A/B)', 1, null, 456, 4],
        [676, 36, 'RFE Notice', 1, null, 456, 5],
        [677, 36, 'RFE Response', 1, null, 456, 6],
        [678, 36, 'Amendment Petition', 1, null, 456, 7],
        [679, 36, 'Extension Petition', 1, null, 456, 8],
        [680, 36, 'Withdrawal Letter (if any)', 1, null, 456, 9],
        [681, 36, 'Job Description', 1, null, 457, 1],
        [682, 36, 'Job Duties Breakdown', 1, null, 457, 2],
        [683, 36, 'SOC Code Assignment', 1, null, 457, 3],
        [684, 36, 'Wage Level Explanation', 1, null, 457, 4],
        [685, 36, 'Minimum Requirements', 1, null, 457, 5],
        [686, 36, 'Degree Requirement Justification', 1, null, 457, 6],
        [687, 36, 'Offer Letter', 1, null, 457, 7],
        [688, 36, 'Employment Agreement', 1, null, 457, 8],
        [689, 36, 'Internal Project Description', 1, null, 457, 9],
        [690, 36, 'End-Client Letter (if applicable)', 1, null, 457, 10],
        [691, 36, 'Offered Wage Statement', 1, null, 458, 1],
        [692, 36, 'Payroll Summary', 1, null, 458, 2],
        [693, 36, 'Last 3–6 Pay Stubs', 1, null, 458, 3],
        [694, 36, 'W-2 (Redacted)', 1, null, 458, 4],
        [695, 36, 'Pay Rate Change History', 1, null, 458, 5],
        [696, 36, 'Benching Policy', 1, null, 458, 6],
        [697, 36, 'Bonus / Variable Pay Explanation', 1, null, 458, 7],
        [698, 36, 'Timesheets', 1, null, 458, 8],
        [699, 36, 'Bank Deposit Proof (Redacted)', 1, null, 458, 9],
        [700, 36, 'Worksite Address Proof', 1, null, 459, 1],
        [701, 36, 'Client Location Letter', 1, null, 459, 2],
        [702, 36, 'Itinerary of Services', 1, null, 459, 3],
        [703, 36, 'Multiple Worksite List', 1, null, 459, 4],
        [704, 36, 'Remote Work Policy', 1, null, 459, 5],
        [705, 36, 'Home Office Address Proof (if remote)', 1, null, 459, 6],
        [706, 36, 'Photos of Worksite', 1, null, 459, 7],
        [707, 36, 'Badge / Access Card Copy', 1, null, 459, 8],
        [708, 36, 'Visitor Log (if on site)', 1, null, 459, 9],
        [709, 36, 'Passport Bio Page', 1, null, 460, 1],
        [710, 36, 'H-1B Visa Stamp', 1, null, 460, 2],
        [711, 36, 'I-94 Record', 1, null, 460, 3],
        [712, 36, 'Resume', 1, null, 460, 4],
        [713, 36, 'Degree Certificates', 1, null, 460, 5],
        [714, 36, 'Transcripts', 1, null, 460, 6],
        [715, 36, 'Experience Letters', 1, null, 460, 7],
        [716, 36, 'SSN Card (Redacted)', 1, null, 460, 8],
        [717, 36, 'US Address Proof', 1, null, 460, 9],
        [718, 36, 'Emergency Contact Form', 1, null, 460, 10],
        [719, 36, 'Public Access File Snapshot', 1, null, 461, 1],
        [720, 36, 'PAF Index', 1, null, 461, 2],
        [721, 36, 'Certified LCA Copy', 1, null, 461, 3],
        [722, 36, 'Wage Statement in PAF', 1, null, 461, 4],
        [723, 36, 'Benefits Summary', 1, null, 461, 5],
        [724, 36, 'Prevailing Wage Proof', 1, null, 461, 6],
        [725, 36, 'Dependency Attestation', 1, null, 461, 7],
        [726, 36, 'PAF Cover Sheet', 1, null, 461, 8],
        [727, 36, 'Prevailing Wage Determination', 1, null, 462, 1],
        [728, 36, 'FLC Wage Data Printout', 1, null, 462, 2],
        [729, 36, 'SOC Code Justification', 1, null, 462, 3],
        [730, 36, 'Wage Survey (if used)', 1, null, 462, 4],
        [731, 36, 'Survey Methodology', 1, null, 462, 5],
        [732, 36, 'Employer Attestation on Survey', 1, null, 462, 6],
        [733, 36, 'Wage Comparison Sheet', 1, null, 462, 7],
        [734, 36, 'LCA Posting Notices', 1, null, 463, 1],
        [735, 36, 'Posting Location Photos', 1, null, 463, 2],
        [736, 36, 'Posting Dates Log', 1, null, 463, 3],
        [737, 36, 'Email Notice to Employees', 1, null, 463, 4],
        [738, 36, 'Union Notice (if applicable)', 1, null, 463, 5],
        [739, 36, 'Posting Acknowledgement', 1, null, 463, 6],
        [740, 36, 'Master Service Agreement (MSA)', 1, null, 464, 1],
        [741, 36, 'Statement of Work (SOW)', 1, null, 464, 2],
        [742, 36, 'End Client Letter', 1, null, 464, 3],
        [743, 36, 'Vendor Letter', 1, null, 464, 4],
        [744, 36, 'Client Contact Details', 1, null, 464, 5],
        [745, 36, 'Work Order', 1, null, 464, 6],
        [746, 36, 'Purchase Order', 1, null, 464, 7],
        [747, 36, 'Client Org Chart (if available)', 1, null, 464, 8],
        [748, 36, 'Manager Interview Q&A Sheet', 1, null, 465, 1],
        [749, 36, 'Employee Interview Q&A Sheet', 1, null, 465, 2],
        [750, 36, 'Job Duties Talking Points', 1, null, 465, 3],
        [751, 36, 'Company Overview Sheet', 1, null, 465, 4],
        [752, 36, 'Worksite Directions', 1, null, 465, 5],
        [753, 36, 'Compliance Checklist', 1, null, 465, 6],
        [754, 36, 'Internal Notes', 1, null, 465, 7],
        [755, 36, 'FDNS Visit Notice', 1, null, 466, 1],
        [756, 36, 'Business Card of Officer', 1, null, 466, 2],
        [757, 36, 'Follow-up Email', 1, null, 466, 3],
        [758, 36, 'Document Request Letter', 1, null, 466, 4],
        [759, 36, 'Response Package', 1, null, 466, 5],
        [760, 36, 'Delivery Proof', 1, null, 466, 6],
        [761, 36, 'Case Notes', 1, null, 466, 7],
        [762, 36, 'Internal Audit Report', 1, null, 467, 1],
        [763, 36, 'Compliance Memo', 1, null, 467, 2],
        [764, 36, 'Risk Assessment', 1, null, 467, 3],
        [765, 36, 'Attorney Notes', 1, null, 467, 4],
        [766, 36, 'Chronology of Events', 1, null, 467, 5],
        [767, 36, 'Case Summary Sheet', 1, null, 467, 6],
        [768, 39, 'Articles of Incorporation', 1, null, null, 1],
        [769, 39, 'Business License', 1, null, null, 2],
        [770, 39, 'Company Brochure', 1, null, null, 3],
        [771, 39, 'Company Profile', 1, null, null, 4],
        [772, 39, 'Company Profile / Overview', 1, null, null, 5],
        [773, 39, 'Employer Support Letter', 1, null, null, 6],
        [774, 39, 'FEIN Proof (IRS Letter CP-575)', 1, null, null, 7],
        [775, 39, 'Office Lease Agreement', 1, null, null, 8],
        [776, 39, 'Org Chart', 1, null, null, 9],
        [777, 39, 'Organizational Chart', 1, null, null, 10],
        [778, 39, 'Photos of Office Premises', 1, null, null, 11],
        [779, 39, 'Recent Tax Return (Redacted)', 1, null, null, 12],
        [780, 39, 'Utility Bill', 1, null, null, 13],
        [781, 39, 'Website Screenshot', 1, null, null, 14]
    ];

    const genericValues = comprehensiveGenericData.map(item => [
        item[0], // id
        item[1], // g_id
        item[2], // Name
        item[3], // isactive
        item[4], // cutting
        tenantOrgId, // orgid (dynamic replacement)
        item[5], // parent_value_id
        item[6]  // display_order
    ]);

    if (genericValues.length > 0) {
      await newTenantConnection.query(
        `INSERT INTO C_GENERIC_VALUES (id, g_id, Name, isactive, cutting, orgid, parent_value_id, display_order) VALUES ?`,
        [genericValues]
      );
    }

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

export const approveProSubscription = approveSubscription;
export const approveGrowthSubscription = approveSubscription;
export const approveEnterpriseSubscription = approveSubscription;
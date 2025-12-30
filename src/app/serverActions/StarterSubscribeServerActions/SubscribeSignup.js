'use server';

import { MetaDBconnection } from "@/app/utils/config/db"; 
import mysql from 'mysql2/promise'; 
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';
import { getTenantConnection } from "@/app/utils/config/com360db";
import { checkEmailRateLimit } from "../utils/rateLimiter";

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
    console.error("Error checking org name:", error);
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
    console.error("Error checking email:", error);
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
    console.error("Error checking username:", error);
    return { exists: false, error: "Database error" }; 
  }
}

// 4. Send Signup OTP (WITH RATE LIMITING)
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

export async function initiateSignupOTP(formData) {
  return await sendSignupOTP(formData);
}

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

// 5. Complete Subscription
export async function completeSubscription(formData) {
  const metaPool = MetaDBconnection();
  const tenantPool = getTenantConnection();
  
  let metaConnection = null;
  let tenantConnection = null;

  try {
    metaConnection = await metaPool.getConnection();
    tenantConnection = await tenantPool.getConnection();

    await metaConnection.beginTransaction();
    await tenantConnection.beginTransaction();

    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    const gender = formData.get('gender');
    const mobileNumber = formData.get('mobileNumber');
    const dob = formData.get('dob');
    const companyName = formData.get('companyName');
    const email = formData.get('email');
    const username = formData.get('username');
    const password = formData.get('password');
    const logoFile = formData.get('logo');

    // META DATABASE OPERATIONS
    const [metaOrgResult] = await metaConnection.query(
      `INSERT INTO C_ORG (org_name, active) VALUES (?, 'Y')`,
      [companyName]
    );
    const metaOrgId = metaOrgResult.insertId;

    const [subResult] = await metaConnection.query(
      `INSERT INTO C_SUBSCRIBER (admin_first_name, admin_last_name, org_id, active) 
       VALUES (?, ?, ?, 'Y')`,
      [firstName, lastName, metaOrgId]
    );
    const subscriberId = subResult.insertId;

    await metaConnection.query(
      `INSERT INTO C_SUBSCRIBER_PLAN (subscriber_id, plan_id, subscriber_database, plan_start_date, active, privileged_user_access, password) 
       VALUES (?, 1, 'com360', CURRENT_DATE(), 'Y', 'SAINAMAN', 'SAInaman$8393')`, 
      [subscriberId]
    );

    await metaConnection.query(
      `INSERT INTO C_EMP (emp_first_name, emp_middle_name, org_id, username, plan_number, email, active) 
       VALUES (?, ?, ?, ?, 1, ?, 'Y')`,
      [firstName, lastName, metaOrgId, username, email]
    );

    // TENANT DATABASE OPERATIONS
    const [tenantOrgResult] = await tenantConnection.query(
      `INSERT INTO C_ORG (orgid, orgname, orglogo_url, is_logo_set, org_status, CREATED_BY, LAST_UPDATED_BY) 
       VALUES (?, ?, NULL, 0, 'ACTIVE', 'SYSTEM', 'SYSTEM')`,
      [metaOrgId, companyName]
    );
    const tenantOrgId = metaOrgId;

    // Handle Logo Upload
    let logoPath = null;
    if (logoFile && logoFile.size > 0) {
      const uploadDir = path.join(process.cwd(), 'public/uploads/orglogos');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${tenantOrgId}.jpg`;
      const filePath = path.join(uploadDir, fileName);
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      logoPath = `/uploads/orglogos/${fileName}`;
      await tenantConnection.query('UPDATE C_ORG SET orglogo_url = ?, is_logo_set = 1 WHERE orgid = ?', [logoPath, tenantOrgId]);
    }

    const tenantEmpId = `${tenantOrgId}_1`;
    const employee_number = '00001';

    await tenantConnection.query(
      `INSERT INTO C_EMP (
        empid, orgid, EMP_FST_NAME, EMP_LAST_NAME, email, 
        GENDER, MOBILE_NUMBER, DOB,
        STATUS, employee_number, employment_type, HIRE, CREATED_BY, LAST_UPDATED_BY
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, 1, CURRENT_DATE(), 'SYSTEM', 'SYSTEM')`,
      [tenantEmpId, tenantOrgId, firstName, lastName, email, gender, mobileNumber, dob, employee_number]
    );

    const hashedPassword = await bcrypt.hash(password, 10);
    await tenantConnection.query(
      `INSERT INTO C_USER (username, empid, orgid, password, email) VALUES (?, ?, ?, ?, ?)`,
      [username, tenantEmpId, tenantOrgId, hashedPassword, email]
    );

    const roleId = `${tenantOrgId}-1`;
    await tenantConnection.query(
      `INSERT INTO C_ORG_ROLE_TABLE (roleid, orgid, rolename, isadmin, is_active) 
       VALUES (?, ?, '${companyName}_Admin', 1, 1)`,
      [roleId, tenantOrgId]
    );

    await tenantConnection.query(
      `INSERT INTO C_EMP_ROLE_ASSIGN (empid, orgid, roleid) VALUES (?, ?, ?)`,
      [tenantEmpId, tenantOrgId, roleId]
    );

    // Assign Permissions & Menu Priorities
    const [menus] = await tenantConnection.query('SELECT id, hassubmenu FROM C_MENU WHERE is_active = 1 ORDER BY id');
    const [submenus] = await tenantConnection.query('SELECT id, menuid FROM C_SUBMENU WHERE is_active = 1 ORDER BY id');

    const permissionsValues = [];
    
    const getScopes = (mid, smid) => {
        let scopes = { alldata: 0, teamdata: 0, individualdata: 0 };
        const supportsData = 
          (mid === 9 && smid === null) || (mid === 2 && smid === 3) || (mid === 7 && smid === null) || 
          (mid === 19 && smid === null) || (mid === 15 && smid === 20) || (mid === 11 && smid === null) || 
          (mid === 12 && smid === 17) || (mid === 16 && smid === 22);
  
        if (supportsData) {
          scopes.alldata = 1; 
        }
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
      await tenantConnection.query(
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
      await tenantConnection.query(
        `INSERT INTO C_ORG_MENU_PRIORITY (orgid, menuid, submenuid, priority) VALUES ?`,
        [priorityValues]
      );
    }

    // Generic Values (Full List Restored)
    // Format: [g_id, Name, isactive, cutting, parent_value_id, display_order]
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

    const genericValues = rawGenericData.map(item => [
      item[0], item[1], item[2], item[3], tenantOrgId, item[4], item[5]
    ]);

    if (genericValues.length > 0) {
      await tenantConnection.query(
        `INSERT INTO C_GENERIC_VALUES (g_id, Name, isactive, cutting, orgid, parent_value_id, display_order) VALUES ?`,
        [genericValues]
      );
    }

    const suborgid= `${tenantOrgId}-1`;
    await tenantConnection.query(
      `INSERT INTO C_SUB_ORG (suborgid, orgid, suborgname, isstatus, created_by) VALUES (?, ?, ?, ?, ?)`,
      [suborgid, tenantOrgId, companyName, '1', 'SYSTEM']
    );
    
    await metaConnection.commit();
    await tenantConnection.commit();
    return { success: true };

  } catch (error) {
    if (metaConnection) await metaConnection.rollback();
    if (tenantConnection) await tenantConnection.rollback();
    
    console.error("Subscription Error:", error);
    return { success: false, error: error.message || "Failed to complete subscription" };
  } finally {
    if (metaConnection) metaConnection.release();
    if (tenantConnection) tenantConnection.release();
  }
}
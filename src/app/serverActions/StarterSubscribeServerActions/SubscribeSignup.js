'use server';

import DBconnection from "@/app/utils/config/db";
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer'; // Imported directly for new function
import { verifyOTP } from '../SignupAction'; // Only verifyOTP is needed now

// 1. Check Organization Name
export async function checkOrgName(orgName) {
  const pool = await DBconnection();
  try {
    const [rows] = await pool.query('SELECT orgid FROM C_ORG WHERE LOWER(orgname) = LOWER(?)', [orgName]);
    return { exists: rows.length > 0 };
  } catch (error) {
    console.error("Error checking org name:", error);
    return { exists: false, error: "Database error checking name" };
  }
}

// 2. Check Email Duplication
export async function checkEmail(email) {
  const pool = await DBconnection();
  try {
    const [empRows] = await pool.query('SELECT empid FROM C_EMP WHERE email = ?', [email]);
    const [userRows] = await pool.query('SELECT username FROM C_USER WHERE email = ?', [email]);
    return { exists: empRows.length > 0 || userRows.length > 0 };
  } catch (error) {
    console.error("Error checking email:", error);
    return { exists: false, error: "Database error checking email" };
  }
}

// 3. Check Username Duplication
export async function checkUsername(username) {
  const pool = await DBconnection();
  try {
    const [rows] = await pool.query('SELECT username FROM C_USER WHERE username = ?', [username]);
    return { exists: rows.length > 0 };
  } catch (error) {
    console.error("Error checking username:", error);
    return { exists: false, error: "Database error checking username" };
  }
}

// 4. Send Signup OTP (New Dedicated Function)
// This function sends an OTP specifically for new signups where the email should NOT exist yet.
export async function sendSignupOTP(formData) {
  const email = formData.get('email');
  const pool = await DBconnection();

  try {
    // Ensure OTP table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS C_OTP (
        email VARCHAR(255) PRIMARY KEY,
        otp VARCHAR(6) NOT NULL,
        expiry DATETIME NOT NULL
      )
    `);

    // --- CHECK: Email should NOT exist in C_USER ---
    const [userRows] = await pool.query(`SELECT COUNT(*) AS count FROM C_USER WHERE email=?`, [email]);
    if (userRows[0].count > 0) {
      return { success: false, error: "This email is already registered. Please login." };
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Insert or Update OTP
    await pool.query(`
      INSERT INTO C_OTP (email, otp, expiry) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE otp = ?, expiry = ?
    `, [email, otp, expiry, otp, expiry]);

    // Send Email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Com360 Signup Verification',
      text: `Your verification code for Com360 is ${otp}. It is valid for 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };

  } catch (err) {
    console.error('Signup OTP Error:', err);
    return { success: false, error: "Failed to send OTP email. Check server configuration." };
  }
}

// 5. Wrappers
export async function initiateSignupOTP(formData) {
  // Uses the local dedicated function
  return await sendSignupOTP(formData);
}

export async function validateSignupOTP(formData) {
  // Still uses the generic verify logic from SignupAction
  return await verifyOTP(formData);
}

// 6. Complete Subscription (Main Transaction)
export async function completeSubscription(formData) {
  const pool = await DBconnection();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // --- Extract Data ---
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    const gender = formData.get('gender');
    const mobileNumber = formData.get('mobileNumber');
    const dob = formData.get('dob');
    const companyName = formData.get('companyName');
    const companyUrl = formData.get('companyUrl');
    const email = formData.get('email');
    const username = formData.get('username');
    const password = formData.get('password');
    const logoFile = formData.get('logo');

    // --- Validation Checks inside Transaction ---
    const [existingOrg] = await connection.query('SELECT orgid FROM C_ORG WHERE LOWER(orgname) = LOWER(?)', [companyName]);
    if (existingOrg.length > 0) throw new Error("Organization name already exists.");

    const [existingUser] = await connection.query('SELECT username FROM C_USER WHERE username = ?', [username]);
    if (existingUser.length > 0) throw new Error("Username already taken.");

    // --- 1. Create Organization ---
    const [orgResult] = await connection.query(
      `INSERT INTO C_ORG (orgname, orglogo_url, is_logo_set,org_status, CREATED_BY, LAST_UPDATED_BY) 
       VALUES (?, NULL, 0, 'ACTIVE','SYSTEM', 'SYSTEM')`,
      [companyName]
    );
    const orgId = orgResult.insertId;

    // --- 2. Handle Logo Upload ---
    let logoPath = null;
    if (logoFile && logoFile.size > 0) {
      const uploadDir = path.join(process.cwd(), 'public/uploads/orglogos');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${orgId}.jpg`; 
      const filePath = path.join(uploadDir, fileName);
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      logoPath = `/uploads/orglogos/${fileName}`;
      await connection.query('UPDATE C_ORG SET orglogo_url = ?, is_logo_set = 1 WHERE orgid = ?', [logoPath, orgId]);
    }

    // --- 3. Create Admin Employee ---
    const empId = `${orgId}_1`;
    const employee_number = '00001';

    await connection.query(
      `INSERT INTO C_EMP (
        empid, orgid, EMP_FST_NAME, EMP_LAST_NAME, email, 
        GENDER, MOBILE_NUMBER, DOB,
        STATUS, employee_number, employment_type, HIRE, CREATED_BY, LAST_UPDATED_BY
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, 1, CURRENT_DATE(), 'SYSTEM', 'SYSTEM')`,
      [empId, orgId, firstName, lastName, email, gender, mobileNumber, dob, employee_number]
    );

    // --- 4. Create User ---
    const hashedPassword = await bcrypt.hash(password, 10);
    await connection.query(
      `INSERT INTO C_USER (username, empid, orgid, password, email) VALUES (?, ?, ?, ?, ?)`,
      [username, empId, orgId, hashedPassword, email]
    );

    // --- 5. Create Admin Role ---
    const roleId = `${orgId}-1`;
    await connection.query(
      `INSERT INTO C_ORG_ROLE_TABLE (roleid, orgid, rolename, isadmin, is_active) 
       VALUES (?, ?, '${companyName}_Admin', 1, 1)`,
      [roleId, orgId]
    );

    // --- 6. Assign Role to Employee ---
    await connection.query(
      `INSERT INTO C_EMP_ROLE_ASSIGN (empid, orgid, roleid) VALUES (?, ?, ?)`,
      [empId, orgId, roleId]
    );

    // --- 7. Assign Permissions ---
    const [menus] = await connection.query('SELECT id, hassubmenu FROM C_MENU WHERE is_active = 1 ORDER BY id');
    const [submenus] = await connection.query('SELECT id, menuid FROM C_SUBMENU WHERE is_active = 1 ORDER BY id');

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
      await connection.query(
        `INSERT INTO C_ROLE_MENU_PERMISSIONS (roleid, menuid, submenuid, alldata, teamdata, individualdata) VALUES ?`,
        [permissionsValues]
      );
    }

    // --- 8. Set Menu Priorities ---
    let priorityCounter = 1;
    const priorityValues = [];
    for (const menu of menus) {
      if (menu.hassubmenu === 'yes') {
        const menuSubmenus = submenus.filter(sm => sm.menuid === menu.id).sort((a, b) => a.id - b.id);
        for (const sm of menuSubmenus) {
           priorityValues.push([orgId, menu.id, sm.id, priorityCounter++]);
        }
      } else {
        priorityValues.push([orgId, menu.id, null, priorityCounter++]);
      }
    }

    if (priorityValues.length > 0) {
      await connection.query(
        `INSERT INTO C_ORG_MENU_PRIORITY (orgid, menuid, submenuid, priority) VALUES ?`,
        [priorityValues]
      );
    }

    const suborgid= `${orgId}-1`;
     await connection.query(
      `INSERT INTO C_SUB_ORG (suborgid, orgid, suborgname, isstatus,created_by) VALUES (?, ?, ?, ?,?)`,
      [suborgid, orgId, companyName, '1', 'SYSTEM']
    );
    

    await connection.commit();
    return { success: true };

  } catch (error) {
    await connection.rollback();
    console.error("Subscription Error:", error);
    return { success: false, error: error.message || "Failed to complete subscription" };
  } finally {
    connection.release();
  }
}
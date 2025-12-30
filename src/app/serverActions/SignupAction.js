'use server';

import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import loginDBconnection, { metaPool } from "../utils/config/logindb";
import { checkEmailRateLimit } from "../utils/rateLimiter";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create email transporter with optimized Zoho settings
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

export async function sendOTP(formData) {
  const email = formData.get('email');
  
  // Rate limit check
  const rateCheck = checkEmailRateLimit(email, 3, 600000);
  if (!rateCheck.allowed) {
    return { 
      success: false, 
      error: `Too many OTP requests. Please wait ${rateCheck.waitTime} minutes before trying again.` 
    };
  }
  
  const pool = await loginDBconnection(email, 'email');

  if (!pool) {
    return { success: false, error: "Email not found in employee records." };
  }

  // Create OTP table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS C_OTP (
      email VARCHAR(255) PRIMARY KEY,
      otp VARCHAR(6) NOT NULL,
      expiry DATETIME NOT NULL
    )
  `);

  const [countEmployee] = await pool.query(`SELECT COUNT(*) AS count FROM C_EMP WHERE Email=?`, [email]);
  if (countEmployee[0].count === 0) {
    return { success: false, error: "Email not registered with any employee." };
  }

  const [countUser] = await pool.query(`SELECT COUNT(*) AS count FROM C_USER WHERE email=?`, [email]);
  if (countUser[0].count !== 0) {
    return { success: false, error: "Email already registered with this employee." };
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Insert or replace OTP
  await pool.query(`
    INSERT INTO C_OTP (email, otp, expiry) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE otp = ?, expiry = ?
  `, [email, otp, expiry, otp, expiry]);

  // Send email with delay
  const transporter = createEmailTransporter();
  
  // Add delay to prevent rate limiting
  await delay(2000);

  try {
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
    console.error('Email sending error:', err);
    
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

export async function verifyOTP(formData) {
  const email = formData.get('email');
  const otp = formData.get('otp');
  
  const pool = await loginDBconnection(email, 'email');

  if (!pool) {
     return { success: false, error: "System Error: Database connection failed." };
  }

  const [rows] = await pool.query(`SELECT otp, expiry FROM C_OTP WHERE email=?`, [email]);
  if (rows.length === 0) {
    return { success: false, error: "No OTP found for this email." };
  }

  const { otp: storedOTP, expiry } = rows[0];
  if (new Date() > new Date(expiry)) {
    await pool.query(`DELETE FROM C_OTP WHERE email=?`, [email]);
    return { success: false, error: "OTP has expired." };
  }

  if (storedOTP !== otp) {
    return { success: false, error: "Invalid OTP." };
  }

  // Delete OTP after successful verification
  await pool.query(`DELETE FROM C_OTP WHERE email=?`, [email]);

  return { success: true };
}

export async function finalSignup(formData) {
  const email = formData.get('email');
  const user_id = formData.get('user_id');
  const password = formData.get('password');
  const confirm_password = formData.get('confirm_password');
  
  const pool = await loginDBconnection(email, 'email');

  if (!pool) {
      return { success: false, error: "Employee record not found." };
  }

  // Validate username (only letters and numbers)
  const usernameRegex = /^[a-zA-Z0-9]+$/;
  if (!usernameRegex.test(user_id)) {
    return { success: false, error: "Username must contain only letters and numbers." };
  }

  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,}$/;
  if (!passwordRegex.test(password)) {
    return { success: false, error: "Password must be at least 6 characters long and include at least one letter, one capital letter, one number, and one special character (!@#$%^&*)." };
  }

  if (password !== confirm_password) {
    return { success: false, error: "Password and Confirm Password do not match." };
  }

  const [countUsername] = await pool.query(`SELECT COUNT(*) AS count FROM C_USER WHERE username=?`, [user_id]);
  if (countUsername[0].count !== 0) {
    return { success: false, error: "Username is already in use. Please select another username." };
  }

  // Get employee details to link the new user
  const [empidRows] = await pool.query(`SELECT empid, orgid FROM C_EMP WHERE Email=?`, [email]);
  if (empidRows.length === 0) {
    return { success: false, error: "Employee details not found." };
  }

  const { empid, orgid } = empidRows[0];

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 1. Insert into Tenant Database (C_USER)
  await pool.query(
    `INSERT INTO C_USER (username, email, password, empid, orgid) VALUES (?, ?, ?, ?, ?)`,
    [user_id, email, hashedPassword, empid, orgid]
  );

  // 2. Sync Username to Meta Database (C_EMP)
  try {
    const [metaResult] = await metaPool.query(
      `UPDATE C_EMP SET username = ? WHERE email = ?`,
      [user_id, email]
    );
    console.log(`Meta DB Sync: Username updated for ${email}. Rows affected: ${metaResult.affectedRows}`);
  } catch (err) {
    console.error("Meta DB Sync Error: Failed to update username in Meta C_EMP:", err);
    return { success: false, error: "Account created, but system synchronization failed. Please contact support." };
  }

  return { success: true };
}
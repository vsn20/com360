'use server';

import loginDBconnection from "../utils/config/logindb";
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
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

export async function sendForgotOTP(formData) {
  const type = formData.get('type');
  const identifier = formData.get('identifier');

  const pool = await loginDBconnection(identifier, type);

  if (!pool) {
    return { success: false, error: "Account not found in system records." };
  }

  console.log('GMAIL_USER:', process.env.GMAIL_USER);
  console.log('GMAIL_APP_PASS:', process.env.GMAIL_APP_PASS ? '***SET***' : 'MISSING');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    console.error('Missing Gmail credentials');
    return { success: false, error: 'Server configuration error: Missing email credentials.' };
  }

  let email;
  let empidUser;

  if (type === 'email') {
    email = identifier;

    const [countEmp] = await pool.query(`SELECT COUNT(*) AS count FROM C_EMP WHERE email=?`, [email]);
    if (countEmp[0].count === 0) {
      return { success: false, error: "Email not registered with any employee." };
    }

    const [countUser] = await pool.query(`SELECT COUNT(*) AS count FROM C_USER WHERE email=?`, [email]);
    if (countUser[0].count === 0) {
      return { success: false, error: "No user account found for this email." };
    }

    const [empRow] = await pool.query(`SELECT empid FROM C_EMP WHERE email=?`, [email]);
    const [userRow] = await pool.query(`SELECT empid FROM C_USER WHERE email=?`, [email]);

    if (empRow[0].empid !== userRow[0].empid) {
      return { success: false, error: "Employee ID mismatch." };
    }

  } else { // username
    const [countUser] = await pool.query(`SELECT COUNT(*) AS count FROM C_USER WHERE username=?`, [identifier]);
    if (countUser[0].count === 0) {
      return { success: false, error: "Username not found." };
    }

    const [userRow] = await pool.query(`SELECT email, empid FROM C_USER WHERE username=?`, [identifier]);
    email = userRow[0].email;
    empidUser = userRow[0].empid;

    const [empRow] = await pool.query(`SELECT empid FROM C_EMP WHERE email=?`, [email]);
    if (empRow.length === 0 || empRow[0].empid !== empidUser) {
      return { success: false, error: "Employee details mismatch." };
    }
  }

  // Rate limit check
  const rateCheck = checkEmailRateLimit(email, 3, 600000);
  if (!rateCheck.allowed) {
    return { 
      success: false, 
      error: `Too many password reset requests. Please wait ${rateCheck.waitTime} minutes before trying again.` 
    };
  }

  // Create C_FORGOTOTP table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS C_FORGOTOTP (
      email VARCHAR(255) PRIMARY KEY,
      otp VARCHAR(6) NOT NULL,
      expiry DATETIME NOT NULL
    )
  `);

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Insert or replace OTP
  await pool.query(`
    INSERT INTO C_FORGOTOTP (email, otp, expiry) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE otp = ?, expiry = ?
  `, [email, otp, expiry, otp, expiry]);

  // Send email with delay
  const transporter = createEmailTransporter();
  
  // Add delay to prevent rate limiting
  await delay(2000);

  const mailOptions = {
    from: `"Com360 Support" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Your OTP for Password Reset',
    text: `Your OTP is ${otp}, valid for 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
        <p style="font-size: 16px; color: #555;">Your password reset OTP code is:</p>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #dc3545; letter-spacing: 5px;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #666;">This code is valid for <strong>10 minutes</strong>.</p>
        <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
          If you didn't request a password reset, please ignore this email and your password will remain unchanged.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully to:', email);
    return { success: true, email };
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
    
    return { success: false, error: `Failed to send OTP email. Please try again later.` };
  }
}

export async function verifyForgotOTP(formData) {
  const email = formData.get('email');
  const otp = formData.get('otp');

  const pool = await loginDBconnection(email, 'email');

  if (!pool) {
     return { success: false, error: "System Error: Database connection failed." };
  }

  const [rows] = await pool.query(`SELECT otp, expiry FROM C_FORGOTOTP WHERE email=?`, [email]);
  if (rows.length === 0) {
    return { success: false, error: "No OTP found for this email." };
  }

  const { otp: storedOTP, expiry } = rows[0];
  if (new Date() > new Date(expiry)) {
    await pool.query(`DELETE FROM C_FORGOTOTP WHERE email=?`, [email]);
    return { success: false, error: "OTP has expired." };
  }

  if (storedOTP !== otp) {
    return { success: false, error: "Invalid OTP." };
  }

  // Delete OTP after successful verification
  await pool.query(`DELETE FROM C_FORGOTOTP WHERE email=?`, [email]);

  return { success: true };
}

export async function resetPassword(formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  const confirm_password = formData.get('confirm_password');

  const pool = await loginDBconnection(email, 'email');

  if (!pool) {
     return { success: false, error: "System Error: Database connection failed." };
  }

  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,}$/;
  if (!passwordRegex.test(password)) {
    return { success: false, error: "Password must be at least 6 characters long and include at least one letter, one capital letter, one number, and one special character (!@#$%^&*)." };
  }

  if (password !== confirm_password) {
    return { success: false, error: "Password and Confirm Password do not match." };
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(password, 10);

  await pool.query(`UPDATE C_USER SET password=? WHERE email=?`, [hashedPassword, email]);

  return { success: true };
}
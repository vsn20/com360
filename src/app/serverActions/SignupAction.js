'use server';

import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import loginDBconnection, { metaPool } from "../utils/config/logindb"; // 🔹 Import metaPool to access Meta DB

export async function sendOTP(formData) {
  const email = formData.get('email');
  
  // 🔹 Use 'email' mode to find the DB without a cookie
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

  // Send email
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Your OTP for Signup',
      text: `Your OTP is ${otp}, valid for 10 minutes.`,
    });
    return { success: true };
  } catch (err) {
    console.error('Email sending error:', err);
    return { success: false, error: "Failed to send OTP email." };
  }
}

export async function verifyOTP(formData) {
  const email = formData.get('email');
  const otp = formData.get('otp');
  
  // 🔹 Connect using Email
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
  const user_id = formData.get('user_id'); // This is the NEW username
  const password = formData.get('password');
  const confirm_password = formData.get('confirm_password');
  
  // 🔹 Connect using Email (Database location is defined by Employee Email)
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

  // 2. 🔹 CRITICAL UPDATE: Sync Username to Meta Database (C_EMP)
  try {
    const [metaResult] = await metaPool.query(
      `UPDATE C_EMP SET username = ? WHERE email = ?`,
      [user_id, email]
    );
    console.log(`Meta DB Sync: Username updated for ${email}. Rows affected: ${metaResult.affectedRows}`);
  } catch (err) {
    console.error("Meta DB Sync Error: Failed to update username in Meta C_EMP:", err);
    // Optional: You might want to return an error here if strict consistency is required,
    // but usually, we don't want to rollback the Tenant signup if just the Meta sync has a hiccup.
    // However, if Meta isn't updated, they can't log in next time.
    return { success: false, error: "Account created, but system synchronization failed. Please contact support." };
  }

  return { success: true };
}
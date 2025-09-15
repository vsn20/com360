'use server';

import DBconnection from "../utils/config/db";
import nodemailer from 'nodemailer';

export async function sendOTP(formData) {
  const email = formData.get('email');
  const pool = await DBconnection();

  // Create OTP table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS C_OTP (
      email VARCHAR(255) PRIMARY KEY,
      otp VARCHAR(6) NOT NULL,
      expiry DATETIME NOT NULL
    )
  `);

  const [countEmployee] = await pool.query(`SELECT COUNT(*) AS count FROM C_EMP WHERE email=?`, [email]);
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

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Your OTP for Signup',
    text: `Your OTP is ${otp}, valid for 10 minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (err) {
    console.error('Email sending error:', err);
    return { success: false, error: "Failed to send OTP email." };
  }
}

export async function verifyOTP(formData) {
  const email = formData.get('email');
  const otp = formData.get('otp');
  const pool = await DBconnection();

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
  const pool = await DBconnection();

  const [countUsername] = await pool.query(`SELECT COUNT(*) AS count FROM C_USER WHERE username=?`, [user_id]);
  if (countUsername[0].count !== 0) {
    return { success: false, error: "Username is already in use. Please select another username." };
  }

  if (password !== confirm_password) {
    return { success: false, error: "Password and Confirm Password do not match." };
  }

  const [empidRows] = await pool.query(`SELECT empid, orgid FROM C_EMP WHERE email=?`, [email]);
  if (empidRows.length === 0) {
    return { success: false, error: "Employee details not found." };
  }

  const { empid, orgid } = empidRows[0];
  await pool.query(`INSERT INTO C_USER (username, email, password, empid, orgid) VALUES (?, ?, ?, ?, ?)`, [user_id, email, password, empid, orgid]);

  return { success: true };
}
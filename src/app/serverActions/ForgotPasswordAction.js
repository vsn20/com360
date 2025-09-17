'use server';

import DBconnection from "../utils/config/db";
import nodemailer from 'nodemailer';

export async function sendForgotOTP(formData) {
  const type = formData.get('type');
  const identifier = formData.get('identifier');
  const pool = await DBconnection();

  // Log environment variables for debugging
  console.log('GMAIL_USER:', process.env.GMAIL_USER);
  console.log('GMAIL_APP_PASS:', process.env.GMAIL_APP_PASS);

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    console.error('Missing Gmail credentials');
    return { success: false, error: 'Server configuration error: Missing Gmail credentials.' };
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

  // Send email
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Your OTP for Password Reset',
    text: `Your OTP is ${otp}, valid for 10 minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully to:', email);
    return { success: true, email };
  } catch (err) {
    console.error('Email sending error:', err);
    return { success: false, error: `Failed to send OTP email: ${err.message}` };
  }
}

export async function verifyForgotOTP(formData) {
  const email = formData.get('email');
  const otp = formData.get('otp');
  const pool = await DBconnection();

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
  const pool = await DBconnection();

  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,}$/;
  if (!passwordRegex.test(password)) {
    return { success: false, error: "Password must be at least 6 characters long and include at least one letter, one capital letter, one number, and one special character (!@#$%^&*)." };
  }

  if (password !== confirm_password) {
    return { success: false, error: "Password and Confirm Password do not match." };
  }

  await pool.query(`UPDATE C_USER SET password=? WHERE email=?`, [password, email]);

  return { success: true };
}
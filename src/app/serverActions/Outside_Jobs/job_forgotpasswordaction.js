'use server';

import DBconnection from '@/app/utils/config/db';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';

export async function forgotpasswordaction(formData) {
  const step = formData.get('step'); // 'identifier', 'otp', 'reset'
  const pool = await DBconnection();

  // Create OTP table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS C_FORGOTPASSWORD_JOBS_OUTSIDE (
      email VARCHAR(255) PRIMARY KEY,
      otp VARCHAR(6) NOT NULL,
      expiry DATETIME NOT NULL
    )
  `);

  if (step === 'identifier') {
    const email = formData.get('email');

    // Check if email exists in C_CANDIDATE
    const [countCandidate] = await pool.query(`SELECT COUNT(*) AS count FROM C_CANDIDATE WHERE email=?`, [email]);
    if (countCandidate[0].count === 0) {
      return { success: false, error: "Email not registered." };
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Insert or replace OTP
    await pool.query(`
      INSERT INTO C_FORGOTPASSWORD_JOBS_OUTSIDE (email, otp, expiry) VALUES (?, ?, ?)
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

  if (step === 'otp') {
    const email = formData.get('email');
    const otp = formData.get('otp');

    const [rows] = await pool.query(`SELECT otp, expiry FROM C_FORGOTPASSWORD_JOBS_OUTSIDE WHERE email=?`, [email]);
    if (rows.length === 0) {
      return { success: false, error: "No OTP found for this email." };
    }

    const { otp: storedOTP, expiry } = rows[0];
    if (new Date() > new Date(expiry)) {
      await pool.query(`DELETE FROM C_FORGOTPASSWORD_JOBS_OUTSIDE WHERE email=?`, [email]);
      return { success: false, error: "OTP has expired." };
    }

    if (storedOTP !== otp) {
      return { success: false, error: "Invalid OTP." };
    }

    // Delete OTP after successful verification
    await pool.query(`DELETE FROM C_FORGOTPASSWORD_JOBS_OUTSIDE WHERE email=?`, [email]);

    return { success: true };
  }

  if (step === 'reset') {
    const email = formData.get('email');
    const password = formData.get('password');
    const confirm_password = formData.get('confirm_password');

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

    // Update password in C_CANDIDATE
    try {
      await pool.query(`UPDATE C_CANDIDATE SET password=? WHERE email=?`, [hashedPassword, email]);
      return { success: true };
    } catch (error) {
      console.error('Password update error:', error);
      return { success: false, error: "Failed to reset password." };
    }
  }

  return { success: false, error: "Invalid step." };
}
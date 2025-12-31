// 'use server';

// import DBconnection from '@/app/utils/config/olddb';
// import nodemailer from 'nodemailer';
// import bcrypt from 'bcrypt';

// export async function signupaction(formData) {
//   const step = formData.get('step'); // 'email', 'otp', 'details'
//   const pool = await DBconnection();

//   // Create OTP table if not exists
//   await pool.query(`
//     CREATE TABLE IF NOT EXISTS C_OUTSIDE_JOBS_OTP (
//       email VARCHAR(255) PRIMARY KEY,
//       otp VARCHAR(6) NOT NULL,
//       expiry DATETIME NOT NULL
//     )
//   `);

//   if (step === 'email') {
//     const email = formData.get('email');

//     // Check if email already exists in C_CANDIDATE
//     const [countCandidate] = await pool.query(`SELECT COUNT(*) AS count FROM C_CANDIDATE WHERE email=?`, [email]);
//     if (countCandidate[0].count !== 0) {
//       return { success: false, error: "Email already registered." };
//     }

//     // Generate OTP
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

//     // Insert or replace OTP
//     await pool.query(`
//       INSERT INTO C_OUTSIDE_JOBS_OTP (email, otp, expiry) VALUES (?, ?, ?)
//       ON DUPLICATE KEY UPDATE otp = ?, expiry = ?
//     `, [email, otp, expiry, otp, expiry]);

//     // Send email
//     const transporter = nodemailer.createTransport({
//       host: process.env.GMAIL_HOST,
//       port: 587,
//       secure: false,
//       auth: {
//         user: process.env.GMAIL_USER,
//         pass: process.env.GMAIL_APP_PASS,
//       },
//     });

//     const mailOptions = {
//       from: process.env.GMAIL_USER,
//       to: email,
//       subject: 'Your OTP for Job Signup',
//       text: `Your OTP is ${otp}, valid for 10 minutes.`,
//     };

//     try {
//       await transporter.sendMail(mailOptions);
//       return { success: true, email };
//     } catch (err) {
//       console.error('Email sending error:', err);
//       return { success: false, error: "Failed to send OTP email." };
//     }
//   }

//   if (step === 'otp') {
//     const email = formData.get('email');
//     const otp = formData.get('otp');

//     const [rows] = await pool.query(`SELECT otp, expiry FROM C_OUTSIDE_JOBS_OTP WHERE email=?`, [email]);
//     if (rows.length === 0) {
//       return { success: false, error: "No OTP found for this email." };
//     }

//     const { otp: storedOTP, expiry } = rows[0];
//     if (new Date() > new Date(expiry)) {
//       await pool.query(`DELETE FROM C_OUTSIDE_JOBS_OTP WHERE email=?`, [email]);
//       return { success: false, error: "OTP has expired." };
//     }

//     if (storedOTP !== otp) {
//       return { success: false, error: "Invalid OTP." };
//     }

//     // Delete OTP after successful verification
//     await pool.query(`DELETE FROM C_OUTSIDE_JOBS_OTP WHERE email=?`, [email]);

//     return { success: true };
//   }

//   if (step === 'details') {
//     const email = formData.get('email');
//     const first_name = formData.get('first_name');
//     const last_name = formData.get('last_name');
//     const password = formData.get('password');
//     const confirm_password = formData.get('confirm_password');

//     // Validate password strength
//     const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,}$/;
//     if (!passwordRegex.test(password)) {
//       return { success: false, error: "Password must be at least 6 characters long and include at least one letter, one capital letter, one number, and one special character (!@#$%^&*)." };
//     }

//     if (password !== confirm_password) {
//       return { success: false, error: "Password and Confirm Password do not match." };
//     }

//     // Check if email already exists in C_CANDIDATE (double-check)
//     const [countCandidate] = await pool.query(`SELECT COUNT(*) AS count FROM C_CANDIDATE WHERE email=?`, [email]);
//     if (countCandidate[0].count !== 0) {
//       return { success: false, error: "Email already registered." };
//     }

//     // Hash the password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Insert into C_CANDIDATE
//     try {
//       await pool.query(
//         `INSERT INTO C_CANDIDATE (email, first_name, last_name, password, gender) 
//          VALUES (?, ?, ?, ?, ?)`,
//         [email, first_name, last_name, hashedPassword, 'Not Specified'] // Default gender as per table requirement
//       );
//       return { success: true };
//     } catch (error) {
//       console.error('Insert error:', error);
//       return { success: false, error: "Failed to complete signup." };
//     }
//   }

//   return { success: false, error: "Invalid step." };
// }


'use server';

import { metaPool } from '@/app/utils/config/jobsdb'; // ✅ Use AWS Meta Connection
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';

export async function signupaction(formData) {
  const step = formData.get('step'); // 'email', 'otp', 'details'

  // Ensure Tables Exist in Central DB (Com360_Meta)
  try {
    await metaPool.query(`
      CREATE TABLE IF NOT EXISTS C_OUTSIDE_JOBS_OTP (
        email VARCHAR(255) PRIMARY KEY,
        otp VARCHAR(6) NOT NULL,
        expiry DATETIME NOT NULL
      )
    `);
    // Ensure Candidate table exists
    await metaPool.query(`
        CREATE TABLE IF NOT EXISTS C_CANDIDATE (
            cid INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255),
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            password VARCHAR(255),
            gender VARCHAR(50) DEFAULT 'Not Specified',
            mobilenumber VARCHAR(20),
            dateofbirth DATE
        )
    `);
  } catch (e) {
    console.error("Error creating tables:", e.message);
  }

  if (step === 'email') {
    const email = formData.get('email');

    // Check if email already exists in C_CANDIDATE
    const [countCandidate] = await metaPool.query(`SELECT COUNT(*) AS count FROM C_CANDIDATE WHERE email=?`, [email]);
    if (countCandidate[0].count !== 0) {
      return { success: false, error: "Email already registered." };
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Insert or replace OTP
    await metaPool.query(`
      INSERT INTO C_OUTSIDE_JOBS_OTP (email, otp, expiry) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE otp = ?, expiry = ?
    `, [email, otp, expiry, otp, expiry]);

    // Send email
    const transporter = nodemailer.createTransport({
      host: process.env.GMAIL_HOST,
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
      subject: 'Your OTP for Job Signup',
      text: `Your OTP is ${otp}, valid for 10 minutes.`,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true, email };
    } catch (err) {
      console.error('Email sending error:', err);
      return { success: false, error: "Failed to send OTP email." };
    }
  }

  if (step === 'otp') {
    const email = formData.get('email');
    const otp = formData.get('otp');

    const [rows] = await metaPool.query(`SELECT otp, expiry FROM C_OUTSIDE_JOBS_OTP WHERE email=?`, [email]);
    if (rows.length === 0) {
      return { success: false, error: "No OTP found for this email." };
    }

    const { otp: storedOTP, expiry } = rows[0];
    if (new Date() > new Date(expiry)) {
      await metaPool.query(`DELETE FROM C_OUTSIDE_JOBS_OTP WHERE email=?`, [email]);
      return { success: false, error: "OTP has expired." };
    }

    if (storedOTP !== otp) {
      return { success: false, error: "Invalid OTP." };
    }

    // Delete OTP after successful verification
    await metaPool.query(`DELETE FROM C_OUTSIDE_JOBS_OTP WHERE email=?`, [email]);

    return { success: true };
  }

  if (step === 'details') {
    const email = formData.get('email');
    const first_name = formData.get('first_name');
    const last_name = formData.get('last_name');
    const password = formData.get('password');
    const confirm_password = formData.get('confirm_password');

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,}$/;
    if (!passwordRegex.test(password)) {
      return { success: false, error: "Password must be at least 6 characters long and include at least one letter, one capital letter, one number, and one special character." };
    }

    if (password !== confirm_password) {
      return { success: false, error: "Password and Confirm Password do not match." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      await metaPool.query(
        `INSERT INTO C_CANDIDATE (email, first_name, last_name, password, gender) 
         VALUES (?, ?, ?, ?, ?)`,
        [email, first_name, last_name, hashedPassword, 'Not Specified']
      );
      return { success: true };
    } catch (error) {
      console.error('Insert error:', error);
      return { success: false, error: "Failed to complete signup." };
    }
  }

  return { success: false, error: "Invalid step." };
}
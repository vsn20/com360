'use server';

import { MetaDBconnection } from "@/app/utils/config/db"; 
import { approveProSubscription } from "@/app/serverActions/ProSubscriptionForm/SubscribeSignup";
import nodemailer from 'nodemailer';


const formatDate = (date) => {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
  };

// --- INTERNAL HELPER: SEND EMAIL ---
async function sendNotificationEmail(toEmail, status, companyName) {
  if (!toEmail) return;

  // 1. UPDATED: Using the configuration from your working reference code
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.GMAIL_USER,      // Changed from EMAIL_USER
      pass: process.env.GMAIL_APP_PASS,  // Changed from EMAIL_PASS
    },
  });

  

  let subject = "";
  let htmlContent = "";
  const safeName = companyName || "User"; 
  const loginLink = `${process.env.NEXT_PUBLIC_BASE_URL}/login`;

  if (status === 'APPROVED') {
    subject = "🎉 Organization Approved - Login Ready";
    htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h3>Welcome, ${safeName}!</h3>
        <p>Your organization account has been successfully created and approved.</p>
        <p>You can now login to your dashboard:</p>
        <a href="${loginLink}" style="background:#007bff;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;">Login Now</a>
      </div>
    `;
  } else {
    subject = "Organization Request Update";
    htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h3>Request Update for ${safeName}</h3>
        <p>We regret to inform you that your request to create this organization has been <strong>rejected</strong>.</p>
        <p>Please contact support for more details.</p>
      </div>
    `;
  }

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER, // Updated to match auth user
      to: toEmail,
      subject: subject,
      html: htmlContent,
    });
    console.log(`Email sent to ${toEmail} (${status})`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

// --- 1. FETCH ALL REQUESTS ---
export async function fetchRequests() {
  const metaPool = MetaDBconnection();
  try {
    const [rows] = await metaPool.query(
      `SELECT 
         r.*, 
         p.plan_name
       FROM C_ORG_ONBOARDING_REQUESTS r
       JOIN C_PLAN p 
         ON r.plan_id = p.plan_id
       WHERE r.status IN ('PENDING', 'REJECTED')
       ORDER BY FIELD(r.status, 'PENDING', 'REJECTED'), r.created_at DESC`
    );

    return rows.map(row => ({
      ...row,
      created_at: formatDate(row.created_at),
      dob: formatDate(row.dob)
    }));
  } catch (error) {
    console.error("Fetch Error:", error);
    return [];
  }
}


// --- 2. REJECT REQUEST ---
export async function rejectRequest(requestId) {
  const metaPool = MetaDBconnection();
  try {
    // A. Fetch email and company_name
    const [rows] = await metaPool.query(
      `SELECT email, company_name FROM C_ORG_ONBOARDING_REQUESTS WHERE request_id = ?`,
      [requestId]
    );

    if (rows.length === 0) return { success: false, error: "Request not found" };
    
    const { email, company_name } = rows[0];

    // B. Update Status
    await metaPool.query(
      `UPDATE C_ORG_ONBOARDING_REQUESTS SET status = 'REJECTED' WHERE request_id = ?`,
      [requestId]
    );

    // C. Send Notification
    await sendNotificationEmail(email, 'REJECTED', company_name);

    return { success: true };
  } catch (error) {
    console.error("Reject Error:", error);
    return { success: false, error: "Database error" };
  }
}

// --- 3. MASTER APPROVE REQUEST ---
export async function approveRequest(requestId) {
  const metaPool = MetaDBconnection();

  try {
    const [requests] = await metaPool.query(
      `SELECT * FROM C_ORG_ONBOARDING_REQUESTS WHERE request_id = ? AND status IN ('PENDING', 'REJECTED')`,
      [requestId]
    );

    if (requests.length === 0) {
        return { success: false, error: "Request not found or already processed." };
    }
    
    const reqData = requests[0];
    const { plan_id, email, company_name } = reqData; 

    let result;

    if (String(plan_id) === '2' || String(plan_id) === '3'|| String(plan_id) === '4') {
        result = await approveProSubscription(reqData);
    } 
    else if (String(plan_id) === '1') {
        result = { success: false, error: "Starter Plan logic not yet implemented." };
    } 
    else {
        result = { success: false, error: `Unknown Plan ID: ${plan_id}` };
    }

    if (result.success) {
      await sendNotificationEmail(email, 'APPROVED', company_name);
    }

    return result;

  } catch (error) {
    console.error("Master Approval Error:", error);
    return { success: false, error: "System error during approval routing." };
  }
}
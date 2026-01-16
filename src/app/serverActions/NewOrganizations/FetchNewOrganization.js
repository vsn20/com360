'use server';

import { MetaDBconnection } from "@/app/utils/config/db"; 
import { approveProSubscription } from "@/app/serverActions/SharedSubscriptionForm/SubscribeSignup";
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

  const transporter = nodemailer.createTransport({
    host: process.env.GMAIL_HOST,
    port: 587,
    secure: false, 
    auth: {
      user: process.env.GMAIL_USER,      
      pass: process.env.GMAIL_APP_PASS,  
    },
  });

  let subject = "";
  let htmlContent = "";
  const safeName = companyName || "User"; 
  const loginLink = `https://com360view.com/login`;

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
      from: process.env.GMAIL_USER, 
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

// --- 1.1 FETCH EXISTING ORGANIZATIONS ---
// --- 1.1 FETCH EXISTING ORGANIZATIONS ---
export async function fetchExistingOrganizations() {
  const metaPool = MetaDBconnection();
  try {
    const [rows] = await metaPool.query(`
      SELECT 
        o.org_id,
        o.org_name,
        COALESCE(p.plan_name, 'N/A') as plan_name,
        
        -- 1. Fetch Admin Name specifically from the Employee table where isadmin=1
        (SELECT TRIM(CONCAT(COALESCE(emp_first_name, ''), ' ', COALESCE(emp_middle_name, ''))) 
         FROM C_EMP 
         WHERE org_id = o.org_id AND isadmin = 1 
         LIMIT 1) as admin_name,

        -- 2. Fetch Admin Email specifically from the Employee table where isadmin=1
        (SELECT email 
         FROM C_EMP 
         WHERE org_id = o.org_id AND isadmin = 1 
         LIMIT 1) as admin_email,

        -- 3. Count ALL employees (linked via the main join 'e' below)
        COUNT(e.emp_id) as total_employees,
        SUM(CASE WHEN e.active = 'Y' THEN 1 ELSE 0 END) as active_employees,
        SUM(CASE WHEN e.active = 'N' THEN 1 ELSE 0 END) as inactive_employees

      FROM C_ORG o
      LEFT JOIN C_SUBSCRIBER s ON o.org_id = s.org_id
      LEFT JOIN C_SUBSCRIBER_PLAN sp ON s.subscriber_id = sp.subscriber_id AND sp.active = 'Y'
      LEFT JOIN C_PLAN p ON sp.plan_id = p.plan_id
      
      -- 4. Main Join for counts: REMOVED "AND e.isadmin=1" so we get everyone
      LEFT JOIN C_EMP e ON o.org_id = e.org_id
      
      GROUP BY o.org_id, o.org_name, p.plan_name
      ORDER BY o.org_name ASC
    `);
    return rows;
  } catch (error) {
    console.error("Fetch Existing Orgs Error:", error);
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
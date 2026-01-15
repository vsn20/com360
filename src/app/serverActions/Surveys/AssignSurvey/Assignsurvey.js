'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB');
};

// 1. Fetch Surveys & Active Employees
export async function getAssignData() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) return { error: 'Unauthorized' };

    const decoded = decodeJwt(token);
    const { orgid, username } = decoded;

    const pool = await DBconnection();
    
    // Get current user empid
    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ? AND orgid = ?", [username, orgid]);
    if (userRows.length === 0) return { error: 'User not found' };
    const empid = userRows[0].empid;

    // Fetch Surveys
    const [surveys] = await pool.query(
      `SELECT * FROM C_SURVEY 
       WHERE (created_by = ? OR orgid = ?) 
       AND is_active = 1 
       ORDER BY created_at DESC`,
      [empid, orgid]
    );

    // Fetch Active Employees
    const [employees] = await pool.query(
      `SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, email 
       FROM C_EMP 
       WHERE orgid = ? AND STATUS = 'ACTIVE'`,
      [orgid]
    );

    const formattedEmployees = employees.map(e => ({
        value: e.empid,
        label: `${e.EMP_FST_NAME} ${e.EMP_LAST_NAME || ''}`,
        email: e.email
    }));

    return { 
        success: true, 
        surveys: JSON.parse(JSON.stringify(surveys)), 
        employees: formattedEmployees,
        currentUser: { empid, orgid }
    };

  } catch (error) {
    console.error("Fetch Data Error:", error);
    return { error: error.message };
  }
}

// 2. Fetch Full Survey Preview
export async function getSurveyPreview(surveyId) {
    try {
        const pool = await DBconnection();
        const [questions] = await pool.query("SELECT * FROM C_SURVEY_QUESTIONS WHERE survey_id = ? ORDER BY display_order ASC", [surveyId]);
        const [options] = await pool.query(
            `SELECT a.* FROM C_SURVEY_ANSWERS a 
             JOIN C_SURVEY_QUESTIONS q ON a.question_id = q.question_id 
             WHERE q.survey_id = ? ORDER BY a.display_order ASC`,
            [surveyId]
        );

        const mappedQuestions = questions.map(q => ({
            ...q,
            config: typeof q.config === 'string' ? JSON.parse(q.config) : (q.config || {}),
            options: options.filter(opt => opt.question_id === q.question_id).map(o => o.option_text)
        }));

        return { success: true, data: mappedQuestions };
    } catch (error) {
        return { error: error.message };
    }
}

// 3. GET EXISTING ASSIGNMENTS (Crucial for ticking checkboxes)
export async function getExistingAssignments(surveyId) {
    try {
        const pool = await DBconnection();
        const [rows] = await pool.query(
            "SELECT emp_id FROM C_SURVEY_ASSIGNMENTS WHERE survey_id = ?",
            [surveyId]
        );
        // Return array of emp_ids that already have this survey
        return { success: true, assignedIds: rows.map(r => r.emp_id) };
    } catch (error) {
        console.error("Get Assignments Error:", error);
        return { error: error.message };
    }
}

// 4. Assign Survey
export async function assignSurveyToEmployees(surveyId, selectedEmpIds, assignerId, orgid, isAllEmployees) {
    let connection;
    try {
        const pool = await DBconnection();
        
        let targetEmployees = [];
        if (isAllEmployees) {
            const [allEmps] = await pool.query("SELECT empid, email, EMP_FST_NAME FROM C_EMP WHERE orgid = ? AND STATUS = 'ACTIVE'", [orgid]);
            targetEmployees = allEmps;
        } else {
            if(selectedEmpIds.length === 0) return { error: "No employees selected" };
            const placeholders = selectedEmpIds.map(() => '?').join(',');
            const [emps] = await pool.query(
                `SELECT empid, email, EMP_FST_NAME FROM C_EMP WHERE empid IN (${placeholders}) AND orgid = ?`, 
                [...selectedEmpIds, orgid]
            );
            targetEmployees = emps;
        }

        if (targetEmployees.length === 0) return { error: "No valid employees found." };

        const [surveyRows] = await pool.query("SELECT title, end_date FROM C_SURVEY WHERE survey_id = ?", [surveyId]);
        const surveyTitle = surveyRows[0]?.title || "Survey";
        const endDate = formatDate(surveyRows[0]?.end_date);

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check existing to avoid duplicates
        const [existing] = await connection.query(
            "SELECT emp_id FROM C_SURVEY_ASSIGNMENTS WHERE survey_id = ?", 
            [surveyId]
        );
        const existingSet = new Set(existing.map(e => e.emp_id));
        
        // Only insert NEW assignments
        const newAssignments = targetEmployees.filter(e => !existingSet.has(e.empid));

        if (newAssignments.length > 0) {
            const values = newAssignments.map(emp => [surveyId, emp.empid, orgid, assignerId]);
            await connection.query(
                `INSERT INTO C_SURVEY_ASSIGNMENTS (survey_id, emp_id, orgid, assigned_by) VALUES ?`,
                [values]
            );
        }

        await connection.commit();

        // Send Email to NEW assignments only
        const transporter = nodemailer.createTransport({
            host: process.env.GMAIL_HOST,
            port: 587,
            secure: false,
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
        });

        const surveyLink = `https://com360view.com/surveys/${surveyId}`;

        newAssignments.forEach(emp => {
            if (!emp.email) return;
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #0fd46c;">New Survey Assigned: ${surveyTitle}</h2>
                    <p>Hello ${emp.EMP_FST_NAME},</p>
                    <p>You have been assigned a new survey.</p>
                    <p><strong>Deadline:</strong> ${endDate || 'No deadline'}</p>
                    <br/>
                    <a href="${surveyLink}" style="display:inline-block;padding:12px 24px;background:#0fd46c;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Start Survey</a>
                </div>
            `;
            transporter.sendMail({
                from: process.env.GMAIL_USER,
                to: emp.email,
                subject: `New Survey: ${surveyTitle}`,
                html: htmlContent
            }).catch(e => console.error("Email fail", e));
        });

        return { success: true, count: newAssignments.length, alreadyAssigned: targetEmployees.length - newAssignments.length };

    } catch (error) {
        if (connection) await connection.rollback();
        return { error: error.message };
    } finally {
        if (connection) connection.release();
    }
}
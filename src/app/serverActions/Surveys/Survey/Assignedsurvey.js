'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';

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

// 1. Fetch Assigned Surveys for the Logged-in Employee
export async function getAssignedSurveys() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) return { error: 'Unauthorized' };

    const decoded = decodeJwt(token);
    const { orgid, username } = decoded;

    const pool = await DBconnection();
    
    // Get logged-in empid
    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ? AND orgid = ?", [username, orgid]);
    if (userRows.length === 0) return { error: 'User not found' };
    const empid = userRows[0].empid;

    // Fetch surveys assigned to this employee
    const [rows] = await pool.query(`
      SELECT 
        s.survey_id, s.title, s.category, s.end_date, s.description,
        a.status as assignment_status, a.assigned_at
      FROM C_SURVEY_ASSIGNMENTS a
      JOIN C_SURVEY s ON a.survey_id = s.survey_id
      WHERE a.emp_id = ? AND a.orgid = ? AND s.is_active = 1
      ORDER BY a.assigned_at DESC
    `, [empid, orgid]);

    return { success: true, surveys: rows, currentUser: { empid, orgid } };

  } catch (error) {
    console.error("Fetch Assigned Error:", error);
    return { error: error.message };
  }
}

// 2. Fetch Questions & Previous Responses (For Editing)
export async function getSurveyQuestionsAndResponses(surveyId) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    const decoded = decodeJwt(token);
    const pool = await DBconnection();

    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ? AND orgid = ?", [decoded.username, decoded.orgid]);
    const empid = userRows[0].empid;

    // A. Fetch Questions
    const [questions] = await pool.query(
      "SELECT * FROM C_SURVEY_QUESTIONS WHERE survey_id = ? ORDER BY display_order ASC", 
      [surveyId]
    );

    // B. Fetch Options
    const [options] = await pool.query(`
      SELECT a.* FROM C_SURVEY_ANSWERS a 
      JOIN C_SURVEY_QUESTIONS q ON a.question_id = q.question_id 
      WHERE q.survey_id = ? ORDER BY a.display_order ASC`, 
      [surveyId]
    );

    // C. Fetch Existing Responses
    const [existingResponses] = await pool.query(
        "SELECT question_id, response_value FROM C_SURVEY_RESPONSES WHERE survey_id = ? AND emp_id = ?",
        [surveyId, empid]
    );

    // Convert responses to map
    const responseMap = {};
    existingResponses.forEach(r => {
        responseMap[r.question_id] = r.response_value;
    });

    // Map everything together
    const mappedQuestions = questions.map(q => ({
        ...q,
        config: typeof q.config === 'string' ? JSON.parse(q.config) : (q.config || {}),
        options: options.filter(opt => opt.question_id === q.question_id).map(o => o.option_text),
        existingAnswer: responseMap[q.question_id] || null
    }));

    return { success: true, questions: mappedQuestions, empid };

  } catch (error) {
    return { error: error.message };
  }
}

// 3. Submit/Save Responses
export async function submitSurveyResponses(surveyId, responses) {
    let connection;
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('jwt_token')?.value;
        const decoded = decodeJwt(token);
        const pool = await DBconnection();

        const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ? AND orgid = ?", [decoded.username, decoded.orgid]);
        const empid = userRows[0].empid;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Delete old responses to allow clean overwrite/update
        await connection.query(
            "DELETE FROM C_SURVEY_RESPONSES WHERE survey_id = ? AND emp_id = ?",
            [surveyId, empid]
        );

        // 2. Insert new responses
        const insertValues = [];
        for (const [qId, val] of Object.entries(responses)) {
            // Convert arrays (checkboxes) to comma-string
            const finalVal = Array.isArray(val) ? val.join(',') : val;
            if (finalVal !== null && finalVal !== '') {
                insertValues.push([surveyId, qId, empid, finalVal]);
            }
        }

        if (insertValues.length > 0) {
            await connection.query(
                "INSERT INTO C_SURVEY_RESPONSES (survey_id, question_id, emp_id, response_value) VALUES ?",
                [insertValues]
            );
        }

        // 3. Mark Assignment as Completed
        await connection.query(
            "UPDATE C_SURVEY_ASSIGNMENTS SET status = 'COMPLETED' WHERE survey_id = ? AND emp_id = ?",
            [surveyId, empid]
        );

        await connection.commit();
        return { success: true };

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Submit Error:", error);
        return { error: error.message };
    } finally {
        if (connection) connection.release();
    }
}
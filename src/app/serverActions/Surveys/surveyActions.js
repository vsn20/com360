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

export async function getSurveys() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) return { error: 'Unauthorized' };

    const decoded = decodeJwt(token);
    const orgid = decoded.orgid;
    const username = decoded.userId || decoded.username;

    const pool = await DBconnection();
    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ? AND orgid = ?", [username, orgid]);
    
    if (userRows.length === 0) return { error: 'User not found' };
    const empid = userRows[0].empid;

    const [mySurveys] = await pool.query("SELECT * FROM C_SURVEY WHERE created_by = ? ORDER BY created_at DESC", [empid]);
    const [orgSurveys] = await pool.query("SELECT * FROM C_SURVEY WHERE orgid = ? AND created_by != ? ORDER BY created_at DESC", [orgid, empid]);

    return { mySurveys, orgSurveys, currentUser: { empid, orgid } };
  } catch (error) {
    return { error: error.message };
  }
}

export async function createSurvey(data) {
  try {
    const pool = await DBconnection();
    const [result] = await pool.query(
      `INSERT INTO C_SURVEY (title, category, created_by, orgid, end_date) VALUES (?, ?, ?, ?, ?)`,
      [data.title, data.category, data.empid, data.orgid, data.endDate]
    );
    return { success: true, surveyId: result.insertId };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getSurveyDetails(surveyId) {
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
      // Parse the JSON config if it exists
      config: typeof q.config === 'string' ? JSON.parse(q.config) : (q.config || {}),
      options: options.filter(opt => opt.question_id === q.question_id).map(o => o.option_text)
    }));

    return { success: true, data: mappedQuestions };
  } catch (error) {
    return { error: error.message };
  }
}

export async function saveFullSurvey(surveyId, surveyHeader, questions) {
    let connection;
    try {
        const pool = await DBconnection();
        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.query(
            "UPDATE C_SURVEY SET title = ?, category = ?, end_date = ? WHERE survey_id = ?",
            [surveyHeader.title, surveyHeader.category, surveyHeader.end_date || surveyHeader.endDate, surveyId]
        );

        await connection.query("DELETE FROM C_SURVEY_QUESTIONS WHERE survey_id = ?", [surveyId]);

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            let dbType = q.question_type || q.type;
            
            // Map labels to short codes for DB
            if (dbType === 'Multiple Choice (Single Answer)') dbType = 'radio';
            if (dbType === 'Multiple Choice (Multiple Answer)') dbType = 'checkbox';
            if (dbType === 'Rating Scale') dbType = 'rating';
            if (dbType === 'Star Rating') dbType = 'star';
            if (dbType === 'Slider Scale') dbType = 'slider';

            // Prepare config JSON
            const configJson = JSON.stringify(q.config || {});

            const [qRes] = await connection.query(
                `INSERT INTO C_SURVEY_QUESTIONS (survey_id, question_text, question_type, is_required, display_order, config) VALUES (?, ?, ?, ?, ?, ?)`,
                [surveyId, q.question_text || q.text, dbType, q.is_required || q.required ? 1 : 0, i + 1, configJson]
            );
            
            const newQId = qRes.insertId;

            if (['radio', 'checkbox'].includes(dbType) && q.options && q.options.length > 0) {
                const optionValues = q.options.map((opt, idx) => [newQId, opt, idx + 1]);
                await connection.query(
                    `INSERT INTO C_SURVEY_ANSWERS (question_id, option_text, display_order) VALUES ?`,
                    [optionValues]
                );
            }
        }

        await connection.commit();
        return { success: true };
    } catch (error) {
        if (connection) await connection.rollback();
        return { error: error.message };
    } finally {
        if (connection) connection.release();
    }
}
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

// 1. Fetch Surveys Created by User/Org with Stats (Assigned vs Attempted)
export async function getCreatorSurveys() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) return { error: 'Unauthorized' };

    const decoded = decodeJwt(token);
    const { orgid, username } = decoded;

    const pool = await DBconnection();
    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ? AND orgid = ?", [username, orgid]);
    const empid = userRows[0].empid;

    // Fetch surveys with counts
    const [surveys] = await pool.query(`
      SELECT 
        s.survey_id, s.title, s.category, s.created_at,
        COUNT(a.assignment_id) as total_assigned,
        SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) as total_attempted
      FROM C_SURVEY s
      LEFT JOIN C_SURVEY_ASSIGNMENTS a ON s.survey_id = a.survey_id
      WHERE (s.created_by = ? OR s.orgid = ?) AND s.is_active = 1
      GROUP BY s.survey_id
      ORDER BY s.created_at DESC
    `, [empid, orgid]);

    return { success: true, surveys };

  } catch (error) {
    console.error("Fetch Error:", error);
    return { error: error.message };
  }
}

// 2. Fetch Combined Analytics (Aggregated Data)
export async function getSurveyAnalytics(surveyId) {
    try {
        const pool = await DBconnection();

        // A. Fetch Questions
        const [questions] = await pool.query(
            "SELECT question_id, question_text, question_type, config FROM C_SURVEY_QUESTIONS WHERE survey_id = ? ORDER BY display_order ASC", 
            [surveyId]
        );

        // B. Fetch All Responses for this survey
        const [responses] = await pool.query(
            "SELECT question_id, response_value FROM C_SURVEY_RESPONSES WHERE survey_id = ?",
            [surveyId]
        );

        // C. Fetch Options (for labeling charts)
        const [options] = await pool.query(
            `SELECT q.question_id, a.option_text FROM C_SURVEY_ANSWERS a 
             JOIN C_SURVEY_QUESTIONS q ON a.question_id = q.question_id 
             WHERE q.survey_id = ?`,
            [surveyId]
        );

        // Process Data in JS
        const analytics = questions.map(q => {
            const qResponses = responses.filter(r => r.question_id === q.question_id);
            const totalResponses = qResponses.length;
            let breakdown = {};
            let textAnswers = [];

            if (['text'].includes(q.question_type)) {
                // Collect top 5 text answers
                textAnswers = qResponses.slice(0, 5).map(r => r.response_value);
            } else {
                // Initialize counts for options/ratings
                if (['radio', 'checkbox', 'Multiple Choice (Single Answer)', 'Multiple Choice (Multiple Answer)'].includes(q.question_type)) {
                    // Pre-fill 0 for all defined options
                    options.filter(o => o.question_id === q.question_id).forEach(o => {
                        breakdown[o.option_text] = 0;
                    });
                } else if (['rating', 'star', 'Rating Scale', 'Star Rating'].includes(q.question_type)) {
                    // Pre-fill stars (e.g., 1 to max)
                    const cfg = typeof q.config === 'string' ? JSON.parse(q.config) : (q.config || { max: 5 });
                    const max = parseInt(cfg.max || 5);
                    for(let i=1; i<=max; i++) breakdown[i] = 0;
                }

                // Count actual responses
                qResponses.forEach(r => {
                    const val = r.response_value;
                    if (!val) return;

                    // Handle comma-separated checkboxes
                    const values = (q.question_type.includes('Multiple') || q.question_type === 'checkbox') ? val.split(',') : [val];
                    
                    values.forEach(v => {
                        const cleanV = v.trim();
                        // For ratings, ensure key match (string vs int)
                        if(breakdown[cleanV] !== undefined) {
                            breakdown[cleanV]++;
                        } else {
                            // Dynamically add if not pre-defined (e.g. Slider values)
                            breakdown[cleanV] = (breakdown[cleanV] || 0) + 1;
                        }
                    });
                });
            }

            return {
                ...q,
                totalResponses,
                breakdown, // { "Option A": 10, "5": 3 }
                textAnswers // ["Answer 1", "Answer 2"]
            };
        });

        return { success: true, analytics };

    } catch (error) {
        return { error: error.message };
    }
}

// 3. Fetch Individual Responses (Person-by-Person)
export async function getIndividualResponses(surveyId) {
    try {
        const pool = await DBconnection();

        // Fetch Users who COMPLETED the survey
        const [users] = await pool.query(`
            SELECT DISTINCT e.empid, e.EMP_FST_NAME, e.EMP_LAST_NAME, e.email
            FROM C_SURVEY_ASSIGNMENTS sa
            JOIN C_EMP e ON sa.emp_id = e.empid
            WHERE sa.survey_id = ? AND sa.status = 'COMPLETED'
        `, [surveyId]);

        // Fetch all responses for this survey
        const [allResponses] = await pool.query(`
            SELECT r.emp_id, r.question_id, r.response_value, q.question_text 
            FROM C_SURVEY_RESPONSES r
            JOIN C_SURVEY_QUESTIONS q ON r.question_id = q.question_id
            WHERE r.survey_id = ?
            ORDER BY q.display_order ASC
        `, [surveyId]);

        // Group by User
        const individuals = users.map(user => {
            const userResponses = allResponses.filter(r => r.emp_id === user.empid).map(r => ({
                question: r.question_text,
                answer: r.response_value
            }));
            
            return {
                name: `${user.EMP_FST_NAME} ${user.EMP_LAST_NAME || ''}`,
                email: user.email,
                responses: userResponses
            };
        });

        return { success: true, individuals };

    } catch (error) {
        return { error: error.message };
    }
}
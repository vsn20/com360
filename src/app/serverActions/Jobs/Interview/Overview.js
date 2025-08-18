'use server';
import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

const getdisplayprojectid = (prjid) => {
  return prjid.split('_')[1] || prjid;
};

const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId, 'orgid:', orgId);
      return 'unknown';
    }
    let empid = userRows[0].empid;

    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (empRows.length === 0) {
      console.error('Employee not found in C_EMP for empid:', empid, 'orgid:', orgId);
      return `${empid}-unknown`;
    }
    const { EMP_FST_NAME, EMP_LAST_NAME } = empRows[0];
    empid = getdisplayprojectid(empid);
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

export async function fetchAllInterviewsForEmployee({ orgid, empid, editing }) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { success: false, error: 'No token found. Please log in.' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Redirecting: Invalid token or orgid/userId not found');
    return { success: false, error: 'Invalid token or orgid/userId not found.' };
  }

  try {
    const pool = await DBconnection();
    let query = `
      SELECT DISTINCT c.applicationid, b.interview_id, d.first_name, d.last_name, e.display_job_name, c.status,
              d.email, c.resumepath, c.offerletter_timestamp, e.jobid
       FROM C_INTERVIEW_PANELS AS a
       JOIN C_INTERVIEW_TABLES AS b ON a.interview_id = b.interview_id AND a.orgid = b.orgid
       JOIN C_APPLICATIONS AS c ON c.applicationid = b.application_id
       JOIN C_CANDIDATE AS d ON d.cid = c.candidate_id
       JOIN C_EXTERNAL_JOBS AS e ON e.jobid = c.jobid
       WHERE a.orgid = ?
    `;
    let params = [orgid];

    if (editing === 0) {
      query += ' AND a.empid = ?';
      params.push(empid);
    }

    const [rows] = await pool.query(query, params);

    return {
      success: true,
      interviews: rows,
    };
  } catch (error) {
    console.error('Error in fetchAllInterviewsForEmployee:', error);
    return {
      success: false,
      error: 'Failed to fetch interviews',
    };
  }
};

export async function fetchDetailsById({ orgid, interview_id, acceptingtime, empid }) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { success: false, error: 'No token found. Please log in.' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Redirecting: Invalid token or orgid/userId not found');
    return { success: false, error: 'Invalid token or orgid/userId not found.' };
  }

  try {
    const pool = await DBconnection();
    const [rows] = await pool.query(
      `SELECT DISTINCT c.applicationid, b.interview_id, d.first_name, d.last_name, e.display_job_name, c.status,
              d.email, c.resumepath, c.offerletter_timestamp, e.jobid
       FROM C_INTERVIEW_PANELS AS a
       JOIN C_INTERVIEW_TABLES AS b ON a.interview_id = b.interview_id AND a.orgid = b.orgid
       JOIN C_APPLICATIONS AS c ON c.applicationid = b.application_id
       JOIN C_CANDIDATE AS d ON d.cid = c.candidate_id
       JOIN C_EXTERNAL_JOBS AS e ON e.jobid = c.jobid
       WHERE b.interview_id = ? AND a.orgid = ?`,
      [interview_id, orgid]
    );

    if (rows.length === 0) {
      console.error('No interview found for interview_id:', interview_id, 'orgid:', orgid, 'empid:', empid);
      return { success: false, error: 'No interview found' };
    }

    const interview = rows[0];
    let canEdit = true;
    if (interview.offerletter_timestamp) {
      const acceptingHours = acceptingtime ? parseInt(acceptingtime, 10) : 0;
      if (isNaN(acceptingHours)) {
        console.error('Invalid acceptingtime:', acceptingtime);
        return { success: false, error: 'Invalid accepting time' };
      }
      const offerTimestamp = new Date(interview.offerletter_timestamp);
      const currentTime = new Date();
      const maxEditTime = new Date(offerTimestamp.getTime() + acceptingHours * 60 * 60 * 1000);
      if (currentTime > maxEditTime) {
        canEdit = false;
      }
    }

    return {
      success: true,
      interview,
      canEdit,
    };
  } catch (error) {
    console.error('Error in fetchDetailsById:', error);
    return {
      success: false,
      error: 'Failed to fetch interview details',
    };
  }
};

export async function fetchRoundsByInterviewId({ orgid, interview_id, empid, editing }) {
  try {
    const pool = await DBconnection();
    let query = `
      SELECT r.*, ip.empid AS panel_empid, ip.email, ip.is_he_employee
      FROM C_INTERVIEW_ROUNDS r
      LEFT JOIN C_INTERVIEW_PANELS ip ON r.Roundid = ip.Roundid AND r.orgid = ip.orgid AND r.interview_id = ip.interview_id
      WHERE r.orgid = ? AND r.interview_id = ?
    `;
    let params = [orgid, interview_id];

    if (editing === 0) {
      query += ' AND (ip.empid = ? OR ip.empid IS NULL)';
      params.push(empid);
    }

    const [rows] = await pool.query(query, params);

    // Group rounds and collect unique panel members
    const roundsMap = new Map();
    rows.forEach(row => {
      const roundId = row.Roundid;
      if (!roundsMap.has(roundId)) {
        roundsMap.set(roundId, {
          Roundid: row.Roundid,
          orgid: row.orgid,
          interview_id: row.interview_id,
          application_id: row.application_id,
          RoundNo: row.RoundNo,
          marks: row.marks,
          comments: row.comments,
          status: row.status,
          start_date: row.start_date,
          start_am_pm: row.start_am_pm,
          end_date: row.end_date,
          end_am_pm: row.end_am_pm,
          start_time: row.start_time,
          end_time: row.end_time,
          meeting_link: row.meeting_link,
          Confirm: row.Confirm,
          panelMembers: [],
        });
      }
      const round = roundsMap.get(roundId);
      if (row.panel_empid) {
        const panelMember = {
          empid: row.panel_empid || null,
          email: row.email || '',
          is_he_employee: String(row.is_he_employee),
        };
        // Add panel member only if not already present (avoid duplicates)
        if (!round.panelMembers.some(pm => pm.empid === panelMember.empid)) {
          round.panelMembers.push(panelMember);
        }
      }
    });

    const rounds = Array.from(roundsMap.values());

    return {
      success: true,
      rounds: rounds,
    };
  } catch (error) {
    console.error('Error fetching rounds:', error);
    return {
      success: false,
      error: 'Failed to fetch rounds',
    };
  }
}
export async function update({ orgid, empid, interview_id, status, acceptingtime, rounds }) {
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { success: false, error: 'No token found. Please log in.' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Redirecting: Invalid token or orgid/userId not found');
    return { success: false, error: 'Invalid token or orgid/userId not found.' };
  }
  const userId = decoded.userId;

  try {
    const pool = await DBconnection();
    let changes=false;
    

    // Update only the C_INTERVIEW_ROUNDS table
    for (const round of rounds) {
     const[result]= await pool.query(
        `UPDATE C_INTERVIEW_ROUNDS 
         SET marks = ?, comments = ?, status = ?, start_date = ?, start_time = ?, end_date = ?, end_time = ?, meeting_link = ?, start_am_pm = ?, end_am_pm = ?
         WHERE Roundid = ? AND orgid = ? AND interview_id = ?`,
        [
          round.marks || null,
          round.comments || null,
          round.status || null,
          round.start_date || null,
          round.start_time || null,
          round.end_date || null,
          round.end_time || null,
          round.meeting_link || null,
          round.start_am_pm || null,
          round.end_am_pm || null,
          round.Roundid,
          orgid,
          interview_id
        ]
      );
       if (round.marks!==""||round.comments!==""||round.status!=="") {
        changes = true;
      }
    }

    if(changes){
       await pool.query(
        `update C_INTERVIEW_TABLES set interview_completed=1 where interview_id=?`,[interview_id]
      );
    }

    const employeename = await getCurrentUserEmpIdName(pool, userId, orgid);
    const description = `Rounds updated by ${employeename} on ${new Date().toISOString()}`;
    // await pool.query(
    //   `INSERT INTO applications_activity (orgid, application_id, activity_description) 
    //    VALUES (?, ?, ?)`,
    //   [orgid, (await pool.query(`SELECT application_id FROM C_INTERVIEW_TABLES WHERE interview_id = ? AND orgid = ?`, [interview_id, orgid]))[0][0].applicationid, description]
    // );

    return {
      success: true,
      message: 'Rounds updated successfully',
    };
  } catch (error) {
    console.error('Error in update:', error);
    return {
      success: false,
      error: 'Failed to update rounds',
    };
  }
}
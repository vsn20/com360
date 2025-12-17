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
    console.error('Error decoding JWT:', error);
    return null;
  }
};

const formatDateForDB = (dateStr) => {
  if (!dateStr) return null;
  // Parse the date string and create a date using UTC to avoid timezone shifts
  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) return null;
  
  // Format as YYYY-MM-DD using UTC methods
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// ============ EDUCATION FUNCTIONS ============

export async function fetchEducationByEmpId(empid) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT 
        id,
        employee_id,
        degree_name,
        major,
        institution,
        country,
        state,
        custom_state_name,
        location_city,
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
        graduated,
        honors,
        transcript_url,
        notes
      FROM C_EMPLOYEE_EDUCATION 
      WHERE employee_id = ? 
      ORDER BY start_date DESC`,
      [empid]
    );
    return rows;
  } catch (error) {
    console.error('Error fetching education:', error);
    throw new Error('Failed to fetch education records');
  }
}

export async function addEducation(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) return { error: 'Authentication required' };

    const decoded = decodeJwt(token);
    if (!decoded?.orgid) return { error: 'Invalid token' };

    const pool = await DBconnection();
    
    const employee_id = formData.get('employee_id');
    const degree_name = formData.get('degree_name')?.trim() || null;
    const major = formData.get('major')?.trim() || null;
    const institution = formData.get('institution')?.trim() || null;
    const country = formData.get('country') || null;
    const state = formData.get('state') || null;
    const custom_state_name = formData.get('custom_state_name')?.trim() || null;
    const location_city = formData.get('location_city')?.trim() || null;
    const start_date = formatDateForDB(formData.get('start_date'));
    const end_date = formatDateForDB(formData.get('end_date'));
    const graduated = formData.get('graduated') === 'true' ? 1 : 0;
    const honors = formData.get('honors')?.trim() || null;
    const transcript_url = formData.get('transcript_url')?.trim() || null;
    const notes = formData.get('notes')?.trim() || null;

    const [result] = await pool.execute(
      `INSERT INTO C_EMPLOYEE_EDUCATION 
       (employee_id, degree_name, major, institution, country, state, custom_state_name, 
        location_city, start_date, end_date, graduated, honors, transcript_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee_id, degree_name, major, institution, country, state, custom_state_name,
       location_city, start_date, end_date, graduated, honors, transcript_url, notes]
    );

    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('Error adding education:', error);
    return { error: 'Failed to add education record' };
  }
}

export async function updateEducation(formData) {
  try {
    const pool = await DBconnection();
    
    const id = formData.get('id');
    const degree_name = formData.get('degree_name')?.trim() || null;
    const major = formData.get('major')?.trim() || null;
    const institution = formData.get('institution')?.trim() || null;
    const country = formData.get('country') || null;
    const state = formData.get('state') || null;
    const custom_state_name = formData.get('custom_state_name')?.trim() || null;
    const location_city = formData.get('location_city')?.trim() || null;
    const start_date = formatDateForDB(formData.get('start_date'));
    const end_date = formatDateForDB(formData.get('end_date'));
    const graduated = formData.get('graduated') === 'true' ? 1 : 0;
    const honors = formData.get('honors')?.trim() || null;
    const transcript_url = formData.get('transcript_url')?.trim() || null;
    const notes = formData.get('notes')?.trim() || null;

    await pool.execute(
      `UPDATE C_EMPLOYEE_EDUCATION 
       SET degree_name=?, major=?, institution=?, country=?, state=?, custom_state_name=?,
           location_city=?, start_date=?, end_date=?, graduated=?, honors=?, transcript_url=?, notes=?
       WHERE id=?`,
      [degree_name, major, institution, country, state, custom_state_name,
       location_city, start_date, end_date, graduated, honors, transcript_url, notes, id]
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating education:', error);
    return { error: 'Failed to update education record' };
  }
}

export async function deleteEducation(id) {
  try {
    const pool = await DBconnection();
    await pool.execute('DELETE FROM C_EMPLOYEE_EDUCATION WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting education:', error);
    return { error: 'Failed to delete education record' };
  }
}

// ============ EXPERIENCE FUNCTIONS ============

export async function fetchExperienceByEmpId(empid) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT 
        id,
        employee_id,
        location_city,
        location_country,
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
        currently_working,
        description,
        achievements,
        supervisor_name,
        supervisor_email,
        created_at,
        updated_at
      FROM C_EMPLOYEE_EXPERIENCE 
      WHERE employee_id = ? 
      ORDER BY start_date DESC`,
      [empid]
    );
    return rows;
  } catch (error) {
    console.error('Error fetching experience:', error);
    throw new Error('Failed to fetch experience records');
  }
}

export async function addExperience(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) return { error: 'Authentication required' };

    const decoded = decodeJwt(token);
    if (!decoded?.orgid) return { error: 'Invalid token' };

    const pool = await DBconnection();
    
    const employee_id = formData.get('employee_id');
    const location_city = formData.get('location_city')?.trim() || null;
    const location_country = formData.get('location_country') || null;
    const start_date = formatDateForDB(formData.get('start_date'));
    const end_date = formatDateForDB(formData.get('end_date'));
    const currently_working = formData.get('currently_working') === 'true' ? 1 : 0;
    const description = formData.get('description')?.trim() || null;
    const achievements = formData.get('achievements')?.trim() || null;
    const supervisor_name = formData.get('supervisor_name')?.trim() || null;
    const supervisor_email = formData.get('supervisor_email')?.trim() || null;

    const [result] = await pool.execute(
      `INSERT INTO C_EMPLOYEE_EXPERIENCE 
       (employee_id, location_city, location_country, start_date, end_date, 
        currently_working, description, achievements, supervisor_name, supervisor_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee_id, location_city, location_country, start_date, end_date,
       currently_working, description, achievements, supervisor_name, supervisor_email]
    );

    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('Error adding experience:', error);
    return { error: 'Failed to add experience record' };
  }
}

export async function updateExperience(formData) {
  try {
    const pool = await DBconnection();
    
    const id = formData.get('id');
    const location_city = formData.get('location_city')?.trim() || null;
    const location_country = formData.get('location_country') || null;
    const start_date = formatDateForDB(formData.get('start_date'));
    const end_date = formatDateForDB(formData.get('end_date'));
    const currently_working = formData.get('currently_working') === 'true' ? 1 : 0;
    const description = formData.get('description')?.trim() || null;
    const achievements = formData.get('achievements')?.trim() || null;
    const supervisor_name = formData.get('supervisor_name')?.trim() || null;
    const supervisor_email = formData.get('supervisor_email')?.trim() || null;

    await pool.execute(
      `UPDATE C_EMPLOYEE_EXPERIENCE 
       SET location_city=?, location_country=?, start_date=?, end_date=?, 
           currently_working=?, description=?, achievements=?, supervisor_name=?, supervisor_email=?
       WHERE id=?`,
      [location_city, location_country, start_date, end_date,
       currently_working, description, achievements, supervisor_name, supervisor_email, id]
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating experience:', error);
    return { error: 'Failed to update experience record' };
  }
}

export async function deleteExperience(id) {
  try {
    const pool = await DBconnection();
    await pool.execute('DELETE FROM C_EMPLOYEE_EXPERIENCE WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting experience:', error);
    return { error: 'Failed to delete experience record' };
  }
}
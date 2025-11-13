'use server';

import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';
import { revalidatePath } from 'next/cache';

// Simple function to decode JWT without verification
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

/**
 * Gets the authenticated user's info and permission level for the Performance module.
 * This helper also enforces that the user has 'all' or 'team' permissions.
 */
async function getAuthAndPermissions() {
  const token = cookies().get('jwt_token')?.value;
  if (!token) throw new Error('Authentication token is missing.');

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    throw new Error('Invalid authentication token.');
  }

  const { orgid, userId: username } = decoded;
  const pool = await DBconnection();

  const [userRows] = await pool.execute(
    "SELECT empid FROM C_USER WHERE username = ? AND orgid = ?",
    [username, orgid]
  );
  if (userRows.length === 0) {
    throw new Error('User account is not linked to an employee record.');
  }
  const loggedInEmpId = userRows[0].empid; // This is varchar

  // Now, determine permission level
  const [userRoles] = await pool.query(
    'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
    [loggedInEmpId, orgid]
  );
  const roleIds = userRoles.map(r => r.roleid);

  let permissionLevel = 'none';
  if (roleIds.length > 0) {
    const [permissions] = await pool.query(
      `SELECT alldata, teamdata FROM C_ROLE_MENU_PERMISSIONS 
       WHERE roleid IN (?) AND menuid = 19`, // Menu 19 for Performance
      [roleIds]
    );

    let hasAllData = false;
    let hasTeamData = false;
    for (const p of permissions) {
      if (p.alldata === 1) hasAllData = true;
      if (p.teamdata === 1) hasTeamData = true;
    }
    
    if (hasAllData) permissionLevel = 'all';
    else if (hasTeamData) permissionLevel = 'team';
  }

  // ENFORCE PERMISSION: Only 'all' or 'team' can manage reviews
  if (permissionLevel === 'none') {
    throw new Error('You do not have permission to manage reviews.');
  }

  return { pool, orgid, loggedInEmpId, permissionLevel };
}

/**
 * Creates a new review.
 */
export async function createReview(formData) {
  try {
    const { pool, orgid, loggedInEmpId } = await getAuthAndPermissions();

    const newReview = {
      orgid: orgid,
      employee_id: formData.get('employee_id'),
      supervisor_id: loggedInEmpId, // The person creating the review is the supervisor
      review_year: formData.get('review_year'),
      review_date: formData.get('review_date'),
      rating: formData.get('rating'),
      review_text: formData.get('review_text'), // Main text from the form
      comments: formData.get('comments') || null, // Optional comments
    };

    // Validation
    if (!newReview.employee_id || !newReview.review_year || !newReview.review_date || !newReview.rating || !newReview.review_text) {
      throw new Error('Missing required fields.');
    }

    const sql = `
      INSERT INTO C_EMP_REVIEWS 
      (orgid, employee_id, supervisor_id, review_year, review_date, rating, review_text, comments) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await pool.query(sql, [
      newReview.orgid,
      newReview.employee_id,
      newReview.supervisor_id,
      newReview.review_year,
      newReview.review_date,
      newReview.rating,
      newReview.review_text,
      newReview.comments,
    ]);

    revalidatePath('/(routes)/userscreens/performancereview');
    return { success: true };

  } catch (err) {
    console.error('Error creating review:', err);
    return { error: err.message };
  }
}

/**
 * Updates an existing review.
 */
export async function updateReview(formData) {
  try {
    const { pool, orgid } = await getAuthAndPermissions();
    
    const reviewId = formData.get('id');
    if (!reviewId) {
      throw new Error('Review ID is missing.');
    }

    const updatedReview = {
      employee_id: formData.get('employee_id'),
      review_year: formData.get('review_year'),
      review_date: formData.get('review_date'),
      rating: formData.get('rating'),
      review_text: formData.get('review_text'),
      comments: formData.get('comments') || null,
    };

    const sql = `
      UPDATE C_EMP_REVIEWS SET 
      employee_id = ?, 
      review_year = ?, 
      review_date = ?, 
      rating = ?, 
      review_text = ?,
      comments = ?
      WHERE id = ? AND orgid = ?
    `;
    
    const params = [
      updatedReview.employee_id,
      updatedReview.review_year,
      updatedReview.review_date,
      updatedReview.rating,
      updatedReview.review_text,
      updatedReview.comments,
      reviewId,
      orgid
    ];

    await pool.query(sql, params);

    revalidatePath('/(routes)/userscreens/performancereview');
    return { success: true };

  } catch (err) {
    console.error('Error updating review:', err);
    return { error: err.message };
  }
}

/**
 * Deletes a review.
 */
export async function deleteReview(reviewId) {
  try {
    const { pool, orgid } = await getAuthAndPermissions();

    if (!reviewId) {
      throw new Error('Review ID is missing.');
    }

    await pool.query(
      "DELETE FROM C_EMP_REVIEWS WHERE id = ? AND orgid = ?",
      [reviewId, orgid]
    );

    revalidatePath('/(routes)/userscreens/performancereview');
    return { success: true };

  } catch (err) {
    console.error('Error deleting review:', err);
    return { error: err.message };
  }
}
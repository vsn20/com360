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
  const loggedInEmpId = userRows[0].empid;

  // Now, determine permission level (same logic as page.jsx)
  const [userRoles] = await pool.query(
    'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
    [loggedInEmpId, orgid]
  );
  const roleIds = userRoles.map(r => r.roleid);

  let permissionLevel = 'none';
  if (roleIds.length > 0) {
    const [permissions] = await pool.query(
      `SELECT alldata, teamdata, individualdata 
       FROM C_ROLE_MENU_PERMISSIONS 
       WHERE roleid IN (?) AND menuid = 19`, // Menu 19 for Performance
      [roleIds]
    );

    let hasAllData = false;
    let hasTeamData = false;
    let hasIndividualData = false;
    for (const p of permissions) {
      if (p.alldata === 1) hasAllData = true;
      if (p.teamdata === 1) hasTeamData = true;
      if (p.individualdata === 1) hasIndividualData = true;
    }
    
    if (hasAllData) permissionLevel = 'all';
    else if (hasTeamData) permissionLevel = 'team';
    else if (hasIndividualData) permissionLevel = 'individual';
  }

  return { pool, orgid, loggedInEmpId, permissionLevel };
}

/**
 * Creates a new goal.
 */
export async function createGoal(formData) {
  try {
    const { pool, orgid, loggedInEmpId, permissionLevel } = await getAuthAndPermissions();

    const canAdmin = permissionLevel === 'all' || permissionLevel === 'team';

    // 1. Determine Employee ID (Permission Check)
    let employee_id = formData.get('employee_id');
    if (!canAdmin) {
      // If user is 'individual', force the goal to be for themselves
      employee_id = loggedInEmpId;
    }

    // 2. Determine Supervisor Comments (Permission Check)
    let supervisor_comments = formData.get('supervisor_comments') || null;
    
    // --- FIX: More specific check ---
    let canEditSupervisorComments = false;
    if (permissionLevel === 'all') {
      canEditSupervisorComments = true;
    } else if (permissionLevel === 'team' && String(employee_id) !== String(loggedInEmpId)) {
      // Team leads can add supervisor comments, but NOT for themselves
      canEditSupervisorComments = true;
    }

    if (!canEditSupervisorComments) {
      // If user doesn't have permission (individual, or team lead creating for self), force null
      supervisor_comments = null;
    }
    // --- End of FIX ---

    const newGoal = {
      orgid: orgid,
      employee_id: employee_id,
      description: formData.get('description'),
      start_date: formData.get('start_date'),
      end_date: formData.get('end_date'),
      completion_percentage: formData.get('completion_percentage') || 0,
      employee_comments: formData.get('employee_comments') || null,
      supervisor_comments: supervisor_comments,
    };

    const sql = `
      INSERT INTO C_EMP_GOALS 
      (orgid, employee_id, description, start_date, end_date, completion_percentage, employee_comments, supervisor_comments) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await pool.query(sql, [
      newGoal.orgid,
      newGoal.employee_id,
      newGoal.description,
      newGoal.start_date,
      newGoal.end_date,
      newGoal.completion_percentage,
      newGoal.employee_comments,
      newGoal.supervisor_comments,
    ]);

    // Revalidate the page path to show the new goal
    revalidatePath('/(routes)/userscreens/performancereview'); // Adjusted path
    return { success: true };

  } catch (err) {
    console.error('Error creating goal:', err);
    return { error: err.message };
  }
}

/**
 * Updates an existing goal.
 */
export async function updateGoal(formData) {
  try {
    const { pool, orgid, loggedInEmpId, permissionLevel } = await getAuthAndPermissions();
    const goalId = formData.get('id');

    if (!goalId) {
      throw new Error('Goal ID is missing.');
    }

    // 1. Permission Check: Can this user edit this goal?
    const [goalRows] = await pool.query(
      "SELECT employee_id FROM C_EMP_GOALS WHERE id = ? AND orgid = ?",
      [goalId, orgid]
    );

    if (goalRows.length === 0) {
      throw new Error('Goal not found.');
    }

    const goalOwnerEmpId = goalRows[0].employee_id;
    
    // Check if user can edit the goal at all
    const canEdit = (permissionLevel === 'all' || permissionLevel === 'team') || goalOwnerEmpId === loggedInEmpId;

    if (!canEdit) {
      throw new Error('You do not have permission to edit this goal.');
    }

    // --- FIX: Specific check for supervisor comments ---
    // 2. Check if user has permission to edit the SUPERVISOR comments specifically
    let canEditSupervisorComments = false;
    if (permissionLevel === 'all') {
      canEditSupervisorComments = true;
    } else if (permissionLevel === 'team' && goalOwnerEmpId !== loggedInEmpId) {
      // Team leads can edit supervisor comments, but NOT for their own goals
      canEditSupervisorComments = true;
    }
    // --- End of FIX ---

    // 3. Build Update Query based on permissions
    let sql = `
      UPDATE C_EMP_GOALS SET 
      description = ?, 
      start_date = ?, 
      end_date = ?, 
      completion_percentage = ?, 
      employee_comments = ?
    `;
    
    const params = [
      formData.get('description'),
      formData.get('start_date'),
      formData.get('end_date'),
      formData.get('completion_percentage') || 0,
      formData.get('employee_comments') || null,
    ];

    // Only update supervisor comments if permission is granted
    if (canEditSupervisorComments) {
      sql += ", supervisor_comments = ?";
      params.push(formData.get('supervisor_comments') || null);
    }
    
    sql += " WHERE id = ? AND orgid = ?";
    params.push(goalId, orgid);

    // 4. Execute Update
    await pool.query(sql, params);

    revalidatePath('/(routes)/userscreens/performancereview'); // Adjusted path
    return { success: true };

  } catch (err) {
    console.error('Error updating goal:', err);
    return { error: err.message };
  }
}

/**
 * Deletes a goal.
 */
export async function deleteGoal(goalId) {
  try {
    const { pool, orgid, loggedInEmpId, permissionLevel } = await getAuthAndPermissions();
    const canAdmin = permissionLevel === 'all' || permissionLevel === 'team';

    if (!goalId) {
      throw new Error('Goal ID is missing.');
    }

    // 1. Permission Check: Can this user delete this goal?
    const [goalRows] = await pool.query(
      "SELECT employee_id FROM C_EMP_GOALS WHERE id = ? AND orgid = ?",
      [goalId, orgid]
    );

    if (goalRows.length === 0) {
      throw new Error('Goal not found.');
    }

    const goalOwnerEmpId = goalRows[0].employee_id;
    const canDelete = canAdmin || goalOwnerEmpId === loggedInEmpId;

    if (!canDelete) {
      throw new Error('You do not have permission to delete this goal.');
    }

    // 2. Execute Delete
    await pool.query(
      "DELETE FROM C_EMP_GOALS WHERE id = ? AND orgid = ?",
      [goalId, orgid]
    );

    revalidatePath('/(routes)/userscreens/performancereview'); // Adjusted path
    return { success: true };

  } catch (err) {
    console.error('Error deleting goal:', err);
    return { error: err.message };
  }
}
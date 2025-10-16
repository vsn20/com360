"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

const decodeJwt = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch (error) {
    console.error("JWT decoding error:", error);
    return null;
  }
};

/**
 * **CORRECTED**: Server-side date formatting helper
 */
const formatDate = (dateObj) => {
    // Check if dateObj is null, undefined, or not a Date object
    if (!dateObj || !(dateObj instanceof Date)) return '';

    // Check for invalid date
    if (isNaN(dateObj.getTime())) return '';

    // **FIX**: Use local date parts (getMonth, getDate) instead of UTC parts.
    // The database driver creates a local Date object based on the server's timezone.
    // We just need to extract these local parts back.
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${month}/${day}/${dateObj.getFullYear()}`;
};


/**
 * Gets a user's highest permission level for the Leaves module (menuid = 9).
 */
async function getUserPermissionLevel(pool, empId, orgId) {
  if (!empId || !orgId) return 'none';
  const [roles] = await pool.execute(
    `SELECT p.alldata, p.teamdata, p.individualdata
     FROM C_EMP_ROLE_ASSIGN era
     LEFT JOIN C_ROLE_MENU_PERMISSIONS p ON era.roleid = p.roleid AND p.menuid = 9
     WHERE era.empid = ? AND era.orgid = ?`,
    [empId, orgId]
  );

  let level = 'none';
  for (const role of roles) {
    if (role.alldata) return 'all'; // Highest priority
    if (role.teamdata) level = 'team';
    else if (role.individualdata && level !== 'team') level = 'individual';
  }
  return level;
}

/**
 * Gets all subordinate IDs for a superior (recursive).
 */
const getSubordinateIds = async (pool, superiorEmpId) => {
  if (!superiorEmpId) return [];
  const query = `
      WITH RECURSIVE SubordinateHierarchy AS (
          SELECT empid FROM C_EMP WHERE superior = ?
          UNION ALL
          SELECT e.empid FROM C_EMP e
          INNER JOIN SubordinateHierarchy sh ON e.superior = sh.empid
      )
      SELECT empid FROM SubordinateHierarchy;
  `;
  const [rows] = await pool.execute(query, [superiorEmpId]);
  return rows.map(r => r.empid);
};

/**
 * Central function to calculate a user's scope of visibility and management for leaves.
 */
export async function getLeaveManagementScope(pool, currentEmpId, orgid) {
    const viewableEmpIds = new Set([currentEmpId]);
    const manageableEmpIds = new Set(); // Employees this user can edit ANYTIME

    // 1. Determine the user's highest effective permission level from their own roles and delegations
    let effectiveLevel = await getUserPermissionLevel(pool, currentEmpId, orgid);

    const [delegations] = await pool.execute(
      `SELECT senderempid FROM C_DELEGATE WHERE receiverempid = ? AND menuid = 9 AND isactive = 1`,
      [currentEmpId]
    );

    if (effectiveLevel !== 'all') {
        for (const delegation of delegations) {
            const delegatorLevel = await getUserPermissionLevel(pool, delegation.senderempid, orgid);
            if (delegatorLevel === 'all') {
                effectiveLevel = 'all';
                break; // Max permission achieved
            }
        }
    }

    // 2. Build viewable and manageable sets based on permissions
    if (effectiveLevel === 'all') {
        const [allEmps] = await pool.execute('SELECT empid FROM C_EMP WHERE orgid = ?', [orgid]);
        allEmps.forEach(emp => {
            viewableEmpIds.add(emp.empid);
            manageableEmpIds.add(emp.empid); // `alldata` can manage everyone anytime, including self.
        });
    } else {
        // Handle non-alldata scenarios.
        // Rule: Only 'alldata' allows editing non-subordinates.
        
        // Step 2a: Add the user's own subordinates if they have teamdata permission
        const userBaseLevel = await getUserPermissionLevel(pool, currentEmpId, orgid);
        if (userBaseLevel === 'team') {
            const ownSubordinates = await getSubordinateIds(pool, currentEmpId);
            ownSubordinates.forEach(id => {
                viewableEmpIds.add(id);
                manageableEmpIds.add(id); // Can manage own subordinates anytime.
            });
        }

        // Step 2b: Add visibility and manageability from delegations.
        for (const delegation of delegations) {
            const delegatorId = delegation.senderempid;
            const delegatorLevel = await getUserPermissionLevel(pool, delegatorId, orgid);
            
            viewableEmpIds.add(delegatorId); // Always add delegator to viewable set.
            
            if (delegatorLevel === 'team') {
                const delegatorSubordinates = await getSubordinateIds(pool, delegatorId);
                delegatorSubordinates.forEach(id => {
                    viewableEmpIds.add(id);
                    manageableEmpIds.add(id); // Can manage delegator's subordinates anytime.
                });
            }
        }
    }

    return {
        viewableEmpIds: Array.from(viewableEmpIds),
        manageableEmpIds: Array.from(manageableEmpIds)
    };
}


/**
 * Fetches all necessary data for the main Overview page in one go.
 */
export async function getInitialLeaveData() {
  try {
    const token = cookies().get("jwt_token")?.value;
    if (!token) return { error: "Authentication token not found." };
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId) return { error: "Invalid token." };
    
    const { userId, orgid } = decoded;
    const pool = await DBconnection();
    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [userId]);
    if (!userRows.length) return { error: "User not found." };
    const currentEmpId = userRows[0].empid;

    const scope = await getLeaveManagementScope(pool, currentEmpId, orgid);
    
    const [myDelegateeRows] = await pool.execute(
        `SELECT receiverempid FROM C_DELEGATE WHERE senderempid = ? AND menuid = 9 AND isactive = 1`,
        [currentEmpId]
    );
    const myDelegatees = myDelegateeRows.map(d => d.receiverempid);

    const viewableIdsArray = scope.viewableEmpIds.filter(id => id != null);

    if (viewableIdsArray.length === 0) {
        return { employees: [], leaves: [], assignments: {}, manageableEmpIds: [], loggedInEmpId: currentEmpId, myDelegatees: [] };
    }
    
    if (!currentEmpId) {
        return { error: "Could not identify the current logged-in employee." };
    }

    const placeholders = viewableIdsArray.map(() => '?').join(',');

    const [employeeRows] = await pool.execute(
        `SELECT empid, EMP_FST_NAME, EMP_LAST_NAME 
         FROM C_EMP 
         WHERE empid IN (${placeholders}) 
         ORDER BY CASE WHEN empid = ? THEN 0 ELSE 1 END, EMP_FST_NAME`,
        [...viewableIdsArray, currentEmpId]
    );
    
    const [leaveRows] = await pool.execute(
        `SELECT l.*, gv.Name AS leave_name FROM C_EMPLOYEE_LEAVES l LEFT JOIN C_GENERIC_VALUES gv ON l.leaveid = gv.id AND gv.g_id = 1 WHERE l.empid IN (${placeholders}) AND l.orgid = ?`,
        [...viewableIdsArray, orgid]
    );

    const formattedLeaves = leaveRows.map(leave => ({
        ...leave,
        startdate: formatDate(leave.startdate),
        enddate: formatDate(leave.enddate)
    }));

    const [assignments] = await pool.execute(
        `SELECT ela.leaveid, ela.noofleaves, gv.Name as name FROM C_EMPLOYEE_LEAVES_ASSIGN ela JOIN C_GENERIC_VALUES gv ON ela.leaveid = gv.id WHERE ela.empid = ? AND ela.orgid = ? AND ela.g_id = 1 AND gv.isactive = 1`, 
        [currentEmpId, orgid]
    );

    const assignmentsObject = assignments.reduce((acc, row) => ({ ...acc, [row.leaveid]: { noofleaves: row.noofleaves, name: row.name } }), {});

    return {
        employees: employeeRows,
        leaves: formattedLeaves, // Send formatted leaves
        assignments: assignmentsObject,
        manageableEmpIds: scope.manageableEmpIds,
        loggedInEmpId: currentEmpId,
        myDelegatees: myDelegatees
    };

  } catch (error) {
      console.error("Error fetching initial leave data:", error.message);
      return { error: `Failed to load initial data: ${error.message}` };
  }
}

/**
 * Fetches pending leaves for which the user has management rights.
 */
export async function fetchPendingLeaves() {
    try {
        const token = cookies().get("jwt_token")?.value;
        if (!token) return { error: "No token found." };
        const decoded = decodeJwt(token);
        if (!decoded || !decoded.userId) return { error: "Invalid token." };

        const { userId, orgid } = decoded;
        const pool = await DBconnection();
        const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [userId]);
        if (!userRows.length) return { error: "User not found." };
        const currentEmpId = userRows[0].empid;

        const scope = await getLeaveManagementScope(pool, currentEmpId, orgid);
        const manageableIdsArray = scope.manageableEmpIds;

        if (manageableIdsArray.length === 0) {
            return { leaves: [] };
        }
        
        const placeholders = manageableIdsArray.map(() => '?').join(',');
        const [leaveRows] = await pool.execute(
            `SELECT l.*, gv.Name AS leave_name, e.EMP_FST_NAME, e.EMP_LAST_NAME
             FROM C_EMPLOYEE_LEAVES l
             JOIN C_GENERIC_VALUES gv ON l.leaveid = gv.id AND gv.g_id = 1
             JOIN C_EMP e ON l.empid = e.empid
             WHERE l.empid IN (${placeholders}) AND l.status = 'pending'`,
            manageableIdsArray
        );
        
        const leaves = leaveRows.map(leave => ({
            ...leave,
            employee_name: `${leave.EMP_FST_NAME} ${leave.EMP_LAST_NAME || ''}`.trim(),
            startdate: formatDate(leave.startdate),
            enddate: formatDate(leave.enddate)
        }));
        
        return { leaves };
    } catch (error) {
        console.error("Error fetching pending leaves:", error.message);
        return { error: `Failed to fetch pending leaves: ${error.message}` };
    }
}


export async function fetchLeaveTypes() {
  try {
    const token = cookies().get('jwt_token')?.value;
    if (!token) return { error: 'No token found.' };
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) return { error: 'Invalid token.' };

    const pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1`,
      [1, decoded.orgid]
    );
    return rows;
  } catch (error) {
    return { error: `Failed to fetch leave types: ${error.message}` };
  }
}

// RESTORED ORIGINAL FUNCTIONS
export async function fetchEmployeeLeaves(empId) {
    try {
        const token = cookies().get("jwt_token")?.value;
        if (!token) throw new Error("No token.");
        const decoded = decodeJwt(token);
        const orgId = decoded.orgid;
        const pool = await DBconnection();
        const [rows] = await pool.execute(
          `SELECT l.*, gv.Name AS leave_name FROM C_EMPLOYEE_LEAVES l LEFT JOIN C_GENERIC_VALUES gv ON l.leaveid = gv.id AND gv.g_id = 1 WHERE l.empid = ? AND l.orgid = ?`,
          [empId, orgId]
        );

        const formattedLeaves = rows.map(leave => ({
            ...leave,
            startdate: formatDate(leave.startdate),
            enddate: formatDate(leave.enddate)
        }));
        return { leaves: formattedLeaves };
    } catch (error) {
        return { error: `Failed to fetch employee leaves: ${error.message}` };
    }
}

export async function fetchLeaveAssignments(empid) {
    try {
        const token = cookies().get("jwt_token")?.value;
        if (!token) return { error: "No token." };
        const decoded = decodeJwt(token);
        const orgId = decoded.orgid;
        const pool = await DBconnection();
        const [rows] = await pool.execute(
            `SELECT ela.leaveid, ela.noofleaves, gv.Name as name FROM C_EMPLOYEE_LEAVES_ASSIGN ela JOIN C_GENERIC_VALUES gv ON ela.leaveid = gv.id WHERE ela.empid = ? AND ela.orgid = ? AND ela.g_id = 1 AND gv.isactive = 1`,
            [empid, orgId]
        );
        return rows.reduce((acc, row) => ({ ...acc, [row.leaveid]: { noofleaves: row.noofleaves, name: row.name } }), {});
    } catch (error) {
        return { error: `Failed to fetch leave assignments: ${error.message}` };
    }
}
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

async function isUserAdmin(pool, empId, orgId) {
  if (!empId || !orgId) return false;
  const [rows] = await pool.execute(
    `SELECT 1 FROM C_EMP_ROLE_ASSIGN era 
     JOIN C_ORG_ROLE_TABLE r ON era.roleid = r.roleid AND era.orgid = r.orgid
     WHERE era.empid = ? AND era.orgid = ? AND r.isadmin = 1 LIMIT 1`,
    [empId, orgId]
  );
  return rows.length > 0;
}

const getAllSubordinatesCTE = async (pool, superiorEmpId) => {
  if (!superiorEmpId) return [];
  const query = `
      WITH RECURSIVE SubordinateHierarchy AS (
          SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, superior FROM C_EMP WHERE superior = ?
          UNION ALL
          SELECT e.empid, e.EMP_FST_NAME, e.EMP_LAST_NAME, e.superior FROM C_EMP e
          INNER JOIN SubordinateHierarchy sh ON e.superior = sh.empid
      )
      SELECT DISTINCT empid, EMP_FST_NAME, EMP_LAST_NAME FROM SubordinateHierarchy;
  `;
  const [rows] = await pool.execute(query, [superiorEmpId]);
  return rows;
};

const getDelegatedSubordinatesCTE = async (pool, userEmpId) => {
  const [delegateRows] = await pool.execute(
    `SELECT senderempid FROM C_DELEGATE WHERE receiverempid = ? AND menuid = (SELECT id FROM C_MENU WHERE name = 'Leaves') AND isactive = 1 AND (submenuid IS NULL OR submenuid = 0)`,
    [userEmpId]
  );
  if (delegateRows.length === 0) return [];
  
  const delegatedSuperiorIds = delegateRows.map(row => row.senderempid);
  const placeholders = delegatedSuperiorIds.map(() => '?').join(',');

  const query = `
      WITH RECURSIVE DelegatedHierarchy AS (
          SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid IN (${placeholders})
          UNION ALL
          SELECT e.empid, e.EMP_FST_NAME, e.EMP_LAST_NAME FROM C_EMP e
          INNER JOIN DelegatedHierarchy dh ON e.superior = dh.empid
      )
      SELECT DISTINCT empid, EMP_FST_NAME, EMP_LAST_NAME FROM DelegatedHierarchy;
  `;
  const [allRelatedEmployees] = await pool.execute(query, [...delegatedSuperiorIds]);
  return allRelatedEmployees.filter(emp => emp.empid !== userEmpId && !delegatedSuperiorIds.includes(emp.empid));
};

export async function getInitialLeaveData() {
  try {
    const token = cookies().get("jwt_token")?.value;
    if (!token) return { error: "No token found. Please log in." };
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId) return { error: "Invalid token." };
    
    const { userId, orgid } = decoded;
    const pool = await DBconnection();
    const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [userId]);
    if (!userRows.length) return { error: "User not found." };
    const currentEmpId = userRows[0].empid;

    const [
      isAdmin,
      directSubordinates,
      delegatedSubordinates,
      selfDetails,
      initialLeaves,
      initialAssignments
    ] = await Promise.all([
        isUserAdmin(pool, currentEmpId, orgid),
        getAllSubordinatesCTE(pool, currentEmpId),
        getDelegatedSubordinatesCTE(pool, currentEmpId),
        pool.execute("SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?", [currentEmpId]),
        pool.execute(`SELECT l.*, gv.Name AS leave_name FROM C_EMPLOYEE_LEAVES l LEFT JOIN C_GENERIC_VALUES gv ON l.leaveid = gv.id AND gv.g_id = 1 WHERE l.empid = ? AND l.orgid = ?`, [currentEmpId, orgid]),
        pool.execute(`SELECT ela.leaveid, ela.noofleaves, gv.Name as name FROM C_EMPLOYEE_LEAVES_ASSIGN ela JOIN C_GENERIC_VALUES gv ON ela.leaveid = gv.id WHERE ela.empid = ? AND ela.orgid = ? AND ela.g_id = 1 AND gv.isactive = 1`, [currentEmpId, orgid])
    ]);
    
    const [self] = selfDetails;
    const [leaves] = initialLeaves;
    const [assignments] = initialAssignments;
    
    let allEmployees = [...self, ...directSubordinates, ...delegatedSubordinates];
    const uniqueEmployees = allEmployees.reduce((acc, current) => {
        if (!acc.find(item => item.empid === current.empid)) {
            acc.push(current);
        }
        return acc;
    }, []);
    
    uniqueEmployees.sort((a, b) => {
        if (a.empid === currentEmpId) return -1;
        if (b.empid === currentEmpId) return 1;
        return a.EMP_FST_NAME.localeCompare(b.EMP_FST_NAME);
    });

    const assignmentsObject = assignments.reduce((acc, row) => ({ ...acc, [row.leaveid]: { noofleaves: row.noofleaves, name: row.name } }), {});

    return {
        employees: uniqueEmployees,
        isAdmin,
        initialLeaves: { leaves: leaves },
        initialAssignments: assignmentsObject,
    };
  } catch (error) {
      console.error("Error fetching initial leave data:", error.message);
      return { error: `Failed to load initial data: ${error.message}` };
  }
}

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
        return { leaves: rows };
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

export async function fetchPendingLeaves() {
    try {
        const token = cookies().get("jwt_token")?.value;
        if (!token) return { error: "No token found." };
        
        const decoded = decodeJwt(token);
        if (!decoded || !decoded.userId) return { error: "Invalid token." };

        const pool = await DBconnection();
        const [userRows] = await pool.execute("SELECT empid FROM C_USER WHERE username = ?", [decoded.userId]);
        if (!userRows.length) return { error: "User not found." };
        const superiorEmpId = userRows[0].empid;
        
        const directSubordinates = await getAllSubordinatesCTE(pool, superiorEmpId);
        const delegatedSubordinates = await getDelegatedSubordinatesCTE(pool, superiorEmpId);

        let allManageableEmployees = [...directSubordinates, ...delegatedSubordinates];
        const uniqueEmployeeIds = [...new Set(allManageableEmployees.map(e => e.empid))];

        if (uniqueEmployeeIds.length === 0) {
            return { leaves: [] };
        }
        
        const placeholders = uniqueEmployeeIds.map(() => '?').join(',');
        const [leaveRows] = await pool.execute(
            `SELECT l.*, gv.Name AS leave_name, e.EMP_FST_NAME, e.EMP_LAST_NAME
             FROM C_EMPLOYEE_LEAVES l
             JOIN C_GENERIC_VALUES gv ON l.leaveid = gv.id AND gv.g_id = 1
             JOIN C_EMP e ON l.empid = e.empid
             WHERE l.empid IN (${placeholders}) AND l.status = 'pending'`,
            uniqueEmployeeIds
        );
        
        const leaves = leaveRows.map(leave => ({
            ...leave,
            employee_name: `${leave.EMP_FST_NAME} ${leave.EMP_LAST_NAME || ''}`.trim(),
        }));
        
        return { leaves };
    } catch (error) {
        console.error("Error fetching pending leaves:", error.message);
        return { error: `Failed to fetch pending leaves: ${error.message}` };
    }
}

// **NEW**: Moved from Addleave.js for better organization
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
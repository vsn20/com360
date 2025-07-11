"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

const decodeJwt = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error("JWT decoding error:", error);
    return null;
  }
};

export async function delegateAction(action, data = {}) {
  const token = cookies().get("jwt_token")?.value;
  if (!token) {
    console.log("No token found for action:", action);
    return { error: "No token found. Please log in." };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.userId) {
    console.log("Invalid token or user ID not found for action:", action, decoded);
    return { error: "Invalid token or user ID not found." };
  }

  const pool = await DBconnection();
  const [userRows] = await pool.execute(
    "SELECT empid, orgid FROM C_USER WHERE username = ?",
    [decoded.userId]
  );
  if (!userRows.length) {
    console.log("User not found in C_USER table for username:", decoded.userId);
    return { error: "User not found in C_USER table." };
  }
  const userEmpId = userRows[0].empid;
  const orgId = userRows[0].orgid;
  console.log(`Executing action: ${action}, userEmpId: ${userEmpId}, orgId: ${orgId}`);

  if (action === 'checkPermission') {
    const [permissionRows] = await pool.execute(
      "SELECT m.id, m.name FROM menu m JOIN role_menu_permissions rmp ON m.id = rmp.menuid WHERE rmp.roleid = (SELECT roleid FROM C_EMP WHERE empid = ?) AND (rmp.submenuid IS NULL OR rmp.submenuid = 0)",
      [userEmpId]
    );
    console.log("Permission check result:", permissionRows);
    const hasTimeSheets = permissionRows.some(row => row.name === 'TimeSheets');
    const hasLeaves = permissionRows.some(row => row.name === 'Leaves');
    return { hasPermission: { TimeSheets: hasTimeSheets, Leaves: hasLeaves }, userEmpId };
  }

  if (action === 'getEligibleEmployees') {
    const senderEmpId = userEmpId;
    const { menuName } = data;
    if (!senderEmpId) {
      console.log("Sender employee ID is missing for getEligibleEmployees");
      return { error: "Sender employee ID is required." };
    }

    const [empRows] = await pool.execute(
      `SELECT empid, EMP_FST_NAME, EMP_LAST_NAME 
       FROM C_EMP 
       WHERE orgid = ? 
       AND empid != ? 
       AND empid IN (
         SELECT ce.empid 
         FROM C_EMP ce
         JOIN role_menu_permissions rmp ON rmp.roleid = ce.roleid 
         WHERE rmp.menuid = (SELECT id FROM menu WHERE name = ?)
         AND ce.orgid = ?
         AND (rmp.submenuid IS NULL OR rmp.submenuid = 0)
       )
       AND empid NOT IN (
         SELECT receiverempid 
         FROM delegate 
         WHERE senderempid = ? 
         AND menuid = (SELECT id FROM menu WHERE name = ?)
         AND isactive = 1 
         AND (submenuid IS NULL OR submenuid = 0)
       )`,
      [orgId, senderEmpId, menuName, orgId, senderEmpId, menuName]
    );
    console.log("Eligible employees for", menuName, ":", empRows);
    return { employees: empRows };
  }

  if (action === 'getActiveDelegations') {
    const senderEmpId = userEmpId;
    const { menuName } = data;
    if (!senderEmpId) {
      console.log("Sender employee ID is missing for getActiveDelegations");
      return { error: "Sender employee ID is required." };
    }

    const [delegationRows] = await pool.execute(
      `SELECT d.id, d.receiverempid, d.menuid, d.isactive, e.EMP_FST_NAME, e.EMP_LAST_NAME
       FROM delegate d
       JOIN C_EMP e ON d.receiverempid = e.empid
       WHERE d.senderempid = ?
       AND d.menuid = (SELECT id FROM menu WHERE name = ?)
       AND d.isactive = 1
       AND (d.submenuid IS NULL OR d.submenuid = 0)`,
      [senderEmpId, menuName]
    );
    console.log("Active delegations for", menuName, "sender:", senderEmpId, delegationRows);
    return { delegations: delegationRows };
  }

  if (action === 'delegate') {
    const { receiverEmpId, isActive, menuName = 'TimeSheets' } = data;
    if (!receiverEmpId) {
      console.log("Receiver employee ID is missing for delegate action");
      return { error: "Receiver employee ID is required." };
    }

    const [receiverRoleRows] = await pool.execute(
      "SELECT roleid FROM C_EMP WHERE empid = ?",
      [receiverEmpId]
    );
    if (!receiverRoleRows.length) {
      console.log("Receiver employee not found for empid:", receiverEmpId);
      return { error: "Receiver employee not found." };
    }

    const [senderPermissionRows] = await pool.execute(
      "SELECT menuid, submenuid FROM role_menu_permissions WHERE roleid = (SELECT roleid FROM C_EMP WHERE empid = ?) AND menuid = (SELECT id FROM menu WHERE name = ?)",
      [userEmpId, menuName]
    );
    console.log("Sender permissions for", menuName, ":", senderPermissionRows);

    if (senderPermissionRows.length === 0) {
      console.log("Sender does not have", menuName, "permission to delegate");
      return { error: `Sender does not have ${menuName} permission to delegate.` };
    }

    const startdate = new Date().toISOString().split('T')[0]; // 2025-07-11
    const enddate = isActive ? null : new Date().toISOString().split('T')[0];

    await pool.query('START TRANSACTION');

    try {
      for (const perm of senderPermissionRows) {
        const { menuid, submenuid } = perm;
        const [existingRows] = await pool.execute(
          "SELECT id, isactive, enddate FROM delegate WHERE senderempid = ? AND receiverempid = ? AND menuid = ? AND (submenuid IS NULL OR submenuid = ?)",
          [userEmpId, receiverEmpId, menuid, submenuid || null]
        );
        console.log("Existing delegation check for receiver:", receiverEmpId, existingRows);

        const uniqueTimestamp = new Date().toISOString().replace(/[:.-]/g, '');
        await pool.execute(
          "INSERT INTO delegate (senderempid, receiverempid, menuid, submenuid, startdate, enddate, isactive, created_by, last_updated_by, unique_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [userEmpId, receiverEmpId, menuid, submenuid, startdate, enddate, isActive ? 1 : 0, 'SYSTEM', 'SYSTEM', `${userEmpId}_${receiverEmpId}_${menuid}_${uniqueTimestamp}`]
        );
        console.log(`Inserted new delegation for receiver ${receiverEmpId} with unique_id ${uniqueTimestamp}`);

        if (existingRows.length > 0 && !isActive) {
          for (const existingRow of existingRows) {
            await pool.execute(
              "UPDATE delegate SET isactive = 0, enddate = ?, last_updated_date = CURRENT_TIMESTAMP, last_updated_by = ? WHERE id = ?",
              [enddate, 'SYSTEM', existingRow.id]
            );
            console.log(`Deactivated existing delegation ID ${existingRow.id} for receiver ${receiverEmpId}`);
          }
        }
      }

      await pool.query('COMMIT');
      console.log("Delegation transaction committed successfully");
      return { success: true };
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error("Delegation error:", error);
      return { error: `Failed to process delegation: ${error.message}` };
    }
  }

  if (action === 'updateDelegations') {
    const { delegationIds } = data;
    if (!delegationIds || delegationIds.length === 0) {
      console.log("No delegation IDs provided for updateDelegations");
      return { error: "No delegation IDs provided." };
    }

    await pool.query('START TRANSACTION');

    try {
      for (const id of delegationIds) {
        const enddate = new Date().toISOString().split('T')[0];
        const [result] = await pool.execute(
          "UPDATE delegate SET isactive = 0, enddate = ?, last_updated_date = CURRENT ribbons, last_updated_by = ? WHERE id = ? AND senderempid = ?",
          [enddate, 'SYSTEM', id, userEmpId]
        );
        if (result.affectedRows === 0) {
          console.log(`No delegation found or not authorized to update delegation ID: ${id}`);
        } else {
          console.log(`Deactivated delegation ID: ${id}`);
        }
      }

      await pool.query('COMMIT');
      console.log("Delegations updated successfully:", delegationIds);
      return { success: true };
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error("Update delegations error:", error);
      return { error: `Failed to update delegations: ${error.message}` };
    }
  }

  console.log("Invalid action:", action);
  return { error: "Invalid action." };
}
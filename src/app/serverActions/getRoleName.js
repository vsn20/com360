"use server";

import DBconnection from "../utils/config/db";

export async function getRoleName(roleid) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.query(
      "SELECT rolename FROM org_role_table WHERE roleid = ?",
      [roleid]
    );

    if (rows.length === 0) {
      return { success: false, error: "Role not found" };
    }

    return { success: true, rolename: rows[0].rolename };
  } catch (error) {
    console.log("Error fetching role name:", error.message);
    return { success: false, error: "An error occurred while fetching role name" };
  }
}
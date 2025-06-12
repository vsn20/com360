"use server";

import DBconnection from "../utils/config/db";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { getsidebarmenu } from "./getsmenu";

const JWT_SECRET = process.env.JWT_SECRET;

const generateToken = (userId, roleid, username, rolename, features) => {
  return jwt.sign({ userId, roleid, username, rolename, features }, JWT_SECRET, { expiresIn: "24h" });
};

export async function loginaction(logindetails) {
  const { username, password } = logindetails;
  console.log("Login details:", { username, password });

  try {
    const pool = await DBconnection();

    const [rows] = await pool.query(
      `SELECT u.*, e.roleid, e.issuperadmin, e.isadmin, r.rolename 
       FROM C_USER u 
       JOIN C_EMP e ON u.empid = e.empid 
       LEFT JOIN org_role_table r ON e.roleid = r.roleid 
       WHERE u.username = ?`,
      [username]
    );

    if (rows.length === 0) {
      console.log("Login failed: User not found");
      return { success: false, error: "Invalid username or password" };
    }

    const user = rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log("Login failed: Incorrect password");
      return { success: false, error: "Invalid username or password" };
    }

    const effectiveRoleId = user.issuperadmin === 1 ? null : user.roleid;
    const roleName = user.issuperadmin === 1 ? "superadmin" : user.rolename;

    if (!roleName) {
      console.log("Login failed: Role name not found");
      return { success: false, error: "User role not found" };
    }

    console.log("User authenticated:", user.username, "Role:", roleName, "Superadmin:", user.issuperadmin);

    // Fetch the user's permitted features
    const sidebarItems = await getsidebarmenu(effectiveRoleId);
    console.log("Login: Sidebar items for roleid", effectiveRoleId, ":", sidebarItems);

    // Extract the href values (e.g., ["/sales", "/reports"])
    const features = sidebarItems.map(item => item.href);
    console.log("Login: Features included in token:", features);

    const token = generateToken(user.username, effectiveRoleId, username, roleName, features);
    console.log("Generated JWT token:", token);

    const cookieStore = cookies();
    await cookieStore.set("jwt_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    await pool.query(
      "UPDATE C_USER SET LAST_LOGIN_TIMESTAMP = CURRENT_TIMESTAMP WHERE username = ?",
      [username]
    );

    return { success: true, roleid: effectiveRoleId, issuperadmin: user.issuperadmin, rolename: roleName };
  } catch (error) {
    console.log("Login error:", error.message);
    return { success: false, error: "An error occurred during login" };
  }
}
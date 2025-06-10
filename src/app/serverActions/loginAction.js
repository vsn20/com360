
"use server";

import DBconnection from "../utils/config/db";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET;

const generateToken = (userId, roleid, username) => {
  return jwt.sign({ userId, roleid, username }, JWT_SECRET, { expiresIn: "24h" });
};

export async function loginaction(logindetails) {
  const { username, password } = logindetails;
  console.log("Login details:", { username, password });

  try {
    const pool = await DBconnection();

    // Updated query: Join C_USER with C_EMP to get roleid directly
    const [rows] = await pool.query(
      `SELECT u.*, e.roleid, e.issuperadmin, e.isadmin 
       FROM C_USER u 
       JOIN C_EMP e ON u.empid = e.empid 
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

    // Determine effective roleid: If issuperadmin is 1, roleid should be null
    const effectiveRoleId = user.issuperadmin === 1 ? null : user.roleid;

    console.log("User authenticated:", user.username, "Role:", effectiveRoleId, "Superadmin:", user.issuperadmin, "Admin:", user.isadmin);

    const token = generateToken(user.username, effectiveRoleId, username);
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

    return { success: true, roleid: effectiveRoleId, issuperadmin: user.issuperadmin, isadmin: user.isadmin };
  } catch (error) {
    console.log("Login error:", error.message);
    return { success: false, error: "An error occurred during login" };
  }
}

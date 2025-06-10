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

    const [rows] = await pool.query(
      `SELECT u.*, era.roleid 
       FROM C_USER u 
       LEFT JOIN employee_role_assign era ON u.EMP_ID = era.EMP_ID 
       WHERE u.USER_ID = ?`,
      [username]
    );

    if (rows.length === 0) {
      console.log("Login failed: User not found");
      return { success: false, error: "Invalid username or password" };
    }

    const user = rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.PASSWORD);

    if (!isPasswordValid) {
      console.log("Login failed: Incorrect password");
      return { success: false, error: "Invalid username or password" };
    }

    console.log("User authenticated:", user.USER_ID, "Role:", user.roleid);

    const token = generateToken(user.USER_ID, user.roleid, username);
    console.log("Generated JWT token:", token);

    const cookieStore = cookies();
    await cookieStore.set("jwt_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    await pool.query(
      "UPDATE C_USER SET LAST_LOGIN_TIMESTAMP = CURRENT_TIMESTAMP WHERE USER_ID = ?",
      [username]
    );

    return { success: true, roleid: user.roleid };
  } catch (error) {
    console.log("Login error:", error.message);
    return { success: false, error: "An error occurred during login" };
  }
}
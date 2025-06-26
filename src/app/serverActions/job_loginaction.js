"use server";

import DBconnection from "../utils/config/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET;

const generateJobToken = (cid, email, first_name) => {
  return jwt.sign({ cid, email, first_name }, JWT_SECRET, { expiresIn: "24h" });
};

export async function job_loginaction(logindetails) {
  const { username, password } = logindetails;
  console.log("Job login details received:", { username, password });

  try {
    const pool = await DBconnection();
    console.log("MySQL connection established for job login");

    const [rows] = await pool.query(
      `SELECT 
        c.cid, 
        c.email, 
        c.first_name, 
        c.password 
       FROM candidate c 
       WHERE c.email = ?`,
      [username]
    );

    if (rows.length === 0) {
      console.log("Job login failed: User not found for email:", username);
      return { success: false, error: "Invalid email or password" };
    }

    const user = rows[0];
    console.log("User data retrieved for job login:", user);

    if (!user.password) {
      console.log("Job login failed: Password field is missing or empty for email:", username);
      return { success: false, error: "Invalid email or password" };
    }

    const isPasswordValid = password === user.password;
    console.log("Password comparison result for job login:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("Job login failed: Incorrect password for email:", username);
      return { success: false, error: "Invalid email or password" };
    }

    console.log("User authenticated for job login:", user.email);

    const token = generateJobToken(user.cid, user.email, user.first_name);
    console.log("Generated job JWT token payload:", JSON.stringify({ cid: user.cid, email: user.email, first_name: user.first_name }));
    console.log("Generated job JWT token:", token);

    try {
      const cookieStore = await cookies();
      await cookieStore.set("job_jwt_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
        sameSite: "lax",
      });
      console.log("Job cookie set:", { name: "job_jwt_token", value: token });
    } catch (cookieError) {
      console.error("Error setting cookie:", cookieError.message);
      return { success: false, error: "Failed to set authentication cookie" };
    }

    return { success: true, cid: user.cid, email: user.email, first_name: user.first_name, token };
  } catch (error) {
    console.log("Job login error:", error.message);
    return { success: false, error: "An error occurred during job login" };
  }
}
"use server";

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export async function getUserRole() {
  try {
    const cookieStore = cookies();
    const tokenCookie = cookieStore.get("jwt_token");
    const token = tokenCookie?.value;

    if (!token) {
      return { success: false, error: "No token found" };
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Token verified in getUserRole, user:", decoded.userId, "role:", decoded.roleid);

    return { 
      success: true, 
      userId: decoded.userId, 
      roleid: decoded.roleid,
      username: decoded.username // Add username to the response
    };
  } catch (error) {
    console.log("Error verifying token in getUserRole:", error.message);
    return { success: false, error: "Invalid token" };
  }
}
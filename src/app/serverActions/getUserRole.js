"use server";

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET;

export async function getUserRole() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("jwt_token")?.value;

    if (!token) {
      return { success: false, error: "No token found" };
    }

    const { userId, roleid, username, rolename, features } = jwt.verify(token, JWT_SECRET);
    console.log("getUserRole: Decoded token:", { userId, roleid, username, rolename, features });

    return { success: true, userId, roleid, username, rolename, features };
  } catch (error) {
    console.log("getUserRole: Error verifying token:", error.message);
    return { success: false, error: "Invalid or expired token" };
  }
}
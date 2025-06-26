"use server";

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET;

export async function getUserFromCookie() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("job_jwt_token")?.value;

    if (!token) {
      console.log("No job_jwt_token cookie found");
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded JWT:", decoded);
    return {
      first_name: decoded.first_name,
      email: decoded.email,
    };
  } catch (error) {
    console.log("Error decoding job_jwt_token:", error.message);
    return null;
  }
}
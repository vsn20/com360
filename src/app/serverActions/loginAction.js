"use server";

import DBconnection from "../utils/config/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET;

const generateToken = (userId, roleid, username, rolename, orgid, orgname) => {
  return jwt.sign({ userId, roleid, username, rolename, orgid, orgname }, JWT_SECRET, { expiresIn: "24h" });
};

export async function loginaction(logindetails) {
  const { username, password } = logindetails;
  console.log("Login details received:", { username, password });

  try {
    const pool = await DBconnection();
    console.log("MySQL connection established");

    const [rows] = await pool.query(
      `SELECT 
        u.username, u.empid, u.orgid, u.email, u.password, 
        e.roleid, 
        r.rolename,
        o.orgname
       FROM C_USER u 
       JOIN C_EMP e ON u.empid = e.empid 
       LEFT JOIN org_role_table r ON e.roleid = r.roleid 
       LEFT JOIN C_ORG o ON u.orgid = o.orgid
       WHERE u.username = ?`,
      [username]
    );

    if (rows.length === 0) {
      console.log("Login failed: User not found for username:", username);
      return { success: false, error: "Invalid username or password" };
    }

    const user = rows[0];
    console.log("User data retrieved:", user);

    if (!user.password) {
      console.log("Login failed: Password field is missing or empty for username:", username);
      return { success: false, error: "Invalid username or password" };
    }

    const isPasswordValid = password === user.password;
    console.log("Password comparison result:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("Login failed: Incorrect password for username:", username);
      return { success: false, error: "Invalid username or password" };
    }

    const effectiveRoleId = user.roleid;
    const roleName = user.rolename || "default";
    const orgName = user.orgname || "Unknown"; // Default to "Unknown" if orgname is null

    if (!roleName) {
      console.log("Login failed: Role name not found for username:", username);
      return { success: false, error: "User role not found" };
    }

    console.log("User authenticated:", user.username, "Role:", roleName, "Org:", orgName);

    const token = generateToken(user.username, effectiveRoleId, username, roleName, user.orgid, orgName);
    console.log("Generated JWT token payload:", JSON.stringify({ userId: user.username, roleid: effectiveRoleId, username, rolename: roleName, orgid: user.orgid, orgname: orgName }));
    console.log("Generated JWT token:", token);

    const cookieStore = cookies();
    await cookieStore.set("jwt_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
      sameSite: "lax",
    });
    console.log("Cookie set:", { name: "jwt_token", value: token });

    const url = new URL('/api/menu', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
    url.searchParams.append('roleid', effectiveRoleId.toString());
    url.searchParams.append('orgid', user.orgid.toString());

    const menuResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Cookie: `jwt_token=${token}`, // For server-side context
      },
    });

    if (!menuResponse.ok) {
      throw new Error(`HTTP error! status: ${menuResponse.status}`);
    }

    const menuData = await menuResponse.json();
    const features = menuData.map(item => item.href || item.submenu.map(sub => sub.href)).flat();
    console.log("Features fetched from /api/menu:", features);

    await pool.query(
      "UPDATE C_USER SET LAST_LOGIN_TIMESTAMP = CURRENT_TIMESTAMP WHERE username = ?",
      [username]
    );

    return { success: true, roleid: effectiveRoleId, rolename: roleName, orgid: user.orgid, orgname: orgName, token };
  } catch (error) {
    console.log("Login error:", error.message);
    return { success: false, error: "An error occurred during login" };
  }
}
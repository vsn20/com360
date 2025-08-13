"use server";

import DBconnection from "../utils/config/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET;

const generateToken = (userId, empid, username, rolename, orgid, orgname) => {
  return jwt.sign({ userId, empid, username, rolename, orgid, orgname }, JWT_SECRET, { expiresIn: "24h" });
};

export async function loginaction(logindetails) {
  const { username, password } = logindetails;
 // console.log("Login details received:", { username, password });

  try {
    const pool = await DBconnection();
    console.log("MySQL connection established");

    // Fetch user data from C_USER
    const [userRows] = await pool.query(
      `SELECT 
        u.username, u.empid, u.orgid, u.email, u.password, 
        o.orgname
       FROM C_USER u 
       LEFT JOIN C_ORG o ON u.orgid = o.orgid
       WHERE u.username = ?`,
      [username]
    );

    if (userRows.length === 0) {
      console.log("Login failed: User not found for username:", username);
      return { success: false, error: "Invalid username or password" };
    }

    const user = userRows[0];
    console.log("User data retrieved:", user);

    if (!user.empid) {
      console.log("Login failed: empid is missing or null for username:", username);
      return { success: false, error: "Employee ID not found for this user" };
    }

    if (!user.password) {
      console.log("Login failed: Password field is missing or empty for username:", username);
      return { success: false, error: "Invalid username or password" };
    }

    // Validate password (assuming plain text for now; consider hashing in production)
    const isPasswordValid = password === user.password;
    console.log("Password comparison result:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("Login failed: Incorrect password for username:", username);
      return { success: false, error: "Invalid username or password" };
    }

    // Fetch all roles for the employee from emp_role_assign
    const [roleRows] = await pool.query(
      `SELECT r.roleid, r.rolename
       FROM emp_role_assign era
       JOIN org_role_table r ON era.roleid = r.roleid AND era.orgid = r.orgid
       WHERE era.empid = ? AND era.orgid = ?`,
      [user.empid, user.orgid]
    );

    if (roleRows.length === 0) {
      console.log("Login failed: No roles assigned for empid:", user.empid);
      return { success: false, error: "No roles assigned to user" };
    }

    // Combine role names into a comma-separated string
    const rolename = roleRows.map(row => row.rolename).join(", ");
    const orgName = user.orgname || "Unknown";

    console.log("User authenticated:", user.username, "Roles:", rolename, "Org:", orgName);

    // Generate JWT token with empid
    const token = generateToken(user.username, user.empid, user.username, rolename, user.orgid, orgName);
   // console.log("Generated JWT token payload:", JSON.stringify({ userId: user.username, empid: user.empid, username, rolename, orgid: user.orgid, orgname: orgName }));
    //console.log("Generated JWT token:", token);

    // Set JWT token in cookies
    const cookieStore = cookies();
    await cookieStore.set("jwt_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
      sameSite: "lax",
    });
    console.log("Cookie set:", { name: "jwt_token", value: token });

    // Fetch menu items from /api/menu
    const url = new URL('/api/menu', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
    const menuResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Cookie: `jwt_token=${token}`,
      },
    });

    if (!menuResponse.ok) {
      const errorBody = await menuResponse.text();
      console.error('Menu fetch failed:', { status: menuResponse.status, body: errorBody });
      throw new Error(`HTTP error! status: ${menuResponse.status}`);
    }

    const menuData = await menuResponse.json();
    const features = menuData.map(item => item.href || item.submenu.map(sub => sub.href)).flat();
   // console.log("Features fetched from /api/menu:", features);

    // Update last login timestamp
    await pool.query(
      "UPDATE C_USER SET LAST_LOGIN_TIMESTAMP = CURRENT_TIMESTAMP WHERE username = ?",
      [username]
    );

    return { success: true, empid: user.empid, rolename, orgid: user.orgid, orgname: orgName, token };
  } catch (error) {
    console.log("Login error:", error.message);
    return { success: false, error: "An error occurred during login" };
  }
}
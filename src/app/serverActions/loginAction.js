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
  console.log("Login attempt for username:", username);

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

    // Fetch all roles for the employee from C_EMP_ROLE_ASSIGN
    const [roleRows] = await pool.query(
      `SELECT r.roleid, r.rolename
       FROM C_EMP_ROLE_ASSIGN era
       JOIN C_ORG_ROLE_TABLE r ON era.roleid = r.roleid AND era.orgid = r.orgid
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
    console.log("JWT token generated successfully");

    // Set JWT token in cookies - PRODUCTION READY
    const cookieStore = await cookies();
    await cookieStore.set("jwt_token", token, {
      httpOnly: true,
      secure: false, // Set to false for HTTP, true for HTTPS
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
      sameSite: "lax",
    });
    console.log("Cookie set successfully:", { name: "jwt_token", value: token.substring(0, 20) + "..." });

    // Fetch C_MENU items from /api/menu - Use relative URL for internal calls
    try {
      // For server-side internal calls, use localhost (works within the same server)
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'http://localhost' // Internal calls use localhost
        : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
      
      const menuUrl = `${baseUrl}/api/menu`;
      console.log("Fetching menu from:", menuUrl);

      const menuResponse = await fetch(menuUrl, {
        method: 'GET',
        headers: {
          'Cookie': `jwt_token=${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!menuResponse.ok) {
        const errorBody = await menuResponse.text();
        console.error('Menu fetch failed:', { 
          status: menuResponse.status, 
          statusText: menuResponse.statusText,
          body: errorBody 
        });
        throw new Error(`Menu API error: ${menuResponse.status}`);
      }

      const menuData = await menuResponse.json();
      const features = menuData.map(item => item.href || item.C_SUBMENU?.map(sub => sub.href)).flat().filter(Boolean);
      console.log("Features fetched successfully, count:", features.length);

    } catch (menuError) {
      console.error("Menu fetch error (non-blocking):", menuError.message);
      // Don't fail login if menu fetch fails
    }

    // Update last login timestamp
    try {
      await pool.query(
        "UPDATE C_USER SET LAST_LOGIN_TIMESTAMP = CURRENT_TIMESTAMP WHERE username = ?",
        [username]
      );
      console.log("Last login timestamp updated for:", username);
    } catch (updateError) {
      console.error("Failed to update last login timestamp:", updateError.message);
      // Don't fail login if timestamp update fails
    }

    console.log("✅ Login successful for:", username);
    return { 
      success: true, 
      empid: user.empid, 
      rolename, 
      orgid: user.orgid, 
      orgname: orgName, 
      token 
    };

  } catch (error) {
    console.error("❌ Login error:", error.message);
    console.error("Full error stack:", error.stack);
    return { success: false, error: "An error occurred during login" };
  }
}
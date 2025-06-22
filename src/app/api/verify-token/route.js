import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import DBconnection from '@/app/utils/config/db';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request) {
  try {
    const { token, pathname } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Token verified in API, decoded payload:", decoded);

    const { roleid, orgid } = decoded;
    if (!roleid || !orgid) {
      return NextResponse.json({ error: 'Missing roleid or orgid in token' }, { status: 400 });
    }

    // Connect to the database
    const pool = await DBconnection();

    // Fetch isadmin from org_role_table
    let isAdmin = false;
    try {
      const [adminRows] = await pool.query(
        'SELECT isadmin FROM org_role_table WHERE roleid = ?',
        [roleid]
      );
      if (adminRows.length > 0) {
        isAdmin = adminRows[0].isadmin === 1;
      }
    } catch (error) {
      console.error('Error fetching isadmin from org_role_table:', error.message);
      isAdmin = false; // Fallback to non-admin on error
    }

    // Fetch menu permissions for the role and organization
    const [rows] = await pool.query(
      `SELECT 
        m.id AS menuid,
        m.name AS menuname,
        m.url AS menuhref,
        m.hassubmenu,
        sm.id AS submenuid,
        sm.name AS submenuname,
        sm.url AS submenuurl,
        omp.priority
      FROM org_menu_priority omp
      JOIN menu m ON m.id = omp.menuid AND m.is_active = 1
      LEFT JOIN submenu sm ON sm.id = omp.submenuid AND sm.is_active = 1
      JOIN role_menu_permissions rmp 
          ON rmp.menuid = omp.menuid 
         AND (rmp.submenuid = omp.submenuid OR omp.submenuid IS NULL)
      WHERE rmp.roleid = ? AND omp.orgid = ?
      ORDER BY omp.priority;`,
      [roleid, orgid]
    );

    // Build accessible items to match LoginPage logic
    const accessibleItems = [];
    const menuMap = new Map();

    for (const row of rows) {
      const {
        menuid,
        menuname,
        menuhref,
        hassubmenu,
        submenuid,
        submenuname,
        submenuurl,
        priority,
      } = row;

      if (!menuMap.has(menuid)) {
        menuMap.set(menuid, {
          title: menuname,
          href: menuhref || null,
          submenu: [],
          priority: priority || 0, // Use priority from org_menu_priority
        });
      }

      const menu = menuMap.get(menuid);

      if (hassubmenu === 'yes' && submenuid && submenuurl) {
        menu.submenu.push({
          title: submenuname,
          href: submenuurl,
          priority: priority || menu.submenu.length + 1, // Sequential priority for submenus
        });
      } else if (menuhref && !menu.href) {
        menu.href = menuhref;
      }
    }

    // Flatten accessible items like in LoginPage
    menuMap.forEach(menu => {
      if (menu.href) {
        accessibleItems.push({
          href: menu.href,
          isMenu: true,
          priority: menu.priority,
        });
      }
      menu.submenu.forEach((sub, index) => {
        accessibleItems.push({
          href: sub.href,
          isMenu: false,
          priority: sub.priority,
        });
      });
    });

    // Add Priority Setting for admins
    if (isAdmin) {
      accessibleItems.push({
        href: '/userscreens/prioritysetting',
        isMenu: true,
        priority: 1000, // High priority to place it last
      });
    }

    // Sort by priority (ascending, lower is least priority)
    accessibleItems.sort((a, b) => a.priority - b.priority);
    console.log("Accessible items for user:", JSON.stringify(accessibleItems, null, 2));

    // If no pathname provided, return accessible items
    if (!pathname) {
      return NextResponse.json({ success: true, accessibleItems });
    }

    // Check if the requested path is accessible
    const accessiblePaths = accessibleItems.map(item => item.href);
    if (!accessiblePaths.includes(pathname)) {
      console.log(`Access denied to ${pathname} for roleid ${roleid}`);
      return NextResponse.json({ error: 'Access denied', accessibleItems }, { status: 403 });
    }

    console.log(`Access granted to ${pathname} for roleid ${roleid}`);
    return NextResponse.json({ success: true, accessibleItems });
  } catch (error) {
    console.error("Verify token API error:", error.message);
    return NextResponse.json({ error: 'Invalid token or server error' }, { status: 401 });
  }
}
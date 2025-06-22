import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET;

export async function GET(request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("JWT token decoded:", decoded);

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

    // Build menu items
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
      } = row;

      if (!menuMap.has(menuid)) {
        menuMap.set(menuid, {
          title: menuname,
          href: menuhref || null,
          submenu: [],
        });
      }

      const menu = menuMap.get(menuid);

      if (hassubmenu === 'yes' && submenuid && submenuurl) {
        menu.submenu.push({
          title: submenuname,
          href: submenuurl,
        });
        if (!menu.href) {
          menu.href = submenuurl;
        }
      } else if (menuhref && !menu.href) {
        menu.href = menuhref;
      }
    }

    // Convert menuMap to array
    const menuItems = Array.from(menuMap.values());

    // Add Priority Setting for admins
    if (isAdmin) {
      menuItems.push({
        title: 'Priority Setting',
        href: '/userscreens/prioritysetting',
        submenu: [],
      });
    }

    console.log("Menu items:", JSON.stringify(menuItems, null, 2));
    return NextResponse.json(menuItems);
  } catch (error) {
    console.error("Menu API error:", error.message);
    return NextResponse.json({ error: 'Invalid token or server error' }, { status: 401 });
  }
}
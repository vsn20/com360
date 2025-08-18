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

    const { empid, orgid } = decoded;
    if (!empid || !orgid) {
      return NextResponse.json({ error: 'Missing empid or orgid in token' }, { status: 400 });
    }

    // Connect to the database
    const pool = await DBconnection();

    // Fetch all role IDs for the employee
    const [roleRows] = await pool.query(
      'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
      [empid, orgid]
    );
    const roleids = roleRows.map(row => row.roleid);

    if (roleids.length === 0) {
      return NextResponse.json({ error: 'No roles assigned to employee' }, { status: 400 });
    }

    // Fetch isadmin for any of the roles
    let isAdmin = false;
    try {
      const [adminRows] = await pool.query(
        'SELECT isadmin FROM C_ORG_ROLE_TABLE WHERE roleid IN (?) AND orgid = ?',
        [roleids, orgid]
      );
      isAdmin = adminRows.some(row => row.isadmin === 1);
    } catch (error) {
      console.error('Error fetching isadmin from C_ORG_ROLE_TABLE:', error.message);
      isAdmin = false;
    }

    // Fetch C_MENU permissions for all roles
    const [rows] = await pool.query(
      `SELECT DISTINCT
        m.id AS menuid,
        m.name AS menuname,
        m.url AS menuhref,
        m.hassubmenu,
        sm.id AS submenuid,
        sm.name AS submenuname,
        sm.url AS submenuurl,
        MIN(omp.priority) AS priority
      FROM C_ORG_MENU_PRIORITY omp
      JOIN C_MENU m ON m.id = omp.menuid AND m.is_active = 1
      LEFT JOIN C_SUBMENU sm ON sm.id = omp.submenuid AND sm.is_active = 1
      JOIN C_ROLE_MENU_PERMISSIONS rmp 
          ON rmp.menuid = omp.menuid 
         AND (rmp.submenuid = omp.submenuid OR omp.submenuid IS NULL)
      WHERE rmp.roleid IN (?) AND omp.orgid = ?
      GROUP BY m.id, m.name, m.url, m.hassubmenu, sm.id, sm.name, sm.url
      ORDER BY priority`,
      [roleids, orgid]
    );

    // Build C_MENU items
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
          C_SUBMENU: [],
        });
      }

      const C_MENU = menuMap.get(menuid);

      if (hassubmenu === 'yes' && submenuid && submenuurl) {
        if (!C_MENU.C_SUBMENU.some(sub => sub.href === submenuurl)) {
          C_MENU.C_SUBMENU.push({
            title: submenuname,
            href: submenuurl,
          });
        }
        if (!C_MENU.href) {
          C_MENU.href = submenuurl;
        }
      } else if (menuhref && !C_MENU.href) {
        C_MENU.href = menuhref;
      }
    }

    // Convert menuMap to array
    const menuItems = Array.from(menuMap.values());

    // Add Priority Setting for admins
    if (isAdmin) {
      menuItems.push({
        title: 'Priority Setting',
        href: '/userscreens/prioritysetting',
        C_SUBMENU: [],
      });
    }

   // console.log("Menu items:", JSON.stringify(menuItems, null, 2));
    return NextResponse.json(menuItems);
  } catch (error) {
    console.error("Menu API error:", error.message);
    return NextResponse.json({ error: 'Invalid token or server error' }, { status: 401 });
  }
}
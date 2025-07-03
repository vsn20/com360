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
        'SELECT isadmin FROM org_role_table WHERE roleid = ? AND orgid = ?',
        [roleid, orgid]
      );
      if (adminRows.length > 0) {
        isAdmin = adminRows[0].isadmin === 1;
      }
    } catch (error) {
      console.error('Error fetching isadmin from org_role_table:', error.message);
      isAdmin = false;
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
      ORDER BY omp.priority`,
      [roleid, orgid]
    );

    // Build accessible items
    const accessibleItems = [];
    const menuMap = new Map();
    let hasAddEmployee = false;
    let hasAddRoles = false;
    let hasAddAccount = false;
    let hasAdproject = false;
    let hastimesheet=false;
    let hasEditProjectAssignment = false; // Flag for project assignment edit
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
          priority: priority || 0,
        });
      }

      const menu = menuMap.get(menuid);
if (menuhref === '/userscreens/timesheets') { // Updated to match case
          hastimesheet = true;
        }
      if (hassubmenu === 'yes' && submenuid && submenuurl) {
        menu.submenu.push({
          title: submenuname,
          href: submenuurl,
          priority: priority || menu.submenu.length + 1,
        });
        if (submenuurl === '/userscreens/employee/addemployee') {
          hasAddEmployee = true;
        }
        if (submenuurl === '/userscreens/roles/addroles') {
          hasAddRoles = true;
        }
        if (submenuurl === '/userscreens/account/addaccount') {
          hasAddAccount = true;
        }
        if (submenuurl === '/userscreens/project/addproject') {
          hasAdproject = true;
        }
        if (submenuurl === '/userscreens/Project_Assign/add_project_assign') { // Updated to match case
          hasEditProjectAssignment = true;
        }
      } else if (menuhref && !menu.href) {
        menu.href = menuhref;
      }
    }
    menuMap.forEach(menu => {
      if (menu.href) {
        accessibleItems.push({
          href: menu.href,
          isMenu: true,
          priority: menu.priority,
        });
      }
      menu.submenu.forEach((sub) => {
        accessibleItems.push({
          href: sub.href,
          isMenu: false,
          priority: sub.priority,
        });
      });
    });

  
    if (isAdmin) {
      accessibleItems.push({
        href: '/userscreens/prioritysetting',
        isMenu: true,
        priority: 1000,
      });
    }

    if (hasAddEmployee) {
      accessibleItems.push({
        href: '/userscreens/employee/edit/:empid',
        isMenu: true,
        priority: 1001,
      });
    }

    if (hasAddRoles) {
      accessibleItems.push({
        href: '/userscreens/roles/edit/:roleid',
        isMenu: true,
        priority: 1002,
      });
    }

    if (hasAddAccount) {
      accessibleItems.push({
        href: '/userscreens/account/edit/:accntId',
        isMenu: true,
        priority: 1003,
      });
    }

    if (hasAdproject) {
      accessibleItems.push({
        href: '/userscreens/project/edit/:PRJ_ID',
        isMenu: true,
        priority: 1004,
      });
    }

    if (hasEditProjectAssignment) {
      accessibleItems.push({
        href: '/userscreens/Project_Assign/edit/:PRJ_ID', // Updated to match case
        isMenu: true,
        priority: 1005,
      });
    }
 if (hastimesheet) {
      accessibleItems.push({
        href: '/userscreens/timesheets/pendingapproval',
        isMenu: true,
        priority: 10000,
      });
    }
    accessibleItems.sort((a, b) => a.priority - b.priority);
    console.log("Accessible items for user:", JSON.stringify(accessibleItems, null, 2));

    if (!pathname) {
      return NextResponse.json({ success: true, accessibleItems });
    }

    const accessiblePaths = accessibleItems.map(item => item.href);
    const isEditEmployeePath = pathname.match(/^\/userscreens\/employee\/edit\/[^/]+$/);
    const isEditRolePath = pathname.match(/^\/userscreens\/roles\/edit\/[^/]+$/);
    const isEditAccountPath = pathname.match(/^\/userscreens\/account\/edit\/[^/]+$/);
    const isEditProjectPath = pathname.match(/^\/userscreens\/project\/edit\/[^/]+$/);
    const isEditProjectAssignmentPath = pathname.match(/^\/userscreens\/Project_Assign\/edit\/[^/]+$/); // Updated to match case
    const ispendingapproval=pathname.match(/^\/userscreens\/timesheets\/pendingapproval$/)
    if (isEditEmployeePath && accessiblePaths.includes('/userscreens/employee/edit/:empid')) {
      console.log(`Access granted to ${pathname} for roleid ${roleid} (dynamic employee edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if(ispendingapproval&&accessiblePaths.includes('/userscreens/timesheets/pendingapproval')){
       console.log(`Access granted to ${pathname} for roleid ${roleid} (dynamic employee edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isEditProjectPath && accessiblePaths.includes('/userscreens/project/edit/:PRJ_ID')) {
      console.log(`Access granted to ${pathname} for roleid ${roleid} (dynamic project edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isEditRolePath && accessiblePaths.includes('/userscreens/roles/edit/:roleid')) {
      console.log(`Access granted to ${pathname} for roleid ${roleid} (dynamic role edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isEditAccountPath && accessiblePaths.includes('/userscreens/account/edit/:accntId')) {
      console.log(`Access granted to ${pathname} for roleid ${roleid} (dynamic account edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isEditProjectAssignmentPath && accessiblePaths.includes('/userscreens/Project_Assign/edit/:PRJ_ID')) {
      console.log(`Access granted to ${pathname} for roleid ${roleid} (dynamic project assignment edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }

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
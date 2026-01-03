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
    // console.log("Token verified in API, decoded payload:", decoded);

    const { empid, orgid } = decoded;
    if (!empid || !orgid) {
      return NextResponse.json({ error: 'Missing empid or orgid in token' }, { status: 400 });
    }

    // Grant access to upload paths for authenticated users
    let isUploadPath = pathname && pathname.match(/^\/Uploads\/[^/]+\/[^/]+\/[^/]+$/);
    const isResumePath = pathname && pathname.match(/^\/uploads\/resumes\/[^_]+_[^/]+\.pdf$/);
    const isOfferLetterPath = pathname && pathname.match(/^\/uploads\/offerletter\/[^_]+_[^/]+\.pdf$/);
    const isDocumentsPath = pathname && pathname.match(/^\/uploads\/documents\/.*$/); // Unrestricted access to /uploads/documents
    const isProfilePhotoPath = pathname && pathname.match(/^\/uploads\/profile_photos\/.*$/); // Unrestricted access to /uploads/profile_photos
    const isServiceRequestPath = pathname && pathname.match(/^\/uploads\/ServiceRequests\/.*$/i); // Service Request attachments
    
    // --- ADDED: Check for Logo Path ---
    const isLogoPath = pathname && pathname.match(/^\/COM360LOGOS\.jpg$/); 

    // --- UPDATED: Included isLogoPath and isServiceRequestPath in the condition ---
    if (isUploadPath || isResumePath || isOfferLetterPath || isDocumentsPath || isProfilePhotoPath || isLogoPath || isServiceRequestPath) {
      // Check if the applicationid prefix (from pathname) matches orgid for resume or offer letter paths
      if (isResumePath || isOfferLetterPath) {
        const applicationidMatch = pathname.match(/^\/uploads\/(resumes|offerletter)\/([^_]+)_/);
        if (applicationidMatch) {
          // Extract the full Application ID (e.g. "39-1")
          const fullAppId = applicationidMatch[2];
          
          // ✅ FIX: Split by '-' to get the full Org ID prefix (e.g. "39" from "39-1") instead of just the first char
          const fileOrgPrefix = parseInt(fullAppId.split('-')[0]);
          
          if (fileOrgPrefix === parseInt(orgid)) {
            console.log(`Access granted to ${pathname} for empid ${empid} (${isResumePath ? 'resume' : 'offer letter'} path with matching orgid ${orgid})`);
            return NextResponse.json({ success: true, accessibleItems: [] });
          } else {
            console.log(`Access denied to ${pathname} for empid ${empid} (orgid mismatch: ${fileOrgPrefix} vs ${orgid})`);
            return NextResponse.json({ error: 'Access denied due to orgid mismatch', accessibleItems: [] }, { status: 403 });
          }
        }
      }
      
      // --- UPDATED: Allow unrestricted access if it is a document, profile photo, logo, OR Service Request attachment ---
      if (isDocumentsPath || isProfilePhotoPath || isLogoPath || isServiceRequestPath) {
        console.log(`Unrestricted access granted to ${pathname} for empid ${empid} (static resource path)`);
        return NextResponse.json({ success: true, accessibleItems: [] });
      }
      
      console.log(`Universal access granted to ${pathname} for empid ${empid} (upload path)`);
      return NextResponse.json({ success: true, accessibleItems: [] });
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
    let issuperadmin = false;
    try {
      const [adminRows] = await pool.query(
        'SELECT isadmin,issuperadmin FROM C_ORG_ROLE_TABLE WHERE roleid IN (?) AND orgid = ?',
        [roleids, orgid]
      );
      isAdmin = adminRows.some(row => row.isadmin === 1);
      issuperadmin = adminRows.some(row => row.issuperadmin === 1);
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

    // Build accessible items
    const accessibleItems = [];
    const menuMap = new Map();
    let hasAddEmployee = false;
    let hasAddRoles = false;
    let hasAddAccount = false;
    let hasAdproject = false;
    let hastimesheet = false;
    let hasEditProjectAssignment = false;
    let hasleaves = false;

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
          C_SUBMENU: [],
          priority: priority || 0,
        });
      }

      const C_MENU = menuMap.get(menuid);
      if (menuhref === '/userscreens/C_TIMESHEETS') {
        hastimesheet = true;
      }
      if (menuhref === '/userscreens/leaves') {
        hasleaves = true;
      }
      if (hassubmenu === 'yes' && submenuid && submenuurl) {
        if (!C_MENU.C_SUBMENU.some(sub => sub.href === submenuurl)) {
          C_MENU.C_SUBMENU.push({
            title: submenuname,
            href: submenuurl,
            priority: priority || C_MENU.C_SUBMENU.length + 1,
          });
        }
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
        if (submenuurl === '/userscreens/Project_Assign/add_project_assign') {
          hasEditProjectAssignment = true;
        }
      } else if (menuhref && !C_MENU.href) {
        C_MENU.href = menuhref;
      }
    }

    menuMap.forEach(C_MENU => {
      if (C_MENU.href) {
        accessibleItems.push({
          href: C_MENU.href,
          isMenu: true,
          priority: C_MENU.priority,
        });
      }
      C_MENU.C_SUBMENU.forEach((sub) => {
        accessibleItems.push({
          href: sub.href,
          isMenu: false,
          priority: sub.priority,
        });
      });
    });

    // Add unrestricted /uploads/documents and /uploads/profile_photos to accessible items
    accessibleItems.push({
      href: '/uploads/documents/*',
      isMenu: false,
      priority: 10006,
    });
    accessibleItems.push({
      href: '/uploads/profile_photos/*',
      isMenu: false,
      priority: 10007,
    });

    if (isAdmin) {
      accessibleItems.push({
        href: '/userscreens/prioritysetting',
        isMenu: true,
        priority: 1000,
      });
    }
    if(issuperadmin){
      accessibleItems.push({
        href: '/userscreens/neworganization',
        isMenu: true,
        priority:1001
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
        href: '/userscreens/Project_Assign/edit/:PRJ_ID',
        isMenu: true,
        priority: 1005,
      });
    }

    if (hastimesheet) {
      accessibleItems.push({
        href: '/userscreens/C_TIMESHEETS/pendingapproval',
        isMenu: true,
        priority: 10000,
      });
      accessibleItems.push({
        href: '/Uploads/:employeeId/:date/:filename',
        isMenu: false,
        priority: 10001,
      });
    }

    if (hasleaves) {
      accessibleItems.push({
        href: '/userscreens/leaves/addleave',
        isMenu: true,
        priority: 10002,
      });
      accessibleItems.push({
        href: '/userscreens/leaves/pending',
        isMenu: true,
        priority: 10003,
      });
    }

    //accessibleItems.sort((a, b) => a.priority - b.priority);
    // console.log("Accessible items for user:", JSON.stringify(accessibleItems, null, 2));

    if (!pathname) {
      return NextResponse.json({ success: true, accessibleItems });
    }

    const accessiblePaths = accessibleItems.map(item => item.href);
    const isEditEmployeePath = pathname.match(/^\/userscreens\/employee\/edit\/[^/]+$/);
    const isEditRolePath = pathname.match(/^\/userscreens\/roles\/edit\/[^/]+$/);
    const isEditAccountPath = pathname.match(/^\/userscreens\/account\/edit\/[^/]+$/);
    const isEditProjectPath = pathname.match(/^\/userscreens\/project\/edit\/[^/]+$/);
    const isEditProjectAssignmentPath = pathname.match(/^\/userscreens\/Project_Assign\/edit\/[^/]+$/);
    const ispendingapproval = pathname.match(/^\/userscreens\/C_TIMESHEETS\/pendingapproval$/);
    const isaddleave = pathname.match(/^\/userscreens\/leaves\/addleave$/);
    const ispendingleaves = pathname.match(/^\/userscreens\/leaves\/pending$/);
    isUploadPath = pathname.match(/^\/Uploads\/[^/]+\/[^/]+\/[^/]+$/);
    const isDocumentsPathCheck = pathname.match(/^\/uploads\/documents\/.*$/); // Check for documents path
    const isProfilePhotoPathCheck = pathname.match(/^\/uploads\/profile_photos\/.*$/); // Check for profile photos path

    if (isEditEmployeePath && accessiblePaths.includes('/userscreens/employee/edit/:empid')) {
      console.log(`Access granted to ${pathname} for empid ${empid} (dynamic employee edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isaddleave && accessiblePaths.includes('/userscreens/leaves/addleave')) {
      console.log(`Access granted to ${pathname} for empid ${empid} (dynamic add leave route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (ispendingleaves && accessiblePaths.includes('/userscreens/leaves/pending')) {
      console.log(`Access granted to ${pathname} for empid ${empid} (dynamic pending leaves route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (ispendingapproval && accessiblePaths.includes('/userscreens/C_TIMESHEETS/pendingapproval')) {
      console.log(`Access granted to ${pathname} for empid ${empid} (dynamic pending approval route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isEditProjectPath && accessiblePaths.includes('/userscreens/project/edit/:PRJ_ID')) {
      console.log(`Access granted to ${pathname} for empid ${empid} (dynamic project edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isEditRolePath && accessiblePaths.includes('/userscreens/roles/edit/:roleid')) {
      console.log(`Access granted to ${pathname} for empid ${empid} (dynamic role edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isEditAccountPath && accessiblePaths.includes('/userscreens/account/edit/:accntId')) {
      console.log(`Access granted to ${pathname} for empid ${empid} (dynamic account edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isEditProjectAssignmentPath && accessiblePaths.includes('/userscreens/Project_Assign/edit/:PRJ_ID')) {
      console.log(`Access granted to ${pathname} for empid ${empid} (dynamic project assignment edit route)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isUploadPath && accessiblePaths.includes('/Uploads/:employeeId/:date/:filename')) {
      console.log(`Access granted to ${pathname} for empid ${empid} (upload path)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isDocumentsPathCheck && accessiblePaths.includes('/uploads/documents/*')) {
      console.log(`Unrestricted access granted to ${pathname} for empid ${empid} (documents path)`);
      return NextResponse.json({ success: true, accessibleItems });
    }
    if (isProfilePhotoPathCheck && accessiblePaths.includes('/uploads/profile_photos/*')) {
      console.log(`Unrestricted access granted to ${pathname} for empid ${empid} (profile photos path)`);
      return NextResponse.json({ success: true, accessibleItems });
    }

    if (!accessiblePaths.includes(pathname)) {
      console.log(`Access denied to ${pathname} for empid ${empid}`);
      return NextResponse.json({ error: 'Access denied', accessibleItems }, { status: 403 });
    }

    console.log(`Access granted to ${pathname} for empid ${empid}`);
    return NextResponse.json({ success: true, accessibleItems });
  } catch (error) {
    console.error("Verify token API error:", error.message);
    return NextResponse.json({ error: 'Invalid token or server error' }, { status: 401 });
  }
}
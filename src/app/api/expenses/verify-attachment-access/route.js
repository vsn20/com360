// src/app/api/expenses/verify-attachment-access/route.js
import { NextResponse } from 'next/server';
import DBconnection from '@/app/utils/config/db';

// Decode JWT
const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, expenseId, orgid, empid } = body;

    if (!token || !expenseId || !orgid || !empid) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Decode and validate token
    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid !== orgid || decoded.empid !== empid) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const pool = await DBconnection();

    // Check if this expense belongs to the requesting user's organization
    const [expense] = await pool.query(
      'SELECT EMP_ID, ORG_ID, VERIFIER_ID FROM C_EXPENSES WHERE ID = ?',
      [expenseId]
    );

    if (expense.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      );
    }

    const expenseData = expense[0];

    // Verify orgid matches
    if (expenseData.ORG_ID !== orgid) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Organization mismatch' },
        { status: 403 }
      );
    }

    // Allow access if:
    // 1. User is the expense owner (submitter)
    // 2. User is the verifier
    // 3. User has verification permissions for this employee
    if (expenseData.EMP_ID === empid || expenseData.VERIFIER_ID === empid) {
      console.log(`✅ Access granted: User is expense owner or verifier`);
      return NextResponse.json({ success: true });
    }

    // Check if user has verifier permissions for this employee
    // Get user's role assignments
    const [roleAssignments] = await pool.query(
      'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
      [empid, orgid]
    );

    if (roleAssignments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No permissions' },
        { status: 403 }
      );
    }

    const roleIds = roleAssignments.map(r => r.roleid);

    // Check if user has expense verification permissions (menuid=16, submenuid=22)
    const [permissions] = await pool.query(
      `SELECT roleid, alldata, teamdata 
       FROM C_ROLE_MENU_PERMISSIONS 
       WHERE roleid IN (?) AND menuid = 16 AND submenuid = 22 
       AND (alldata = 1 OR teamdata = 1)`,
      [roleIds]
    );

    if (permissions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No verification permissions' },
        { status: 403 }
      );
    }

    // If has alldata permission, allow access
    const hasAllData = permissions.some(p => p.alldata === 1);
    if (hasAllData) {
      console.log(`✅ Access granted: User has alldata permission`);
      return NextResponse.json({ success: true });
    }

    // If has teamdata permission, check if expense owner is a subordinate
    const hasTeamData = permissions.some(p => p.teamdata === 1);
    if (hasTeamData) {
      const isSubordinate = await checkIfSubordinate(empid, expenseData.EMP_ID, orgid, pool);
      if (isSubordinate) {
        console.log(`✅ Access granted: Expense owner is subordinate`);
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized: Cannot access this expense' },
      { status: 403 }
    );

  } catch (error) {
    console.error('❌ Error verifying attachment access:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Recursive function to check if targetEmpId is a subordinate of verifierEmpId
async function checkIfSubordinate(verifierEmpId, targetEmpId, orgid, pool) {
  try {
    // Get direct subordinates of verifier
    const [directReports] = await pool.query(
      'SELECT empid FROM C_EMP WHERE superior = ? AND orgid = ? AND STATUS = "ACTIVE"',
      [verifierEmpId, orgid]
    );

    // Check if target is a direct subordinate
    if (directReports.some(r => r.empid === targetEmpId)) {
      return true;
    }

    // Recursively check nested subordinates
    for (const report of directReports) {
      const isNested = await checkIfSubordinate(report.empid, targetEmpId, orgid, pool);
      if (isNested) return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking subordinate:', error);
    return false;
  }
}
// src/app/serverActions/expenses/verification.js
'use server';

import DBconnection from '@/app/utils/config/db';

// ✅ Get nested employees based on verifier permissions
export async function getVerifierEmployees(empid, orgid) {
  const pool = await DBconnection();
  
  try {
    console.log('🔍 Checking verifier permissions for empid:', empid, 'orgid:', orgid);
    
    // Step 1: Get all role IDs for this employee
    const [roleAssignments] = await pool.query(
      'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
      [empid, orgid]
    );
    
    if (roleAssignments.length === 0) {
      console.log('⚠️ No roles found for verifier');
      return { employees: [], hasAllData: false };
    }
    
    const roleIds = roleAssignments.map(r => r.roleid);
    console.log('📋 Role IDs:', roleIds);
    
    // Step 2: Check permissions for menuid=16 and submenuid=22
    const [permissions] = await pool.query(
      `SELECT roleid, alldata, teamdata, individualdata 
       FROM C_ROLE_MENU_PERMISSIONS 
       WHERE roleid IN (?) AND menuid = 16 AND submenuid = 22`,
      [roleIds]
    );
    
    if (permissions.length === 0) {
      console.log('⚠️ No expense verification permissions found');
      return { employees: [], hasAllData: false };
    }
    
    console.log('🔐 Permissions:', permissions);
    
    // Check if any role has alldata = 1
    const hasAllData = permissions.some(p => p.alldata === 1);
    const hasTeamData = permissions.some(p => p.teamdata === 1);
    
    let employees = [];
    
    if (hasAllData) {
      // Can verify all employees in the organization (including themselves)
      console.log('✅ Has ALL DATA permission - fetching all employees in org');
      const [allEmployees] = await pool.query(
        `SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, email 
         FROM C_EMP 
         WHERE orgid = ? AND STATUS = 'ACTIVE'
         ORDER BY EMP_FST_NAME, EMP_LAST_NAME`,
        [orgid]
      );
      employees = allEmployees;
    } else if (hasTeamData) {
      // Can verify subordinates only (not themselves)
      console.log('✅ Has TEAM DATA permission - fetching subordinates');
      employees = await getSubordinates(empid, orgid, pool);
    } else {
      console.log('⚠️ No valid permissions (alldata or teamdata required)');
      return { employees: [], hasAllData: false };
    }
    
    console.log('👥 Total employees accessible:', employees.length);
    return { employees, hasAllData };
    
  } catch (error) {
    console.error('❌ Error fetching verifier employees:', error);
    throw new Error('Failed to fetch employees: ' + error.message);
  }
}

// ✅ Recursive function to get all nested subordinates
async function getSubordinates(empid, orgid, pool) {
  try {
    // Get direct subordinates
    const [directReports] = await pool.query(
      `SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, email, superior 
       FROM C_EMP 
       WHERE superior = ? AND orgid = ? AND STATUS = 'ACTIVE'`,
      [empid, orgid]
    );
    
    let allSubordinates = [...directReports];
    
    // Recursively get subordinates of subordinates
    for (const report of directReports) {
      const nestedSubordinates = await getSubordinates(report.empid, orgid, pool);
      allSubordinates = [...allSubordinates, ...nestedSubordinates];
    }
    
    return allSubordinates;
  } catch (error) {
    console.error('Error getting subordinates:', error);
    return [];
  }
}

// ✅ Get expense categories from C_GENERIC_VALUES
export async function getExpenseCategories(orgid) {
  try {
    const pool = await DBconnection();
    
    const [types] = await pool.query(
      'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 24 AND isactive = 1 AND orgid = ? ORDER BY Name',
      [orgid]
    );
    
    const [subtypes] = await pool.query(
      'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 25 AND isactive = 1 AND orgid = ? ORDER BY Name',
      [orgid]
    );
    
    const [categories] = await pool.query(
      'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 26 AND isactive = 1 AND orgid = ? ORDER BY Name',
      [orgid]
    );
    
    return {
      types,
      subtypes,
      categories
    };
  } catch (error) {
    console.error('Error fetching categories:', error);
    return {
      types: [],
      subtypes: [],
      categories: []
    };
  }
}

// ✅ Get expenses for verification
export async function getExpensesForVerification(empIds, orgid, pendingOnly = false) {
  const pool = await DBconnection();
  
  try {
    if (!empIds || empIds.length === 0) {
      return [];
    }
    
    console.log('💰 Fetching expenses for verification. EmpIDs:', empIds.length, 'PendingOnly:', pendingOnly);
    
    // Build query with optional pending filter
    let query = `
      SELECT 
        e.*,
        CONCAT(emp.EMP_FST_NAME, ' ', emp.EMP_LAST_NAME) as EMP_NAME,
        verifier.EMP_FST_NAME as VERIFIER_FIRST_NAME,
        verifier.EMP_LAST_NAME as VERIFIER_LAST_NAME,
        CONCAT(verifier.EMP_FST_NAME, ' ', verifier.EMP_LAST_NAME) as VERIFIER_NAME
      FROM C_EXPENSES e
      INNER JOIN C_EMP emp ON e.EMP_ID = emp.empid
      LEFT JOIN C_EMP verifier ON e.VERIFIER_ID = verifier.empid
      WHERE e.EMP_ID IN (?) AND e.ORG_ID = ?
    `;
    
    if (pendingOnly) {
      query += ' AND e.APPROVED_FLAG = 0';
    }
    
    query += ' ORDER BY e.SUBMITTED_DATE DESC, e.CREATED_AT DESC';
    
    const [expenses] = await pool.query(query, [empIds, orgid]);
    
    console.log('✅ Found expenses:', expenses.length);
    
    // Fetch attachments for each expense
    for (let expense of expenses) {
      const [attachments] = await pool.query(
        'SELECT * FROM C_EXPENSE_ATTACHMENTS WHERE EXPENSE_ID = ?',
        [expense.ID]
      );
      expense.ATTACHMENTS = attachments;
    }
    
    return expenses;
  } catch (error) {
    console.error('❌ Error fetching expenses for verification:', error);
    throw new Error('Failed to fetch expenses: ' + error.message);
  }
}

// ✅ Verify an expense
export async function verifyExpense(expenseId, verifierId, orgid) {
  const pool = await DBconnection();
  
  try {
    console.log('✔️ Verifying expense:', expenseId, 'by verifier:', verifierId);
    
    // Check if expense exists and is pending
    const [expense] = await pool.query(
      'SELECT * FROM C_EXPENSES WHERE ID = ? AND ORG_ID = ?',
      [expenseId, orgid]
    );
    
    if (expense.length === 0) {
      throw new Error('Expense not found');
    }
    
    // Update expense as verified
    const [result] = await pool.query(
      `UPDATE C_EXPENSES 
       SET APPROVED_FLAG = 1, 
           VERIFIER_ID = ?,
           UPDATED_AT = NOW(),
           UPDATED_BY = ?
       WHERE ID = ?`,
      [verifierId, verifierId, expenseId]
    );
    
    if (result.affectedRows === 0) {
      throw new Error('Failed to verify expense');
    }
    
    console.log('✅ Expense verified successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error verifying expense:', error);
    throw new Error('Failed to verify expense: ' + error.message);
  }
}

// ✅ Unverify an expense (in case verifier needs to update it)
export async function unverifyExpense(expenseId, orgid) {
  const pool = await DBconnection();
  
  try {
    console.log('↩️ Unverifying expense:', expenseId);
    
    const [result] = await pool.query(
      `UPDATE C_EXPENSES 
       SET APPROVED_FLAG = 0, 
           VERIFIER_ID = NULL,
           UPDATED_AT = NOW()
       WHERE ID = ? AND ORG_ID = ?`,
      [expenseId, orgid]
    );
    
    if (result.affectedRows === 0) {
      throw new Error('Failed to unverify expense');
    }
    
    console.log('✅ Expense unverified successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error unverifying expense:', error);
    throw new Error('Failed to unverify expense: ' + error.message);
  }
}
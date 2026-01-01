// src/app/serverActions/expenses/expenses.js
'use server';

import DBconnection from '@/app/utils/config/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// ✅ Utility function to format dates properly (UTC to avoid timezone issues)
const formatDate = (date) => {
  if (!date || isNaN(new Date(date))) return null;
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ✅ Generate unique expense ID
const generateExpenseId = () => {
  return `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

// ✅ Generate unique attachment ID
const generateAttachmentId = () => {
  return `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

// ✅ Upload attachment with meaningful filename
export async function uploadAttachment(file, expenseId, attachmentType = 'receipt') {
  try {
    console.log(`📎 Uploading ${attachmentType} for expense ID:`, expenseId);
    
    if (!expenseId) {
      throw new Error('Expense ID is required for attachment upload');
    }
    
    // Get file extension
    const ext = path.extname(file.name) || '.png';
    
    // Define directory - save to /uploads/expenses/ for Nginx access
    const publicDir = path.join(process.cwd(), 'public', 'uploads', 'expenses');
    await fs.mkdir(publicDir, { recursive: true });
    
    // ✅ Use expense ID + timestamp for unique filename
    const timestamp = Date.now();
    const filename = `expense_${expenseId}_${timestamp}${ext}`;
    const filePath = path.join(publicDir, filename);
    
    // Convert file to buffer and write
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Validate file size (max 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('File too large (max 5MB)');
    }
    
    await fs.writeFile(filePath, buffer);
    
    console.log('✅ Attachment saved:', filename);
    
    return { 
      success: true, 
      path: `/uploads/expenses/${filename}`,
      filename: filename
    };
  } catch (error) {
    console.error('❌ Error uploading attachment:', error);
    return { success: false, error: error.message };
  }
}

// ✅ Delete attachment file
export async function deleteAttachment(filename) {
  try {
    if (!filename) return { success: true };
    
    const publicDir = path.join(process.cwd(), 'public', 'uploads', 'expenses');
    const filePath = path.join(publicDir, filename);
    
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      console.log('✅ Deleted attachment:', filename);
    } catch (err) {
      console.log('ℹ️ Attachment file not found:', filename);
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting attachment:', error);
    return { success: false, error: error.message };
  }
}

// ✅ Verify expense can be edited
export async function canEditExpense(expenseId) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.query(
      'SELECT APPROVED_FLAG FROM C_EXPENSES WHERE ID = ?',
      [expenseId]
    );
    
    if (rows.length === 0) {
      return { canEdit: false, reason: 'Expense not found' };
    }
    
    const expense = rows[0];
    
    // Cannot edit if approved by verifier
    if (expense.APPROVED_FLAG === 1) {
      return { canEdit: false, reason: 'This expense has been verified and cannot be edited' };
    }
    
    return { canEdit: true };
  } catch (error) {
    console.error('Error checking edit permission:', error);
    return { canEdit: false, reason: 'Error checking permissions' };
  }
}

// ✅ Get expense categories from C_GENERIC_VALUES - FIXED WITH ORGID
export async function getExpenseCategories(orgid) {
  try {
    console.log('📋 Fetching categories for orgid:', orgid);
    const pool = await DBconnection();
    
    // GID 24 = expense_type, 25 = expense_sub_type, 26 = expenses_category
    // Filter by g_id AND orgid to get only relevant categories for this organization
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
    
    console.log('✅ Categories loaded:', {
      types: types.length,
      subtypes: subtypes.length,
      categories: categories.length
    });
    
    return {
      types,
      subtypes,
      categories
    };
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    return {
      types: [],
      subtypes: [],
      categories: []
    };
  }
}

// ✅ Add new expense
export async function addExpense(formData) {
  const pool = await DBconnection();
  
  try {
    const expenseId = generateExpenseId();
    
    const start_date = formatDate(formData.get('start_date'));
    const end_date = formatDate(formData.get('end_date'));
    const type = formData.get('type'); // Stores id from C_GENERIC_VALUES (not g_id)
    const subtype = formData.get('subtype') || null; // Stores id from C_GENERIC_VALUES
    const category = formData.get('category'); // Stores id from C_GENERIC_VALUES
    const description = formData.get('description') || null;
    const amount = parseFloat(formData.get('amount')) || 0;
    const tax = parseFloat(formData.get('tax')) || 0;
    const tip = parseFloat(formData.get('tip')) || 0;
    const total = parseFloat(formData.get('total')) || 0;
    const orgid = formData.get('orgid');
    const emp_id = formData.get('emp_id');
    
    console.log('💾 Creating expense:', {
      expenseId,
      orgid,
      emp_id,
      type,
      subtype,
      category
    });
    
    // Insert expense - TYPE, SUBTYPE, CATEGORY store the id values
    const query = `
      INSERT INTO C_EXPENSES (
        ID, ORG_ID, EMP_ID, START_DATE, END_DATE, TYPE, SUBTYPE, CATEGORY,
        DESCRIPTION, SUBMITTED_DATE, APPROVED_FLAG, AMOUNT, TAX, TIP, TOTAL,
        CREATED_AT, CREATED_BY
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 0, ?, ?, ?, ?, NOW(), ?)
    `;

    const values = [
      expenseId, orgid, emp_id, start_date, end_date, type, subtype, category,
      description, amount, tax, tip, total, emp_id
    ];

    await pool.query(query, values);
    console.log('✅ Expense created with ID:', expenseId);

    // Handle attachments
    const attachmentCount = parseInt(formData.get('attachment_count')) || 0;
    
    for (let i = 0; i < attachmentCount; i++) {
      const file = formData.get(`attachment_${i}`);
      if (file && file.size > 0) {
        const uploadResult = await uploadAttachment(file, expenseId, 'receipt');
        
        if (uploadResult.success) {
          const attachmentId = generateAttachmentId();
          await pool.query(
            `INSERT INTO C_EXPENSE_ATTACHMENTS (ATTACHMENT_ID, EXPENSE_ID, ATTACHMENT_TYPE, ATTACHMENT_URL, CREATED_AT) 
             VALUES (?, ?, ?, ?, NOW())`,
            [attachmentId, expenseId, path.extname(file.name).slice(1).toUpperCase(), uploadResult.path]
          );
          console.log('✅ Attachment saved:', uploadResult.filename);
        }
      }
    }

    return { success: true, id: expenseId };
  } catch (error) {
    console.error('❌ Error adding expense:', error);
    throw new Error('Failed to add expense: ' + error.message);
  }
}

// ✅ Fetch expenses by employee ID with attachments and verifier info
export async function fetchExpensesByEmpId(empId, orgId) {
  const pool = await DBconnection();
  
  try {
    console.log('🔍 Fetching expenses for empId:', empId, 'orgId:', orgId);
    
    // Fetch expenses with verifier name
    // TYPE, SUBTYPE, CATEGORY contain id values that need to be looked up in C_GENERIC_VALUES
    const [expenses] = await pool.query(`
      SELECT 
        e.*,
        emp.EMP_FST_NAME as VERIFIER_FIRST_NAME,
        emp.EMP_LAST_NAME as VERIFIER_LAST_NAME,
        CONCAT(emp.EMP_FST_NAME, ' ', emp.EMP_LAST_NAME) as VERIFIER_NAME
      FROM C_EXPENSES e
      LEFT JOIN C_EMP emp ON e.VERIFIER_ID = emp.empid
      WHERE e.EMP_ID = ? AND e.ORG_ID = ?
      ORDER BY e.CREATED_AT DESC
    `, [empId, orgId]);

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
    console.error('❌ Error fetching expenses:', error);
    throw new Error('Failed to fetch expenses');
  }
}

// ✅ Update expense
export async function updateExpense(expenseId, formData) {
  const pool = await DBconnection();
  
  try {
    // Check if expense can be edited
    const editCheck = await canEditExpense(expenseId);
    if (!editCheck.canEdit) {
      throw new Error(editCheck.reason);
    }
    
    console.log('🔄 Updating expense ID:', expenseId);
    
    const start_date = formatDate(formData.get('start_date'));
    const end_date = formatDate(formData.get('end_date'));
    const type = formData.get('type'); // id from C_GENERIC_VALUES
    const subtype = formData.get('subtype') || null; // id from C_GENERIC_VALUES
    const category = formData.get('category'); // id from C_GENERIC_VALUES
    const description = formData.get('description') || null;
    const amount = parseFloat(formData.get('amount')) || 0;
    const tax = parseFloat(formData.get('tax')) || 0;
    const tip = parseFloat(formData.get('tip')) || 0;
    const total = parseFloat(formData.get('total')) || 0;

    // Update expense data - TYPE, SUBTYPE, CATEGORY store id values
    const query = `
      UPDATE C_EXPENSES 
      SET START_DATE = ?, END_DATE = ?, TYPE = ?, SUBTYPE = ?, CATEGORY = ?,
          DESCRIPTION = ?, AMOUNT = ?, TAX = ?, TIP = ?, TOTAL = ?,
          UPDATED_AT = NOW()
      WHERE ID = ?
    `;

    const values = [
      start_date, end_date, type, subtype, category,
      description, amount, tax, tip, total, expenseId
    ];

    const [result] = await pool.query(query, values);
    
    if (result.affectedRows === 0) {
      throw new Error('Expense not found or no changes made');
    }

    // Handle attachments - get list of attachments to keep
    const existingAttachmentsStr = formData.get('existing_attachments');
    const existingAttachments = existingAttachmentsStr ? JSON.parse(existingAttachmentsStr) : [];
    const existingIds = existingAttachments.map(a => a.ATTACHMENT_ID);

    // Get current attachments from database
    const [currentAttachments] = await pool.query(
      'SELECT * FROM C_EXPENSE_ATTACHMENTS WHERE EXPENSE_ID = ?',
      [expenseId]
    );

    // Delete attachments that are not in the keep list
    for (let attachment of currentAttachments) {
      if (!existingIds.includes(attachment.ATTACHMENT_ID)) {
        // Delete file
        const filename = path.basename(attachment.ATTACHMENT_URL);
        await deleteAttachment(filename);
        
        // Delete database record
        await pool.query(
          'DELETE FROM C_EXPENSE_ATTACHMENTS WHERE ATTACHMENT_ID = ?',
          [attachment.ATTACHMENT_ID]
        );
        console.log('✅ Deleted attachment:', attachment.ATTACHMENT_ID);
      }
    }

    // Add new attachments
    const attachmentCount = parseInt(formData.get('attachment_count')) || 0;
    
    for (let i = 0; i < attachmentCount; i++) {
      const file = formData.get(`attachment_${i}`);
      if (file && file.size > 0) {
        const uploadResult = await uploadAttachment(file, expenseId, 'receipt');
        
        if (uploadResult.success) {
          const attachmentId = generateAttachmentId();
          await pool.query(
            `INSERT INTO C_EXPENSE_ATTACHMENTS (ATTACHMENT_ID, EXPENSE_ID, ATTACHMENT_TYPE, ATTACHMENT_URL, CREATED_AT) 
             VALUES (?, ?, ?, ?, NOW())`,
            [attachmentId, expenseId, path.extname(file.name).slice(1).toUpperCase(), uploadResult.path]
          );
          console.log('✅ New attachment saved:', uploadResult.filename);
        }
      }
    }

    console.log('✅ Expense updated successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating expense:', error);
    throw new Error(error.message || 'Failed to update expense');
  }
}

// ✅ Delete expense and its attachments
export async function deleteExpense(expenseId) {
  const pool = await DBconnection();
  
  try {
    // Check if expense can be deleted
    const [expense] = await pool.query(
      'SELECT APPROVED_FLAG FROM C_EXPENSES WHERE ID = ?',
      [expenseId]
    );
    
    if (expense.length === 0) {
      throw new Error('Expense not found');
    }
    
    if (expense[0].APPROVED_FLAG === 1) {
      throw new Error('Cannot delete an expense that has been verified');
    }
    
    // Get all attachments
    const [attachments] = await pool.query(
      'SELECT * FROM C_EXPENSE_ATTACHMENTS WHERE EXPENSE_ID = ?',
      [expenseId]
    );
    
    // Delete attachment files
    for (let attachment of attachments) {
      const filename = path.basename(attachment.ATTACHMENT_URL);
      await deleteAttachment(filename);
    }
    
    // Delete attachment records
    await pool.query('DELETE FROM C_EXPENSE_ATTACHMENTS WHERE EXPENSE_ID = ?', [expenseId]);
    
    // Delete expense record
    await pool.query('DELETE FROM C_EXPENSES WHERE ID = ?', [expenseId]);
    
    console.log('✅ Expense and attachments deleted:', expenseId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting expense:', error);
    throw new Error(error.message || 'Failed to delete expense');
  }
}
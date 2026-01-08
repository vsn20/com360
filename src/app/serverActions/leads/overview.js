'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error.message);
    return null;
  }
};

const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId);
      return 'unknown';
    }
    const empid = userRows[0].empid;

    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (empRows.length === 0) {
      console.error('Employee not found in C_EMP for empid:', empid);
      return `${empid}-unknown`;
    }
    const { EMP_FST_NAME, EMP_LAST_NAME } = empRows[0];
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

/**
 * Fetch a single lead by LEAD_ID
 */
export async function fetchLeadById(leadId) {
  let pool;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      throw new Error('Invalid token or orgid not found.');
    }

    const orgId = decoded.orgid;

    if (!leadId) {
      console.log('Lead ID is required');
      throw new Error('Lead ID is required');
    }

    console.log(`Fetching lead details for LEAD_ID: ${leadId}, ORG_ID: ${orgId}`);
    pool = await DBconnection();

    const [rows] = await pool.execute(
      `SELECT 
        l.ROW_ID,
        l.LEAD_ID,
        l.LEAD_NAME,
        l.LEAD_DESC,
        l.ACCNT_ID,
        l.ORG_ID,
        l.COST,
        l.BILL_TYPE,
        l.OT_COST,
        l.OT_BILL_TYPE,
        l.BILLABLE_FLAG,
        DATE_FORMAT(l.START_DT, '%Y-%m-%d') AS START_DT,
        DATE_FORMAT(l.END_DT, '%Y-%m-%d') AS END_DT,
        l.CLIENT_ID,
        l.PAY_TERM,
        l.suborgid,
        l.Industries,
        l.CREATED_BY,
        l.LAST_UPDATED_BY,
        DATE_FORMAT(l.LAST_UPDATED_DATE, '%Y-%m-%d') AS last_updated_date,
        s.suborgname
      FROM C_LEADS l
      LEFT JOIN C_SUB_ORG s ON l.suborgid = s.suborgid AND l.ORG_ID = s.orgid
      WHERE l.LEAD_ID = ? AND l.ORG_ID = ?`,
      [leadId, orgId]
    );

    if (rows.length === 0) {
      console.log('Lead not found');
      throw new Error('Lead not found');
    }

    console.log('Fetched lead details:', rows[0]);
    return rows[0];
  } catch (error) {
    console.error('Error fetching lead details:', error.message);
    throw new Error(`Failed to fetch lead details: ${error.message}`);
  }
}

/**
 * Update lead information (basic or additional details)
 */
export async function updateLead(formData) {
  const LEAD_ID = formData.get('LEAD_ID')?.trim();
  const section = formData.get('section')?.trim();

  console.log('updateLead FormData:', {
    LEAD_ID,
    section,
    formData: Object.fromEntries(formData)
  });

  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('No token found');
    return { error: 'No token found. Please log in.', success: false };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Invalid token or orgid/userId not found');
    return { error: 'Invalid token or orgid/userId not found.', success: false };
  }

  const orgId = decoded.orgid;
  const userId = decoded.userId;

  if (!LEAD_ID) {
    console.log('Lead ID is required');
    return { error: 'Lead ID is required.', success: false };
  }

  let pool;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
      console.log(`Attempting to connect to MySQL (attempt ${retryCount + 1})...`);
      pool = await DBconnection();
      console.log('MySQL connection pool acquired');

      // Verify lead exists and belongs to this org
      const [existing] = await pool.execute(
        'SELECT ROW_ID FROM C_LEADS WHERE LEAD_ID = ? AND ORG_ID = ?',
        [LEAD_ID, orgId]
      );
      if (existing.length === 0) {
        console.log('Lead not found');
        return { error: 'Lead not found.', success: false };
      }

      const updatedBy = await getCurrentUserEmpIdName(pool, userId, orgId);
      let affectedRows = 0;

      if (section === 'basic') {
        const leadName = formData.get('LEAD_NAME')?.trim();
        const leadDesc = formData.get('LEAD_DESC')?.trim() || null;
        const accntId = formData.get('ACCNT_ID')?.trim();
        const clientId = formData.get('CLIENT_ID')?.trim() || null;
        const startDt = formData.get('START_DT')?.trim() || null;
        const endDt = formData.get('END_DT')?.trim() || null;
        const suborgid = formData.get('suborgid')?.trim() || null;
        const industries = formData.get('Industries')?.trim() || null;

        console.log('Basic details:', { leadName, leadDesc, accntId, clientId, startDt, endDt, suborgid, industries, updatedBy });

        if (!leadName) {
          console.log('Lead Name is required');
          return { error: 'Lead Name is required.', success: false };
        }
        if (!accntId) {
          console.log('Account is required');
          return { error: 'Account is required.', success: false };
        }

        // Verify account exists and is active
        const [accountCheck] = await pool.execute(
          'SELECT ACCNT_ID, suborgid FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ? AND ACTIVE_FLAG = 1',
          [accntId, orgId]
        );
        if (accountCheck.length === 0) {
          console.log('Invalid or inactive account');
          return { error: 'Invalid or inactive account.', success: false };
        }

        // If clientId provided, verify it exists
        if (clientId) {
          const [clientCheck] = await pool.execute(
            'SELECT ACCNT_ID FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ? AND ACTIVE_FLAG = 1',
            [clientId, orgId]
          );
          if (clientCheck.length === 0) {
            console.log('Invalid or inactive client');
            return { error: 'Invalid or inactive client.', success: false };
          }
        }

        // Use suborgid from account if not provided
        let effectiveSuborgid = suborgid;
        if (!suborgid && accountCheck[0].suborgid) {
          effectiveSuborgid = accountCheck[0].suborgid;
          console.log(`Using suborgid ${effectiveSuborgid} from account ${accntId}`);
        }

        // Verify suborgid if provided
        if (effectiveSuborgid) {
          const [suborgCheck] = await pool.execute(
            'SELECT suborgid FROM C_SUB_ORG WHERE suborgid = ? AND orgid = ? AND isstatus = 1',
            [effectiveSuborgid, orgId]
          );
          if (suborgCheck.length === 0) {
            console.log('Invalid suborganization');
            return { error: 'Invalid suborganization.', success: false };
          }
        }

        const [result] = await pool.query(
          `UPDATE C_LEADS 
           SET LEAD_NAME = ?, LEAD_DESC = ?, ACCNT_ID = ?, CLIENT_ID = ?,
               START_DT = ?, END_DT = ?, suborgid = ?, Industries = ?,
               LAST_UPDATED_BY = ?, LAST_UPDATED_DATE = CURRENT_TIMESTAMP, MODIFICATION_NUM = MODIFICATION_NUM + 1
           WHERE LEAD_ID = ? AND ORG_ID = ?`,
          [leadName, leadDesc, accntId, clientId, startDt, endDt, effectiveSuborgid, industries, updatedBy, LEAD_ID, orgId]
        );

        affectedRows += result.affectedRows;
        console.log(`Basic details update result: ${result.affectedRows} rows affected for LEAD_ID ${LEAD_ID}`);

      } else if (section === 'additional') {
        const cost = formData.get('COST') ? parseFloat(formData.get('COST')) : null;
        const billType = formData.get('BILL_TYPE')?.trim() || null;
        const otCost = formData.get('OT_COST') ? parseFloat(formData.get('OT_COST')) : null;
        const otBillType = formData.get('OT_BILL_TYPE')?.trim() || null;
        const billableFlag = formData.get('BILLABLE_FLAG')?.trim() === '1' ? 1 : 0;
        const payTerm = formData.get('PAY_TERM')?.trim() || null;

        console.log('Additional details:', { cost, billType, otCost, otBillType, billableFlag, payTerm, updatedBy });

        // Verify bill type if provided
        if (billType) {
          const [billTypeCheck] = await pool.execute(
            'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 7 AND id = ? AND orgid = ? AND isactive = 1',
            [billType, orgId]
          );
          if (billTypeCheck.length === 0) {
            console.log('Invalid bill type ID');
            return { error: 'Invalid bill type.', success: false };
          }
        }

        // Verify OT bill type if provided
        if (otBillType) {
          const [otBillTypeCheck] = await pool.execute(
            'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 8 AND id = ? AND orgid = ? AND isactive = 1',
            [otBillType, orgId]
          );
          if (otBillTypeCheck.length === 0) {
            console.log('Invalid OT bill type ID');
            return { error: 'Invalid OT bill type.', success: false };
          }
        }

        // Verify payment term if provided
        if (payTerm) {
          const [payTermCheck] = await pool.execute(
            'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 9 AND id = ? AND orgid = ? AND isactive = 1',
            [payTerm, orgId]
          );
          if (payTermCheck.length === 0) {
            console.log('Invalid payment term ID');
            return { error: 'Invalid payment term.', success: false };
          }
        }

        const [result] = await pool.query(
          `UPDATE C_LEADS 
           SET COST = ?, BILL_TYPE = ?, OT_COST = ?, OT_BILL_TYPE = ?,
               BILLABLE_FLAG = ?, PAY_TERM = ?,
               LAST_UPDATED_BY = ?, LAST_UPDATED_DATE = CURRENT_TIMESTAMP, MODIFICATION_NUM = MODIFICATION_NUM + 1
           WHERE LEAD_ID = ? AND ORG_ID = ?`,
          [cost, billType, otCost, otBillType, billableFlag, payTerm, updatedBy, LEAD_ID, orgId]
        );

        affectedRows += result.affectedRows;
        console.log(`Additional details update result: ${result.affectedRows} rows affected for LEAD_ID ${LEAD_ID}`);

      } else {
        console.log('Invalid section:', section);
        return { error: 'Invalid section specified.', success: false };
      }

      if (affectedRows === 0) {
        console.log('No rows updated for LEAD_ID:', LEAD_ID);
        return { error: 'No changes were applied.', success: false };
      }

      console.log(`Lead updated: LEAD_ID ${LEAD_ID}, section ${section}, affectedRows: ${affectedRows}`);
      return { success: true, updatedBy };

    } catch (error) {
      console.error('Error updating lead:', error.message);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        console.log('Pool is closed, retrying connection...');
        retryCount++;
        continue;
      }
      return { error: `Failed to update lead: ${error.message}`, success: false };
    }
  }

  return { error: 'Failed to update lead after multiple retries: Pool is closed', success: false };
}

/**
 * Fetch all leads for an organization (used in overview table)
 */
export async function fetchAllLeads(orgId) {
  let pool;
  try {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    console.log(`Fetching all leads for orgId: ${orgId}`);
    pool = await DBconnection();

    const [rows] = await pool.execute(
      `SELECT 
        l.ROW_ID,
        l.LEAD_ID,
        l.LEAD_NAME,
        l.LEAD_DESC,
        l.ACCNT_ID,
        l.ORG_ID,
        l.COST,
        l.BILL_TYPE,
        l.OT_COST,
        l.OT_BILL_TYPE,
        l.BILLABLE_FLAG,
        DATE_FORMAT(l.START_DT, '%Y-%m-%d') AS START_DT,
        DATE_FORMAT(l.END_DT, '%Y-%m-%d') AS END_DT,
        l.CLIENT_ID,
        l.PAY_TERM,
        l.suborgid,
        l.Industries,
        l.CREATED_BY,
        l.LAST_UPDATED_BY,
        s.suborgname,
        a.ALIAS_NAME as ACCOUNT_NAME
      FROM C_LEADS l
      LEFT JOIN C_SUB_ORG s ON l.suborgid = s.suborgid AND l.ORG_ID = s.orgid
      LEFT JOIN C_ACCOUNT a ON l.ACCNT_ID = a.ACCNT_ID AND l.ORG_ID = a.ORGID
      WHERE l.ORG_ID = ?
      ORDER BY l.CREATED_DATE DESC`,
      [orgId]
    );

    console.log(`Fetched ${rows.length} leads`);
    return rows;
  } catch (error) {
    console.error('Error fetching all leads:', error.message);
    throw new Error(`Failed to fetch leads: ${error.message}`);
  }
}

/**
 * Delete a lead (optional - if you want delete functionality)
 */
export async function deleteLead(leadId) {
  let pool;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { error: 'No token found. Please log in.', success: false };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      return { error: 'Invalid token or orgid not found.', success: false };
    }

    const orgId = decoded.orgid;

    if (!leadId) {
      console.log('Lead ID is required');
      return { error: 'Lead ID is required.', success: false };
    }

    pool = await DBconnection();

    // Check if lead has assignments
    const [assignments] = await pool.execute(
      'SELECT COUNT(*) as count FROM C_LEAD_ASSIGNMENTS WHERE LEAD_ID = ?',
      [leadId]
    );

    if (assignments[0].count > 0) {
      console.log('Cannot delete lead with existing assignments');
      return { error: 'Cannot delete lead with existing assignments. Please delete assignments first.', success: false };
    }

    // Delete the lead
    const [result] = await pool.execute(
      'DELETE FROM C_LEADS WHERE LEAD_ID = ? AND ORG_ID = ?',
      [leadId, orgId]
    );

    if (result.affectedRows === 0) {
      console.log('Lead not found or already deleted');
      return { error: 'Lead not found.', success: false };
    }

    console.log(`Lead deleted: LEAD_ID ${leadId}`);
    return { success: true };

  } catch (error) {
    console.error('Error deleting lead:', error.message);
    return { error: `Failed to delete lead: ${error.message}`, success: false };
  }
}
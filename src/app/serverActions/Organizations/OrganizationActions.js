import DBconnection from '@/app/utils/config/db';

export async function addorganization(formData) {
  try {
    const pool = await DBconnection();
    
    // Count existing rows for the given orgid to generate suborgid
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as count FROM C_SUB_ORG WHERE orgid = ?`,
      [formData.get('org_id')]
    );
    const rowCount = countResult[0].count;
    const suborgid = `${formData.get('org_id')}-${rowCount + 1}`;

    const [result] = await pool.query(
      `INSERT INTO C_SUB_ORG (
        suborgid, orgid, suborgname, isstatus, addresslane1, addresslane2, 
        country, state, postalcode, created_by, created_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        suborgid,
        formData.get('org_id'),
        formData.get('suborgname'),
        formData.get('isstatus') === 'Active' ? 1 : 0,
        formData.get('addresslane1') || null,
        formData.get('addresslane2') || null,
        formData.get('country') || null,
        formData.get('state') || null,
        formData.get('postalcode') || null,
        formData.get('createdby'),
      ]
    );

    if (result.affectedRows > 0) {
      return { success: true };
    } else {
      return { error: 'Failed to add organization' };
    }
  } catch (error) {
    console.error('Error adding organization:', error);
    return { error: error.message };
  }
}

export async function getorgdetailsbyid(suborgid) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.query(
      `SELECT suborgid, orgid, suborgname, isstatus, addresslane1, addresslane2, 
       country, state, postalcode, created_by, created_date, updated_by, updated_date 
       FROM C_SUB_ORG WHERE suborgid = ?`,
      [suborgid]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error fetching organization details:', error);
    throw new Error('Failed to fetch organization details');
  }
}

export async function updateorganization(formData) {
  try {
    const pool = await DBconnection();
    const [result] = await pool.query(
      `UPDATE C_SUB_ORG SET 
        suborgname = ?, 
        isstatus = ?, 
        addresslane1 = ?, 
        addresslane2 = ?, 
        country = ?, 
        state = ?, 
        postalcode = ?, 
        updated_by = ?, 
        updated_date = NOW() 
       WHERE suborgid = ?`,
      [
        formData.get('suborgname'),
        formData.get('isstatus') === 'Active' ? 1 : 0,
        formData.get('addresslane1') || null,
        formData.get('addresslane2') || null,
        formData.get('country') || null,
        formData.get('state') || null,
        formData.get('postalcode') || null,
        formData.get('updatedby'),
        formData.get('suborgid'),
      ]
    );

    if (result.affectedRows > 0) {
      return { success: true };
    } else {
      return { error: 'Failed to update organization' };
    }
  } catch (error) {
    console.error('Error updating organization:', error);
    return { error: error.message };
  }
}
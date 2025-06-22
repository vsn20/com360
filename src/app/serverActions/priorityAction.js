'use server';

import { cookies } from 'next/headers';
import DBconnection from '../utils/config/db';
import { redirect } from 'next/navigation';

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

export async function savePriorities(formData) {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) throw new Error('No JWT token found');

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) throw new Error('Invalid token or orgid');

  const orgid = decoded.orgid;
  const pool = await DBconnection();

  const priorities = Object.fromEntries(formData.entries());
  console.log('Form Data:', priorities); // Optional: for debugging

  const updatePromises = Object.entries(priorities)
    .filter(([key]) => !key.endsWith('_type')) // Skip hidden type fields
    .map(async ([id, priority]) => {
      const itemId = parseInt(id);
      const type = priorities[`${id}_type`];
      const column = type === 'submenu' ? 'submenuid' : 'menuid';

      if (!type) return;

      const [existing] = await pool.query(
        `SELECT * FROM org_menu_priority WHERE ${column} = ? AND orgid = ?`,
        [itemId, orgid]
      );

      if (existing.length > 0) {
        await pool.query(
          `UPDATE org_menu_priority SET priority = ? WHERE ${column} = ? AND orgid = ?`,
          [priority, itemId, orgid]
        );
      } else {
        await pool.query(
          `INSERT INTO org_menu_priority (orgid, ${column}, priority) VALUES (?, ?, ?)`,
          [orgid, itemId, priority]
        );
      }
    });

  await Promise.all(updatePromises);

  // Redirect after successful save
  redirect('/userscreens');
}




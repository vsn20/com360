// src/app/serverActions/getAllFeatures.js
import DBconnection from "../utils/config/db";

export async function getAllFeatures() {
  try {
    const pool = await DBconnection();
    const [menuRows] = await pool.query(
      `SELECT m.id, m.name, m.hassubmenu
       FROM menu m
       WHERE m.is_active = 1`
    );

    const features = await Promise.all(menuRows.map(async (menu) => {
      if (menu.hassubmenu === 'yes') {
        const [submenuRows] = await pool.query(
          `SELECT id, name, url
           FROM submenu
           WHERE menuid = ? AND is_active = 1`,
          [menu.id]
        );
        return { ...menu, submenu: submenuRows };
      }
      return { ...menu, submenu: [] };
    }));

    return { success: true, features };
  } catch (error) {
    console.error('Error fetching features:', error);
    return { success: false, error: 'Failed to fetch features', features: [] };
  }
}
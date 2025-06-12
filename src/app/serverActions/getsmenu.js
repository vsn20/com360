'use server';

const { default: DBconnection } = require("../utils/config/db");

export async function getsidebarmenu(roleid) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.query(
      'SELECT m.id, m.name, m.href FROM role_menu_permissions rmp JOIN sidebarmenu m ON rmp.menuid = m.id WHERE rmp.roleid = ?',
      [roleid]
    );
    return rows;
  } catch (error) {
    console.error("Error fetching menu items:", error);
    throw new Error("Failed to fetch navbar items");
  }
}

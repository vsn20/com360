'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from '../(routes)/userscreens/userscreens.module.css';

function Sidebar({ isAdmin }) {
  const pathname = usePathname();
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/menu', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        const safeData = Array.isArray(data) ? data : [];
        setMenuItems(safeData);
      } catch (error) {
        console.error('Error fetching menu items:', error.message);
        setMenuItems([]);
      }
    }
    fetchData();
  }, []);

  // Use menu items directly from /api/menu
  const finalMenuItems = [...menuItems];

  return (
    <aside className={styles.sidebarContainer}>
      <ul className={styles.sidebarMenu}>
        {finalMenuItems.map((item) => {
          const safeSubmenu = Array.isArray(item.submenu) ? item.submenu : [];
          const isActive = pathname === item.href || (safeSubmenu.length > 0 && safeSubmenu.some(sub => pathname === sub.href));
          return (
            <li key={item.title} className={styles.sidebarMenuItem}>
              <a
                href={item.href || '#'}
                className={`${styles.sidebarLink} ${isActive ? styles.active : ''}`}
              >
                {item.title}
                {safeSubmenu.length > 0 && <span className={styles.sidebarArrow}></span>}
              </a>
              {safeSubmenu.length > 0 && (
                <ul className={styles.sidebarSubmenu}>
                  {safeSubmenu.map((sub) => (
                    <li key={sub.title} className={styles.sidebarSubmenuItem}>
                      <a
                        href={sub.href || '#'}
                        className={`${styles.sidebarSubmenuLink} ${pathname === sub.href ? styles.active : ''}`}
                      >
                        {sub.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default Sidebar;
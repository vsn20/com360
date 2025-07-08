'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from '../(routes)/userscreens/userscreens.module.css';

function Sidebar({ isAdmin }) {
  const pathname = usePathname();
  const [menuItems, setMenuItems] = useState([]);
  const [isFetched, setIsFetched] = useState(false); // Flag to prevent re-fetching

  useEffect(() => {
    if (!isFetched) {
      async function fetchData() {
        try {
          const res = await fetch('/api/menu', { credentials: 'include' });
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const data = await res.json();
          const safeData = Array.isArray(data) ? data : [];
          setMenuItems(safeData);
          setIsFetched(true); // Mark as fetched after successful load
        } catch (error) {
          console.error('Error fetching menu items:', error.message);
          setMenuItems([]);
          setIsFetched(true); // Still mark as fetched to avoid retries on error
        }
      }
      fetchData();
    }
  }, [isFetched]); // Dependency on isFetched to run only once

  const finalMenuItems = [...menuItems];

  return (
    <aside className={styles.sidebarContainer}>
      <ul className={styles.sidebarMenu}>
        {finalMenuItems.map((item) => {
          const safeSubmenu = Array.isArray(item.submenu) ? item.submenu : [];
          const isActive = pathname === item.href || (safeSubmenu.length > 0 && safeSubmenu.some(sub => pathname === sub.href));
          return (
            <li key={item.title} className={styles.sidebarMenuItem}>
              <Link
                href={item.href || '#'}
                className={`${styles.sidebarLink} ${isActive ? styles.active : ''}`}
              >
                {item.title}
                {safeSubmenu.length > 0 && <span className={styles.sidebarArrow}></span>}
              </Link>
              {safeSubmenu.length > 0 && (
                <ul className={styles.sidebarSubmenu}>
                  {safeSubmenu.map((sub) => (
                    <li key={sub.title} className={styles.sidebarSubmenuItem}>
                      <Link
                        href={sub.href || '#'}
                        className={`${styles.sidebarSubmenuLink} ${pathname === sub.href ? styles.active : ''}`}
                      >
                        {sub.title}
                      </Link>
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
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './submenubar.module.css';

function SubmenuBar() {
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
          setMenuItems(data);
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

  const activeMenu = menuItems.find(
    item => item.submenu?.some(sub => pathname === sub.href)
  );

  if (!activeMenu || !activeMenu.submenu) return null;

  return (
    <div className={styles.submenuBar}>
      {activeMenu.submenu.map((sub) => (
        <Link
          key={sub.href}
          href={sub.href}
          className={`${styles.submenuItem} ${pathname === sub.href ? styles.active : ''}`}
        >
          {sub.title}
        </Link>
      ))}
    </div>
  );
}

export default SubmenuBar;
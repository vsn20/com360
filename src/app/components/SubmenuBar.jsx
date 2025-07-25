'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../(routes)/userscreens/userscreens.module.css';

function SubmenuBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState([]);
  const [isFetched, setIsFetched] = useState(false);

  useEffect(() => {
    if (!isFetched) {
      async function fetchData() {
        try {
          const res = await fetch('/api/menu', { credentials: 'include' });
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const data = await res.json();
          setMenuItems(data);
          setIsFetched(true);
        } catch (error) {
          console.error('Error fetching menu items:', error.message);
          setMenuItems([]);
          setIsFetched(true);
        }
      }
      fetchData();
    }
  }, [isFetched]);

  const activeMenu = menuItems.find(
    item => item.href === pathname || item.submenu?.some(sub => pathname === sub.href || pathname.startsWith(sub.href + '?'))
  );

  const handleSubmenuClick = (href) => {
    // Append a unique refresh query parameter to force pathname change
    const timestamp = new Date().getTime();
    router.push(`${href}?refresh=${timestamp}`);
  };

  if (!activeMenu) return null;

  return (
    <div className={styles.submenuBar}>
      <div className={styles.activeMenuTitle}>{activeMenu.title}</div>
      {activeMenu.submenu && activeMenu.submenu.length > 0 && (
        <div className={styles.submenuContainer}>
          {activeMenu.submenu.map((sub) => (
            <Link
              key={sub.href}
              href={`${sub.href}?refresh=${new Date().getTime()}`}
              className={`${styles.submenuItem} ${pathname === sub.href || pathname.startsWith(sub.href + '?') ? styles.subactive : ''}`}
              onClick={(e) => {
                e.preventDefault(); // Prevent default Link navigation
                handleSubmenuClick(sub.href);
              }}
            >
              {sub.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default SubmenuBar;
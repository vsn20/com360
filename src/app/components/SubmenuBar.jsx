'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './submenubar.module.css';

function SubmenuBar() {
  const pathname = usePathname();
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch('/api/menu');
      const data = await res.json();
      setMenuItems(data);
    }
    fetchData();
  }, []);

  const activeMenu = menuItems.find(
    item => item.submenu?.some(sub => pathname === sub.href)
  );

  if (!activeMenu || !activeMenu.submenu) return null;

  return (
    <div className={styles.submenuBar}>
      {activeMenu.submenu.map((sub) => (
        <a
          key={sub.href}
          href={sub.href}
          className={`${styles.submenuItem} ${pathname === sub.href ? styles.active : ''}`}
        >
          {sub.title}
        </a>
      ))}
      
    </div>
  );
}

export default SubmenuBar;

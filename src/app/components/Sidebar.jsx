'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../(routes)/userscreens/userscreens.module.css';

function Sidebar({ isAdmin }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState([]);
  const [isFetched, setIsFetched] = useState(false);
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState(null); // Track open C_SUBMENU
  const [isSubmenuLocked, setIsSubmenuLocked] = useState(false); // Lock C_SUBMENU after click

  useEffect(() => {
    if (!isFetched) {
      async function fetchData() {
        try {
          const res = await fetch('/api/menu', { credentials: 'include' });
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const data = await res.json();
          const safeData = Array.isArray(data) ? data : [];
          setMenuItems(safeData);
          setIsFetched(true);
        } catch (error) {
          console.error('Error fetching C_MENU items:', error.message);
          setMenuItems([]);
          setIsFetched(true);
        }
      }
      fetchData();
    }
  }, [isFetched]);

  const finalMenuItems = [...menuItems];

  // Handle hover to open C_SUBMENU, but only if not locked
  const handleMouseEnter = (index) => {
    if (!isSubmenuLocked) {
      setOpenSubmenuIndex(index);
    }
  };

  // Handle mouse leave to close C_SUBMENU and unlock
  const handleMouseLeave = () => {
    setOpenSubmenuIndex(null);
    setIsSubmenuLocked(false); // Unlock to allow hover again
  };

  // Handle C_MENU/C_SUBMENU click to close C_SUBMENU after 2 seconds, lock it, and navigate
  const handleMenuClick = (e, href, index) => {
    e.preventDefault(); // Prevent default Link navigation
    const timestamp = new Date().getTime();
    router.push(`${href}?refresh=${timestamp}`); // Navigate immediately
    // Delay hiding C_SUBMENU and locking for 2 seconds
   
      setOpenSubmenuIndex(null); // Close C_SUBMENU after 2 seconds
      setIsSubmenuLocked(true); // Lock C_SUBMENU to prevent hover
   
  };

  return (
    <aside className={styles.sidebarContainer}>
      <ul className={styles.sidebarMenu}>
        <li className={styles.com360_logo}>COM@360</li>
        {finalMenuItems.map((item, index) => {
          const safeSubmenu = Array.isArray(item.C_SUBMENU) ? item.C_SUBMENU : [];
          const isActive = pathname === item.href || (safeSubmenu.length > 0 && safeSubmenu.some(sub => pathname === sub.href || pathname.startsWith(sub.href + '?')));
          return (
            <li
              key={item.title}
              className={styles.sidebarMenuItem}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={handleMouseLeave}
            >
              <Link
                href={item.href || '#'}
                className={`${styles.sidebarLink} ${isActive ? styles.active : ''}`}
                onClick={(e) => handleMenuClick(e, item.href, index)}
              >
                {item.title}
                {safeSubmenu.length > 0 && <span className={styles.sidebarArrow}></span>}
              </Link>
              {safeSubmenu.length > 0 && (
                <ul
                  className={`${styles.sidebarSubmenu} ${
                    openSubmenuIndex === index && !isSubmenuLocked ? styles.visible : ''
                  }`}
                >
                  {safeSubmenu.map((sub) => (
                    <li key={sub.title} className={styles.sidebarSubmenuItem}>
                      <Link
                        href={sub.href || '#'}
                        className={`${styles.sidebarSubmenuLink} ${
                          pathname === sub.href || pathname.startsWith(sub.href + '?') ? styles.active : ''
                        }`}
                        onClick={(e) => handleMenuClick(e, sub.href, index)}
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
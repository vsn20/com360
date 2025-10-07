'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  ShoppingCart, 
  TrendingUp,
  BarChart3,
  Package,
  DollarSign,
  Calendar,
  Mail,
  Phone,
  Building2,
  UserCircle,
  FolderKanban,
  Clock,
  Umbrella,
  Briefcase,
  Headphones,
  Wrench,
  Shield,
  ListChecks
} from 'lucide-react';
import styles from '../(routes)/userscreens/userscreens.module.css';

// Icon mapping for menu items
const iconMap = {
  'dashboard': LayoutDashboard,
  'users': Users,
  'reports': FileText,
  'settings': Settings,
  'sales': ShoppingCart,
  'analytics': TrendingUp,
  'statistics': BarChart3,
  'inventory': Package,
  'finance': DollarSign,
  'calendar': Calendar,
  'messages': Mail,
  'contacts': Phone,
};

// Direct icon mapping - Add your exact menu titles here
const menuIconMap = {
  'Roles': Shield,
  'Employees': Users,
  'Organizations': Building2,
  'Account': UserCircle,
  'Projects': FolderKanban,
  'Timesheets': Clock,
  'Leaves': Umbrella,
  'Jobs': Briefcase,
  'Service Requests': Headphones,
  'Configuration': Wrench,
  'Priority Setting': Settings,
  'Dashboard': LayoutDashboard,
  'Reports': FileText,
  'Sales': ShoppingCart,
  'Analytics': TrendingUp,
  'Statistics': BarChart3,
  'Inventory': Package,
  'Finance': DollarSign,
  'Calendar': Calendar,
  'Messages': Mail,
  'Contacts': Phone,
  'Tasks': ListChecks,
};

// Function to get icon based on menu title
const getIconForTitle = (title) => {
  // First try exact match
  if (menuIconMap[title]) {
    return menuIconMap[title];
  }
  
  // Then try case-insensitive search
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('role')) return Shield;
  if (lowerTitle.includes('employee')) return Users;
  if (lowerTitle.includes('organization')) return Building2;
  if (lowerTitle.includes('account')) return UserCircle;
  if (lowerTitle.includes('project')) return FolderKanban;
  if (lowerTitle.includes('timesheet')) return Clock;
  if (lowerTitle.includes('leave')) return Umbrella;
  if (lowerTitle.includes('job')) return Briefcase;
  if (lowerTitle.includes('service')) return Headphones;
  if (lowerTitle.includes('configuration')) return Wrench;
  if (lowerTitle.includes('priority')) return Settings;
  if (lowerTitle.includes('dashboard')) return LayoutDashboard;
  if (lowerTitle.includes('user')) return Users;
  if (lowerTitle.includes('report')) return FileText;
  if (lowerTitle.includes('setting')) return Settings;
  if (lowerTitle.includes('sale')) return ShoppingCart;
  if (lowerTitle.includes('analytic')) return TrendingUp;
  if (lowerTitle.includes('stat')) return BarChart3;
  if (lowerTitle.includes('inventory')) return Package;
  if (lowerTitle.includes('finance')) return DollarSign;
  if (lowerTitle.includes('calendar')) return Calendar;
  if (lowerTitle.includes('message')) return Mail;
  if (lowerTitle.includes('contact')) return Phone;
  if (lowerTitle.includes('task')) return ListChecks;
  
  return LayoutDashboard; // Default icon
};

function Sidebar({ isAdmin }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState([]);
  const [isFetched, setIsFetched] = useState(false);
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState(null);
  const [isSubmenuLocked, setIsSubmenuLocked] = useState(false);

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

  const handleMouseEnter = (index) => {
    if (!isSubmenuLocked) {
      setOpenSubmenuIndex(index);
    }
  };

  const handleMouseLeave = () => {
    setOpenSubmenuIndex(null);
    setIsSubmenuLocked(false);
  };

  const handleMenuClick = (e, href, index) => {
    e.preventDefault();
    const timestamp = new Date().getTime();
    router.push(`${href}?refresh=${timestamp}`);
    setOpenSubmenuIndex(null);
    setIsSubmenuLocked(true);
  };

  return (
    <aside className={styles.sidebarContainer}>
      <ul className={styles.sidebarMenu}>
        <li className={styles.com360_logo}>COM@360</li>
        {finalMenuItems.map((item, index) => {
          const safeSubmenu = Array.isArray(item.C_SUBMENU) ? item.C_SUBMENU : [];
          const isActive = pathname === item.href || (safeSubmenu.length > 0 && safeSubmenu.some(sub => pathname === sub.href || pathname.startsWith(sub.href + '?')));
          const IconComponent = getIconForTitle(item.title);
          
          // Debug: Log menu titles to console
          console.log('Menu Title:', item.title, 'Icon:', IconComponent.name);
          
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
                <span className={styles.menuItemContent}>
                  <IconComponent className={styles.menuIcon} size={18} />
                  <span>{item.title}</span>
                </span>
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
'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/screenbar';
import SubmenuBar from '../../components/SubmenuBar';
import styles from './userscreens.module.css';

export default function UserscreenLayoutClient({ children, userData }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div>
      {/* Hamburger Menu Button - Mobile Only */}
      <button 
        className={styles.hamburgerButton}
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        <Menu size={24} />
      </button>

      {/* Overlay - Mobile Only */}
      <div 
        className={`${styles.sidebarOverlay} ${isSidebarOpen ? styles.visible : ''}`}
        onClick={closeSidebar}
      />

      <Sidebar 
        isAdmin={userData.isAdmin} 
        isSidebarOpen={isSidebarOpen}
        closeSidebar={closeSidebar}
      />
      
      <div className={styles.rightContent}>
        <Navbar
          orgName={userData.orgName}
          logoLetter={userData.logoLetter}
          username={userData.username}
          rolename={userData.rolename}
          orglogo_url={userData.orglogo_url}
          is_logo_set={userData.is_logo_set}
        />
        <SubmenuBar />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
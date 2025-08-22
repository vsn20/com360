'use client';
import { useState, useEffect } from 'react';
import styles from '../(routes)/userscreens/userscreens.module.css';

function LogoutButton({ logoLetter = 'M', username = 'Unknown', rolename = 'Unknown', orgName = 'Unknown' }) {
  const [userData, setUserData] = useState({
    logoLetter: logoLetter,
    username: username,
    rolename: rolename,
    orgName: orgName,
    isLoading: true,
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    setUserData({
      logoLetter,
      username,
      rolename,
      orgName,
      isLoading: false,
    });
  }, [logoLetter, username, rolename, orgName]);

  if (userData.isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div
      className={styles.logoContainer}
      onMouseEnter={() => setIsDropdownOpen(true)}
      onMouseLeave={() => setIsDropdownOpen(false)}
    >
      <span className={styles.logo}>{userData.logoLetter.toUpperCase()}</span>
      {isDropdownOpen && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <div className={styles.username}>{userData.username}</div>
            <div className={styles.userRole}>{userData.rolename}</div>
          </div>
          <div className={styles.divider}></div>
          <form action="/api/logout" method="POST">
            <button type="submit">Logout</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default LogoutButton;
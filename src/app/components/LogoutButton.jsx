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
    // Sync props with state after mount to handle hydration
    setUserData({
      logoLetter,
      username,
      rolename,
      orgName,
      isLoading: false,
    });
    console.log('LogoutButton props updated:', { logoLetter, username, rolename, orgName });
  }, [logoLetter, username, rolename, orgName]);

  if (userData.isLoading) {
    return <div>Loading...</div>; // Prevent rendering until synced
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
          <p>Organization: {userData.orgName}</p>
          <p>User ID: {userData.username}</p>
          <p>Role: {userData.rolename}</p>
          <form action="/api/logout" method="POST">
            <button type="submit">Logout</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default LogoutButton;
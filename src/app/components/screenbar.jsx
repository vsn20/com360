'use client';
import { MdApps } from 'react-icons/md';
import LogoutButton from './LogoutButton';
import styles from '../(routes)/userscreens/userscreens.module.css';

function Navbar({
  orgName = 'Unknown',
  logoLetter = 'Unknown',
  username = 'Unknown',
  rolename = 'Unknown',
  orglogo_url = null,
  is_logo_set = 0, // Default to 0 as per database convention
}) {
  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        {is_logo_set === 1 && orglogo_url && (
          <img src={orglogo_url} alt={`${orgName} logo`} className={styles.orgLogo} />
        )}
        <span className={styles.orgName}>{orgName}</span>
      </div>
      <a href="#" className={styles.icon}>
        <MdApps />
      </a>
      <LogoutButton
        logoLetter={logoLetter}
        username={username}
        rolename={rolename}
        orgName={orgName}
      />
    </nav>
  );
}

export default Navbar;
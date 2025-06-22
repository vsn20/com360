'use client';
import { MdApps } from 'react-icons/md';
import LogoutButton from './LogoutButton';
import styles from '../(routes)/userscreens/userscreens.module.css';

function Navbar({ orgName='unknown',logoLetter='unknown',username='unknown',rolename='unknown'}) {
  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <span className={styles.orgName}>{orgName}</span>
      </div>
      <a href="#" className={styles.icon}>
         <MdApps /> 
      </a>
      <LogoutButton logoLetter={logoLetter} username={username} rolename={rolename}  orgName={orgName}/> 
    </nav>
  );
}

export default Navbar;
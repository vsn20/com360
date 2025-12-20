'use client';
import { MdApps } from 'react-icons/md';
import LogoutButton from './LogoutButton';
import SearchInput from './SearchInput';
import styles from '../(routes)/userscreens/userscreens.module.css';

function Navbar({   
  orgName = 'Unknown',   
  logoLetter = 'Unknown',   
  username = 'Unknown',   
  rolename = 'Unknown',   
  orglogo_url = null,   
  is_logo_set = 0, 
}) {
  const handleSearch = async (query) => {
    // Store query in sessionStorage to be picked up by the page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('aiQuery', query);
      // Trigger a custom event
      window.dispatchEvent(new CustomEvent('aiQuerySubmitted', { detail: query }));
    }
  };

  return (     
    <nav className={styles.navbar}>       
      <div className={styles.left}>         
        {is_logo_set === 1 && orglogo_url && (           
          <img src={orglogo_url} alt={`${orgName} logo`} className={styles.orgLogo} />         
        )}         
        <span className={styles.orgName}>{orgName}</span>       
      </div>
      
      {/* <SearchInput onSearch={handleSearch} /> */}
      
      <div className={styles.right}>
        <a href="#" className={styles.icon}>         
          <MdApps />       
        </a>       
        <LogoutButton         
          logoLetter={logoLetter}         
          username={username}         
          rolename={rolename}         
          orgName={orgName}       
        />     
      </div>
    </nav>   
  ); 
}

export default Navbar;
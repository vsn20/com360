"use client";

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MdApps } from 'react-icons/md';
import { getUserFromCookie } from '../serverActions/getUserFromCookie';
import { job_logoutaction } from '../serverActions/job_logoutaction';
import Link from 'next/link';
import Image from 'next/image';
export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      setIsLoading(true);
      const userData = await getUserFromCookie();
      setUser(userData);
      setIsLoading(false);
    }
    fetchUser();
  }, []); // Re-fetch on route changes to handle cookie updates

  const handleLogout = async () => {
    const result = await job_logoutaction();
    if (result.success) {
      console.log("Logout successful, redirecting to /jobs/jobslogin");
      setUser(null); // Clear user state immediately
      router.push("/jobs");
    } else {
      console.error("Logout failed:", result.error);
    }
  };

  if (isLoading) {
    return <nav id="navid">Loading...</nav>; // Prevent flickering
  }

  return (
    <nav id="navid" style={{ position: 'relative' }}>
     <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginRight: '1rem' 
          }}>
            <Image 
              src="/COM360LOGOS.jpg" 
              alt="logo" 
              width={120} 
              height={40}
              style={{ objectFit: 'contain', maxHeight: '40px' }}
              priority={true} 
              unoptimized={true}
            />
          </div>
         
      <Link href="/" className={pathname === '/' ? 'active' : ''}>Home</Link>
      <Link href="/jobs" className={pathname === '/jobs' ? 'active' : ''}>Jobs</Link>
      <Link href="/jobs/jobapplications" className={pathname === '/jobs/jobapplications' ? 'active' : ''}>Applications</Link>
      <Link href="#"><MdApps className="menu-icon" /></Link>
      {user ? (
        <div
          className="profile-container"
          style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => setIsDropdownOpen(true)}
          onMouseLeave={() => setIsDropdownOpen(false)}
        >
          <div
            className="profile-icon"
            style={{
              width: '25px',
              height: '25px',
              borderRadius: '50%',
              backgroundColor: '#007bff',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            {user.first_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          {isDropdownOpen && (
            <div
              className="dropdown-menu"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                backgroundColor: 'white',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                borderRadius: '4px',
                padding: '10px',
                zIndex: 1000,
                minWidth: '150px',
              }}
            >
              <p style={{ margin: '0 0 10px 0', padding: '5px 10px' }}>{user.email}</p>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '5px 10px',
                  backgroundColor: '#ff4d4f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link href="/jobs/jobslogin" className={`button ${pathname === '/jobs/jobslogin' ? 'active' : ''}`}>
          jobsLogin
        </Link>
      )}
    </nav>
  );
}
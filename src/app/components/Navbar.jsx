'use client';
import { usePathname } from 'next/navigation';
import { MdApps } from 'react-icons/md';
import { useState } from 'react';
import Link from 'next/link';
function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
    <nav id="navid" className={isMenuOpen ? 'menu-open' : ''}>
      <Link href="/">COM@360</Link>
      <Link href="/" className={pathname === '/' ? 'active' : ''}>Home</Link>
      <Link href="/about" className={pathname === '/about' ? 'active' : ''}>About</Link>
      <Link href="/jobs" className={pathname === '/jobs' ? 'active' : ''}>Jobs</Link>
      <Link href="/features" className={pathname === '/features' ? 'active' : ''}>Top features</Link>
      <Link href="/pricing" className={pathname === '/pricing' ? 'active' : ''}>Plans and pricing</Link>
      <Link href="/contact" className={pathname === '/contact' ? 'active' : ''}>Contact Us</Link>
      <Link href="/support" className={pathname === '/support' ? 'active' : ''}>Support</Link>
      <Link href="/docs" className={pathname === '/docs' ? 'active' : ''}>Documentation / tutorials</Link>
      <Link href="#"><MdApps className="menu-icon" /></Link>
      <Link href="/login" className={`button ${pathname === '/login' ? 'active' : ''}`}>Login</Link>
      
      {/* Hamburger menu button for mobile */}
      <button 
        className={`hamburger ${isMenuOpen ? 'active' : ''}`}
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    </nav>
  
    </>
  );
}

export default Navbar;
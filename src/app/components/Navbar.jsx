'use client';
import { usePathname } from 'next/navigation';
import { MdApps } from 'react-icons/md';
import { useState } from 'react';

function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav id="navid" className={isMenuOpen ? 'menu-open' : ''}>
      <a href="/">COM@360</a>
      <a href="/" className={pathname === '/' ? 'active' : ''}>Home</a>
      <a href="/about" className={pathname === '/about' ? 'active' : ''}>About</a>
      <a href="/jobs" className={pathname === '/jobs' ? 'active' : ''}>Jobs</a>
      <a href="/features" className={pathname === '/features' ? 'active' : ''}>Top features</a>
      <a href="/pricing" className={pathname === '/pricing' ? 'active' : ''}>Plans and pricing</a>
      <a href="/contact" className={pathname === '/contact' ? 'active' : ''}>Contact Us</a>
      <a href="/support" className={pathname === '/support' ? 'active' : ''}>Support</a>
      <a href="/docs" className={pathname === '/docs' ? 'active' : ''}>Documentation / tutorials</a>
      <a href="#"><MdApps className="menu-icon" /></a>
      <a href="/login" className={`button ${pathname === '/login' ? 'active' : ''}`}>Login</a>
      
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
  );
}

export default Navbar;
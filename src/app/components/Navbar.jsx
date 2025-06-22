'use client';
import { usePathname } from 'next/navigation';
import { MdApps } from 'react-icons/md'; // Material Design icon

function Navbar() {
  const pathname = usePathname();

  return (
    <nav id="navid">
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
    </nav>
  );
}


export default Navbar;

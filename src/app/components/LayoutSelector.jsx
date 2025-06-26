'use client';
import { usePathname } from 'next/navigation';
import Navbar from '../components/Navbar';

export default function LayoutSelector({ children }) {
  const pathname = usePathname();
  const isUserOrJobScreen = pathname.startsWith('/userscreens') || pathname.startsWith('/jobs');

  if (isUserOrJobScreen) return <>{children}</>;

  return (
    <>
      <Navbar />
      <main style={{ marginTop: '30px' }}>{children}</main>
    </>
  );
}

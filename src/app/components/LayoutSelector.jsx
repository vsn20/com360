'use client';
import { usePathname } from 'next/navigation';
import Navbar from '../components/Navbar';

export default function LayoutSelector({ children }) {
  const pathname = usePathname();
  const isUserScreen = pathname.startsWith('/userscreens');

  if (isUserScreen) return <>{children}</>;

  return (
    <>
      <Navbar />
      <main style={{ marginTop: '30px' }}>{children}</main>
    </>
  );
}

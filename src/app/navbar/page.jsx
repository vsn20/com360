'use client'

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { getnavbaritems } from '../serverActions/NavbarAction';

const Navbarpage = () => {
  const [navbaritems, setnavbaritems] = useState([]);
  const [error, seterror] = useState(null);

  useEffect(() => {
    async function fetchNavbar() {
      try {
        const data = await getnavbaritems();
        console.log("Received navbar items in component:", data);
        if (!data || data.length === 0) {
          seterror("No navbar items found");
          setnavbaritems([]);
          return;
        }
        setnavbaritems(data);
        seterror(null);
      } catch (error) {
        console.error("Error fetching navbar items:", error);
        seterror("Failed to load navbar items");
      }
    }
    fetchNavbar();
  }, []);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="navbar-container">
      <nav className="navbar-nav">
        {navbaritems
          .filter(item => item.name) // Only render items with a name
          .map((item) => (
            <Link key={item.id} href={item.href}>
              {item.name}
            </Link>
          ))}
      </nav>
    </div>
  );
};

export default Navbarpage;
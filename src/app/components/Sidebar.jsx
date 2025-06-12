"use client";

import { useEffect, useState } from "react";
import { getsidebarmenu } from "../serverActions/getsmenu";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SidebarMenu({ roleid }) {
  const [sidebaritems, setSidebaritems] = useState([]);
  const pathname = usePathname();

  // Extract role from current path (e.g., /homepage/admin/sales)
  const role = pathname.split("/")[2] || "unknown";

  useEffect(() => {
    async function fetchSidebar() {
      try {
        const data = await getsidebarmenu(roleid);
        setSidebaritems(data || []);
      } catch (error) {
        console.error("Error fetching sidebar:", error);
        setSidebaritems([]);
      }
    }
    fetchSidebar();
  }, [roleid]);

  return (
    <div className="sidebar" style={{
      position: 'fixed',
      top: '60px', // below navbar
      left: 0,
      width: '200px',
      height: 'calc(100vh - 60px)',
      backgroundColor: '#333',
      color: 'white',
      padding: '20px',
    }}>
      {sidebaritems.length > 0 ? (
        sidebaritems.map((item) => (
          <Link
            key={`${item.name}-${item.href}`}
            href={`/homepage/${role}${item.href}`}
            className="sidebar-link"
            style={{
              display: 'block',
              color: 'white',
              textDecoration: 'none',
              padding: '10px 0',
              borderBottom: '1px solid #444',
            }}
          >
            {item.name}
          </Link>
        ))
      ) : (
        <p>No features available for your role.</p>
      )}
    </div>
  );
}
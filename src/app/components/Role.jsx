"use client";

import React from 'react';
import { useRouter, useParams } from 'next/navigation';

const Role = () => {
  const router = useRouter();
  const params = useParams();
  const role = params?.role || ""; // Extract the [role] parameter (e.g., "admin")

  const handleAddRoleClick = () => {
    // Navigate to /homepage/[role]/role/addrole
    router.push(`/homepage/${role}/role/addrole`);
  };

  return (
    <div>
      <h1>Role Page</h1>
      <button
        onClick={handleAddRoleClick}
        style={{
          padding: "10px 20px",
          backgroundColor: "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          marginTop: "10px",
        }}
      >
        Add Role
      </button>
    </div>
  );
};

export default Role;
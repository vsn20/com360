"use client";

import { useState, useRef, useEffect } from "react";
import { logoutAction } from "../serverActions/logoutAction";

export default function LogoutButton({ username, role }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    await logoutAction(); // redirects the user
  };

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
      }}
    >
      {/* Round icon button */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          backgroundColor: "#111",
          color: "#fff",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "16px",
        }}
      >
        {username ? username.charAt(0).toUpperCase() : "U"}
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            marginTop: "10px",
            background: "#fff",
            padding: "10px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            minWidth: "160px",
            fontFamily: "sans-serif",
          }}
        >
          <p style={{ margin: "4px 0", fontWeight: "bold" }}>{username}</p>
          <p style={{ margin: "4px 0", fontSize: "12px", color: "#666" }}>{role}</p>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              backgroundColor: "red",
              color: "white",
              padding: "6px",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              marginTop: "8px",
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { logoutAction } from "../serverActions/logoutAction";

export default function LogoutButton({ username, role }) {
  console.log(`[LogoutButton] Rendering with username: ${username}, role: ${role}`);
  
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    console.log("[LogoutButton] Initiating logout");
    await logoutAction();
    // Note: This line will not be reached because logoutAction redirects
    console.log("[LogoutButton] Logout successful - this log won't appear");
  };

  return (
    <div className="logout-container">
      {/* Round button */}
      <div
        className="user-button"
        onMouseEnter={() => {
          console.log("[LogoutButton] Mouse entered, opening dropdown");
          setIsOpen(true);
        }}
        onMouseLeave={() => {
          console.log("[LogoutButton] Mouse left, closing dropdown");
          setIsOpen(false);
        }}
        onClick={() => {
          console.log("[LogoutButton] Button clicked, toggling dropdown");
          setIsOpen(!isOpen);
        }}
      >
        {username ? username.charAt(0).toUpperCase() : "U"}
      </div>

      {/* Dropdown on hover/click */}
      {isOpen && (
        <div
          className="dropdown-menu"
          onMouseEnter={() => {
            console.log("[LogoutButton] Mouse entered dropdown, keeping open");
            setIsOpen(true);
          }}
          onMouseLeave={() => {
            console.log("[LogoutButton] Mouse left dropdown, closing");
            setIsOpen(false);
          }}
        >
          <p className="dropdown-username">
            <strong>{username}</strong>
          </p>
          <p className="dropdown-role">{role}</p>
          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
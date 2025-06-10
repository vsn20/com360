import { getUserRole } from "../../serverActions/getUserRole";
import LogoutButton from "../../components/LogoutButton";

export default async function Homepage({ params }) {
  const role = params?.role || "";

  if (!role) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h1>Error</h1>
          <p>Role parameter is missing.</p>
        </div>
      </div>
    );
  }

  const { success, roleid, username, error } = await getUserRole();

  if (!success) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h1>Error</h1>
          <p>{error || "You must be logged in to view this page."}</p>
        </div>
      </div>
    );
  }

  const userRole = roleid === 1 ? "admin" : "employee";

  if (role !== userRole) {
    return (
      <div className="unauthorized-container">
        <div className="unauthorized-content">
          <h1>Unauthorized</h1>
          <p>You do not have access to this page.</p>
        </div>
      </div>
    );
  }

  const isAdmin = roleid === 1;
  const isEmployee = roleid === 2;
  const displayRole = isAdmin ? "Admin" : "Employee";

  return (
    <div className="homepage-container">
      {/* Navigation Bar */}
      <nav className="homepage-nav">
        <div className="nav-links">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </div>
        {/* Logout Button */}
        <LogoutButton username={username} role={displayRole} />
      </nav>

      {/* Main Content */}
      <div className="main-content">
        {isAdmin && (
          <h1>Hello Admin, welcome to club</h1>
        )}
        {isEmployee && (
          <h1>Hi Employee, warm regards</h1>
        )}
      </div>
    </div>
  );
}
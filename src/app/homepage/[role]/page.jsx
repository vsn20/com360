import { getUserRole } from "../../serverActions/getUserRole";
import LogoutButton from "../../components/LogoutButton";
import SidebarMenu from "@/app/components/Sidebar";

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

  const { success, roleid, username, rolename, error } = await getUserRole();
  console.log("Homepage: getUserRole result:", { success, roleid, username, rolename, error });

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

  const userRole = rolename.toLowerCase();
  const displayRole = rolename;

  // Check if the URL role matches the user's role
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

  return (
    <div className="homepage-container">
      <SidebarMenu roleid={roleid} />
      <LogoutButton username={username} role={displayRole} />
      <div
        className="main-content"
        style={{
          position: "absolute",
          top: "60px",
          left: "220px",
          right: 0,
          bottom: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "24px",
          fontWeight: "bold",
          backgroundColor: "#f2f2f2",
          height: "calc(100vh - 60px)",
        }}
      >
        <h1>Hello {displayRole}, welcome to the dashboard!</h1>
      </div>
    </div>
  );
}
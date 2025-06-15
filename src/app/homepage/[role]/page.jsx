// app/[role]/page.js
import { getUserRole } from "../../serverActions/getUserRole";

export default async function Homepage({ params }) {
  // Decode URL-encoded role and normalize
  const role = decodeURIComponent(params?.role || "").toLowerCase().replace(/\s+/g, " ").trim();
  console.log("Homepage: URL role:", role); // Debug

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

  const { success, rolename, error } = await getUserRole();
  console.log("Homepage: getUserRole result:", { success, rolename, error });

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

  const userRole = rolename.toLowerCase().replace(/\s+/g, " ").trim();
  console.log("Homepage: Role comparison:", { urlRole: role, userRole }); // Debug

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

  const displayRole = rolename;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "calc(100vh - 60px)",
        fontSize: "24px",
        fontWeight: "bold",
      }}
    >
      <h1>Hello {displayRole}, welcome to the dashboard!</h1>
    </div>
  );
}
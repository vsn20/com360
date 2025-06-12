// app/[role]/page.js
import { getUserRole } from "../../serverActions/getUserRole";

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

  const userRole = rolename.toLowerCase();
  const displayRole = rolename;

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
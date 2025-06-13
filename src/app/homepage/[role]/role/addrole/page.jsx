import { getAllFeatures } from "../../../../serverActions/getAllFeatures";
import AddRole from "../../../../components/AddRole";

export default async function AddRolePage({ params, searchParams }) {
  const role = params?.role || ""; // e.g., "admin"
  const { success, features, error: fetchError } = await getAllFeatures();
  const error = searchParams?.error || null; // Get error from query string

  // Handle fetch error
  if (!success) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <h1>Add Role</h1>
        <p style={{ color: "red" }}>{fetchError || "Failed to load features."}</p>
      </div>
    );
  }

  return (
    <AddRole
      features={features}
      currentRole={role}
      error={error}
    />
  );
}
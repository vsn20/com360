import { getAllFeatures } from "../../../../serverActions/getAllFeatures";
import AddRole from "../../../../components/AddRole";

export const dynamic = 'force-dynamic'; // Force dynamic rendering to prevent caching

export default async function AddRolePage({ params, searchParams }) {
  const role = params?.role || "";
  const { success, features, error: fetchError } = await getAllFeatures();
  const error = searchParams?.error || null;

  if (!success) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <h1>Add Role</h1>
        <p style={{ color: "red" }}>{fetchError || "Failed to load features."}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <AddRole
        features={features}
        currentRole={role}
        error={error}
      />
    </div>
  );
}
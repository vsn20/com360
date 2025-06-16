import { addRole } from "../serverActions/addRole";

export default async function AddRole({ features, currentRole, error }) {
  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Add Role</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form action={addRole}>
        {/* Hidden input to pass the current role for redirection */}
        <input type="hidden" name="currentRole" value={currentRole} />

        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="roleName" style={{ display: "block", marginBottom: "5px" }}>
            Role Name:
          </label>
          <input
            type="text"
            id="roleName"
            name="roleName"
            placeholder="Enter role name (e.g., Manager)"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h3>Select Features:</h3>
          {features.length === 0 ? (
            <p>No features available.</p>
          ) : (
            features.map((feature) => (
              <div key={feature.id} style={{ margin: "10px 0" }}>
                <label style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    name="features"
                    value={feature.id}
                    style={{ marginRight: "10px" }}
                  />
                  {feature.name}
                </label>
              </div>
            ))
          )}
        </div>

        <button
          type="submit"
          style={{
            padding: "10px 20px",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Add Role
        </button>
      </form>
    </div>
  );
}
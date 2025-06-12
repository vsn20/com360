"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginaction } from "../serverActions/loginAction";

export default function Login() {
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.target);
    const logindetails = {
      username: formData.get("username"),
      password: formData.get("password"),
    };

    try {
      const result = await loginaction(logindetails);
      if (result.success) {
        // Use the rolename from loginaction response for redirection
        const roleName = result.rolename.toLowerCase();
        router.push(`/homepage/${roleName}`);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("An error occurred during login");
    }
  };

  return (
    <div className="login-container">
      <h1>Login Page</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Username</label>
          <input type="text" name="username"  />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" name="password" />
        </div>
        <button className="login-button" type="submit">Login</button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
}
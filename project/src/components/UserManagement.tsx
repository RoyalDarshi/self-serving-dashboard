import React, { useState } from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Ensure only admins can access this component
  if (!user || user.role !== "admin") {
    return (
      <div className="p-6 text-red-600">
        Access denied. Admins only.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic client-side validation
    if (!username || !email || !password) {
      setError("All fields are required.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/semantic/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, role }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("User created successfully!");
        setUsername("");
        setEmail("");
        setPassword("");
        setRole("user");
      } else {
        setError(data.error || "Failed to create user.");
      }
    } catch (err) {
      setError("An error occurred while creating the user.");
      console.error(err);
    }
  };

  return (
    <div className="p-6 bg-slate-100 ">
      <h1 className="text-3xl font-bold text-slate-900  mb-8">
        User Management
      </h1>
      <div className="flex items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-xl shadow-lg space-y-6 w-full max-w-md transition-all duration-300"
        >
          <h2 className="text-2xl font-semibold text-center text-slate-900 ">
            Create New User
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Username
              </label>
              <input
                className="w-full border border-slate-300 p-3 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                className="w-full border border-slate-300 p-3 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200"
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                className="w-full border border-slate-300 p-3 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Role
              </label>
              <select
                className="w-full border border-slate-300 p-3 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "user")}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {error && (
            <p className="text-red-600 text-sm text-center">
              {error}
            </p>
          )}
          {success && (
            <p className="text-green-600 text-sm text-center">
              {success}
            </p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition-all duration-200"
          >
            Create User
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;

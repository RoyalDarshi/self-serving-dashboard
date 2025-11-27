import React, { useState, useEffect } from "react";
import {
  apiService,
  User,
  Role,
  Designation,
  AccessLevel,
} from "../../services/api";

// Constants
const ROLES: Role[] = ["admin", "user", "designer"];
const ACCESS_LEVELS: AccessLevel[] = ["viewer", "editor"];
const DESIGNATIONS: Designation[] = [
  null,
  "Business Analyst",
  "Data Scientist",
  "Operations Manager",
  "Finance Manager",
  "Consumer Insights Manager",
  "Store / Regional Manager",
];

// Form data interface, separate from the main User type
interface FormData {
  id: number;
  username: string;
  password: string;
  role: Role;
  accessLevel: AccessLevel;
  designation: Designation;
  is_ad_user: boolean; // Track if the user is from AD
}

// Utility Functions
const getRoleColor = (role: string): string => {
  switch (role) {
    case "admin":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "designer":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "user":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ===================================================================
// START: MOVED AND UPDATED UserForm COMPONENT
// ===================================================================

interface UserFormProps {
  isEditing: boolean;
  formData: FormData;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleCancel: () => void;
}

const UserForm: React.FC<UserFormProps> = ({
  isEditing,
  formData,
  handleInputChange,
  handleSubmit,
  handleCancel,
}) => (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
      <div className="flex items-center justify-between pb-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">
          {isEditing ? "Edit User" : "Create New User"}
        </h3>
        <button
          onClick={handleCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close form"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Username *
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100"
              required
              disabled={isEditing}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              required={!isEditing}
              placeholder={
                isEditing
                  ? formData.is_ad_user
                    ? "Cannot change for AD user"
                    : "Leave blank to keep current"
                  : ""
              }
              disabled={isEditing && formData.is_ad_user}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Role *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {formData.role === "user" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Access Level
              </label>
              <select
                name="accessLevel"
                value={formData.accessLevel}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              >
                {ACCESS_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={formData.role === "user" ? "" : "md:col-span-1"}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Designation
            </label>
            <select
              name="designation"
              value={formData.designation || ""}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            >
              {DESIGNATIONS.map((designation) => (
                <option key={designation || "none"} value={designation || ""}>
                  {designation || "None"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors font-medium"
          >
            {isEditing ? "Update User" : "Create User"}
          </button>
        </div>
      </form>
    </div>
  </div>
);
// ===================================================================
// END: MOVED AND UPDATED UserForm COMPONENT
// ===================================================================

const UserManagement: React.FC = () => {
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState<FormData>({
    id: 0,
    username: "",
    password: "",
    role: "user",
    accessLevel: "viewer",
    designation: null,
    is_ad_user: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [importingFromAD, setImportingFromAD] = useState(false);

  // Effects
  useEffect(() => {
    fetchUsers();
  }, []);

  // API Functions
  const fetchUsers = async (): Promise<void> => {
    try {
      const fetchedUsers = await apiService.getUsers();
      setUsers(fetchedUsers);
      setError(null);
    } catch (err) {
      setError("Failed to fetch users");
      console.error("Fetch users error:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Construct the payload for both create and update
    const payload: any = {
      username: formData.username,
      role: formData.role,
      designation: formData.designation || null,
    };

    // Only add password if it's not empty and not an AD user
    if (formData.password && !formData.is_ad_user) {
      payload.password = formData.password;
    }

    // Only add accessLevel if the role is 'user'
    if (formData.role === "user") {
      payload.accessLevel = formData.accessLevel;
    }

    try {
      if (isEditing) {
        // Validation for editing
        if (!formData.username || !formData.role) {
          setError("Username and role are required");
          return;
        }
        const response = await apiService.updateUser(formData.id, payload);
        if (response.success && response.data) {
          setUsers((prev) =>
            prev.map((user) => (user.id === formData.id ? response.data : user))
          );
          setSuccess("User updated successfully");
        } else {
          setError(response.error || "Failed to update user");
        }
      } else {
        // Validation for creating
        if (!formData.username || !formData.password || !formData.role) {
          setError("Username, password, and role are required");
          return;
        }
        const response = await apiService.createUser(payload);
        if (response.success && response.data) {
          setUsers((prev) => [...prev, response.data.user]);
          setSuccess("User created successfully");
        } else {
          setError(response.error || "Failed to create user");
        }
      }

      resetForm();
      setShowForm(false);
    } catch (err) {
      setError("An error occurred");
      console.error("Submit error:", err);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      const response = await apiService.deleteUser(id);
      if (response.success) {
        setUsers((prev) => prev.filter((user) => user.id !== id));
        setSuccess("User deleted successfully");
      } else {
        setError(response.error || "Failed to delete user");
      }
    } catch (err) {
      setError("An error occurred");
      console.error("Delete error:", err);
    }
  };

  const handleImportFromAD = async (): Promise<void> => {
    setImportingFromAD(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiService.importUsersFromAD();
      if (response.success) {
        setSuccess(
          `Imported ${response.data?.importedCount || 0} users from AD`
        );
        await fetchUsers();
      } else {
        setError(response.error || "Failed to import users from AD");
      }
    } catch (err) {
      setError("An error occurred during AD import");
      console.error("AD import error:", err);
    } finally {
      setImportingFromAD(false);
    }
  };

  // Form Handlers
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (user: User): void => {
    setFormData({
      id: user.id,
      username: user.username,
      password: "", // Clear password for editing
      role: user.role,
      accessLevel: user.accessLevel || "viewer",
      designation: user.designation || null,
      is_ad_user: user.is_ad_user, // Set the AD user flag
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const resetForm = (): void => {
    setFormData({
      id: 0,
      username: "",
      password: "",
      role: "user",
      accessLevel: "viewer",
      designation: null,
      is_ad_user: false, // Reset the AD user flag
    });
    setIsEditing(false);
  };

  const handleAddUser = (): void => {
    resetForm();
    setShowForm(true);
  };

  const handleCancel = (): void => {
    resetForm();
    setShowForm(false);
  };

  // Computed Values
  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase();
    const userType = user.is_ad_user ? "ad" : "local";

    return (
      user.username.toLowerCase().includes(term) ||
      user.role.toLowerCase().includes(term) ||
      (user.designation && user.designation.toLowerCase().includes(term)) ||
      (user.accessLevel && user.accessLevel.toLowerCase().includes(term)) ||
      userType.includes(term)
    );
  });

  // Sub-Components (Not defined inside render)
  const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
    <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-red-800">{message}</p>
        </div>
      </div>
    </div>
  );

  const SuccessMessage: React.FC<{ message: string }> = ({ message }) => (
    <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-green-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-green-800">{message}</p>
        </div>
      </div>
    </div>
  );

  const colorClasses: Record<string, any> = {
    blue: {
      bg: "bg-blue-500",
      text: "text-blue-600",
      border: "border-blue-200",
      from: "from-blue-50",
      to: "to-blue-100",
    },
    purple: {
      bg: "bg-purple-500",
      text: "text-purple-600",
      border: "border-purple-200",
      from: "from-purple-50",
      to: "to-purple-100",
    },
    green: {
      bg: "bg-green-500",
      text: "text-green-600",
      border: "border-green-200",
      from: "from-green-50",
      to: "to-green-100",
    },
  };

  const StatsCard: React.FC<{
    title: string;
    value: number | string;
    color: "blue" | "purple" | "green";
    icon: React.ReactNode;
  }> = ({ title, value, color, icon }) => {
    const c = colorClasses[color];

    return (
      <div
        className={`bg-gradient-to-r ${c.from} ${c.to} rounded-lg p-4 border ${c.border}`}
      >
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div
              className={`w-8 h-8 ${c.bg} rounded-lg flex items-center justify-center`}
            >
              {icon}
            </div>
          </div>
          <div className="ml-3">
            <p className={`text-sm font-medium ${c.text}`}>{title}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg mb-8">
          <div className="px-6 py-8 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  User Management
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Manage users, roles, and permissions for your organization
                </p>
              </div>
              <div className="mt-4 sm:mt-0 space-x-2">
                <button
                  onClick={handleAddUser}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 shadow-sm"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Add New Local User
                </button>
                <button
                  onClick={handleImportFromAD}
                  disabled={importingFromAD}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 shadow-sm"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                  {importingFromAD ? "Importing..." : "Import from AD"}
                </button>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatsCard
                title="Total Users"
                value={users.length}
                color="blue"
                icon={
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                }
              />
              <StatsCard
                title="Administrators"
                value={users.filter((u) => u.role === "admin").length}
                color="purple"
                icon={
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                }
              />
              <StatsCard
                title="Active Users"
                value={users.filter((u) => u.role === "user").length}
                color="green"
                icon={
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                }
              />
            </div>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <UserForm
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            handleCancel={handleCancel}
          />
        )}

        {/* Messages */}
        {error && <ErrorMessage message={error} />}
        {success && <SuccessMessage message={success} />}

        {/* Search */}
        <div className="bg-white shadow-sm rounded-lg mb-6">
          <div className="px-6 py-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by name, role, designation, access level, or type (AD/Local)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* User Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Access Level
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {user.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.username}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {user.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getRoleColor(
                            user.role
                          )}`}
                        >
                          {user.role.charAt(0).toUpperCase() +
                            user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.role === "user" && user.accessLevel ? (
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${user.accessLevel === "editor"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {user.accessLevel.charAt(0).toUpperCase() +
                              user.accessLevel.slice(1)}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {user.designation || (
                          <span className="text-gray-400 italic">
                            No designation
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${user.is_ad_user
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                            }`}
                        >
                          {user.is_ad_user ? "AD" : "Local"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-600 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            title="Edit user"
                          >
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-600 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                            title="Delete user"
                          >
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No users found that match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;

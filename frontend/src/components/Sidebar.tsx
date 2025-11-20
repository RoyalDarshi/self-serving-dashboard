// Sidebar.tsx
import React from "react";
import {
  UserPlus,
  Database,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Link,
  FileText,
  ClipboardList,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: { role: string; accessLevel: string } | null;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
}) => {
  return (
    <div className="w-16 bg-gray-800 text-white h-screen p-3 fixed top-0 left-0 flex flex-col items-center space-y-4">
      {user?.role === "admin" && (
        <>
          <button
            onClick={() => setActiveTab("create-user")}
            className={`p-2 rounded-md ${
              activeTab === "create-user" ? "bg-blue-600" : "hover:bg-gray-700"
            }`}
            title="User Management"
          >
            <UserPlus className="h-6 w-6" />
          </button>
          <button
            onClick={() => setActiveTab("admin-panel")}
            className={`p-2 rounded-md ${
              activeTab === "admin-panel" ? "bg-blue-600" : "hover:bg-gray-700"
            }`}
            title="Connections Management"
          >
            <Database className="h-6 w-6" />
          </button>
          <button
            onClick={() => setActiveTab("connection-designations")}
            className={`p-2 rounded-md ${
              activeTab === "connection-designations"
                ? "bg-blue-600"
                : "hover:bg-gray-700"
            }`}
            title="Connection Hub"
          >
            <Link className="h-6 w-6" />
          </button>
        </>
      )}
      {user?.role === "designer" && (
        <button
          onClick={() => setActiveTab("semantic-builder")}
          className={`p-2 rounded-md ${
            activeTab === "semantic-builder"
              ? "bg-blue-600"
              : "hover:bg-gray-700"
          }`}
          title="Semantic Builder"
        >
          <Database className="h-6 w-6" />
        </button>
      )}
      {(user?.role === "designer" ||
        (user?.role === "user" && user?.accessLevel === "editor")) && (
        <button
          onClick={() => setActiveTab("chart-builder")}
          className={`p-2 rounded-md ${
            activeTab === "chart-builder" ? "bg-blue-600" : "hover:bg-gray-700"
          }`}
          title="Chart Builder"
        >
          <BarChart3 className="h-6 w-6" />
        </button>
      )}
      {(user?.role === "designer" || user?.role === "user") && (
        <button
          onClick={() => setActiveTab("my-dashboards")}
          className={`p-2 rounded-md ${
            activeTab === "my-dashboards" ? "bg-blue-600" : "hover:bg-gray-700"
          }`}
          title="My Dashboards"
        >
          <LayoutDashboard className="h-6 w-6" />
        </button>
      )}
      {/* Reports Tab for all users who can view dashboards */}
      {(user?.role === "designer" || user?.role === "user") && (
        <button
          onClick={() => setActiveTab("reports")}
          className={`p-2 rounded-md ${
            activeTab === "reports" ? "bg-blue-600" : "hover:bg-gray-700"
          }`}
          title="Reports"
        >
          <FileText className="h-6 w-6" />
        </button>
      )}

      {/* Report Builder only for designers & editors */}
      {(user?.role === "designer" ||
        (user?.role === "user" && user?.accessLevel === "editor")) && (
        <button
          onClick={() => setActiveTab("report-builder")}
          className={`p-2 rounded-md ${
            activeTab === "report-builder" ? "bg-blue-600" : "hover:bg-gray-700"
          }`}
          title="Report Builder"
        >
          <ClipboardList className="h-6 w-6" />
        </button>
      )}

      <button
        onClick={onLogout}
        className="p-2 rounded-md hover:bg-gray-700 mt-auto"
        title="Logout"
      >
        <LogOut className="h-6 w-6" />
      </button>
    </div>
  );
};

export default Sidebar;

// Sidebar.tsx
import React from "react";
import {
  UserPlus,
  Settings,
  BarChart3,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: { role: string } | null;
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
            title="Create User"
          >
            <UserPlus className="h-6 w-6" />
          </button>
          <button
            onClick={() => setActiveTab("admin-panel")}
            className={`p-2 rounded-md ${
              activeTab === "admin-panel" ? "bg-blue-600" : "hover:bg-gray-700"
            }`}
            title="Admin Panel"
          >
            <Settings className="h-6 w-6" />
          </button>
        </>
      )}
      <button
        onClick={() => setActiveTab("dashboard")}
        className={`p-2 rounded-md ${
          activeTab === "dashboard" ? "bg-blue-600" : "hover:bg-gray-700"
        }`}
        title="Chart Builder"
      >
        <BarChart3 className="h-6 w-6" />
      </button>
      <button
        onClick={() => setActiveTab("my-dashboards")}
        className={`p-2 rounded-md ${
          activeTab === "my-dashboards" ? "bg-blue-600" : "hover:bg-gray-700"
        }`}
        title="My Dashboards"
      >
        <LayoutDashboard className="h-6 w-6" />
      </button>
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

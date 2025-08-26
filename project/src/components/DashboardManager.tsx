import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";

interface Dashboard {
  id: number;
  name: string;
  layout: string;
}

const DashboardManager: React.FC = () => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [newDashboardName, setNewDashboardName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboards = async () => {
      try {
        const response = await apiService.getDashboards();
        if (response.success) {
          setDashboards(response.dashboards);
        } else {
          setError("Failed to fetch dashboards");
        }
      } catch (err) {
        console.error("Fetch dashboards error:", err);
        setError("Failed to fetch dashboards");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboards();
  }, []);

  const handleCreateDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiService.saveDashboard(newDashboardName, []);
      if (response.success) {
        const dashboardResponse = await apiService.getDashboards();
        if (dashboardResponse.success) {
          setDashboards(dashboardResponse.dashboards);
          setNewDashboardName("");
        } else {
          setError("Failed to refresh dashboards");
        }
      } else {
        setError("Failed to create dashboard");
      }
    } catch (err) {
      console.error("Create dashboard error:", err);
      setError("Failed to create dashboard");
    }
  };

  const handleDeleteDashboard = async (dashboardId: number) => {
    try {
      const response = await apiService.deleteDashboard(dashboardId);
      if (response.success) {
        setDashboards(dashboards.filter((d) => d.id !== dashboardId));
      } else {
        setError("Failed to delete dashboard");
      }
    } catch (err) {
      console.error("Delete dashboard error:", err);
      setError("Failed to delete dashboard");
    }
  };

  if (loading) return <div className="text-center">Loading dashboards...</div>;
  if (error)
    return <div className="text-red-500 text-center">Error: {error}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Dashboard Manager</h2>
      <form onSubmit={handleCreateDashboard} className="mb-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Dashboard Name:
          </label>
          <input
            type="text"
            value={newDashboardName}
            onChange={(e) => setNewDashboardName(e.target.value)}
            required
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          Create Dashboard
        </button>
      </form>
      <h3 className="text-xl font-semibold mb-4">My Dashboards</h3>
      {dashboards.length === 0 ? (
        <div className="text-center">No dashboards available</div>
      ) : (
        <ul className="space-y-4">
          {dashboards.map((dashboard) => (
            <li key={dashboard.id} className="border p-4 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">{dashboard.name}</span>
                <button
                  onClick={() => handleDeleteDashboard(dashboard.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
              <pre className="bg-gray-100 p-4 rounded-md mt-2">
                {JSON.stringify(JSON.parse(dashboard.layout || "[]"), null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DashboardManager;

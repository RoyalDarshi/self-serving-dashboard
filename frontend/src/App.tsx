import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { apiService } from "./services/api";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import UserManagement from "./components/UserManagement";
import AdminPanel from "./components/AdminPanel";
import DynamicSemanticChartBuilder from "./components/DynamicSementicChartBuilder";
import DragDropProvider from "./components/DragDropProvider";
import DynamicSemanticPanel from "./components/DynamicSemanticPanel";
import Dashboard from "./components/Dashboard";

// Types from DynamicSemanticChartBuilder
interface Fact {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
  aggregate_function: string;
}
interface Dimension {
  id: number;
  name: string;
  column_name: string;
}
type AggregationType = "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
interface ChartConfig {
  id?: string;
  xAxisDimension: Dimension | null;
  yAxisFacts: Fact[];
  groupByDimension: Dimension | null;
  chartType: "bar" | "line" | "pie";
  aggregationType: AggregationType;
  stacked: boolean;
}

interface Connection {
  id: number;
  connection_name: string;
  description?: string;
  type: string;
  hostname: string;
  port: number;
  database: string;
  command_timeout?: number;
  max_transport_objects?: number;
  username: string;
  selected_db: string;
  created_at: string;
}

const App: React.FC = () => {
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [loading, setLoading] = useState<boolean>(true);
  const [dashboards, setDashboards] = useState<
    {
      id: string;
      name: string;
      description?: string;
      connectionId: number;
      charts: ChartConfig[];
      layout: any[];
    }[]
  >([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    number | null
  >(null);

  useEffect(() => {
    const validateUser = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const response = await apiService.validateToken();
          if (response.success && response.data) {
            setUser({ role: response.data.user.role });
          } else {
            localStorage.removeItem("token");
          }
        } catch (err) {
          console.error("Token validation error:", err);
          localStorage.removeItem("token");
        }
      }
      setLoading(false);
    };

    validateUser();
  }, []);

  useEffect(() => {
    if (user) {
      apiService.getConnections().then(setConnections);
      fetchDashboards();
    }
  }, [user]);

  useEffect(() => {
    if (connections.length > 0 && selectedConnectionId === null) {
      setSelectedConnectionId(connections[0].id);
    }
  }, [connections]);

  const fetchDashboards = async () => {
    const dashboards = await apiService.getDashboards();
    setDashboards(dashboards);
  };

  const addNewDashboard = async (
    name: string,
    description?: string
  ): Promise<string> => {
    if (!selectedConnectionId) {
      throw new Error("No connection selected");
    }
    const response = await apiService.saveDashboard({
      name,
      description,
      connection_id: selectedConnectionId,
      charts: [],
      layout: [],
    });
    if (response.success && response.data) {
      setDashboards((prev) => [
        ...prev,
        {
          id: response.data.dashboardId,
          name,
          description,
          connectionId: selectedConnectionId,
          charts: [],
          layout: [],
        },
      ]);
      return response.data.dashboardId;
    }
    throw new Error(response.error || "Failed to create dashboard");
  };

  const addChartToDashboard = async (
    config: ChartConfig,
    dashboardId: string
  ) => {
    const dashboard = dashboards.find((d) => d.id === dashboardId);
    if (!dashboard) return;

    const updatedCharts = [...dashboard.charts, { ...config, id: uuidv4() }];
    const updatedLayout = [
      ...dashboard.layout,
      {
        i: config.id || `chart-${updatedCharts.length - 1}`,
        x: ((updatedCharts.length - 1) % 3) * 4,
        y: Math.floor((updatedCharts.length - 1) / 3) * 4,
        w: 4,
        h: 4,
        minW: 3,
        minH: 3,
      },
    ];

    const response = await apiService.updateDashboard(dashboardId, {
      name: dashboard.name,
      description: dashboard.description,
      charts: updatedCharts,
      layout: updatedLayout,
    });

    if (response.success) {
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === dashboardId
            ? { ...d, charts: updatedCharts, layout: updatedLayout }
            : d
        )
      );
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setActiveTab("dashboard");
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Loading...
      </div>
    );

  return (
    <div className="bg-gray-100">
      {user ? (
        <div className="flex min-h-screen">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            user={user}
            onLogout={handleLogout}
          />
          <div className="flex-1 ml-16">
            {activeTab === "create-user" && user.role === "admin" && (
              <UserManagement />
            )}
            {activeTab === "admin-panel" && user.role === "admin" && (
              <AdminPanel />
            )}
            {activeTab === "dashboard" && (
              <DragDropProvider>
                <div className="flex gap-4 p-4 h-screen">
                  <div className="w-1/4">
                    <DynamicSemanticPanel
                      connections={connections}
                      selectedConnectionId={selectedConnectionId}
                      setSelectedConnectionId={setSelectedConnectionId}
                    />
                  </div>
                  <div className="w-3/4">
                    <DynamicSemanticChartBuilder
                      dashboards={dashboards}
                      addNewDashboard={addNewDashboard}
                      addChartToDashboard={addChartToDashboard}
                      selectedConnectionId={selectedConnectionId}
                    />
                  </div>
                </div>
              </DragDropProvider>
            )}
            {activeTab === "my-dashboards" && (
              <Dashboard
                dashboards={dashboards}
                addNewDashboard={addNewDashboard}
                selectedConnectionId={selectedConnectionId}
              />
            )}
          </div>
        </div>
      ) : (
        <Login setUser={setUser} />
      )}
    </div>
  );
};

export default App;

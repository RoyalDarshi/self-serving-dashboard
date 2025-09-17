import React, { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { apiService } from "./services/api";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import UserManagement from "./components/UserManagement";
import AdminPanel from "./components/AdminPanel";
import DynamicSemanticChartBuilder from "./components/DynamicSementicChartBuilder"; // Corrected typo
import DragDropProvider from "./components/DragDropProvider";
import DynamicSemanticPanel from "./components/DynamicSemanticPanel";
import Dashboard from "./components/Dashboard";
import { debounce } from "lodash";

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

interface DashboardData {
  id: string;
  name: string;
  description?: string;
  connectionId: number;
  charts: ChartConfig[];
  layout: any[];
}

const App: React.FC = () => {
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [loading, setLoading] = useState<boolean>(true);
  const [dashboards, setDashboards] = useState<DashboardData[]>([]);
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
      console.log("Fetching connections and dashboards for user:", user);
      apiService.getConnections().then((connections) => {
        console.log("Fetched connections:", connections);
        setConnections(connections);
      });
      fetchDashboards();
    }
  }, [user]);

  useEffect(() => {
    if (connections.length > 0 && selectedConnectionId === null) {
      console.log("Setting default connection ID:", connections[0].id);
      setSelectedConnectionId(connections[0].id);
    }
  }, [connections, selectedConnectionId]);

  const fetchDashboards = useCallback(async () => {
    try {
      console.log("Calling fetchDashboards");
      const dashboards = await apiService.getDashboards();
      console.log("Fetched dashboards:", dashboards);
      const synchronizedDashboards = dashboards.map((dashboard) => ({
        ...dashboard,
        layout: dashboard.layout.filter((item) =>
          dashboard.charts.some((chart) => chart.id === item.i)
        ),
      }));
      setDashboards(synchronizedDashboards);
    } catch (error) {
      console.error("Error fetching dashboards:", error);
    }
  }, []);

  const addNewDashboard = useCallback(
    debounce(async (name: string, description?: string): Promise<string> => {
      console.log("Calling addNewDashboard with:", { name, description });
      if (!selectedConnectionId) {
        throw new Error("No connection selected");
      }
      try {
        const response = await apiService.saveDashboard({
          name,
          description,
          connection_id: selectedConnectionId,
          charts: [],
          layout: [],
        });
        if (response.success && response.data) {
          await fetchDashboards();
          return response.data.dashboardId;
        }
        throw new Error(response.error || "Failed to create dashboard");
      } catch (error) {
        console.error("Error creating dashboard:", error);
        throw error;
      }
    }, 1000),
    [selectedConnectionId, fetchDashboards]
  );

  const addChartToDashboard = useCallback(
    debounce(async (config: ChartConfig, dashboardId: string) => {
      console.log("Calling addChartToDashboard with:", { dashboardId, config });
      const dashboard = dashboards.find((d) => d.id === dashboardId);
      if (!dashboard) {
        console.error("Dashboard not found:", dashboardId);
        return;
      }

      try {
        const chartId = config.id || uuidv4();
        const updatedCharts = [...dashboard.charts, { ...config, id: chartId }];
        const updatedLayout = [
          ...dashboard.layout.filter((item) =>
            updatedCharts.some((chart) => chart.id === item.i)
          ),
          {
            i: chartId,
            x: ((updatedCharts.length - 1) % 2) * 6,
            y: Math.floor((updatedCharts.length - 1) / 2) * 7,
            w: 6,
            h: 7,
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
          await fetchDashboards();
        } else {
          throw new Error(response.error || "Failed to update dashboard");
        }
      } catch (error) {
        console.error("Error adding chart to dashboard:", error);
      }
    }, 1000),
    [dashboards, fetchDashboards]
  );

  const handleLogout = () => {
    console.log("Logging out user");
    localStorage.removeItem("token");
    setUser(null);
    setActiveTab("dashboard");
    setDashboards([]);
    setConnections([]);
    setSelectedConnectionId(null);
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
                setDashboards={setDashboards}
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

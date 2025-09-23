// App.tsx
import React, { useState, useEffect, useCallback } from "react";
import { apiService } from "./services/api";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import UserManagement from "./components/UserManagement";
import ConnectionManager from "./components/ConnectionManager";
import DynamicSemanticChartBuilder from "./components/DynamicSementicChartBuilder";
import DragDropProvider from "./components/DragDropProvider";
import DynamicSemanticPanel from "./components/DynamicSemanticPanel";
import Dashboard from "./components/Dashboard";
import SemanticBuilder from "./components/SemanticBuilder"; // New component for designer
import ConnectionDesignationManager from "./components/ConnectionDesignationManager";

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

// Updated user interface to include designation
interface User {
  role: string;
  designation?: string | null;
  id?: number;
  accessLevel?: string | null;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>("chart-builder");
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
            setUser({
              role: response.data.user.role,
              designation: response.data.user.designation,
              id: response.data.user.id,
              accessLevel: response.data.user.accessLevel,
            });
            console.log(response.data);
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
      apiService.getConnections().then((connections) => {
        setConnections(connections);
      });
      fetchDashboards();

      // Set initial tab based on role
      if (user.role === "admin") {
        setActiveTab("create-user");
      } else if (user.role === "designer") {
        setActiveTab("chart-builder");
      } else {
        setActiveTab("my-dashboards");
      }
    }
  }, [user]);

  useEffect(() => {
    if (connections.length > 0 && selectedConnectionId === null) {
      setSelectedConnectionId(connections[0].id);
    }
  }, [connections, selectedConnectionId]);

  const fetchDashboards = useCallback(async () => {
    try {
      const dashboards = await apiService.getDashboards();
      const synchronizedDashboards = dashboards.map((dashboard) => ({
        ...dashboard,
        layout: (dashboard.layout || [])
          .map((item) => ({
            ...item,
            x: Number(item.x) || 0,
            y: Number(item.y) || 0,
            w: Number(item.w) || 6,
            h: Number(item.h) || 7,
            minW: Number(item.minW) || 3,
            minH: Number(item.minH) || 3,
          }))
          .filter((item) =>
            dashboard.charts.some((chart) => chart.id === item.i)
          ),
      }));
      setDashboards(synchronizedDashboards);
    } catch (error) {
      console.error("Error fetching dashboards:", error);
    }
  }, []);

  const addNewDashboard = useCallback(
    async (name: string, description?: string): Promise<string> => {
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
          return response.data.data.dashboardId;
        }
        throw new Error(response.error || "Failed to create dashboard");
      } catch (error) {
        console.error("Error creating dashboard:", error);
        throw error;
      }
    },
    [selectedConnectionId, fetchDashboards]
  );

  const handleConnectionsUpdate = useCallback(
    (updatedConnections: Connection[]) => {
      setConnections(updatedConnections);
      if (updatedConnections.length > 0 && selectedConnectionId === null) {
        setSelectedConnectionId(updatedConnections[0].id);
      }
    },
    [selectedConnectionId]
  );

  const handleDashboardsUpdate = useCallback(
    (updatedDashboards: DashboardData[]) => {
      setDashboards(updatedDashboards);
    },
    []
  );

  const handleLogout = () => {
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
              <ConnectionManager
                onConnectionsUpdate={handleConnectionsUpdate}
              />
            )}
            {activeTab === "connection-designations" &&
              user.role === "admin" && (
                <ConnectionDesignationManager connections={connections} />
              )}
            {activeTab === "chart-builder" &&
              (user.role === "designer" ||
                (user.role === "user" && user.accessLevel === "editor")) && (
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
                        selectedConnectionId={selectedConnectionId}
                        refreshDashboards={fetchDashboards}
                      />
                    </div>
                  </div>
                </DragDropProvider>
              )}
            {activeTab === "semantic-builder" && user.role === "designer" && (
              <SemanticBuilder
                connections={connections}
                selectedConnectionId={selectedConnectionId}
                setSelectedConnectionId={setSelectedConnectionId}
              />
            )}
            {activeTab === "my-dashboards" &&
              (user.role === "designer" || user.role === "user") && (
                <Dashboard
                  dashboards={dashboards}
                  setDashboards={setDashboards}
                  addNewDashboard={addNewDashboard}
                  selectedConnectionId={selectedConnectionId}
                  setSelectedConnectionId={setSelectedConnectionId}
                  connections={connections}
                  onDashboardsUpdate={handleDashboardsUpdate}
                  user={user}
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

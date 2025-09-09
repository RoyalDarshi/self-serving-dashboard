// App.tsx
import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { apiService } from "./services/api";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import CreateUser from "./components/CreateUser";
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
  xAxisDimension: Dimension | null;
  yAxisFacts: Fact[];
  groupByDimension: Dimension | null;
  chartType: "bar" | "line" | "pie";
  aggregationType: AggregationType;
  stacked: boolean;
}

const App: React.FC = () => {
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [loading, setLoading] = useState<boolean>(true);
  const [dashboards, setDashboards] = useState<
    { id: string; name: string; charts: ChartConfig[] }[]
  >([]);

  useEffect(() => {
    const validateUser = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const response = await apiService.validateToken();
          if (response.success) {
            setUser({ role: response.user.role });
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setActiveTab("dashboard");
  };

  const addNewDashboard = (name: string): string => {
    const id = uuidv4();
    setDashboards((prev) => [...prev, { id, name, charts: [] }]);
    return id;
  };

  const addChartToDashboard = (config: ChartConfig, dashboardId: string) => {
    setDashboards((prev) =>
      prev.map((d) =>
        d.id === dashboardId
          ? { ...d, charts: [...d.charts, { ...config, id: uuidv4() }] }
          : d
      )
    );
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
              <CreateUser />
            )}
            {activeTab === "admin-panel" && user.role === "admin" && (
              <AdminPanel />
            )}
            {activeTab === "dashboard" && (
              <DragDropProvider>
                <div className="flex gap-4 p-4 h-screen">
                  <div className="w-1/4">
                    <DynamicSemanticPanel />
                  </div>
                  <div className="w-3/4">
                    <DynamicSemanticChartBuilder
                      dashboards={dashboards}
                      addNewDashboard={addNewDashboard}
                      addChartToDashboard={addChartToDashboard}
                    />
                  </div>
                </div>
              </DragDropProvider>
            )}
            {activeTab === "my-dashboards" && (
              <Dashboard
                dashboards={dashboards}
                addNewDashboard={addNewDashboard}
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

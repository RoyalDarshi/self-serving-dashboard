import React, { useState, useEffect, useCallback, useRef } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  LayoutDashboard,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Grid3X3,
  List,
  Calendar,
  Users,
  TrendingUp,
  BarChart3,
  PieChart,
  LineChart,
  Settings,
  Share2,
  Download,
  Eye,
  Edit3,
  Trash2,
  Move,
  Lock,
  Unlock,
} from "lucide-react";
import { debounce } from "lodash";
import SavedChart from "./SavedChart";
import apiService from "../services/api";

const ResponsiveGridLayout = WidthProvider(Responsive);

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
  title?: string;
  description?: string;
  createdAt?: string;
  lastModified?: string;
}

interface DashboardData {
  id: string;
  name: string;
  description?: string;
  connectionId: number;
  charts: ChartConfig[];
  layout?: any[];
  isPublic?: boolean;
  createdAt?: string;
  lastModified?: string;
}

interface DashboardProps {
  dashboards: DashboardData[];
  setDashboards: React.Dispatch<React.SetStateAction<DashboardData[]>>;
  addNewDashboard: (name: string, description?: string) => Promise<string>;
  selectedConnectionId: number | null;
  onDashboardsUpdate: (dashboards: DashboardData[]) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  dashboards,
  setDashboards,
  addNewDashboard,
  selectedConnectionId,
  onDashboardsUpdate,
}) => {
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardDescription, setNewDashboardDescription] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [layouts, setLayouts] = useState<any>({});
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const currentLayoutRef = useRef<any>(null);

  // Get chart type icon
  const getChartIcon = useCallback((chartType: string) => {
    switch (chartType) {
      case "bar":
        return <BarChart3 className="h-4 w-4" />;
      case "line":
        return <LineChart className="h-4 w-4" />;
      case "pie":
        return <PieChart className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  }, []);

  // Filter dashboards based on search
  const filteredDashboards = useCallback(
    () =>
      dashboards.filter(
        (dashboard) =>
          dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          dashboard.description
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      ),
    [dashboards, searchTerm]
  );

  const handleCreateDashboard = useCallback(async () => {
    if (newDashboardName.trim() && selectedConnectionId) {
      try {
        const dashboardId = await addNewDashboard(
          newDashboardName.trim(),
          newDashboardDescription
        );
        const updatedDashboards = await apiService.getDashboards();
        setDashboards(updatedDashboards);
        onDashboardsUpdate(updatedDashboards); // Notify App.tsx
        setNewDashboardName("");
        setNewDashboardDescription("");
        setShowCreateModal(false);
      } catch (error) {
        console.error("Error creating dashboard:", error);
      }
    }
  }, [
    newDashboardName,
    newDashboardDescription,
    selectedConnectionId,
    addNewDashboard,
    setDashboards,
    onDashboardsUpdate,
  ]);

  // Generate default layout for charts
  const generateLayout = useCallback((charts: ChartConfig[]) => {
    return charts.map((chart, index) => ({
      i: chart.id || `chart-${index}`,
      x: (index % 2) * 6,
      y: Math.floor(index / 2) * 8,
      w: 6,
      h: 8,
      minW: 3,
      minH: 3,
    }));
  }, []);

  // Update local layout
  const handleLayoutChange = useCallback((layout: any) => {
    setLayouts({ lg: layout });
  }, []);

  // Debounced save layout to backend
  const saveLayout = useCallback(
    debounce(async (layout: any) => {
      if (isSavingLayout) return;
      setIsSavingLayout(true);
      console.log("Saving layout to backend:", layout);

      const dashboard = dashboards.find((d) => d.id === selectedDashboard);
      if (dashboard && selectedDashboard) {
        try {
          const response = await apiService.updateDashboard(selectedDashboard, {
            name: dashboard.name,
            description: dashboard.description,
            charts: dashboard.charts,
            layout,
          });
          console.log("Backend update response:", response);
          if (response.success) {
            const updatedDashboards = dashboards.map((d) =>
              d.id === selectedDashboard ? { ...d, layout } : d
            );
            setDashboards(updatedDashboards);
            onDashboardsUpdate(updatedDashboards); // Notify App.tsx
            currentLayoutRef.current = layout;
          } else {
            console.error("Failed to update dashboard layout:", response.error);
          }
        } catch (error) {
          console.error("Error saving layout:", error);
        } finally {
          setIsSavingLayout(false);
        }
      } else {
        setIsSavingLayout(false);
      }
    }, 1000),
    [dashboards, selectedDashboard, setDashboards, onDashboardsUpdate]
  );

  // Handle stop events for drag and resize
  const handleStop = useCallback(
    (layout: any) => {
      const currentLayout = currentLayoutRef.current;
      if (JSON.stringify(layout) !== JSON.stringify(currentLayout)) {
        saveLayout(layout);
      } else {
        console.log("Layout unchanged, skipping save");
      }
    },
    [saveLayout]
  );

  const handleDeleteDashboard = useCallback(
    async (dashboardId: string) => {
      try {
        const response = await apiService.deleteDashboard(dashboardId);
        if (response.success) {
          const updatedDashboards = await apiService.getDashboards();
          console.log("Updated dashboards after delete:", updatedDashboards);
          setDashboards(updatedDashboards);
          onDashboardsUpdate(updatedDashboards); // Notify App.tsx
          if (selectedDashboard === dashboardId) {
            setSelectedDashboard(null);
          }
        }
      } catch (error) {
        console.error("Error deleting dashboard:", error);
      }
    },
    [selectedDashboard, setDashboards, onDashboardsUpdate]
  );

  const handleDeleteChart = useCallback(
    async (chartId: string) => {
      try {
        const response = await apiService.deleteChart(chartId);
        if (response.success) {
          const dashboard = dashboards.find((d) => d.id === selectedDashboard);
          if (dashboard) {
            const updatedCharts = dashboard.charts.filter(
              (c) => c.id !== chartId
            );
            const updatedLayout = dashboard.layout.filter(
              (l) => l.i !== chartId
            );
            const updateResponse = await apiService.updateDashboard(
              dashboard.id,
              {
                name: dashboard.name,
                description: dashboard.description,
                charts: updatedCharts,
                layout: updatedLayout,
              }
            );
            if (updateResponse.success) {
              const updatedDashboards = await apiService.getDashboards();
              console.log(
                "Updated dashboards after chart delete:",
                updatedDashboards
              );
              setDashboards(updatedDashboards);
              onDashboardsUpdate(updatedDashboards); // Notify App.tsx
            }
          }
        }
      } catch (error) {
        console.error("Error deleting chart:", error);
      }
    },
    [dashboards, selectedDashboard, setDashboards, onDashboardsUpdate]
  );

  const selectedDashboardData = dashboards.find(
    (d) => d.id === selectedDashboard
  );

  // Initialize currentLayoutRef on dashboard selection
  useEffect(() => {
    if (selectedDashboardData) {
      const initialLayout = selectedDashboardData.layout?.length
        ? selectedDashboardData.layout
        : generateLayout(selectedDashboardData.charts);
      setLayouts({ lg: initialLayout });
      currentLayoutRef.current = initialLayout;
      console.log(
        "Initialized layout for dashboard:",
        selectedDashboardData.id,
        initialLayout
      );
    }
  }, [selectedDashboardData, generateLayout]);

  if (selectedDashboard && selectedDashboardData) {
    const currentLayout =
      layouts.lg?.length &&
      layouts.lg.every((item) =>
        selectedDashboardData.charts.some((chart) => chart.id === item.i)
      )
        ? layouts.lg
        : selectedDashboardData.layout?.length
        ? selectedDashboardData.layout
        : generateLayout(selectedDashboardData.charts);

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSelectedDashboard(null)}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <LayoutDashboard className="h-5 w-5" />
                <span className="font-medium">All Dashboards</span>
              </button>
              <div className="text-slate-400">/</div>
              <h1 className="text-2xl font-bold text-slate-900">
                {selectedDashboardData.name}
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  isEditMode
                    ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {isEditMode ? (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Lock Layout</span>
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4" />
                    <span>Edit Layout</span>
                  </>
                )}
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>
          {selectedDashboardData.description && (
            <p className="text-slate-600 mt-2">
              {selectedDashboardData.description}
            </p>
          )}
        </div>
        <div className="p-6">
          {isEditMode && (
            <p className="text-orange-600 mb-4">
              Drag and resize charts to adjust layout.
            </p>
          )}
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: currentLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            onLayoutChange={(layout) => {
              console.log("Layout changed:", layout);
              handleLayoutChange(layout);
            }}
            onDragStop={(layout) => {
              console.log("Drag stopped, layout:", layout);
              handleStop(layout);
            }}
            onResizeStop={(layout) => {
              console.log("Resize stopped, layout:", layout);
              handleStop(layout);
            }}
          >
            {selectedDashboardData.charts.map((chart) => (
              <div
                key={chart.id}
                className="bg-white border rounded-lg p-4 relative"
              >
                <SavedChart
                  config={chart}
                  connectionId={selectedDashboardData.connectionId}
                />
                {isEditMode && (
                  <button
                    onClick={() => handleDeleteChart(chart.id)}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      </div>
    );
  }

  // Dashboard List View
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Dashboards</h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search dashboards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Dashboard</span>
          </button>
        </div>
      </div>

      {/* Dashboard List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-slate-600">
            <div className="col-span-4">Name</div>
            <div className="col-span-2">Charts</div>
            <div className="col-span-2">Last Modified</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Actions</div>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {filteredDashboards().map((dashboard) => (
            <div
              key={dashboard.id}
              className="px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
              onClick={() => setSelectedDashboard(dashboard.id)}
            >
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-4 flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <LayoutDashboard className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900">
                      {dashboard.name}
                    </h3>
                    {dashboard.description && (
                      <p className="text-sm text-slate-500 truncate">
                        {dashboard.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-sm text-slate-600">
                  {dashboard.charts.length} chart
                  {dashboard.charts.length !== 1 ? "s" : ""}
                </div>
                <div className="col-span-2 text-sm text-slate-600">
                  {dashboard.lastModified || "Recently"}
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      dashboard.isPublic
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {dashboard.isPublic ? "Shared" : "Private"}
                  </span>
                </div>
                <div className="col-span-2 flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDashboard(dashboard.id);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle edit
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDashboard(dashboard.id);
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Dashboard Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Create New Dashboard
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Dashboard Name
                  </label>
                  <input
                    type="text"
                    value={newDashboardName}
                    onChange={(e) => setNewDashboardName(e.target.value)}
                    placeholder="Enter dashboard name..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newDashboardDescription}
                    onChange={(e) => setNewDashboardDescription(e.target.value)}
                    placeholder="Describe what this dashboard will show..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewDashboardName("");
                    setNewDashboardDescription("");
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDashboard}
                  disabled={!newDashboardName.trim() || !selectedConnectionId}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

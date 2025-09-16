import React, { useState } from "react";
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
import SavedChart from "./SavedChart";

const ResponsiveGridLayout = WidthProvider(Responsive);

// Types
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
  addNewDashboard: (name: string, description?: string) => Promise<string>;
  selectedConnectionId: number | null;
}

const Dashboard: React.FC<DashboardProps> = ({
  dashboards,
  addNewDashboard,
  selectedConnectionId,
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

  // Get chart type icon
  const getChartIcon = (chartType: string) => {
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
  };

  // Filter dashboards based on search
  const filteredDashboards = dashboards.filter(
    (dashboard) =>
      dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dashboard.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateDashboard = async () => {
    if (newDashboardName.trim() && selectedConnectionId) {
      try {
        await addNewDashboard(newDashboardName.trim(), newDashboardDescription);
        setNewDashboardName("");
        setNewDashboardDescription("");
        setShowCreateModal(false);
      } catch (error) {
        console.error("Error creating dashboard:", error);
      }
    }
  };

  // Generate default layout for charts
  const generateLayout = (charts: ChartConfig[]) => {
    return charts.map((chart, index) => ({
      i: chart.id || `chart-${index}`,
      x: (index % 3) * 4,
      y: Math.floor(index / 3) * 4,
      w: 4,
      h: 4,
      minW: 3,
      minH: 3,
    }));
  };

  // Handle layout change
  const handleLayoutChange = async (layout: any, layouts: any) => {
    setLayouts(layouts);
    const dashboard = dashboards.find((d) => d.id === selectedDashboard);
    if (dashboard && selectedDashboard) {
      try {
        await fetch(`${API_BASE}/dashboard/${selectedDashboard}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            name: dashboard.name,
            description: dashboard.description,
            charts: dashboard.charts,
            layout,
          }),
        });
      } catch (error) {
        console.error("Error saving layout:", error);
      }
    }
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    const response = await apiService.deleteDashboard(dashboardId);
    if (response.success) {
      setDashboards(dashboards.filter((d) => d.id !== dashboardId));
      if (selectedDashboard === dashboardId) {
        setSelectedDashboard(null);
      }
    }
  };

  const selectedDashboardData = dashboards.find(
    (d) => d.id === selectedDashboard
  );

  if (selectedDashboard && selectedDashboardData) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Dashboard Header */}
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

        {/* Dashboard Content */}
        <div className="p-6">
          {isEditMode && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center space-x-2 text-orange-700">
                <Move className="h-5 w-5" />
                <span>Drag and resize charts to adjust the layout</span>
              </div>
            </div>
          )}
          <ResponsiveGridLayout
            className="layout"
            layouts={
              layouts.lg
                ? { lg: layouts.lg }
                : {
                    lg:
                      selectedDashboardData.layout ||
                      generateLayout(selectedDashboardData.charts),
                  }
            }
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            width={1200}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            onLayoutChange={handleLayoutChange}
          >
            {selectedDashboardData.charts.map((chart) => (
              <div
                key={chart.id}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-4"
              >
                <SavedChart
                  chart={chart}
                  connectionId={selectedDashboardData.connectionId}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
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
            {filteredDashboards.map((dashboard) => (
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

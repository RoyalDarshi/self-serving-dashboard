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
  charts: ChartConfig[];
  description?: string;
  createdAt?: string;
  lastModified?: string;
  tags?: string[];
  isPublic?: boolean;
  layout?: any[];
  layouts?: any;
}

interface DashboardProps {
  dashboards: DashboardData[];
  addNewDashboard: (name: string) => string;
}

const Dashboard: React.FC<DashboardProps> = ({
  dashboards,
  addNewDashboard,
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

  // Filter dashboards based on search and tags
  const filteredDashboards = dashboards.filter((dashboard) => {
    const matchesSearch =
      dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dashboard.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterTag === "all" || dashboard.tags?.includes(filterTag);
    return matchesSearch && matchesFilter;
  });

  // Get all unique tags
  const allTags = Array.from(new Set(dashboards.flatMap((d) => d.tags || [])));

  const handleCreateDashboard = () => {
    if (newDashboardName.trim()) {
      addNewDashboard(newDashboardName.trim());
      setNewDashboardName("");
      setNewDashboardDescription("");
      setShowCreateModal(false);
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
  const handleLayoutChange = (layout: any, layouts: any) => {
    setLayouts(layouts);
    // Here you would typically save the layout to your backend
    console.log("Layout changed:", layouts);
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
              <div className="flex items-center space-x-2 text-orange-800">
                <Move className="h-5 w-5" />
                <span className="font-medium">Edit Mode Active</span>
              </div>
              <p className="text-sm text-orange-700 mt-1">
                Drag charts to reposition them and resize by dragging the
                corners. Click "Lock Layout" when finished.
              </p>
            </div>
          )}

          {selectedDashboardData.charts.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                No charts yet
              </h3>
              <p className="text-slate-600 mb-6">
                Start building your dashboard by creating charts in the Chart
                Builder.
              </p>
              <button
                onClick={() => setSelectedDashboard(null)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Chart Builder
              </button>
            </div>
          ) : (
            <ResponsiveGridLayout
              className="layout"
              layouts={layouts}
              onLayoutChange={handleLayoutChange}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
              rowHeight={60}
              isDraggable={isEditMode}
              isResizable={isEditMode}
              margin={[16, 16]}
              containerPadding={[0, 0]}
            >
              {selectedDashboardData.charts.map((chart, index) => (
                <div
                  key={chart.id || `chart-${index}`}
                  className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 ${
                    isEditMode
                      ? "hover:shadow-lg cursor-move"
                      : "hover:shadow-md"
                  }`}
                >
                  <div className="p-4 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getChartIcon(chart.chartType)}
                        <h3 className="font-medium text-slate-900">
                          {chart.title ||
                            `${
                              chart.chartType.charAt(0).toUpperCase() +
                              chart.chartType.slice(1)
                            } Chart`}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isEditMode && (
                          <div className="flex items-center space-x-1 text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                            <Move className="h-3 w-3" />
                            <span>Drag</span>
                          </div>
                        )}
                        <button className="text-slate-400 hover:text-slate-600">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {chart.description && (
                      <p className="text-sm text-slate-600 mt-1">
                        {chart.description}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 min-h-0">
                    <SavedChart config={chart} showControls={!isEditMode} />
                  </div>
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-3">
                <LayoutDashboard className="h-8 w-8 text-blue-600" />
                <span>Analytics Dashboard</span>
              </h1>
              <p className="text-slate-600 mt-1">
                Create and manage your business intelligence dashboards
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-5 w-5" />
              <span>New Dashboard</span>
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search dashboards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-slate-400" />
                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "grid"
                    ? "bg-blue-100 text-blue-600"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Grid3X3 className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "list"
                    ? "bg-blue-100 text-blue-600"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                }`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid/List */}
      <div className="p-6">
        {filteredDashboards.length === 0 ? (
          <div className="text-center py-12">
            <LayoutDashboard className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {searchTerm || filterTag !== "all"
                ? "No dashboards found"
                : "No dashboards yet"}
            </h3>
            <p className="text-slate-600 mb-6">
              {searchTerm || filterTag !== "all"
                ? "Try adjusting your search or filter criteria."
                : "Create your first dashboard to get started with analytics."}
            </p>
            {!searchTerm && filterTag === "all" && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Dashboard
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => setSelectedDashboard(dashboard.id)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <LayoutDashboard className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {dashboard.name}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {dashboard.charts.length} chart
                          {dashboard.charts.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle menu click
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded"
                    >
                      <MoreVertical className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>

                  {dashboard.description && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                      {dashboard.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Updated {dashboard.lastModified || "recently"}
                      </span>
                    </div>
                    {dashboard.isPublic && (
                      <div className="flex items-center space-x-1">
                        <Users className="h-3 w-3" />
                        <span>Shared</span>
                      </div>
                    )}
                  </div>

                  {dashboard.tags && dashboard.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {dashboard.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {dashboard.tags.length > 2 && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                          +{dashboard.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
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
                          // Handle delete
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
        )}
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
                  disabled={!newDashboardName.trim()}
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

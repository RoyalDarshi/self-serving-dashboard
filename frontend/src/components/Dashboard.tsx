// Dashboard.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
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
  Star,
  StarOff,
} from "lucide-react";
import { debounce } from "lodash";
import SavedChart from "./SavedChart";
import apiService from "../services/api";

const ResponsiveGridLayout = WidthProvider(Responsive);

// Types and Interfaces
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
  layout?: any[];
  isPublic?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  lastModified?: string;
}

interface User {
  role: string;
  designation?: string | null;
  id?: number;
}

interface DashboardProps {
  dashboards: DashboardData[];
  setDashboards: React.Dispatch<React.SetStateAction<DashboardData[]>>;
  addNewDashboard: (name: string, description?: string) => Promise<string>;
  selectedConnectionId: number | null;
  setSelectedConnectionId: React.Dispatch<React.SetStateAction<number | null>>;
  connections: Connection[];
  onDashboardsUpdate: (dashboards: DashboardData[]) => void;
  user: User;
}

// Main Component
const Dashboard: React.FC<DashboardProps> = ({
  dashboards,
  setDashboards,
  addNewDashboard,
  selectedConnectionId,
  setSelectedConnectionId,
  connections,
  onDashboardsUpdate,
  user,
}) => {
  // State Management
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(
    null
  );
  const [defaultDashboardId, setDefaultDashboardId] = useState<string | null>(
    null
  );
  const [userWantsAllDashboards, setUserWantsAllDashboards] = useState(false);
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

  // Effects
  useEffect(() => {
    if (user.role === "designer") {
      return;
    }

    // For regular users: auto-select dashboard with charts
    if (
      user.role === "user" &&
      !selectedDashboard &&
      !userWantsAllDashboards &&
      dashboards.length > 0
    ) {
      let defaultDashboard: DashboardData | null = null;

      // First try to find a dashboard with charts that matches the selected connection
      if (selectedConnectionId) {
        defaultDashboard = dashboards.find(
          (dashboard) =>
            dashboard.connectionId === selectedConnectionId &&
            dashboard.charts.length > 0
        );
      }

      // If no connection selected or no dashboard with charts for that connection,
      // find any dashboard with charts
      if (!defaultDashboard) {
        defaultDashboard = dashboards.find(
          (dashboard) => dashboard.charts.length > 0
        );
      }

      // If found a dashboard with charts, select it and set as default
      if (defaultDashboard) {
        setSelectedDashboard(defaultDashboard.id);
        setDefaultDashboardId(defaultDashboard.id);
        setUserWantsAllDashboards(false);
      } else {
        // No dashboards with charts - show all dashboards view
        setSelectedDashboard(null);
        setDefaultDashboardId(null);
        setUserWantsAllDashboards(false);
      }
    }
  }, [
    dashboards,
    selectedConnectionId,
    selectedDashboard,
    userWantsAllDashboards,
    user.role,
  ]);

  // Reset selection when connection changes
  useEffect(() => {
    if (selectedConnectionId !== null) {
      setDefaultDashboardId(null);
      setSelectedDashboard(null);
      setUserWantsAllDashboards(false);
    }
  }, [selectedConnectionId]);

  // Layout setup for selected dashboard
  const selectedDashboardData = useMemo(() => {
    return dashboards.find((d) => d.id === selectedDashboard);
  }, [dashboards, selectedDashboard]);

  useEffect(() => {
    if (selectedDashboardData) {
      const generateLayout = (charts: ChartConfig[]) => {
        return charts.map((chart, index) => ({
          i: chart.id || `chart-${index}`,
          x: (index % 2) * 6,
          y: Math.floor(index / 2) * 8,
          w: 6,
          h: 8,
          minW: 3,
          minH: 3,
        }));
      };

      const initialLayout = selectedDashboardData.layout?.length
        ? selectedDashboardData.layout
        : generateLayout(selectedDashboardData.charts);
      setLayouts({ lg: initialLayout });
      currentLayoutRef.current = initialLayout;
    }
  }, [selectedDashboardData]);

  // Callbacks and Handlers
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

  const filteredDashboards = useCallback(
    () =>
      dashboards.filter(
        (dashboard) =>
          (selectedConnectionId === null ||
            dashboard.connectionId === selectedConnectionId) &&
          (dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dashboard.description
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()))
      ),
    [dashboards, searchTerm, selectedConnectionId]
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
        onDashboardsUpdate(updatedDashboards);
        setNewDashboardName("");
        setNewDashboardDescription("");
        setShowCreateModal(false);

        // Select the new dashboard for both roles, but set as default only for users if none exists
        const newDashboard = updatedDashboards.find(
          (d) => d.id === dashboardId
        );
        if (newDashboard) {
          setSelectedDashboard(newDashboard.id);
          // Only set as default if no default exists yet
          if (user.role === "user" && !defaultDashboardId) {
            setDefaultDashboardId(newDashboard.id);
          }
          setUserWantsAllDashboards(false);
        }
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
    defaultDashboardId,
    user.role,
  ]);

  const handleConnectionChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const connectionId = parseInt(event.target.value);
      setSelectedConnectionId(connectionId || null);
      setSelectedDashboard(null);
      setDefaultDashboardId(null);
      setUserWantsAllDashboards(false);
    },
    [setSelectedConnectionId]
  );

  const handleViewAllDashboards = useCallback(() => {
    setSelectedDashboard(null);
    setUserWantsAllDashboards(true);
  }, []);

  const handleDashboardClick = useCallback((dashboardId: string) => {
    setSelectedDashboard(dashboardId);
    setUserWantsAllDashboards(false);
    // Don't set as default here - only auto-selection sets default
  }, []);

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

  const handleLayoutChange = useCallback((layout: any) => {
    setLayouts({ lg: layout });
  }, []);

  const saveLayout = useCallback(
    debounce(async (layout: any) => {
      if (isSavingLayout) return;
      setIsSavingLayout(true);

      const dashboard = dashboards.find((d) => d.id === selectedDashboard);
      if (dashboard && selectedDashboard) {
        try {
          const response = await apiService.updateDashboard(selectedDashboard, {
            name: dashboard.name,
            description: dashboard.description,
            charts: dashboard.charts,
            layout,
          });
          if (response.success) {
            const updatedDashboards = dashboards.map((d) =>
              d.id === selectedDashboard ? { ...d, layout } : d
            );
            setDashboards(updatedDashboards);
            onDashboardsUpdate(updatedDashboards);
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
    [
      dashboards,
      selectedDashboard,
      setDashboards,
      onDashboardsUpdate,
      isSavingLayout,
    ]
  );

  const handleStop = useCallback(
    (layout: any) => {
      const currentLayout = currentLayoutRef.current;
      if (JSON.stringify(layout) !== JSON.stringify(currentLayout)) {
        saveLayout(layout);
      }
    },
    [saveLayout]
  );

  const handleDeleteDashboard = useCallback(
    async (dashboardId: string) => {
      // If deleting the default dashboard, reset the default (only for users)
      if (user.role === "user" && defaultDashboardId === dashboardId) {
        setDefaultDashboardId(null);
      }

      try {
        const response = await apiService.deleteDashboard(dashboardId);
        if (response.success) {
          const updatedDashboards = await apiService.getDashboards();
          setDashboards(updatedDashboards);
          onDashboardsUpdate(updatedDashboards);
          if (selectedDashboard === dashboardId) {
            setSelectedDashboard(null);
            // Set userWantsAllDashboards to true so it doesn't auto-select after delete
            setUserWantsAllDashboards(true);
          }
        }
      } catch (error) {
        console.error("Error deleting dashboard:", error);
      }
    },
    [
      selectedDashboard,
      setDashboards,
      onDashboardsUpdate,
      defaultDashboardId,
      user.role,
    ]
  );

  const handleDeleteChart = useCallback(
    async (chartId: string) => {
      if (!selectedDashboard) return;

      try {
        const response = await apiService.deleteChart(chartId);
        if (response.success) {
          const dashboard = dashboards.find((d) => d.id === selectedDashboard);
          if (dashboard) {
            const updatedCharts = dashboard.charts.filter(
              (c) => c.id !== chartId
            );
            const updatedLayout =
              dashboard.layout?.filter((l) => l.i !== chartId) || [];
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
              setDashboards(updatedDashboards);
              onDashboardsUpdate(updatedDashboards);

              // If this was the default dashboard and now has no charts, reset default (only for users)
              if (
                user.role === "user" &&
                defaultDashboardId === dashboard.id &&
                updatedCharts.length === 0
              ) {
                setDefaultDashboardId(null);
                setUserWantsAllDashboards(true); // Show all dashboards view
              }
            }
          }
        }
      } catch (error) {
        console.error("Error deleting chart:", error);
      }
    },
    [
      dashboards,
      selectedDashboard,
      setDashboards,
      onDashboardsUpdate,
      defaultDashboardId,
      user.role,
    ]
  );

  // Memoized Values
  const currentLayout = useMemo(() => {
    if (!selectedDashboardData) return [];

    if (
      layouts.lg?.length &&
      layouts.lg.every((item: any) =>
        selectedDashboardData.charts.some((chart) => chart.id === item.i)
      )
    ) {
      return layouts.lg;
    } else if (selectedDashboardData.layout?.length) {
      return selectedDashboardData.layout;
    } else {
      return generateLayout(selectedDashboardData.charts);
    }
  }, [layouts.lg, selectedDashboardData, generateLayout]);

  const isDefaultDashboard = useCallback(
    (dashboardId: string) => {
      return user.role === "user" && defaultDashboardId === dashboardId;
    },
    [defaultDashboardId, user.role]
  );

  // Sub-components
  const DashboardView = useMemo(() => {
    if (!selectedDashboard || !selectedDashboardData) return null;

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleViewAllDashboards}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <LayoutDashboard className="h-5 w-5" />
                <span className="font-medium">All Dashboards</span>
              </button>
              <div className="text-slate-400">/</div>
              <div className="flex items-center space-x-2">
                {isDefaultDashboard(selectedDashboard) && (
                  <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium border border-yellow-300">
                    <Star className="h-3 w-3 fill-current" />
                    <span>Default</span>
                  </div>
                )}
                <h1 className="text-2xl font-bold text-slate-900">
                  {selectedDashboardData.name}
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {user.role === "designer" && (
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
              )}
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
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: currentLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={50}
          containerPadding={[10, 10]}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={handleLayoutChange}
          onDragStop={handleStop}
          onResizeStop={handleStop}
        >
          {selectedDashboardData.charts.map((chart) => (
            <div
              key={chart.id}
              className="bg-white border rounded-lg relative h-full"
            >
              <SavedChart
                config={chart}
                connectionId={selectedDashboardData.connectionId}
                chartId={chart.id}
              />
              {isEditMode && user.role === "designer" && (
                <button
                  onClick={() => handleDeleteChart(chart.id!)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    );
  }, [
    selectedDashboard,
    selectedDashboardData,
    currentLayout,
    isEditMode,
    user.role,
    handleViewAllDashboards,
    handleLayoutChange,
    handleStop,
    handleDeleteChart,
    isDefaultDashboard,
  ]);

  const AllDashboardsView = useMemo(
    () => (
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-900">My Dashboards</h1>
          <div className="flex items-center space-x-4">
            <select
              value={selectedConnectionId || ""}
              onChange={handleConnectionChange}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="" disabled>
                Select Connection
              </option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.connection_name}
                </option>
              ))}
            </select>
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
            {user.role === "designer" && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create Dashboard</span>
              </button>
            )}
          </div>
        </div>

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
                className={`px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                  isDefaultDashboard(dashboard.id)
                    ? "hover:bg-yellow-50 "
                    : dashboard.charts.length > 0
                    ? "hover:bg-blue-50"
                    : ""
                }`}
                onClick={() => handleDashboardClick(dashboard.id)}
              >
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-4 flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isDefaultDashboard(dashboard.id)
                          ? "border-2 bg-blue-100"
                          : dashboard.charts.length > 0
                          ? "bg-blue-100"
                          : "bg-slate-100"
                      }`}
                    >
                      <LayoutDashboard
                        className={`h-5 w-5 ${
                          isDefaultDashboard(dashboard.id)
                            ? "text-blue-600"
                            : dashboard.charts.length > 0
                            ? "text-blue-600"
                            : "text-slate-500"
                        }`}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <div>
                        <h3
                          className={`font-medium ${
                            isDefaultDashboard(dashboard.id)
                              ? "text-yellow-900"
                              : "text-slate-900"
                          }`}
                        >
                          {dashboard.name}
                        </h3>
                        {dashboard.description && (
                          <p className="text-sm text-slate-500 truncate">
                            {dashboard.description}
                          </p>
                        )}
                      </div>
                      {isDefaultDashboard(dashboard.id) && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium border border-yellow-300">
                          <Star className="h-3 w-3 fill-current" />
                          <span>Default</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`col-span-2 text-sm ${
                      isDefaultDashboard(dashboard.id)
                        ? "text-yellow-600 font-semibold"
                        : dashboard.charts.length > 0
                        ? "text-blue-600 font-medium"
                        : "text-slate-600"
                    }`}
                  >
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
                        handleDashboardClick(dashboard.id);
                      }}
                      className={`p-1 transition-colors ${
                        isDefaultDashboard(dashboard.id)
                          ? "text-yellow-600 hover:text-yellow-700"
                          : "text-slate-400 hover:text-blue-600"
                      }`}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {user.role === "designer" && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredDashboards().length === 0 && (
              <div className="px-6 py-8 text-center text-slate-500">
                <LayoutDashboard className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p className="text-lg">No dashboards found</p>
                {user.role === "designer" && (
                  <p className="text-sm mt-2">
                    Create your first dashboard to get started!
                  </p>
                )}
                {user.role === "user" && (
                  <p className="text-sm mt-2">
                    No dashboards available. Contact your administrator.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    [
      filteredDashboards,
      selectedConnectionId,
      connections,
      searchTerm,
      user.role,
      handleConnectionChange,
      handleDeleteDashboard,
      isDefaultDashboard,
      handleDashboardClick,
    ]
  );

  const CreateModal = useMemo(
    () =>
      showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Create New Dashboard
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Connection
                  </label>
                  <select
                    value={selectedConnectionId || ""}
                    onChange={handleConnectionChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="" disabled>
                      Select Connection
                    </option>
                    {connections.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.connection_name}
                      </option>
                    ))}
                  </select>
                </div>
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
      ),
    [
      showCreateModal,
      selectedConnectionId,
      connections,
      newDashboardName,
      newDashboardDescription,
      handleConnectionChange,
      handleCreateDashboard,
    ]
  );

  // Main Render
  return (
    <>
      {DashboardView || AllDashboardsView}
      {CreateModal}
    </>
  );
};

export default Dashboard;

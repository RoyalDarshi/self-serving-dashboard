import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ReportColumn,
  ReportFilter,
  Schema,
  ReportDefinition,
  FullReportConfig,
  apiService,
} from "../services/api"; //
import {
  Save,
  BarChart3,
  LineChart,
  PieChart,
  Table as TableIcon,
  Filter,
  Search,
  Settings2,
  Trash2,
  GripVertical,
  ChevronDown,
  Hash,
  Type,
  Calendar,
  X,
  PlayCircle,
  Layout,
  ArrowRightLeft,
  Link as LinkIcon,
  MousePointerClick,
} from "lucide-react";
import ReportViewer from "./ReportViewer";

// --- Types ---
type FieldType = "string" | "number" | "date" | "boolean";
type DragItem = { name: string; type: FieldType };

interface ConfigItem extends DragItem {
  id: string;
  alias?: string;
  aggregation?: string;
}

interface DrillConfig {
  targetReportId: number;
  // Map current column name -> target filter name
  mapping: Record<string, string>;
}

// --- Components ---

/** Field Icon Helper */
const FieldIcon = ({ type }: { type: string }) => {
  const t = type.toLowerCase();
  if (t.includes("int") || t.includes("number") || t.includes("float"))
    return <Hash className="w-3.5 h-3.5 text-blue-500" />;
  if (t.includes("date") || t.includes("time"))
    return <Calendar className="w-3.5 h-3.5 text-orange-500" />;
  return <Type className="w-3.5 h-3.5 text-slate-400" />;
};

/** Draggable Sidebar Field */
const DraggableField = ({ name, type }: { name: string; type: string }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("field", JSON.stringify({ name, type }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-3 px-3 py-2 text-sm bg-white hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg cursor-grab active:cursor-grabbing group transition-all select-none"
    >
      <GripVertical className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      <FieldIcon type={type} />
      <span className="truncate text-slate-700 font-medium">{name}</span>
    </div>
  );
};

/** Configurable Shelf */
const Shelf = ({
  title,
  icon: Icon,
  items,
  onDrop,
  onRemove,
  onUpdate,
  placeholder,
  accepts,
  className = "",
}: {
  title: string;
  icon: any;
  items: ConfigItem[];
  onDrop: (item: DragItem) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updates: Partial<ConfigItem>) => void;
  placeholder: string;
  accepts: string[];
  className?: string;
}) => {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const data = e.dataTransfer.getData("field");
    if (data) {
      const item = JSON.parse(data);
      onDrop(item);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" /> {title}
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={`min-h-[60px] p-2 rounded-xl border-2 border-dashed transition-all flex flex-wrap gap-2 content-start ${
          isOver
            ? "border-indigo-400 bg-indigo-50/50"
            : "border-slate-200 bg-slate-50/30"
        }`}
      >
        {items.length === 0 && (
          <div className="w-full h-full py-3 flex items-center justify-center text-xs text-slate-400 italic pointer-events-none">
            {placeholder}
          </div>
        )}
        {items.map((item, idx) => (
          <ShelfPill
            key={item.id}
            item={item}
            onRemove={() => onRemove(idx)}
            onUpdate={(u) => onUpdate(idx, u)}
          />
        ))}
      </div>
    </div>
  );
};

/** Pill Component */
const ShelfPill = ({
  item,
  onRemove,
  onUpdate,
}: {
  item: ConfigItem;
  onRemove: () => void;
  onUpdate: (u: Partial<ConfigItem>) => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isAgg = !!item.aggregation;

  return (
    <div className="relative group">
      <div
        onClick={() => setShowMenu(!showMenu)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border shadow-sm cursor-pointer select-none transition-all ${
          isAgg
            ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
            : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:shadow-md"
        }`}
      >
        <FieldIcon type={item.type} />
        <span className="opacity-90">{item.alias || item.name}</span>
        {isAgg && (
          <span className="font-bold ml-0.5">({item.aggregation})</span>
        )}
        <ChevronDown className="w-3 h-3 opacity-30" />
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-100 z-50 p-2 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider mb-1">
            Column Settings
          </div>

          <div className="space-y-3 px-2 pb-1">
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-semibold">
                Label (Alias)
              </label>
              <input
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none mt-1"
                value={item.alias || item.name}
                onChange={(e) => onUpdate({ alias: e.target.value })}
                placeholder={item.name}
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 uppercase font-semibold">
                Aggregation
              </label>
              <select
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs mt-1 bg-white"
                value={item.aggregation || ""}
                onChange={(e) =>
                  onUpdate({ aggregation: e.target.value || undefined })
                }
              >
                <option value="">None (Dimension)</option>
                <option value="SUM">Sum</option>
                <option value="AVG">Average</option>
                <option value="COUNT">Count</option>
                <option value="MAX">Max</option>
                <option value="MIN">Min</option>
              </select>
            </div>

            <hr className="border-slate-100" />

            <button
              onClick={onRemove}
              className="w-full text-left px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded flex items-center gap-2"
            >
              <Trash2 className="w-3 h-3" /> Remove from View
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Application ---

interface Props {
  connections: { id: number; connection_name: string }[];
  onSaved?: (reportId: number) => void;
}

const ReportBuilder: React.FC<Props> = ({ connections, onSaved }) => {
  // --- Data Source State ---
  const [connectionId, setConnectionId] = useState<number | null>(
    connections[0]?.id || null
  );
  const [baseTable, setBaseTable] = useState<string>("");
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Report Meta ---
  const [name, setName] = useState("Untitled Report");
  const [description, setDescription] = useState("");

  // --- Configuration Shelves ---
  const [tableColumns, setTableColumns] = useState<ConfigItem[]>([]);

  // Chart Config
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [chartX, setChartX] = useState<ConfigItem | null>(null);
  const [chartY, setChartY] = useState<ConfigItem[]>([]);

  // Filters
  const [filters, setFilters] = useState<ReportFilter[]>([]);

  // Drill-Through Config
  const [availableReports, setAvailableReports] = useState<ReportDefinition[]>(
    []
  );
  const [drillConfig, setDrillConfig] = useState<DrillConfig>({
    targetReportId: 0,
    mapping: {},
  });

  // --- App Status ---
  const [previewConfig, setPreviewConfig] = useState<FullReportConfig | null>(
    null
  );
  const [previewData, setPreviewData] = useState<{
    sql: string;
    rows: any[];
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load Initial Data
  useEffect(() => {
    if (connectionId) {
      apiService.getSchemas(connectionId).then(setSchemas);
    }
    // Fetch reports for drill-down targets
    apiService.getReports().then(setAvailableReports);
  }, [connectionId]);

  // Derived Data
  const availableColumns = useMemo(() => {
    if (!baseTable) return [];
    return schemas.find((s) => s.tableName === baseTable)?.columns || [];
  }, [baseTable, schemas]);

  const filteredColumns = availableColumns.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Handlers ---

  const handleDropTable = (item: DragItem) => {
    if (tableColumns.find((c) => c.name === item.name)) return;
    setTableColumns([
      ...tableColumns,
      { ...item, id: Math.random().toString(36).substr(2, 9) },
    ]);
  };

  const handleDropChartX = (item: DragItem) => {
    setChartX({ ...item, id: Math.random().toString(36).substr(2, 9) });
  };

  const handleDropChartY = (item: DragItem) => {
    const isNum =
      item.type.toLowerCase().includes("int") ||
      item.type.toLowerCase().includes("number");
    setChartY([
      ...chartY,
      {
        ...item,
        id: Math.random().toString(36).substr(2, 9),
        aggregation: isNum ? "SUM" : "COUNT",
      },
    ]);
  };

  const handleDropFilter = (item: DragItem) => {
    setFilters([
      ...filters,
      {
        column_name: item.name,
        operator: "=",
        value: "",
        is_user_editable: true,
        order_index: filters.length,
      },
    ]);
  };

  // --- Payload Construction ---
  const constructPayload = () => {
    // 1. Gather all unique columns
    const uniqueFields = new Map<string, ConfigItem>();

    // Table Columns (Visible)
    tableColumns.forEach((c) => uniqueFields.set(c.name, { ...c }));

    // Chart Columns (Hidden if not in Table)
    if (showChart && chartX && !uniqueFields.has(chartX.name)) {
      uniqueFields.set(chartX.name, { ...chartX, visible: false });
    }
    if (showChart) {
      chartY.forEach((c) => {
        if (!uniqueFields.has(c.name))
          uniqueFields.set(c.name, { ...c, visible: false });
      });
    }

    const reportColumns: ReportColumn[] = [];

    // Add Visible Columns First
    tableColumns.forEach((c, idx) => {
      reportColumns.push({
        column_name: c.name,
        alias: c.alias,
        data_type: c.type,
        visible: true,
        order_index: idx,
      });
    });

    // Add Hidden Chart Columns
    if (showChart) {
      if (chartX && !tableColumns.find((t) => t.name === chartX.name)) {
        reportColumns.push({
          column_name: chartX.name,
          alias: chartX.alias,
          data_type: chartX.type,
          visible: false,
          order_index: reportColumns.length,
        });
      }
      chartY.forEach((c) => {
        if (!tableColumns.find((t) => t.name === c.name)) {
          reportColumns.push({
            column_name: c.name,
            alias: c.alias,
            data_type: c.type,
            visible: false,
            order_index: reportColumns.length,
          });
        }
      });
    }

    const visualizationConfig = showChart
      ? {
          showChart: true,
          chartType,
          xAxisColumn: chartX?.name || "",
          yAxisColumns: chartY.map((y) => y.name),
          aggregation: chartY[0]?.aggregation || "SUM",
        }
      : { showChart: false };

    // Format Drill Targets
    const drillTargets =
      drillConfig.targetReportId !== 0
        ? [
            {
              target_report_id: drillConfig.targetReportId,
              mapping_json: drillConfig.mapping, // api.ts expects object, backend stringifies if needed or service does
            },
          ]
        : [];

    return {
      name,
      description,
      connection_id: connectionId,
      base_table: baseTable,
      columns: reportColumns,
      filters: filters,
      visualization_config: visualizationConfig,
      drillTargets: drillTargets,
    };
  };

  const handleRun = async () => {
    if (!baseTable) return;

    setIsLoadingPreview(true); // Start loading
    setPreviewData(null); // Clear previous data

    const payload = constructPayload();

    // 1. Build preview config (for the viewer columns/settings)
    const config: FullReportConfig = {
      report: {
        id: 0,
        name,
        connection_id: connectionId!,
        base_table: baseTable,
        visualization_config: JSON.stringify(payload.visualization_config),
      },
      columns: payload.columns,
      filters: payload.filters,
      visualization: payload.visualization_config as any,
      drillTargets: [],
    };

    setPreviewConfig(config);

    // 2. Fetch the actual data
    try {
      // Calls the new API method we added in Step 1
      const res = await apiService.previewReport(payload);

      if (res.success && res.data) {
        setPreviewData(res.data);
        setMessage({ type: "success", text: "Query executed successfully" });
      } else {
        setMessage({
          type: "error",
          text: res.error || "Failed to fetch preview data",
        });
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "An unexpected error occurred",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    if (!name || !baseTable) {
      setMessage({
        type: "error",
        text: "Please define a name and select a table.",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = constructPayload();
      // The service might expect JSON string for drill targets mapping depending on implementation
      // Adjusting based on api.ts: `mapping_json: string` in interface, but mostly likely handled by JSON.stringify
      const res = await apiService.saveReport(payload as any);
      if (res.success && res.reportId) {
        setMessage({ type: "success", text: "Report saved successfully!" });
        if (onSaved) onSaved(res.reportId);
      } else {
        setMessage({ type: "error", text: res.error || "Failed to save." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* 1. LEFT PANEL: Data Source */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col z-20 shadow-lg">
        <div className="p-5 border-b border-slate-100 bg-white">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            1. Select Data Source
          </h2>
          <select
            className="w-full text-sm border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 hover:bg-white transition-colors"
            value={connectionId ?? ""}
            onChange={(e) => {
              setConnectionId(Number(e.target.value));
              setBaseTable("");
            }}
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.connection_name}
              </option>
            ))}
          </select>

          {baseTable && (
            <div className="relative mt-3">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {!baseTable ? (
            <div className="space-y-1">
              {schemas.map((s) => (
                <button
                  key={s.tableName}
                  onClick={() => setBaseTable(s.tableName)}
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors flex items-center gap-3 group"
                >
                  <TableIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                  <span className="font-medium">{s.tableName}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  {baseTable}
                </span>
                <button
                  onClick={() => setBaseTable("")}
                  className="text-[10px] text-indigo-600 hover:underline font-medium"
                >
                  Change Table
                </button>
              </div>
              <div className="space-y-1">
                {filteredColumns.map((col) => (
                  <DraggableField
                    key={col.name}
                    name={col.name}
                    type={col.type}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. MIDDLE PANEL: Configuration (Shelves) */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100/50 border-r border-slate-200">
        {/* Header */}
        <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-10">
          <div className="flex-1 max-w-md">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-bold text-slate-800 placeholder:text-slate-300 border-none p-0 focus:ring-0 bg-transparent w-full"
              placeholder="Report Name"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={!baseTable}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors"
            >
              <PlayCircle className="w-4 h-4" /> Run Query
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-slate-200"
            >
              {saving ? "..." : <Save className="w-4 h-4" />} Save Report
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION: TABLE CONFIG */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-white rounded-t-xl">
              <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                <TableIcon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">
                Table Configuration
              </h3>
              <span className="text-xs text-slate-400 ml-auto font-normal">
                Drag fields to build grid
              </span>
            </div>
            <div className="p-5">
              <Shelf
                title="Visible Columns"
                icon={Layout}
                placeholder="Drag fields here to add to the data table..."
                items={tableColumns}
                accepts={["any"]}
                onDrop={handleDropTable}
                onRemove={(i) =>
                  setTableColumns(tableColumns.filter((_, idx) => idx !== i))
                }
                onUpdate={(i, u) => {
                  const n = [...tableColumns];
                  n[i] = { ...n[i], ...u };
                  setTableColumns(n);
                }}
              />
            </div>
          </div>

          {/* SECTION: FILTERS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 rounded-t-xl">
              <div className="p-1.5 bg-amber-50 rounded text-amber-600">
                <Filter className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Filters</h3>
            </div>
            <div className="p-5 space-y-4">
              <Shelf
                title="Active Filters"
                icon={Filter}
                placeholder="Drag fields here to filter data..."
                items={filters.map((f, i) => ({
                  id: String(i),
                  name: f.column_name,
                  type: "string",
                  alias: `${f.operator} ${f.value || "?"}`,
                }))}
                accepts={["any"]}
                onDrop={handleDropFilter}
                onRemove={(i) =>
                  setFilters(filters.filter((_, idx) => idx !== i))
                }
                onUpdate={() => {}}
              />

              {filters.length > 0 && (
                <div className="space-y-2 mt-4">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Edit Filter Values
                  </label>
                  {filters.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 text-sm bg-slate-50 p-2 rounded-lg border border-slate-200"
                    >
                      <span className="font-semibold text-slate-700 w-32 truncate px-2">
                        {f.column_name}
                      </span>
                      <select
                        className="bg-white border border-slate-200 rounded-md text-xs py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                        value={f.operator}
                        onChange={(e) => {
                          const n = [...filters];
                          n[idx].operator = e.target.value;
                          setFilters(n);
                        }}
                      >
                        <option value="=">Equals</option>
                        <option value=">">Greater Than</option>
                        <option value="<">Less Than</option>
                        <option value="LIKE">Contains</option>
                        <option value="IN">Is One Of</option>
                      </select>
                      <input
                        className="flex-1 border border-slate-200 rounded-md px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                        placeholder="Value..."
                        value={f.value}
                        onChange={(e) => {
                          const n = [...filters];
                          n[idx].value = e.target.value;
                          setFilters(n);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION: VISUALIZATION */}
          <div
            className={`bg-white rounded-xl shadow-sm border transition-all duration-300 ${
              showChart
                ? "border-indigo-200 ring-1 ring-indigo-50"
                : "border-slate-200"
            }`}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded transition-colors ${
                    showChart
                      ? "bg-indigo-50 text-indigo-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">
                  Visualization
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium ${
                    showChart ? "text-indigo-600" : "text-slate-500"
                  }`}
                >
                  {showChart ? "Enabled" : "Disabled"}
                </span>
                <button
                  onClick={() => setShowChart(!showChart)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                    showChart ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                      showChart ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {showChart && (
              <div className="p-5 space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
                {/* Chart Type Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Chart Type
                  </label>
                  <div className="flex items-center gap-2">
                    {[
                      { id: "bar", icon: BarChart3, label: "Bar" },
                      { id: "line", icon: LineChart, label: "Line" },
                      { id: "pie", icon: PieChart, label: "Pie" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setChartType(t.id as any)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                          chartType === t.id
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-6">
                  <Shelf
                    title="X-Axis (Dimension)"
                    icon={Settings2}
                    placeholder="Drag 1 dimension..."
                    items={chartX ? [chartX] : []}
                    accepts={["any"]}
                    onDrop={handleDropChartX}
                    onRemove={() => setChartX(null)}
                    onUpdate={(i, u) =>
                      setChartX(chartX ? { ...chartX, ...u } : null)
                    }
                    className="flex-1"
                  />
                  <Shelf
                    title="Y-Axis (Metrics)"
                    icon={BarChart3}
                    placeholder="Drag metrics..."
                    items={chartY}
                    accepts={["any"]}
                    onDrop={handleDropChartY}
                    onRemove={(i) =>
                      setChartY(chartY.filter((_, idx) => idx !== i))
                    }
                    onUpdate={(i, u) => {
                      const n = [...chartY];
                      n[i] = { ...n[i], ...u };
                      setChartY(n);
                    }}
                    className="flex-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION: DRILL THROUGH */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 rounded-t-xl">
              <div className="p-1.5 bg-purple-50 rounded text-purple-600">
                <MousePointerClick className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">
                Interactivity & Drill-Through
              </h3>
            </div>
            <div className="p-5">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Target Report (On Click)
                  </label>
                  <select
                    className="w-full max-w-md text-sm border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                    value={drillConfig.targetReportId}
                    onChange={(e) =>
                      setDrillConfig({
                        targetReportId: Number(e.target.value),
                        mapping: {},
                      })
                    }
                  >
                    <option value={0}>-- No Drill Action --</option>
                    {availableReports.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {drillConfig.targetReportId !== 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-4 text-slate-700 font-medium text-sm">
                      <LinkIcon className="w-4 h-4" />
                      <span>Map Current Columns to Target Filters</span>
                    </div>

                    <div className="space-y-3">
                      {/* Show visible columns from Table config as sources */}
                      {tableColumns.length === 0 && (
                        <p className="text-xs text-slate-400 italic">
                          Add table columns first to map them.
                        </p>
                      )}

                      {tableColumns.map((col) => (
                        <div key={col.id} className="flex items-center gap-4">
                          <div className="w-1/3 text-right">
                            <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                              {col.alias || col.name}
                            </span>
                          </div>
                          <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                          <div className="flex-1 max-w-sm">
                            <input
                              className="w-full text-xs border border-slate-200 rounded-md px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-300"
                              placeholder={`Target filter name (e.g. ${col.name})`}
                              value={drillConfig.mapping[col.name] || ""}
                              onChange={(e) => {
                                const newMapping = {
                                  ...drillConfig.mapping,
                                  [col.name]: e.target.value,
                                };
                                setDrillConfig({
                                  ...drillConfig,
                                  mapping: newMapping,
                                });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. RIGHT PANEL: Live Preview */}
      <div className="flex-1 bg-slate-50/50 border-l border-slate-200 flex flex-col min-w-0">
        <div className="h-10 border-b border-slate-200 bg-white flex items-center justify-between px-4 shadow-sm z-10">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Live Preview
          </span>
          {message && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                message.type === "error"
                  ? "text-red-600 bg-red-50"
                  : "text-emerald-600 bg-emerald-50"
              }`}
            >
              {message.text}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden p-6">
          <div className="h-full bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden relative">
            {isLoadingPreview ? (
              // LOADING STATE
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium">Running Query...</p>
              </div>
            ) : previewConfig ? (
              // DATA LOADED STATE
              <ReportViewer
                initialReportId={0}
                onClose={() => {}}
                previewConfig={previewConfig}
                // Pass the fetched data or a default empty object to prevent crashes
                previewData={previewData || { sql: "", rows: [] }}
              />
            ) : (
              // IDLE STATE
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Layout className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-sm font-medium text-slate-400">
                  Configure your report columns and click{" "}
                  <span className="text-indigo-500">Run Query</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportBuilder;

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ReportColumn,
  ReportFilter,
  Schema,
  ReportDefinition,
  FullReportConfig,
  apiService,
  Fact,
  Dimension,
} from "../../services/api";
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Database,
  Plus,
  Check,
  Layers,
  Sigma,
  BarChart2,
} from "lucide-react";
import ReportViewer from "./ReportViewer";

// --- Types ---
type FieldType = "string" | "number" | "date" | "boolean";
type DragItem = {
  name: string;
  type: FieldType;
  factId?: number;
  dimensionId?: number;
  aggregation?: string;
};

interface ConfigItem extends DragItem {
  id: string;
  alias?: string;
  aggregation?: string;
  visible?: boolean;
}

interface DrillConfig {
  targetReportId: number;
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
      className="flex items-center gap-2.5 px-3 py-2.5 text-sm bg-gradient-to-r from-white to-slate-50 hover:from-indigo-50 hover:to-blue-50 border border-slate-200 hover:border-indigo-300 rounded-lg cursor-grab active:cursor-grabbing group transition-all select-none shadow-sm hover:shadow"
    >
      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
      <FieldIcon type={type} />
      <span className="truncate text-slate-700 font-medium group-hover:text-indigo-900">
        {name}
      </span>
    </div>
  );
};

/** Draggable Semantic Item (Fact/Dimension) */
const DraggableSemanticItem = ({
  item,
  type,
}: {
  item: Fact | Dimension;
  type: "fact" | "dimension";
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    const dragData: DragItem = {
      name: item.name,
      type: type === "fact" ? "number" : "string",
      factId: type === "fact" ? (item as Fact).id : undefined,
      dimensionId: type === "dimension" ? (item as Dimension).id : undefined,
      aggregation: type === "fact" ? (item as Fact).aggregate_function : undefined,
    };
    e.dataTransfer.setData("field", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`flex items-center gap-2.5 px-3 py-2.5 text-sm border rounded-lg cursor-grab active:cursor-grabbing group transition-all select-none shadow-sm hover:shadow ${type === "fact"
        ? "bg-emerald-50/50 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50"
        : "bg-blue-50/50 border-blue-100 hover:border-blue-300 hover:bg-blue-50"
        }`}
    >
      <GripVertical
        className={`w-3.5 h-3.5 transition-colors ${type === "fact"
          ? "text-emerald-300 group-hover:text-emerald-500"
          : "text-blue-300 group-hover:text-blue-500"
          }`}
      />
      {type === "fact" ? (
        <Sigma className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Layers className="w-3.5 h-3.5 text-blue-600" />
      )}
      <div className="flex flex-col overflow-hidden">
        <span
          className={`truncate font-medium ${type === "fact"
            ? "text-emerald-900 group-hover:text-emerald-950"
            : "text-blue-900 group-hover:text-blue-950"
            }`}
        >
          {item.name}
        </span>
        <span className="text-[10px] text-slate-400 truncate">
          {type === "fact"
            ? `${(item as Fact).aggregate_function}(${item.column_name})`
            : item.column_name}
        </span>
      </div>
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
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" /> {title}
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={`min-h-[70px] p-3 rounded-xl border-2 border-dashed transition-all flex flex-wrap gap-2 content-start ${isOver
          ? "border-indigo-400 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-inner"
          : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
          }`}
      >
        {items.length === 0 && (
          <div className="w-full h-full py-4 flex flex-col items-center justify-center text-xs text-slate-400 italic pointer-events-none">
            <Plus className="w-5 h-5 mb-1 opacity-30" />
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
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border shadow-sm cursor-pointer select-none transition-all ${isAgg
          ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 text-emerald-800 hover:shadow-md"
          : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:shadow-md"
          }`}
      >
        {item.factId ? (
          <Sigma className="w-3.5 h-3.5 text-emerald-600" />
        ) : item.dimensionId ? (
          <Layers className="w-3.5 h-3.5 text-blue-600" />
        ) : (
          <FieldIcon type={item.type} />
        )}
        <span className="font-semibold">{item.alias || item.name}</span>
        {isAgg && (
          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 rounded font-bold">
            {item.aggregation}
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-40 ml-0.5" />
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-3 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Settings2 className="w-3 h-3" />
            Column Settings
          </div>

          <div className="space-y-3 px-2 pb-1">
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1.5 block">
                Display Label
              </label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={item.alias || item.name}
                onChange={(e) => onUpdate({ alias: e.target.value })}
                placeholder={item.name}
              />
            </div>

            {/* Only show aggregation options if it's not a semantic fact (facts have fixed agg for now) or if we want to override */}
            {/* For now, let's allow overriding aggregation even for facts, or at least for table columns */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1.5 block">
                Aggregation
              </label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={item.aggregation || ""}
                onChange={(e) =>
                  onUpdate({ aggregation: e.target.value || undefined })
                }
                disabled={!!item.factId} // Disable changing aggregation for defined facts for now
              >
                <option value="">None (Dimension)</option>
                <option value="SUM">Sum</option>
                <option value="AVG">Average</option>
                <option value="COUNT">Count</option>
                <option value="MAX">Max</option>
                <option value="MIN">Min</option>
              </select>
            </div>

            <hr className="border-slate-100 my-2" />

            <button
              onClick={onRemove}
              className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove Column
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
  // UI State
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [mode, setMode] = useState<"TABLE" | "SEMANTIC">("TABLE");

  // --- Data Source State ---
  const [connectionId, setConnectionId] = useState<number | null>(
    connections[0]?.id || null
  );
  const [baseTable, setBaseTable] = useState<string>("");
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Semantic Data
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);

  // --- Report Meta ---
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
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
      // Always fetch facts/dims so they are ready if user switches mode
      apiService.getFacts(connectionId).then(setFacts);
      apiService.getDimensions(connectionId).then(setDimensions);
    }
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

  const filteredFacts = facts.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDimensions = dimensions.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
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
        aggregation: item.aggregation || (isNum ? "SUM" : "COUNT"),
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
    const uniqueFields = new Map<string, ConfigItem>();

    tableColumns.forEach((c) => uniqueFields.set(c.name, { ...c }));

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

    tableColumns.forEach((c, idx) => {
      reportColumns.push({
        column_name: c.name,
        alias: c.alias,
        data_type: c.type,
        visible: true,
        order_index: idx,
      });
    });

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

    const visualizationConfig: any = showChart
      ? {
        showChart: true,
        chartType,
        xAxisColumn: chartX?.name || "",
        yAxisColumns: chartY.map((y) => y.name),
        aggregation: chartY[0]?.aggregation || "SUM",
      }
      : { showChart: false };

    // Semantic Config
    if (mode === "SEMANTIC") {
      const factIds = tableColumns
        .filter((c) => c.factId)
        .map((c) => c.factId!);
      const dimensionIds = tableColumns
        .filter((c) => c.dimensionId)
        .map((c) => c.dimensionId!);

      visualizationConfig.factIds = factIds;
      visualizationConfig.dimensionIds = dimensionIds;
    }

    const drillTargets =
      drillConfig.targetReportId !== 0
        ? [
          {
            target_report_id: drillConfig.targetReportId,
            mapping_json: drillConfig.mapping,
          },
        ]
        : [];

    return {
      name,
      description,
      connection_id: connectionId,
      base_table: mode === "SEMANTIC" ? "SEMANTIC" : baseTable,
      columns: reportColumns,
      filters: filters,
      visualization_config: visualizationConfig,
      drillTargets: drillTargets,
    };
  };

  const handleRun = async () => {
    if (!connectionId) {
      setMessage({ type: "error", text: "Please select a data source." });
      return;
    }
    if (mode === "TABLE" && !baseTable) return;
    if (mode === "SEMANTIC" && tableColumns.length === 0) return;

    setIsLoadingPreview(true);
    setPreviewData(null);

    const payload = constructPayload();

    const config: FullReportConfig = {
      report: {
        id: 0,
        name,
        connection_id: connectionId!,
        base_table: payload.base_table,
        visualization_config: JSON.stringify(payload.visualization_config),
      },
      columns: payload.columns,
      filters: payload.filters,
      visualization: payload.visualization_config as any,
      drillTargets: [],
    };

    setPreviewConfig(config);

    try {
      const res = await apiService.previewReport(payload);

      if (res.success && res.data) {
        setPreviewData(res.data);
        setMessage({ type: "success", text: "Query executed successfully" });
        setTimeout(() => setMessage(null), 3000);
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
    if (!name.trim()) {
      setNameError(true);
      setMessage({
        type: "error",
        text: "Please enter a report name before saving.",
      });
      return;
    }

    if (mode === "TABLE" && !baseTable) {
      setMessage({
        type: "error",
        text: "Please select a data source table.",
      });
      return;
    }
    if (mode === "SEMANTIC" && tableColumns.length === 0) {
      setMessage({
        type: "error",
        text: "Please select at least one fact or dimension.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = constructPayload();
      const res = await apiService.saveReport(payload as any);
      if (res.success && res.reportId) {
        setMessage({ type: "success", text: "Report saved successfully!" });
        setTimeout(() => setMessage(null), 3000);
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
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans text-slate-800 overflow-hidden">
      {/* 1. LEFT PANEL: Data Source */}
      <div
        className={`${leftPanelCollapsed ? "w-0" : "w-80"
          } bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl transition-all duration-300 overflow-hidden`}
      >
        <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Database className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              Data Source
            </h2>
          </div>
          <select
            className="w-full text-sm border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none bg-white hover:bg-slate-50 transition-all shadow-sm font-medium mb-4"
            value={connectionId ?? ""}
            onChange={(e) => {
              setConnectionId(Number(e.target.value));
              setBaseTable("");
              setTableColumns([]);
            }}
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.connection_name}
              </option>
            ))}
          </select>

          {/* MODE SWITCHER */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
            <button
              onClick={() => {
                setMode("TABLE");
                setTableColumns([]);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === "TABLE"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
                }`}
            >
              Tables
            </button>
            <button
              onClick={() => {
                setMode("SEMANTIC");
                setTableColumns([]);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === "SEMANTIC"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
                }`}
            >
              Semantic
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {mode === "TABLE" ? (
            !baseTable ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-semibold mb-3 px-2">
                  Available Tables
                </p>
                {schemas.map((s) => (
                  <button
                    key={s.tableName}
                    onClick={() => setBaseTable(s.tableName)}
                    className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 hover:text-indigo-700 rounded-xl transition-all flex items-center gap-3 group border border-transparent hover:border-indigo-200 shadow-sm hover:shadow"
                  >
                    <TableIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    <span className="font-semibold">{s.tableName}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-900">
                      {baseTable}
                    </span>
                  </div>
                  <button
                    onClick={() => setBaseTable("")}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 hover:bg-indigo-100 rounded transition-colors"
                  >
                    Change
                  </button>
                </div>
                <div className="space-y-1.5">
                  {filteredColumns.map((col) => (
                    <DraggableField
                      key={col.name}
                      name={col.name}
                      type={col.type}
                    />
                  ))}
                </div>
              </div>
            )
          ) : (
            // SEMANTIC MODE LISTS
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                  <Sigma className="w-3 h-3" /> Facts
                </h3>
                <div className="space-y-1.5">
                  {filteredFacts.map((fact) => (
                    <DraggableSemanticItem
                      key={fact.id}
                      item={fact}
                      type="fact"
                    />
                  ))}
                  {filteredFacts.length === 0 && (
                    <p className="text-xs text-slate-400 italic px-2">
                      No facts found.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Dimensions
                </h3>
                <div className="space-y-1.5">
                  {filteredDimensions.map((dim) => (
                    <DraggableSemanticItem
                      key={dim.id}
                      item={dim}
                      type="dimension"
                    />
                  ))}
                  {filteredDimensions.length === 0 && (
                    <p className="text-xs text-slate-400 italic px-2">
                      No dimensions found.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Button */}
      <button
        onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
        className="absolute left-[19.75rem] top-6 z-30 bg-white border border-slate-200 rounded-r-lg p-1.5 shadow-lg hover:bg-slate-50 transition-all"
        style={{
          transform: leftPanelCollapsed
            ? "translateX(-19.75rem)"
            : "translateX(0)",
          transition: "transform 0.3s",
        }}
      >
        {leftPanelCollapsed ? (
          <ChevronRight className="w-4 h-4 text-slate-600" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        )}
      </button>

      {/* 2. MIDDLE PANEL: Configuration */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
        {/* Header */}
        <div className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-10">
          <div className="flex-1 max-w-xl">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value) setNameError(false);
              }}
              className={`text-xl font-bold text-slate-800 placeholder:text-slate-400 border-b-2 bg-transparent w-full px-2 py-2 focus:outline-none transition-all ${nameError
                ? "border-red-500 bg-red-50/30 placeholder:text-red-300 animate-pulse"
                : "border-transparent hover:border-slate-200 focus:border-indigo-500"
                }`}
              placeholder="✨ Name your report..."
              autoFocus
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={mode === "TABLE" && !baseTable}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlayCircle className="w-4 h-4" /> Run Query
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Report
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${(mode === "TABLE" && baseTable) ||
                (mode === "SEMANTIC" && tableColumns.length > 0)
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
                }`}
            >
              {((mode === "TABLE" && baseTable) ||
                (mode === "SEMANTIC" && tableColumns.length > 0)) ? (
                <Check className="w-3 h-3" />
              ) : (
                <div className="w-3 h-3 rounded-full border-2 border-current" />
              )}
              {mode === "TABLE" ? "Data Source" : "Facts & Dimensions"}
            </div>
            <div className="h-px flex-1 bg-slate-200" />
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${tableColumns.length > 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
                }`}
            >
              {tableColumns.length > 0 ? (
                <Check className="w-3 h-3" />
              ) : (
                <div className="w-3 h-3 rounded-full border-2 border-current" />
              )}
              Columns
            </div>
            <div className="h-px flex-1 bg-slate-200" />
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${name.trim()
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
                }`}
            >
              {name.trim() ? (
                <Check className="w-3 h-3" />
              ) : (
                <div className="w-3 h-3 rounded-full border-2 border-current" />
              )}
              Ready
            </div>
          </div>

          {/* TABLE CONFIG */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-white to-blue-50/30 round-t-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TableIcon className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Table Configuration
              </h3>
              <span className="text-xs text-slate-500 ml-auto font-medium">
                {tableColumns.length} columns
              </span>
            </div>
            <div className="p-6">
              <Shelf
                title="Visible Columns"
                icon={Layout}
                placeholder="Drag fields here to display in your report table"
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

          {/* VISUALIZATION CONFIG */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-white to-purple-50/30 round-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart2 className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  Visualization
                </h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={showChart}
                  onChange={(e) => setShowChart(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {showChart && (
              <div className="p-6 space-y-6 animate-in slide-in-from-top-2 fade-in duration-200">
                {/* Chart Type Selector */}
                <div className="flex gap-2">
                  {[
                    { id: "bar", icon: BarChart3, label: "Bar Chart" },
                    { id: "line", icon: LineChart, label: "Line Chart" },
                    { id: "pie", icon: PieChart, label: "Pie Chart" },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setChartType(type.id as any)}
                      className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${chartType === type.id
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-slate-100 hover:border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                      <type.icon className="w-6 h-6" />
                      <span className="text-xs font-bold">{type.label}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <Shelf
                    title="X-Axis (Dimension)"
                    icon={ArrowRightLeft}
                    placeholder="Drag a dimension here"
                    items={chartX ? [chartX] : []}
                    accepts={["string", "date"]}
                    onDrop={handleDropChartX}
                    onRemove={() => setChartX(null)}
                    onUpdate={(i, u) => {
                      if (chartX) setChartX({ ...chartX, ...u });
                    }}
                  />
                  <Shelf
                    title="Y-Axis (Metrics)"
                    icon={BarChart3}
                    placeholder="Drag metrics here"
                    items={chartY}
                    accepts={["number"]}
                    onDrop={handleDropChartY}
                    onRemove={(i) =>
                      setChartY(chartY.filter((_, idx) => idx !== i))
                    }
                    onUpdate={(i, u) => {
                      const n = [...chartY];
                      n[i] = { ...n[i], ...u };
                      setChartY(n);
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* FILTERS */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-white to-amber-50/30 round-t-xl">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Filter className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Filters</h3>
              <span className="text-xs text-slate-500 ml-auto font-medium">
                {filters.length} active
              </span>
            </div>
            <div className="p-6 space-y-5">
              <Shelf
                title="Active Filters"
                icon={Filter}
                placeholder="Drag fields here to filter your data"
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
                onUpdate={(i, u) => {
                  const n = [...filters];
                  n[i] = {
                    ...n[i],
                    column_name: u.name || n[i].column_name,
                  };
                  setFilters(n);
                }}
              />
            </div>
          </div>

          {/* DRILL THROUGH CONFIG */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-white to-orange-50/30">
              <div className="p-2 bg-orange-100 rounded-lg">
                <MousePointerClick className="w-4 h-4 text-orange-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Drill Through
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">
                  Target Report
                </label>
                <select
                  className="w-full text-sm border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  value={drillConfig.targetReportId}
                  onChange={(e) =>
                    setDrillConfig({
                      ...drillConfig,
                      targetReportId: Number(e.target.value),
                    })
                  }
                >
                  <option value={0}>None (Disabled)</option>
                  {availableReports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {drillConfig.targetReportId !== 0 && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <LinkIcon className="w-3 h-3" /> Column Mapping
                  </h4>
                  <div className="space-y-2">
                    {tableColumns.map((col) => (
                      <div
                        key={col.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-600 font-medium">
                          {col.alias || col.name}
                        </span>
                        <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                        <input
                          className="w-40 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Target Column Name"
                          value={drillConfig.mapping[col.name] || ""}
                          onChange={(e) =>
                            setDrillConfig({
                              ...drillConfig,
                              mapping: {
                                ...drillConfig.mapping,
                                [col.name]: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3 italic">
                    Map columns from this report to filter columns in the target
                    report.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. RIGHT PANEL: Preview */}
      <div className="w-[30%] bg-white border-l border-slate-200 flex flex-col z-10 shadow-xl">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            Live Preview
          </h3>
          {previewData && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">
              {previewData.rows.length} rows
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden relative bg-slate-50">
          {isLoadingPreview ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold text-indigo-600 animate-pulse">
                Running Query...
              </p>
            </div>
          ) : previewData ? (
            <div className="h-full overflow-auto">
              <ReportViewer
                previewConfig={previewConfig!}
                previewData={previewData}
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                Ready to Preview
              </p>
              <p className="text-xs max-w-[200px]">
                Configure your report columns and filters, then click "Run Query"
                to see the results here.
              </p>
            </div>
          )}
        </div>

        {/* Status Bar */}
        {message && (
          <div
            className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium animate-in slide-in-from-bottom-5 fade-in duration-300 z-50 ${message.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
              }`}
          >
            {message.type === "success" ? (
              <Check className="w-4 h-4" />
            ) : (
              <X className="w-4 h-4" />
            )}
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportBuilder;
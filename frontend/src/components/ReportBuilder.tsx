// src/components/ReportBuilder.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  ReportColumn,
  ReportFilter,
  Schema,
  ReportDefinition,
} from "../services/api";
import { apiService } from "../services/api";
import {
  Plus,
  Trash2,
  Save,
  BarChart3,
  Table,
  Settings,
  Database,
  ArrowRight,
  Filter,
  Layout,
  PieChart,
} from "lucide-react";

interface Props {
  connections: { id: number; connection_name: string }[];
  onSaved?: (reportId: number) => void;
}

const emptyColumn: ReportColumn = {
  column_name: "",
  alias: "",
  visible: true,
  order_index: 0,
};
const emptyFilter: ReportFilter = {
  column_name: "",
  operator: "=",
  value: "",
  is_user_editable: true,
};

const ReportBuilder: React.FC<Props> = ({ connections, onSaved }) => {
  const [activeTab, setActiveTab] = useState<"data" | "visual" | "drill">(
    "data"
  );

  // Report Basic Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [connectionId, setConnectionId] = useState<number | null>(
    connections[0]?.id ?? null
  );
  const [baseTable, setBaseTable] = useState("");

  // Data Configuration
  const [columns, setColumns] = useState<ReportColumn[]>([emptyColumn]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);

  // Visualization Configuration
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [chartXAxis, setChartXAxis] = useState("");
  const [chartYAxis, setChartYAxis] = useState<string[]>([]);
  const [chartAgg, setChartAgg] = useState<"SUM" | "COUNT" | "AVG">("SUM");

  // Drill Configuration
  const [targetReports, setTargetReports] = useState<ReportDefinition[]>([]);
  const [drillConfig, setDrillConfig] = useState<{
    targetId: number;
    mapping: Record<string, string>;
  }>({ targetId: 0, mapping: {} });

  // Metadata
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Load Schemas
  useEffect(() => {
    if (connectionId) {
      apiService.getSchemas(connectionId).then(setSchemas);
    }
  }, [connectionId]);

  // Load Reports for Drill Targets
  useEffect(() => {
    apiService.getReports().then(setTargetReports);
  }, []);

  const availableColumns = useMemo(() => {
    if (!baseTable) return [];
    const tableSchema = schemas.find((s) => s.tableName === baseTable);
    return tableSchema ? tableSchema.columns : [];
  }, [baseTable, schemas]);

  const handleSave = async () => {
    if (!name || !connectionId || !baseTable) {
      setMessage("Name, connection and base table are required");
      return;
    }
    setSaving(true);
    try {
      const visualization_config = {
        showChart,
        chartType,
        xAxisColumn: chartXAxis,
        yAxisColumns: chartYAxis,
        aggregation: chartAgg,
      };

      const drillTargetsPayload =
        drillConfig.targetId !== 0
          ? [
              {
                target_report_id: drillConfig.targetId,
                mapping_json: drillConfig.mapping,
              },
            ]
          : [];

      const payload = {
        name,
        description,
        connection_id: connectionId,
        base_table: baseTable,
        columns: columns.filter((c) => c.column_name.trim() !== ""),
        filters,
        visualization_config,
        drillTargets: drillTargetsPayload,
      };

      const res = await apiService.saveReport(payload);
      if (res.success && res.reportId) {
        setMessage("Report saved successfully!");
        onSaved?.(res.reportId);
      } else {
        setMessage("Error saving: " + res.error);
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* LEFT SIDEBAR - CONFIGURATION */}
      <div className="w-[480px] flex flex-col border-r border-slate-200 bg-white h-full shadow-xl z-10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="font-bold text-slate-800">Report Studio</h2>
            <p className="text-xs text-slate-500">Configure your data view</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-all"
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                <Save className="h-4 w-4" /> Save
              </>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {["data", "visual", "drill"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab === "data" && <Database className="h-4 w-4" />}
                {tab === "visual" && <BarChart3 className="h-4 w-4" />}
                {tab === "drill" && <ArrowRight className="h-4 w-4" />}
                <span className="capitalize">{tab}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Config Area */}
        <div className="flex-1 overflow-y-auto px-6 pb-20 space-y-6">
          {message && (
            <div
              className={`p-3 rounded text-sm ${
                message.includes("Error")
                  ? "bg-red-50 text-red-600"
                  : "bg-green-50 text-green-600"
              }`}
            >
              {message}
            </div>
          )}

          {/* General Settings (Always Visible) */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Report Name
              </label>
              <input
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g., Monthly Sales Q3"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Connection
                </label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                  value={connectionId ?? ""}
                  onChange={(e) => setConnectionId(Number(e.target.value))}
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.connection_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Source Table
                </label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                  value={baseTable}
                  onChange={(e) => setBaseTable(e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {schemas.map((s) => (
                    <option key={s.tableName} value={s.tableName}>
                      {s.tableName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100"></div>

          {/* TAB CONTENT: DATA */}
          {activeTab === "data" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              {/* Columns Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Table className="h-4 w-4 text-slate-400" /> Columns
                  </label>
                  <button
                    onClick={() =>
                      setColumns([
                        ...columns,
                        { ...emptyColumn, order_index: columns.length },
                      ])
                    }
                    className="text-xs text-indigo-600 font-medium hover:bg-indigo-50 px-2 py-1 rounded"
                  >
                    + Add Column
                  </button>
                </div>
                <div className="space-y-2">
                  {columns.map((col, idx) => (
                    <div key={idx} className="flex gap-2 group">
                      <select
                        className="flex-1 px-2 py-2 bg-white border border-slate-200 rounded text-sm focus:border-indigo-400 outline-none"
                        value={col.column_name}
                        onChange={(e) => {
                          const n = [...columns];
                          n[idx].column_name = e.target.value;
                          n[idx].alias = e.target.value;
                          setColumns(n);
                        }}
                      >
                        <option value="">Select Field...</option>
                        {availableColumns.map((ac) => (
                          <option key={ac.name} value={ac.name}>
                            {ac.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="w-1/3 px-2 py-2 bg-white border border-slate-200 rounded text-sm focus:border-indigo-400 outline-none"
                        placeholder="Alias"
                        value={col.alias}
                        onChange={(e) => {
                          const n = [...columns];
                          n[idx].alias = e.target.value;
                          setColumns(n);
                        }}
                      />
                      <button
                        onClick={() =>
                          setColumns(columns.filter((_, i) => i !== idx))
                        }
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filters Section (RESTORED) */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" /> Filters
                  </label>
                  <button
                    onClick={() => setFilters([...filters, { ...emptyFilter }])}
                    className="text-xs text-indigo-600 font-medium hover:bg-indigo-50 px-2 py-1 rounded"
                  >
                    + Add Filter
                  </button>
                </div>
                {filters.length === 0 && (
                  <div className="text-center py-4 border border-dashed border-slate-200 rounded bg-slate-50 text-slate-400 text-xs">
                    No filters applied
                  </div>
                )}
                <div className="space-y-2">
                  {filters.map((f, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        className="flex-1 px-2 py-2 bg-white border border-slate-200 rounded text-sm"
                        value={f.column_name}
                        onChange={(e) => {
                          const n = [...filters];
                          n[idx].column_name = e.target.value;
                          setFilters(n);
                        }}
                      >
                        <option value="">Column...</option>
                        {availableColumns.map((ac) => (
                          <option key={ac.name} value={ac.name}>
                            {ac.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-20 px-2 py-2 bg-white border border-slate-200 rounded text-sm"
                        value={f.operator}
                        onChange={(e) => {
                          const n = [...filters];
                          n[idx].operator = e.target.value;
                          setFilters(n);
                        }}
                      >
                        <option value="=">=</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value="LIKE">Like</option>
                      </select>
                      <input
                        className="flex-1 px-2 py-2 bg-white border border-slate-200 rounded text-sm"
                        placeholder="Default Value"
                        value={f.value}
                        onChange={(e) => {
                          const n = [...filters];
                          n[idx].value = e.target.value;
                          setFilters(n);
                        }}
                      />
                      <button
                        onClick={() =>
                          setFilters(filters.filter((_, i) => i !== idx))
                        }
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: VISUAL */}
          {activeTab === "visual" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <span className="text-sm font-medium text-indigo-900">
                  Enable Charts
                </span>
                <div
                  className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    showChart ? "bg-indigo-600" : "bg-slate-300"
                  }`}
                  onClick={() => setShowChart(!showChart)}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      showChart ? "translate-x-4" : ""
                    }`}
                  ></div>
                </div>
              </div>

              {showChart && (
                <>
                  {/* Chart Type Selector */}
                  <div className="grid grid-cols-3 gap-3">
                    {["bar", "line", "pie"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setChartType(t as any)}
                        className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-all ${
                          chartType === t
                            ? "border-indigo-600 bg-indigo-50/50 text-indigo-700"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {t === "bar" && <BarChart3 className="h-5 w-5" />}
                        {t === "line" && <Table className="h-5 w-5" />}
                        {t === "pie" && <PieChart className="h-5 w-5" />}
                        <span className="text-xs font-medium capitalize">
                          {t}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Axes Configuration (RESTORED) */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Category Axis (X)
                      </label>
                      <select
                        value={chartXAxis}
                        onChange={(e) => setChartXAxis(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                      >
                        <option value="">Select Column...</option>
                        {columns.map((c) => (
                          <option key={c.column_name} value={c.column_name}>
                            {c.alias || c.column_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Value Axes (Y)
                      </label>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                        {columns.map((c) => (
                          <label
                            key={c.column_name}
                            className="flex items-center gap-2 mb-2 text-sm text-slate-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={chartYAxis.includes(c.column_name)}
                              onChange={(e) => {
                                if (e.target.checked)
                                  setChartYAxis([...chartYAxis, c.column_name]);
                                else
                                  setChartYAxis(
                                    chartYAxis.filter(
                                      (y) => y !== c.column_name
                                    )
                                  );
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {c.alias || c.column_name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Aggregation
                      </label>
                      <select
                        value={chartAgg}
                        onChange={(e) => setChartAgg(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                      >
                        <option value="SUM">Sum</option>
                        <option value="COUNT">Count</option>
                        <option value="AVG">Average</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB CONTENT: DRILL (RESTORED) */}
          {activeTab === "drill" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                <p className="font-semibold mb-1">Drill-Through Actions</p>
                <p className="opacity-80">
                  Configure what happens when a user clicks on a table row or
                  chart bar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Target Report
                </label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                  value={drillConfig.targetId}
                  onChange={(e) =>
                    setDrillConfig({
                      ...drillConfig,
                      targetId: Number(e.target.value),
                    })
                  }
                >
                  <option value={0}>-- No Drill Action --</option>
                  {targetReports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {drillConfig.targetId !== 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Parameter Mapping
                  </label>
                  <div className="space-y-3">
                    {columns.map((col) => (
                      <div
                        key={col.column_name}
                        className="flex items-center gap-3"
                      >
                        <div
                          className="w-1/3 text-sm text-right text-slate-600 truncate"
                          title={col.alias}
                        >
                          {col.alias || col.column_name}
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                        <input
                          placeholder="Target Column Name"
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:border-indigo-400 outline-none"
                          value={drillConfig.mapping[col.column_name] || ""}
                          onChange={(e) => {
                            const newMapping = {
                              ...drillConfig.mapping,
                              [col.column_name]: e.target.value,
                            };
                            if (!e.target.value)
                              delete newMapping[col.column_name];
                            setDrillConfig({
                              ...drillConfig,
                              mapping: newMapping,
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE - PREVIEW */}
      <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 w-full max-w-2xl min-h-[400px] flex flex-col items-center justify-center">
          <Layout className="h-12 w-12 text-slate-200 mb-4" />
          <h3 className="text-lg font-medium text-slate-800">Live Preview</h3>
          <p className="text-sm max-w-xs mx-auto mt-2 mb-6">
            This area will eventually render the live report using the{" "}
            <code>ReportViewer</code> component.
          </p>
          <div className="text-xs bg-slate-100 p-4 rounded text-left w-full font-mono overflow-hidden">
            <strong>Current Config:</strong>
            <br />
            Cols: {columns.length} | Filters: {filters.length}
            <br />
            Chart: {showChart ? chartType : "Disabled"}
            <br />
            Drill:{" "}
            {drillConfig.targetId ? `Report #${drillConfig.targetId}` : "None"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportBuilder;

import React, { useState, useEffect, useMemo } from "react";
import {
  ReportColumn,
  ReportFilter,
  Schema,
  ReportDefinition,
  FullReportConfig,
} from "../services/api";
import { apiService } from "../services/api";
import {
  Plus,
  Trash2,
  Save,
  BarChart3,
  Settings,
  Database,
  ArrowRight,
  Filter,
  Layout,
  Play,
} from "lucide-react";
import ReportViewer from "./ReportViewer";

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

  // FORM STATE
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [connectionId, setConnectionId] = useState<number | null>(
    connections[0]?.id ?? null
  );
  const [baseTable, setBaseTable] = useState("");
  const [columns, setColumns] = useState<ReportColumn[]>([emptyColumn]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);

  // Viz State
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [chartXAxis, setChartXAxis] = useState("");
  const [chartYAxis, setChartYAxis] = useState<string[]>([]);
  const [chartAgg, setChartAgg] = useState<"SUM" | "COUNT" | "AVG">("SUM");

  // Drill State
  const [targetReports, setTargetReports] = useState<ReportDefinition[]>([]);
  const [drillConfig, setDrillConfig] = useState<{
    targetId: number;
    mapping: Record<string, string>;
  }>({ targetId: 0, mapping: {} });

  // Metadata & Status
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // PREVIEW STATE
  const [previewMode, setPreviewMode] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<FullReportConfig | null>(
    null
  );

  useEffect(() => {
    if (connectionId) apiService.getSchemas(connectionId).then(setSchemas);
  }, [connectionId]);

  useEffect(() => {
    apiService.getReports().then(setTargetReports);
  }, []);

  const availableColumns = useMemo(() => {
    if (!baseTable) return [];
    return schemas.find((s) => s.tableName === baseTable)?.columns || [];
  }, [baseTable, schemas]);

  // Construct Payload Helper
  const getPayload = () => {
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

    return {
      name,
      description,
      connection_id: connectionId,
      base_table: baseTable,
      columns: columns.filter((c) => c.column_name.trim() !== ""),
      filters,
      visualization_config,
      drillTargets: drillTargetsPayload,
    };
  };

  const handleSave = async () => {
    if (!name || !connectionId || !baseTable) {
      setMessage("Error: Name and Source Table are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiService.saveReport(getPayload());
      if (res.success && res.reportId) {
        setMessage("Success: Report saved!");
        onSaved?.(res.reportId);
      } else {
        setMessage("Error: " + res.error);
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    if (!baseTable || columns.length === 0) {
      alert("Please select a table and at least one column to preview.");
      return;
    }
    // 1. Create a "fake" FullReportConfig
    const payload = getPayload();
    const config: FullReportConfig = {
      report: {
        ...payload,
        id: 0,
        created_at: "",
        visualization_config: payload.visualization_config,
      }, // Mock ID
      columns: payload.columns,
      filters: payload.filters,
      visualization: payload.visualization_config,
      drillTargets: [], // Drill links won't work in preview usually
    };

    setPreviewConfig(config);
    setPreviewMode(true);
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* LEFT PANEL: CONFIG */}
      <div className="w-[450px] flex flex-col border-r border-slate-200 bg-white h-full shadow-xl z-10">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="font-bold text-slate-800">Report Studio</h2>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-70"
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
                <span className="capitalize">{tab}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Form */}
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

          {/* GENERAL */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">
                Name
              </label>
              <input
                className="w-full border rounded p-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Report Name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Connection
                </label>
                <select
                  className="w-full border rounded p-2 text-sm"
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
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Table
                </label>
                <select
                  className="w-full border rounded p-2 text-sm"
                  value={baseTable}
                  onChange={(e) => setBaseTable(e.target.value)}
                >
                  <option value="">Select...</option>
                  {schemas.map((s) => (
                    <option key={s.tableName} value={s.tableName}>
                      {s.tableName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* TAB: DATA */}
          {activeTab === "data" && (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-bold text-slate-700">
                    Columns
                  </label>
                  <button
                    onClick={() => setColumns([...columns, { ...emptyColumn }])}
                    className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded"
                  >
                    + Add
                  </button>
                </div>
                {columns.map((c, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select
                      className="flex-1 border rounded p-1.5 text-sm"
                      value={c.column_name}
                      onChange={(e) => {
                        const n = [...columns];
                        n[i].column_name = e.target.value;
                        n[i].alias = e.target.value;
                        setColumns(n);
                      }}
                    >
                      <option value="">Field...</option>
                      {availableColumns.map((ac) => (
                        <option key={ac.name} value={ac.name}>
                          {ac.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="w-1/3 border rounded p-1.5 text-sm"
                      placeholder="Alias"
                      value={c.alias}
                      onChange={(e) => {
                        const n = [...columns];
                        n[i].alias = e.target.value;
                        setColumns(n);
                      }}
                    />
                    <button
                      onClick={() =>
                        setColumns(columns.filter((_, idx) => idx !== i))
                      }
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-bold text-slate-700">
                    Filters
                  </label>
                  <button
                    onClick={() => setFilters([...filters, { ...emptyFilter }])}
                    className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded"
                  >
                    + Add
                  </button>
                </div>
                {filters.map((f, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select
                      className="w-1/3 border rounded p-1.5 text-sm"
                      value={f.column_name}
                      onChange={(e) => {
                        const n = [...filters];
                        n[i].column_name = e.target.value;
                        setFilters(n);
                      }}
                    >
                      <option value="">Field...</option>
                      {availableColumns.map((ac) => (
                        <option key={ac.name} value={ac.name}>
                          {ac.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-16 border rounded p-1.5 text-sm"
                      value={f.operator}
                      onChange={(e) => {
                        const n = [...filters];
                        n[i].operator = e.target.value;
                        setFilters(n);
                      }}
                    >
                      <option>=</option>
                      <option>&gt;</option>
                      <option>&lt;</option>
                    </select>
                    <input
                      className="flex-1 border rounded p-1.5 text-sm"
                      placeholder="Value"
                      value={f.value}
                      onChange={(e) => {
                        const n = [...filters];
                        n[i].value = e.target.value;
                        setFilters(n);
                      }}
                    />
                    <button
                      onClick={() =>
                        setFilters(filters.filter((_, idx) => idx !== i))
                      }
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: VISUAL */}
          {activeTab === "visual" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={showChart}
                  onChange={(e) => setShowChart(e.target.checked)}
                />
                <span className="text-sm font-medium">Enable Chart</span>
              </div>
              {showChart && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {["bar", "line", "pie"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setChartType(t as any)}
                        className={`p-2 border rounded text-xs capitalize ${
                          chartType === t
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                            : ""
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      X-Axis (Category)
                    </label>
                    <select
                      className="w-full border rounded p-2 text-sm mt-1"
                      value={chartXAxis}
                      onChange={(e) => setChartXAxis(e.target.value)}
                    >
                      <option value="">Select...</option>
                      {columns.map((c) => (
                        <option key={c.column_name} value={c.column_name}>
                          {c.alias || c.column_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Y-Axis (Values)
                    </label>
                    <div className="border rounded p-2 mt-1 max-h-32 overflow-y-auto">
                      {columns.map((c) => (
                        <label
                          key={c.column_name}
                          className="flex items-center gap-2 text-sm py-1"
                        >
                          <input
                            type="checkbox"
                            checked={chartYAxis.includes(c.column_name)}
                            onChange={(e) =>
                              e.target.checked
                                ? setChartYAxis([...chartYAxis, c.column_name])
                                : setChartYAxis(
                                    chartYAxis.filter(
                                      (y) => y !== c.column_name
                                    )
                                  )
                            }
                          />
                          {c.alias || c.column_name}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: DRILL */}
          {activeTab === "drill" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Target Report
                </label>
                <select
                  className="w-full border rounded p-2 text-sm mt-1"
                  value={drillConfig.targetId}
                  onChange={(e) =>
                    setDrillConfig({
                      ...drillConfig,
                      targetId: Number(e.target.value),
                    })
                  }
                >
                  {targetReports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              {drillConfig.targetId !== 0 && (
                <div className="border-t pt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                    Map Columns
                  </label>
                  {columns.map((col) => (
                    <div
                      key={col.column_name}
                      className="flex items-center gap-2 mb-2"
                    >
                      <span className="text-sm w-1/3 truncate text-right">
                        {col.alias}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <input
                        className="flex-1 border rounded p-1 text-sm"
                        placeholder="Target Field Name"
                        value={drillConfig.mapping[col.column_name] || ""}
                        onChange={(e) => {
                          const m = {
                            ...drillConfig.mapping,
                            [col.column_name]: e.target.value,
                          };
                          setDrillConfig({ ...drillConfig, mapping: m });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: PREVIEW */}
      <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden relative">
        {!previewMode ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Layout className="h-16 w-16 mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-600">
              Ready to Preview?
            </h3>
            <p className="max-w-xs text-center text-sm mb-6">
              Configure your columns and filters on the left, then click the
              button below.
            </p>
            <button
              onClick={handlePreview}
              className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 font-bold rounded-full shadow-lg hover:shadow-xl transition-all border border-indigo-100"
            >
              <Play className="h-5 w-5 fill-indigo-600" /> Run Preview
            </button>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="bg-indigo-900 text-white px-4 py-2 flex justify-between items-center text-sm">
              <span className="font-mono opacity-80">PREVIEW MODE</span>
              <button
                onClick={() => setPreviewMode(false)}
                className="hover:text-white text-indigo-200"
              >
                Close Preview
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative">
              {/* We pass specific PREVIEW props here so it doesn't fetch from DB by ID */}
              {previewConfig && (
                <ReportViewer
                  initialReportId={0} // Dummy
                  onClose={() => setPreviewMode(false)}
                  previewConfig={previewConfig}
                  previewData={{
                    // Mocking response structure based on current filters
                    sql: "SELECT * FROM PREVIEW_MODE",
                    rows: [], // The Viewer will fetch real data if we pass ID, but here for "Live" preview we usually need a special endpoint.
                    // TRICK: If the API supports "runAdhoc(config)", we call that.
                    // For now, let's assume the Viewer handles data fetching if we pass ID.
                    // Since we don't have an ID yet, we might need to Mock the data or Alert the user "Save to see data".
                    // BETTER UX: Let's assume there is an API endpoint `apiService.runReportAdhoc(payload)`.
                  }}
                />
              )}
              {/* NOTE: Real "Live Preview" requires an endpoint that accepts the Config Payload and returns rows. 
                         If your backend only runs saved reports, "Preview" might just show the Layout structure with empty data. 
                         I've added the UI logic for it assuming `ReportViewer` handles it. */}
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50 pointer-events-none">
                <div className="bg-white p-6 rounded-xl shadow-2xl border text-center">
                  <h3 className="font-bold text-lg mb-2">Preview Generated</h3>
                  <p className="text-sm text-slate-500">
                    In a real app, this would call an <code>/adhoc</code>{" "}
                    endpoint.
                    <br />
                    For now, save the report to view data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportBuilder;

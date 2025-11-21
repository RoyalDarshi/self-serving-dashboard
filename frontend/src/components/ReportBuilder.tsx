// src/components/ReportBuilder.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  ReportColumn,
  ReportFilter,
  Schema,
  ReportDrillConfig,
  ReportDefinition,
} from "../services/api";
import { apiService } from "../services/api";
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  BarChart3,
  Table,
  ArrowRightCircle,
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
  const [chartAgg, setChartAgg] = useState<"SUM" | "COUNT">("SUM");

  // Drill Configuration (Linking to other reports)
  const [targetReports, setTargetReports] = useState<ReportDefinition[]>([]);
  const [drillConfig, setDrillConfig] = useState<{
    targetId: number;
    mapping: Record<string, string>;
  }>({ targetId: 0, mapping: {} });

  // Metadata
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Load Schemas
  useEffect(() => {
    if (connectionId) {
      setLoadingSchemas(true);
      apiService
        .getSchemas(connectionId)
        .then(setSchemas)
        .finally(() => setLoadingSchemas(false));
    }
  }, [connectionId]);

  // Load available reports for Drill-through targets
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

      // Prepare drill targets payload
      const drillTargetsPayload = [];
      if (drillConfig.targetId !== 0) {
        drillTargetsPayload.push({
          target_report_id: drillConfig.targetId,
          mapping_json: drillConfig.mapping, // Send object, backend will stringify
        });
      }

      const payload = {
        name,
        description,
        connection_id: connectionId,
        base_table: baseTable,
        columns: columns.filter((c) => c.column_name.trim() !== ""),
        filters,
        visualization_config,
        drillTargets: drillTargetsPayload, // <--- ADD THIS
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
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Report Studio</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("data")}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === "data"
                ? "bg-blue-100 text-blue-700"
                : "text-slate-600"
            }`}
          >
            Data
          </button>
          <button
            onClick={() => setActiveTab("visual")}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === "visual"
                ? "bg-blue-100 text-blue-700"
                : "text-slate-600"
            }`}
          >
            Visualization
          </button>
          <button
            onClick={() => setActiveTab("drill")}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === "drill"
                ? "bg-blue-100 text-blue-700"
                : "text-slate-600"
            }`}
          >
            Drill-Through
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
        >
          <Save className="h-4 w-4" /> Save
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {message && (
          <div className="p-2 bg-green-100 text-green-800 text-sm rounded">
            {message}
          </div>
        )}

        {/* General Info (Always Visible) */}
        <div className="bg-white p-4 rounded border border-slate-200 grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500">Name</label>
            <input
              className="w-full border rounded px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">
              Connection
            </label>
            <select
              className="w-full border rounded px-2 py-1"
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
            <label className="text-xs font-bold text-slate-500">
              Base Table
            </label>
            <select
              className="w-full border rounded px-2 py-1"
              value={baseTable}
              onChange={(e) => setBaseTable(e.target.value)}
            >
              <option value="">Select Table</option>
              {schemas.map((s) => (
                <option key={s.tableName} value={s.tableName}>
                  {s.tableName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TAB: DATA */}
        {activeTab === "data" && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded border border-slate-200">
              <div className="flex justify-between mb-2">
                <h3 className="font-medium text-slate-700">Columns</h3>
                <button
                  onClick={() =>
                    setColumns([
                      ...columns,
                      { ...emptyColumn, order_index: columns.length },
                    ])
                  }
                  className="text-xs bg-slate-100 px-2 py-1 rounded"
                >
                  + Add
                </button>
              </div>
              {columns.map((col, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <select
                    className="border rounded px-2 py-1 text-sm flex-1"
                    value={col.column_name}
                    onChange={(e) => {
                      const newCols = [...columns];
                      newCols[idx].column_name = e.target.value;
                      newCols[idx].alias = e.target.value; // Auto-alias
                      setColumns(newCols);
                    }}
                  >
                    <option value="">Select Column</option>
                    {availableColumns.map((ac) => (
                      <option key={ac.name} value={ac.name}>
                        {ac.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="border rounded px-2 py-1 text-sm w-32"
                    placeholder="Alias"
                    value={col.alias || ""}
                    onChange={(e) => {
                      const newCols = [...columns];
                      newCols[idx].alias = e.target.value;
                      setColumns(newCols);
                    }}
                  />
                  <button
                    onClick={() =>
                      setColumns(columns.filter((_, i) => i !== idx))
                    }
                    className="text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white p-4 rounded border border-slate-200">
              <div className="flex justify-between mb-2">
                <h3 className="font-medium text-slate-700">Filters</h3>
                <button
                  onClick={() => setFilters([...filters, { ...emptyFilter }])}
                  className="text-xs bg-slate-100 px-2 py-1 rounded"
                >
                  + Add
                </button>
              </div>
              {filters.map((f, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <select
                    className="border rounded px-2 py-1 text-sm w-1/3"
                    value={f.column_name}
                    onChange={(e) => {
                      const newFilters = [...filters];
                      newFilters[idx].column_name = e.target.value;
                      setFilters(newFilters);
                    }}
                  >
                    <option value="">Column</option>
                    {availableColumns.map((ac) => (
                      <option key={ac.name} value={ac.name}>
                        {ac.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="border rounded px-2 py-1 text-sm w-20"
                    value={f.operator}
                    onChange={(e) => {
                      const newFilters = [...filters];
                      newFilters[idx].operator = e.target.value;
                      setFilters(newFilters);
                    }}
                  >
                    <option value="=">=</option>
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value="LIKE">Like</option>
                  </select>
                  <input
                    className="border rounded px-2 py-1 text-sm flex-1"
                    placeholder="Value"
                    value={f.value}
                    onChange={(e) => {
                      const newFilters = [...filters];
                      newFilters[idx].value = e.target.value;
                      setFilters(newFilters);
                    }}
                  />
                  <button
                    onClick={() =>
                      setFilters(filters.filter((_, i) => i !== idx))
                    }
                    className="text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: VISUALIZATION */}
        {activeTab === "visual" && (
          <div className="bg-white p-4 rounded border border-slate-200 space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showChart}
                onChange={(e) => setShowChart(e.target.checked)}
              />
              <span className="font-medium text-slate-700">
                Enable Chart Visualization
              </span>
            </label>

            {showChart && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Chart Type
                    </label>
                    <div className="flex gap-2">
                      {["bar", "line", "pie"].map((t) => (
                        <button
                          key={t}
                          onClick={() => setChartType(t as any)}
                          className={`px-3 py-2 border rounded flex flex-col items-center ${
                            chartType === t
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          {t === "bar" && <BarChart3 className="h-5 w-5" />}
                          {t === "line" && <Table className="h-5 w-5" />}{" "}
                          {/* Placeholder icon */}
                          <span className="text-xs capitalize mt-1">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Aggregation
                    </label>
                    <select
                      value={chartAgg}
                      onChange={(e) => setChartAgg(e.target.value as any)}
                      className="w-full border rounded px-2 py-2"
                    >
                      <option value="SUM">Sum</option>
                      <option value="COUNT">Count</option>
                      <option value="AVG">Average</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Category (X-Axis)
                    </label>
                    <select
                      value={chartXAxis}
                      onChange={(e) => setChartXAxis(e.target.value)}
                      className="w-full border rounded px-2 py-2"
                    >
                      <option value="">Select Column</option>
                      {columns.map((c) => (
                        <option key={c.column_name} value={c.column_name}>
                          {c.alias || c.column_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Values (Y-Axis)
                    </label>
                    <div className="border rounded p-2 h-32 overflow-y-auto">
                      {columns.map((c) => (
                        <label
                          key={c.column_name}
                          className="flex items-center gap-2 mb-1 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={chartYAxis.includes(c.column_name)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setChartYAxis([...chartYAxis, c.column_name]);
                              else
                                setChartYAxis(
                                  chartYAxis.filter((y) => y !== c.column_name)
                                );
                            }}
                          />
                          {c.alias || c.column_name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: DRILL THROUGH */}
        {activeTab === "drill" && (
          <div className="bg-white p-4 rounded border border-slate-200 space-y-4">
            <p className="text-sm text-slate-500">
              Configure what happens when a user clicks a row in the table.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-500">
                Target Report
              </label>
              <select
                className="w-full border rounded px-2 py-2 mt-1"
                value={drillConfig.targetId}
                onChange={(e) =>
                  setDrillConfig({
                    ...drillConfig,
                    targetId: Number(e.target.value),
                  })
                }
              >
                <option value={0}>-- No Drill Through --</option>
                {targetReports
                  .filter((r) => r.id.toString() !== "CURRENT_ID")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>

            {drillConfig.targetId !== 0 && (
              <div className="border-t pt-4">
                <label className="text-xs font-bold text-slate-500 mb-2 block">
                  Parameter Mapping
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2 font-medium text-xs bg-slate-50 p-2 rounded">
                  <div>Source Column (Current)</div>
                  <div className="flex justify-center">
                    <ArrowRightCircle className="h-4 w-4" />
                  </div>
                  <div>Target Filter (Destination)</div>
                </div>
                {/* Simple Mapping UI: Just select one key column for now for MVP */}
                {columns.map((col) => (
                  <div
                    key={col.column_name}
                    className="grid grid-cols-3 gap-2 items-center mb-2"
                  >
                    <div className="text-sm">
                      {col.alias || col.column_name}
                    </div>
                    <div className="text-center text-slate-400">→</div>
                    <input
                      placeholder="Target Column Name"
                      className="border rounded px-2 py-1 text-sm"
                      value={drillConfig.mapping[col.column_name] || ""}
                      onChange={(e) => {
                        const newMapping = {
                          ...drillConfig.mapping,
                          [col.column_name]: e.target.value,
                        };
                        if (!e.target.value) delete newMapping[col.column_name];
                        setDrillConfig({ ...drillConfig, mapping: newMapping });
                      }}
                    />
                  </div>
                ))}
                <p className="text-xs text-slate-400 mt-2">
                  Enter the column name in the target report that matches the
                  source column value.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportBuilder;

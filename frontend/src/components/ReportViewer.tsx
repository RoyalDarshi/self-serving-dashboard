// src/components/ReportViewer.tsx
import React, { useEffect, useState, useMemo } from "react";
import { FullReportConfig, RunReportResponse } from "../services/api";
import { apiService } from "../services/api";
import ReportFilters from "./ReportFilters";
import ReportShareModal from "./ReportShareModal";
import {
  ArrowLeft,
  Download,
  Share2,
  Filter,
  BarChart2,
  Table as TableIcon,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  LineChart,
  Line,
  Cell,
} from "recharts";

interface ReportViewerProps {
  initialReportId: number;
  onClose?: () => void;
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

const ReportViewer: React.FC<ReportViewerProps> = ({
  initialReportId,
  onClose,
}) => {
  const [config, setConfig] = useState<FullReportConfig | null>(null);
  const [data, setData] = useState<RunReportResponse | null>(null);
  const [runtimeFilters, setRuntimeFilters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "chart" | "both">("both");
  const [shareOpen, setShareOpen] = useState(false);

  // Fetch Data
  const loadReport = async (id: number, filters: any) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load Config
      const response = await apiService.getReportConfig(id);

      if (!response.success || !response.data) {
        throw new Error(
          response.error || "Failed to fetch report configuration"
        );
      }

      const cfg = response.data; // <--- FIX: Extract data from response wrapper

      // Parse visualization config if it's a string (JSON from DB)
      // We use optional chaining (?.) just in case report is missing
      if (typeof cfg.report?.visualization_config === "string") {
        try {
          // We need to cast to any to write back to the object if types are strict
          (cfg as any).visualization = JSON.parse(
            cfg.report.visualization_config
          );
        } catch (e) {
          console.warn("Failed to parse visualization config", e);
        }
      }
      setConfig(cfg);

      // 2. Run Query
      const result = await apiService.runReport(id, filters);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to load report data");
        setData({ sql: "", rows: [] });
      }
    } catch (err: any) {
      console.error("Report load error:", err);
      setError(err.message || "Unexpected error loading report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(initialReportId, {});
  }, [initialReportId]);

  // Filter Handler
  const handleFilterChange = (col: string, val: any) => {
    const newFilters = { ...runtimeFilters, [col]: val };
    setRuntimeFilters(newFilters);
    if (config?.report.id) {
      apiService.runReport(config.report.id, newFilters).then((res) => {
        if (res.success && res.data) setData(res.data);
      });
    }
  };

  // Drill Through Handler
  const handleDrill = (row: any) => {
    if (config?.drillTargets && config.drillTargets.length > 0) {
      const target = config.drillTargets[0];
      const mapping = JSON.parse(target.mapping_json);

      // 1. Identify the metrics we want to IGNORE (Y-Axis columns)
      const metricsToIgnore = config.visualization?.yAxisColumns || [];

      const drillFilters: any = {};

      Object.entries(mapping).forEach(([src, dest]) => {
        // 2. FAILSAFE: If the source column is a Y-Axis metric, SKIP IT.
        if (metricsToIgnore.includes(src)) {
          return;
        }

        // 3. Only add the filter if it's NOT a metric
        if (row[src]) {
          drillFilters[dest as string] = row[src];
        }
      });

      console.log("Drill-down Filters Applied:", drillFilters); // Check console to verify
      loadReport(target.target_report_id, drillFilters);
    }
  };

  const handleExportCSV = () => {
    if (!data?.rows?.length) return;
    const cols = Object.keys(data.rows[0]);
    const csv =
      cols.join(",") +
      "\n" +
      data.rows
        .map((row) => cols.map((c) => JSON.stringify(row[c] ?? "")).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config?.report?.name || "report"}.csv`;
    link.click();
  };

  // Frontend Aggregation for Charts
  const chartData = useMemo(() => {
    if (!data?.rows || !config?.visualization?.showChart) return [];
    const vis = config.visualization;

    // Simple GroupBy and Aggregate
    const groups: Record<string, any> = {};

    data.rows.forEach((row) => {
      const key = row[vis.xAxisColumn] || "Unknown";

      if (!groups[key]) {
        groups[key] = {
          name: key, // Used by Recharts XAxis
          [vis.xAxisColumn]: key, // <--- FIX: Store original column name (e.g. sales_type) for Drill Mapping
          count: 0,
        };
        vis.yAxisColumns.forEach((y) => (groups[key][y] = 0));
      }

      groups[key].count++;
      vis.yAxisColumns.forEach((y) => {
        groups[key][y] += Number(row[y]) || 0;
      });
    });

    return Object.values(groups);
  }, [data, config]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose}>
              <ArrowLeft className="h-4 w-4 text-slate-600" />
            </button>
          )}
          <div>
            <h2 className="font-semibold text-slate-800">
              {config?.report.name || "Loading..."}
            </h2>
            <div className="text-xs text-slate-500">
              {loading ? "Fetching data..." : `${data?.rows?.length || 0} rows`}
              {config?.report.base_table
                ? ` • ${config.report.base_table}`
                : ""}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="p-1.5 rounded hover:bg-slate-100 border text-slate-600"
            title="Export CSV"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="p-1.5 rounded hover:bg-slate-100 border text-slate-600"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <div className="h-6 w-px bg-slate-300 mx-1"></div>
          <button
            onClick={() => setViewMode(viewMode === "table" ? "both" : "table")}
            className={`p-1.5 rounded border ${
              viewMode !== "chart"
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "hover:bg-slate-100 text-slate-600"
            }`}
            title="Toggle Table"
          >
            <TableIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode(viewMode === "chart" ? "both" : "chart")}
            className={`p-1.5 rounded border ${
              viewMode !== "table"
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "hover:bg-slate-100 text-slate-600"
            }`}
            title="Toggle Chart"
          >
            <BarChart2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters Area */}
      {config?.filters && (
        <ReportFilters
          filters={config.filters}
          runtimeFilters={runtimeFilters}
          onChange={handleFilterChange}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
        {loading && !data && (
          <div className="flex-1 flex items-center justify-center text-slate-500 gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" /> Loading Report
            Data...
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
            <p className="font-semibold">Error loading report</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Chart Section */}
        {!loading &&
          !error &&
          config?.visualization?.showChart &&
          viewMode !== "table" && (
            <div
              className={`${
                viewMode === "both" ? "h-1/2" : "h-full"
              } bg-white rounded-lg border border-slate-200 p-4 shadow-sm`}
            >
              <ResponsiveContainer width="100%" height="100%">
                {config.visualization.chartType === "pie" ? (
                  <PieChart>
                    <Tooltip />
                    <Legend />
                    <Pie
                      data={chartData}
                      dataKey={config.visualization.yAxisColumns[0]}
                      nameKey="name"
                      outerRadius={80}
                      label
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {config.visualization.yAxisColumns.map((col, i) => (
                      <Bar
                        key={col}
                        dataKey={col}
                        fill={COLORS[i % COLORS.length]}
                        onClick={(data) => handleDrill(data)}
                        cursor="pointer"
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

        {/* Table Section */}
        {!loading && !error && viewMode !== "chart" && (
          <div
            className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden ${
              viewMode === "both" ? "flex-1" : "h-full"
            }`}
          >
            <div className="overflow-auto h-full">
              <table className="min-w-full text-sm text-left border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {config?.columns
                      .filter((c) => c.visible)
                      .map((c) => (
                        <th
                          key={c.column_name}
                          className="px-4 py-3 font-semibold text-slate-700 border-b"
                        >
                          {c.alias || c.column_name}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* SAFE RENDER: Check if data.rows exists before mapping */}
                  {data?.rows?.map((row, i) => (
                    <tr
                      key={i}
                      onClick={() => handleDrill(row)}
                      className="hover:bg-indigo-50 cursor-pointer transition-colors"
                    >
                      {config?.columns
                        .filter((c) => c.visible)
                        .map((c) => (
                          <td
                            key={c.column_name}
                            className="px-4 py-2 text-slate-600"
                          >
                            {row[c.column_name]}
                          </td>
                        ))}
                    </tr>
                  ))}
                  {/* Empty State */}
                  {(!data?.rows || data.rows.length === 0) && (
                    <tr>
                      <td
                        colSpan={config?.columns?.length || 1}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <TableIcon className="h-8 w-8 text-slate-300" />
                          <span>No data returned from the database.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {config && (
        <ReportShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          report={config.report}
        />
      )}
    </div>
  );
};

export default ReportViewer;

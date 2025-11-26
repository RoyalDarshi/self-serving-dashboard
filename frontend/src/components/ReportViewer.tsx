// src/components/ReportViewer.tsx
import React, { useEffect, useState, useMemo } from "react";
import { FullReportConfig, RunReportResponse } from "../services/api";
import { apiService } from "../services/api";
import ReportShareModal from "./ReportShareModal";
import {
  ArrowLeft,
  Download,
  Share2,
  Filter,
  BarChart2,
  Table as TableIcon,
  RefreshCw,
  X,
  PieChart as PieIcon,
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
  Cell,
} from "recharts";

interface ReportViewerProps {
  initialReportId: number;
  onClose?: () => void;
}

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

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
  const [showFilters, setShowFilters] = useState(true);

  // 1. LOAD REPORT (Restored JSON Parsing)
  const loadReport = async (id: number, filters: any) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getReportConfig(id);

      if (!response.success || !response.data) {
        throw new Error(
          response.error || "Failed to fetch report configuration"
        );
      }

      const cfg = response.data;

      // CRITICAL: Parse visualization config if it's a string
      if (typeof cfg.report?.visualization_config === "string") {
        try {
          (cfg as any).visualization = JSON.parse(
            cfg.report.visualization_config
          );
        } catch (e) {
          console.warn("Failed to parse visualization config", e);
        }
      } else {
        // Ensure it's mapped if it's already an object
        (cfg as any).visualization = cfg.report.visualization_config;
      }

      setConfig(cfg);

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

  // 2. DATA AGGREGATION (Restored for Charts)
  const chartData = useMemo(() => {
    if (!data?.rows || !config?.visualization?.showChart) return [];
    const vis = config.visualization;

    const groups: Record<string, any> = {};

    data.rows.forEach((row) => {
      const key = row[vis.xAxisColumn] || "Unknown";

      if (!groups[key]) {
        groups[key] = {
          name: key,
          [vis.xAxisColumn]: key,
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

  // 3. DRILL THROUGH HANDLER
  const handleDrill = (row: any) => {
    if (config?.drillTargets && config.drillTargets.length > 0) {
      const target = config.drillTargets[0];
      const mapping = JSON.parse(target.mapping_json);
      const metricsToIgnore = config.visualization?.yAxisColumns || [];
      const drillFilters: any = {};

      Object.entries(mapping).forEach(([src, dest]) => {
        if (metricsToIgnore.includes(src)) return;
        if (row[src]) {
          drillFilters[dest as string] = row[src];
        }
      });

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

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden">
      {/* FILTER SIDEBAR */}
      <div
        className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col ${
          showFilters ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" /> Filters
          </h3>
          <button
            onClick={() => setShowFilters(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {config?.filters?.map((f) => (
            <div key={f.column_name}>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                {f.column_name}
              </label>
              <input
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                placeholder={f.operator || "Search..."}
                onChange={(e) => {
                  const newF = {
                    ...runtimeFilters,
                    [f.column_name]: e.target.value,
                  };
                  setRuntimeFilters(newF);
                }}
              />
            </div>
          ))}
          {(!config?.filters || config.filters.length === 0) && (
            <p className="text-sm text-slate-400 italic">
              No filters configured for this report.
            </p>
          )}
        </div>
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => loadReport(initialReportId, runtimeFilters)}
            className="w-full py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg text-sm hover:bg-indigo-100"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Floating Toolbar */}
        <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-slate-200 shadow-sm z-10">
          <div className="flex items-center gap-4">
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                {config?.report.name || "Loading..."}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                  {config?.report.base_table}
                </span>
                <span>• {data?.rows?.length || 0} records found</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showFilters && (
              <button
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Filter className="h-4 w-4" /> Filters
              </button>
            )}
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded ${
                  viewMode === "table"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-500"
                }`}
              >
                <TableIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("both")}
                className={`p-1.5 rounded ${
                  viewMode === "both"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-500"
                }`}
              >
                <div className="flex gap-0.5">
                  <TableIcon className="h-4 w-4" />
                  <BarChart2 className="h-4 w-4" />
                </div>
              </button>
              <button
                onClick={() => setViewMode("chart")}
                className={`p-1.5 rounded ${
                  viewMode === "chart"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-500"
                }`}
              >
                <BarChart2 className="h-4 w-4" />
              </button>
            </div>
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            <button
              onClick={handleExportCSV}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 overflow-hidden p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
              <p className="font-semibold">Error loading report</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Chart Card */}
          {config?.visualization?.showChart && viewMode !== "table" && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[350px] animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                {config.visualization.chartType === "pie" ? (
                  <PieIcon className="h-4 w-4 text-indigo-500" />
                ) : (
                  <BarChart2 className="h-4 w-4 text-indigo-500" />
                )}
                Visualization
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer>
                  {config.visualization.chartType === "pie" ? (
                    <PieChart>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                      <Legend />
                      <Pie
                        data={chartData}
                        dataKey={config.visualization.yAxisColumns[0]}
                        nameKey="name"
                        outerRadius={100}
                        innerRadius={60}
                        paddingAngle={5}
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
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E2E8F0"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#64748B", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#64748B", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "#F1F5F9" }}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                      <Legend />
                      {config.visualization.yAxisColumns.map((col, i) => (
                        <Bar
                          key={col}
                          dataKey={col}
                          fill={COLORS[i % COLORS.length]}
                          radius={[4, 4, 0, 0]}
                          onClick={(data) => handleDrill(data)}
                          cursor="pointer"
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table Card */}
          {viewMode !== "chart" && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-8">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {config?.columns
                        .filter((c) => c.visible)
                        .map((c) => (
                          <th
                            key={c.column_name}
                            className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap"
                          >
                            {c.alias || c.column_name}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.rows?.map((row, i) => (
                      <tr
                        key={i}
                        onClick={() => handleDrill(row)}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      >
                        {config?.columns
                          .filter((c) => c.visible)
                          .map((c) => (
                            <td
                              key={c.column_name}
                              className="px-6 py-3 text-slate-600 group-hover:text-slate-900"
                            >
                              {row[c.column_name]}
                            </td>
                          ))}
                      </tr>
                    ))}
                    {(!data?.rows || data.rows.length === 0) && (
                      <tr>
                        <td
                          colSpan={config?.columns?.length || 1}
                          className="px-6 py-12 text-center text-slate-400 italic"
                        >
                          No data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
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

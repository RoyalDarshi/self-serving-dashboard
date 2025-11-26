// src/components/ReportViewer.tsx
import React, { useEffect, useState, useMemo } from "react";
import { FullReportConfig, RunReportResponse } from "../services/api";
import { apiService } from "../services/api";
import ReportShareModal from "./ReportShareModal";
import {
  ArrowLeft,
  Share2,
  Filter,
  BarChart2,
  Table as TableIcon,
  X,
  ChevronRight,
  ChevronLeft,
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
  initialReportId?: number;
  onClose?: () => void;
  previewConfig?: FullReportConfig;
  previewData?: RunReportResponse;
}

const COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];
const PAGE_SIZE = 10;

const ReportViewer: React.FC<ReportViewerProps> = ({
  initialReportId,
  onClose,
  previewConfig,
  previewData,
}) => {
  const [history, setHistory] = useState<
    { id: number; filters: any; name: string }[]
  >([]);
  const [config, setConfig] = useState<FullReportConfig | null>(null);
  const [data, setData] = useState<RunReportResponse | null>(null);
  const [runtimeFilters, setRuntimeFilters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "chart" | "both">("both");
  const [shareOpen, setShareOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Initialize
  useEffect(() => {
    if (previewConfig && previewData) {
      setConfig(previewConfig);
      setData(previewData);
    } else if (initialReportId) {
      loadReport(initialReportId, {}, true);
    }
  }, [initialReportId, previewConfig, previewData]);

  const loadReport = async (id: number, filters: any, isNewHistory = false) => {
    setLoading(true);
    setError(null);
    try {
      const configRes = await apiService.getReportConfig(id);
      if (!configRes.data)
        throw new Error(configRes.error || "Failed to load config");

      const cfg = configRes.data;
      if (typeof cfg.report?.visualization_config === "string") {
        try {
          (cfg as any).visualization = JSON.parse(
            cfg.report.visualization_config
          );
        } catch (e) {}
      } else {
        (cfg as any).visualization = cfg.report.visualization_config;
      }

      const dataRes = await apiService.runReport(id, filters);

      setConfig(cfg);
      setData(dataRes.data || { sql: "", rows: [] });
      setRuntimeFilters(filters);
      setCurrentPage(1);

      if (isNewHistory) {
        setHistory((prev) => [...prev, { id, filters, name: cfg.report.name }]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- UPDATED DRILL HANDLER ---
  const handleDrill = (rowInput: any, source: "table" | "chart") => {
    if (previewConfig) {
      alert(
        "Drill-down is disabled in Preview Mode. Save the report to test navigation."
      );
      return;
    }

    // Normalize Data (Recharts uses .payload)
    const row = rowInput.payload || rowInput;

    if (config?.drillTargets && config.drillTargets.length > 0) {
      const target = config.drillTargets[0];

      let mapping = {};
      try {
        mapping =
          typeof target.mapping_json === "string"
            ? JSON.parse(target.mapping_json)
            : target.mapping_json;
      } catch (e) {
        console.error("Invalid Drill Mapping JSON", e);
        return;
      }

      const drillFilters: any = {};
      let matchFound = false;

      // Identify the X-Axis Column (for Chart filtering)
      const xAxisCol = config.visualization?.xAxisColumn;

      Object.entries(mapping).forEach(([srcCol, targetCol]) => {
        // --- LOGIC CHANGE ---
        // If clicking a CHART, we ONLY allow filtering by the X-Axis column.
        // This prevents accidental filtering by other columns that might be in the row data.
        if (source === "chart" && srcCol !== xAxisCol) {
          return;
        }

        if (row[srcCol] !== undefined && row[srcCol] !== null) {
          drillFilters[targetCol as string] = row[srcCol];
          matchFound = true;
        }
      });

      if (matchFound) {
        loadReport(target.target_report_id, drillFilters, true);
      } else {
        if (source === "chart") {
          alert(
            `Drill failed: Could not find value for X-Axis column '${xAxisCol}' in the chart data.`
          );
        } else {
          alert("Drill failed: Mapped columns not found in this row.");
        }
      }
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === history.length - 1) return;
    const target = history[index];
    setHistory((prev) => prev.slice(0, index + 1));
    loadReport(target.id, target.filters, false);
  };

  const chartData = useMemo(() => {
    if (!data?.rows || !config?.visualization?.showChart) return [];
    const vis = config.visualization;
    const groups: Record<string, any> = {};

    data.rows.forEach((row) => {
      const key = row[vis.xAxisColumn] || "Unknown";
      if (!groups[key]) {
        groups[key] = {
          name: key,
          [vis.xAxisColumn]: key, // Ensure X-Axis key is present for drilling
          ...row, // We still spread row for Table view, but handleDrill will ignore non-X cols for charts now
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

  const paginatedRows = useMemo(() => {
    if (!data?.rows) return [];
    const start = (currentPage - 1) * PAGE_SIZE;
    return data.rows.slice(start, start + PAGE_SIZE);
  }, [data?.rows, currentPage]);

  const totalPages = data?.rows ? Math.ceil(data.rows.length / PAGE_SIZE) : 0;

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden">
      {/* FILTER SIDEBAR */}
      <div
        className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20 ${
          showFilters ? "w-72" : "w-0 overflow-hidden"
        }`}
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filters
          </h3>
          <button onClick={() => setShowFilters(false)}>
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {config?.filters?.map((f) => (
            <div key={f.column_name}>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                {f.column_name}
              </label>
              <div className="flex items-center border rounded bg-white overflow-hidden focus-within:ring-2 ring-indigo-100">
                <span className="px-2 text-xs text-slate-400 bg-slate-50 border-r py-2">
                  {f.operator || "="}
                </span>
                <input
                  className="w-full px-2 py-1.5 text-sm outline-none"
                  placeholder="Value..."
                  value={runtimeFilters[f.column_name] || ""}
                  onChange={(e) =>
                    setRuntimeFilters({
                      ...runtimeFilters,
                      [f.column_name]: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <button
            onClick={() =>
              initialReportId && loadReport(initialReportId, runtimeFilters)
            }
            disabled={!!previewConfig}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* HEADER TOOLBAR */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-4">
            {onClose && (
              <button onClick={onClose}>
                <ArrowLeft className="h-5 w-5 text-slate-500 hover:text-slate-800" />
              </button>
            )}

            {/* BREADCRUMBS */}
            <div className="flex items-center gap-1 text-sm">
              {history.map((h, idx) => (
                <React.Fragment key={idx}>
                  <button
                    onClick={() => handleBreadcrumbClick(idx)}
                    className={`hover:underline ${
                      idx === history.length - 1
                        ? "font-bold text-slate-800"
                        : "text-slate-500"
                    }`}
                  >
                    {h.name}
                  </button>
                  {idx < history.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  )}
                </React.Fragment>
              ))}
              {history.length === 0 && (
                <span className="font-bold text-slate-800">
                  {config?.report.name || "Report"}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded hover:bg-slate-100 ${
                showFilters ? "bg-indigo-50 text-indigo-600" : "text-slate-500"
              }`}
            >
              <Filter className="h-5 w-5" />
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded ${
                  viewMode === "table"
                    ? "bg-white shadow text-indigo-600"
                    : "text-slate-500"
                }`}
              >
                <TableIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("chart")}
                className={`p-1.5 rounded ${
                  viewMode === "chart"
                    ? "bg-white shadow text-indigo-600"
                    : "text-slate-500"
                }`}
              >
                <BarChart2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("both")}
                className={`p-1.5 rounded ${
                  viewMode === "both"
                    ? "bg-white shadow text-indigo-600"
                    : "text-slate-500"
                }`}
              >
                <span className="text-xs font-bold px-1">ALL</span>
              </button>
            </div>
            <button
              onClick={() => setShareOpen(true)}
              className="p-2 ml-2 text-slate-500 hover:bg-slate-100 rounded"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center h-64 text-slate-500 gap-2">
              Loading data...
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* CHART SECTION */}
              {config?.visualization?.showChart && viewMode !== "table" && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    {config.visualization.chartType === "pie" ? (
                      <PieChart>
                        <Pie
                          data={chartData}
                          dataKey={config.visualization.yAxisColumns[0]}
                          nameKey="name"
                          outerRadius={100}
                          fill="#8884d8"
                          label
                          onClick={(data) => handleDrill(data, "chart")} // PASSING 'chart'
                          cursor="pointer"
                        >
                          {chartData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    ) : (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#94a3b8" }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#94a3b8" }}
                        />
                        <Tooltip cursor={{ fill: "#f1f5f9" }} />
                        <Legend />
                        {config.visualization.yAxisColumns.map((col, i) => (
                          <Bar
                            key={col}
                            dataKey={col}
                            fill={COLORS[i % COLORS.length]}
                            radius={[4, 4, 0, 0]}
                            onClick={(data) => handleDrill(data, "chart")} // PASSING 'chart'
                            cursor="pointer"
                          />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}

              {/* TABLE SECTION */}
              {viewMode !== "chart" && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <tr>
                          {config?.columns
                            .filter((c) => c.visible)
                            .map((c) => (
                              <th
                                key={c.column_name}
                                className="px-6 py-3 font-semibold whitespace-nowrap"
                              >
                                {c.alias || c.column_name}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedRows.map((row, i) => (
                          <tr
                            key={i}
                            onClick={() => handleDrill(row, "table")} // PASSING 'table'
                            className={`hover:bg-slate-50 ${
                              config?.drillTargets?.length
                                ? "cursor-pointer"
                                : ""
                            }`}
                          >
                            {config?.columns
                              .filter((c) => c.visible)
                              .map((c) => (
                                <td
                                  key={c.column_name}
                                  className="px-6 py-3 text-slate-700"
                                >
                                  {row[c.column_name]}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* PAGINATION */}
                  <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
                      {Math.min(
                        currentPage * PAGE_SIZE,
                        data?.rows.length || 0
                      )}{" "}
                      of {data?.rows.length} rows
                    </span>
                    <div className="flex gap-1">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                        className="p-1 rounded border hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="px-2 py-1 text-sm text-slate-600">
                        Page {currentPage}
                      </span>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="p-1 rounded border hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
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

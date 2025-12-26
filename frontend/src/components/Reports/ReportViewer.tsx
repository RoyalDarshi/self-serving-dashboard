import React, { useEffect, useState } from "react";
import { apiService, FullReportConfig } from "../../services/api";
import ReportShareModal from "./ReportShareModal";
import { SqlDisplay } from "./components/SqlDisplay";
import { ChartSection } from "./components/ChartSection";
import { TableSection } from "./components/TableSection";
import { ArrowLeft, Share2, BarChart2, Table as TableIcon } from "lucide-react";

interface ReportViewerProps {
  initialReportId?: number;
  onClose?: () => void;
}

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
const PAGE_SIZE = 10;
const resolveKey = (v: string) => v?.toLowerCase().trim().replace(/\s+/g, "_");

const ReportViewer: React.FC<ReportViewerProps> = ({
  initialReportId,
  onClose,
}) => {
  const [config, setConfig] = useState<FullReportConfig | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "chart" | "both">("both");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);
  const [sql, setSql] = useState<string>("");
  const [filterInputs, setFilterInputs] = useState<Record<string, string>>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});

  useEffect(() => {
    if (initialReportId) {
      loadReport(initialReportId, {}, false);
    }
  }, [initialReportId]);

  const loadReport = async (
    reportId: number,
    filters: Record<string, any>,
    pushHistory = false
  ) => {
    try {
      setLoading(true);
      setError(null);
      const cfgRes = await apiService.getReportConfig(reportId);
      const cfg = cfgRes.data;

      // Config Normalization
      const rawViz =
        typeof cfg.report.visualization_config === "string"
          ? JSON.parse(cfg.report.visualization_config || "{}")
          : cfg.report.visualization_config || {};

      cfg.visualization = {
        chartType: rawViz.chartType || "bar",
        xAxisColumn:
          rawViz.xAxisColumn ||
          cfg.columns?.find((c: any) => c.data_type !== "number")?.column_name,
        yAxisColumns: Array.isArray(rawViz.yAxisColumns)
          ? rawViz.yAxisColumns
          : cfg.columns
              ?.filter((c: any) => c.data_type === "number")
              .map((c: any) => c.column_name),
      };

      setConfig(cfg);
      setActiveFilters(filters);
      setCurrentPage(1);

      await Promise.all([
        loadChart(reportId, filters),
        loadTable(reportId, filters, 1),
      ]);
    } catch (e: any) {
      setError(e.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const loadChart = async (reportId: number, filters: any) => {
    try {
      const res = await apiService.runReport(reportId, {
        mode: "chart",
        ...filters,
      });
      setChartData(res.data?.data || []);
      if (res.data?.sql) setSql(res.data.sql);
    } catch {
      setChartData([]);
    }
  };

  const loadTable = async (reportId: number, filters: any, page: number) => {
    try {
      const res = await apiService.runReport(reportId, {
        mode: "table",
        page,
        pageSize: PAGE_SIZE,
        ...filters,
      });
      setTableRows(res.data?.rows || []);
      if (res.data?.sql) setSql(res.data.sql);
    } catch (e) {
      console.error("Failed to load table", e);
    }
  };

  const handleDrill = (row: any) => {
    if (!config?.drillTargets?.length) return;
    const target = config.drillTargets[0];
    const mapping =
      typeof target.mapping_json === "string"
        ? JSON.parse(target.mapping_json)
        : target.mapping_json;

    const filters: any = {};
    Object.entries(mapping).forEach(([src, dest]) => {
      const key = resolveKey(src);
      if (row[key] !== undefined) {
        filters[dest] = row[key];
      }
    });
    if (Object.keys(filters).length > 0) {
      loadReport(target.target_report_id, filters, true);
    }
  };

  return (
    // FIX: Main wrapper is w-full and overflow-hidden horizontally
    <div className="flex flex-col w-full bg-slate-50 font-sans min-h-screen overflow-x-hidden">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight truncate max-w-[200px] md:max-w-md">
              {config?.report?.name || "Report Viewer"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              View and analyze your data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 rounded-md transition-all ${
              viewMode === "table"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <TableIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("chart")}
            className={`p-2 rounded-md transition-all ${
              viewMode === "chart"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("both")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === "both"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            BOTH
          </button>
        </div>
        <button
          onClick={() => setShareOpen(true)}
          className="ml-4 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* CONTENT AREA */}
      {/* FIX: min-w-0 ensures flex children don't overflow the parent container width */}
      <div className="flex flex-col flex-1 p-6 space-y-6 w-full max-w-full min-w-0">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* FILTERS */}
        {config?.filters?.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm w-full">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Filters
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              {config.filters.map((f: any) => (
                <div
                  key={f.column_name}
                  className="flex flex-col gap-1 w-full sm:w-auto"
                >
                  <label className="text-xs font-medium text-slate-700">
                    {f.column_name}
                  </label>
                  <input
                    className="border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full sm:w-48"
                    placeholder="Value..."
                    value={filterInputs[f.column_name] || ""}
                    onChange={(e) =>
                      setFilterInputs({
                        ...filterInputs,
                        [f.column_name]: e.target.value,
                      })
                    }
                  />
                </div>
              ))}
              <button
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-indigo-200"
                onClick={() => loadReport(config.report.id, filterInputs)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* SQL */}
        <div className="w-full min-w-0">
          <SqlDisplay sql={sql} />
        </div>

        {/* CHART */}
        {viewMode !== "table" && config && (
          <div className="w-full min-w-0">
            <ChartSection
              data={chartData}
              config={config}
              resolveKey={resolveKey}
              onDrill={handleDrill}
              colors={COLORS}
            />
          </div>
        )}

        {/* TABLE */}
        {viewMode !== "chart" && config && (
          // FIX: min-w-0 prevents table from blowing out width
          <div className="w-full min-w-0">
            <TableSection
              rows={tableRows}
              config={config}
              currentPage={currentPage}
              resolveKey={resolveKey}
              onPageChange={(p) => {
                setCurrentPage(p);
                loadTable(config.report.id, activeFilters, p);
              }}
              onDrill={handleDrill}
            />
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

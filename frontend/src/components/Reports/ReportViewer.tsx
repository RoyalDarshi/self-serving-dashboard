import React, { useEffect, useState } from "react";
import { apiService, FullReportConfig } from "../../services/api";
import ReportShareModal from "./ReportShareModal";
import {
  ArrowLeft,
  Share2,
  BarChart2,
  Table as TableIcon,
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
} from "recharts";

interface ReportViewerProps {
  initialReportId?: number;
  onClose?: () => void;
}

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
const PAGE_SIZE = 10;

const resolveKey = (v: string) =>
  v?.toLowerCase().trim().replace(/\s+/g, "_");

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
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  // user typing (UI only)
const [filterInputs, setFilterInputs] = useState<Record<string, string>>({});

// applied filters (sent to backend)
const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});


  // --------------------------------------------------
  // INIT
  // --------------------------------------------------
  useEffect(() => {
    if (initialReportId) {
      loadReport(initialReportId, {}, false);
    }
  }, [initialReportId]);

  // --------------------------------------------------
  // LOAD REPORT
  // --------------------------------------------------
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

      // ✅ NORMALIZE VISUALIZATION CONFIG
      const rawViz =
        typeof cfg.report.visualization_config === "string"
          ? JSON.parse(cfg.report.visualization_config || "{}")
          : cfg.report.visualization_config || {};

      cfg.visualization = {
        chartType: rawViz.chartType || "bar",
        xAxisColumn:
          rawViz.xAxisColumn ||
          cfg.columns?.find((c: any) => c.data_type !== "number")
            ?.column_name,
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

  // --------------------------------------------------
  // LOAD CHART
  // --------------------------------------------------
  const loadChart = async (reportId: number, filters: any) => {
    try {
      const res = await apiService.runReport(reportId, {
        mode: "chart",
        ...filters,
      });
      setChartData(res.data?.data || []);
    } catch {
      setChartData([]);
    }
  };

  // --------------------------------------------------
  // LOAD TABLE
  // --------------------------------------------------
  const loadTable = async (
    reportId: number,
    filters: any,
    page: number
  ) => {
    const res = await apiService.runReport(reportId, {
      mode: "table",
      page,
      pageSize: PAGE_SIZE,
      ...filters,
    });
    setTableRows(res.data?.rows || []);
  };

  // --------------------------------------------------
  // DRILL HANDLER
  // --------------------------------------------------
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

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  const xKey = config?.visualization?.xAxisColumn
    ? resolveKey(config.visualization.xAxisColumn)
    : undefined;

  return (
    <div className="flex h-full bg-slate-50">
      <div className="flex-1 flex flex-col">
        {/* HEADER */}
        <div className="bg-white border-b px-6 py-3 flex justify-between">
          <div className="flex items-center gap-2">
            {onClose && (
              <button onClick={onClose}>
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <span className="font-semibold">
              {config?.report?.name || "Report"}
            </span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setViewMode("table")}>
              <TableIcon />
            </button>
            <button onClick={() => setViewMode("chart")}>
              <BarChart2 />
            </button>
            <button onClick={() => setViewMode("both")}>ALL</button>
            <button onClick={() => setShareOpen(true)}>
              <Share2 />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6 overflow-auto">
          {loading && <div>Loading...</div>}
          {error && <div className="text-red-600">{error}</div>}

          {/* ===================== CHART ===================== */}

          {config?.filters?.length > 0 && (
            <div className="bg-white border rounded p-4 space-y-3">
              <div className="font-semibold text-sm">Filters</div>

              <div className="grid grid-cols-4 gap-3">
                {config.filters.map((f: any) => (
                  <input
                    key={f.column_name}
                    className="border px-2 py-1 rounded text-sm"
                    placeholder={f.column_name}
                    value={filterInputs[f.column_name] || ""}
                    onChange={(e) =>
                      setFilterInputs({
                        ...filterInputs,
                        [f.column_name]: e.target.value,
                      })
                    }
                  />
                ))}
              </div>

              <button
                className="px-4 py-1 bg-indigo-600 text-white rounded text-sm"
                onClick={() => {
                  setAppliedFilters(filterInputs);
                  loadReport(config.report.id, filterInputs);
                }}
              >
                Apply Filters
              </button>
            </div>
          )}

          {viewMode !== "table" &&
            chartData.length > 0 &&
            xKey &&
            config?.visualization?.yAxisColumns?.length > 0 && (
              <div className="bg-white h-96 p-4 rounded border">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={xKey} />
                    <YAxis />
                    <Tooltip />
                    <Legend />

                    {config.visualization.yAxisColumns.map(
                      (col: string, i: number) => (
                        <Bar
                          key={col}
                          dataKey={resolveKey(col)}
                          fill={COLORS[i % COLORS.length]}
                          onClick={(d) => handleDrill(d.payload)}
                          cursor="pointer"
                        />
                      )
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

          {/* ===================== TABLE ===================== */}
          {viewMode !== "chart" && (
            <div className="bg-white border rounded">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {config?.columns
                      ?.filter((c) => c.visible)
                      .map((c) => (
                        <th key={c.column_name} className="p-2 text-left">
                          {c.alias || c.column_name}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr
                      key={i}
                      onClick={() => handleDrill(row)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      {config?.columns
                        ?.filter((c) => c.visible)
                        .map((c) => (
                          <td key={c.column_name} className="p-2">
                            {row[resolveKey(c.column_name)] ?? ""}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between px-4 py-3 border-t bg-slate-50">
                <span>Page {currentPage}</span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => {
                      const p = currentPage - 1;
                      setCurrentPage(p);
                      loadTable(config!.report.id, activeFilters, p);
                    }}
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    onClick={() => {
                      const p = currentPage + 1;
                      setCurrentPage(p);
                      loadTable(config!.report.id, activeFilters, p);
                    }}
                  >
                    <ChevronRight />
                  </button>
                </div>
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

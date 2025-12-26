import React, { useEffect, useState, useMemo } from "react";
import { FullReportConfig } from "../../services/api";
import { apiService } from "../../services/api";
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

const COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

const PAGE_SIZE = 10;

type DrillHistoryItem = {
  reportId: number;
  filters: Record<string, any>;
  name: string;
};

const ReportViewer: React.FC<ReportViewerProps> = ({
  initialReportId,
  onClose,
}) => {
  const [config, setConfig] = useState<FullReportConfig | null>(null);

  const [chartData, setChartData] = useState<any[]>([]);
  const [tableRows, setTableRows] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"table" | "chart" | "both">("both");
  const [chartKey, setChartKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);

  const [history, setHistory] = useState<DrillHistoryItem[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});

  // ---------- helpers ----------
  const resolveKey = (label: string) =>
    label.toLowerCase().trim().replace(/\s+/g, "_");

  // ---------- init ----------
  useEffect(() => {
    if (initialReportId) {
      loadReport(initialReportId, {}, true);
    }
  }, [initialReportId]);

  // ---------- main loader ----------
  const loadReport = async (
    reportId: number,
    filters: Record<string, any>,
    pushHistory = false
  ) => {
    setLoading(true);
    setError(null);

    try {
      const cfgRes = await apiService.getReportConfig(reportId);
      const cfg = cfgRes.data;

      cfg.visualization =
        typeof cfg.report.visualization_config === "string"
          ? JSON.parse(cfg.report.visualization_config)
          : cfg.report.visualization_config;

      if (pushHistory && config) {
        setHistory((prev) => [
          ...prev,
          { reportId, filters, name: cfg.report.name },
        ]);
      }

      setConfig(cfg);
      setActiveFilters(filters);
      setCurrentPage(1);

      await Promise.all([
        loadChart(reportId, filters),
        loadTable(reportId, filters, 1),
      ]);
    } catch (e: any) {
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  // ---------- chart ----------
  const loadChart = async (
    reportId: number,
    filters: Record<string, any>
  ) => {
    const res = await apiService.runReport(reportId, {
      mode: "chart",
      ...filters,
    });
    setChartData(res.data.data || []);
    setChartKey((k) => k + 1);
  };

  // ---------- table ----------
  const loadTable = async (
    reportId: number,
    filters: Record<string, any>,
    page: number
  ) => {
    const res = await apiService.runReport(reportId, {
      mode: "table",
      page,
      pageSize: PAGE_SIZE,
      ...filters,
    });
    setTableRows(res.data.rows || []);
  };

  // ---------- drill ----------
  const handleDrill = (payload: any, source: "chart" | "table") => {
    if (!config?.drillTargets?.length) return;

    const drillTarget = config.drillTargets[0];
    let mapping: Record<string, string> = {};

    try {
      mapping =
        typeof drillTarget.mapping_json === "string"
          ? JSON.parse(drillTarget.mapping_json)
          : drillTarget.mapping_json;
    } catch {
      return;
    }

    const drillFilters: Record<string, any> = {};
    let matched = false;

    if (source === "chart") {
      const xVal = payload?.name ?? payload?.payload?.name;
      const mapEntry = Object.entries(mapping)[0];
      if (mapEntry && xVal !== undefined) {
        drillFilters[mapEntry[1]] = xVal;
        matched = true;
      }
    } else {
      Object.entries(mapping).forEach(([src, target]) => {
        const key = resolveKey(src);
        if (payload[key] !== undefined) {
          drillFilters[target] = payload[key];
          matched = true;
        }
      });
    }

    if (matched) {
      loadReport(drillTarget.target_report_id, drillFilters, true);
    }
  };

  // ---------- breadcrumbs ----------
  const handleBreadcrumbClick = (index: number) => {
    const item = history[index];
    setHistory(history.slice(0, index));
    loadReport(item.reportId, item.filters, false);
  };

  // ---------- render ----------
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

            <div className="flex items-center gap-1 text-sm">
              {history.map((h, i) => (
                <React.Fragment key={i}>
                  <button
                    className="text-indigo-600 hover:underline"
                    onClick={() => handleBreadcrumbClick(i)}
                  >
                    {h.name}
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </React.Fragment>
              ))}
              <span className="font-bold">
                {config?.report.name || "Report"}
              </span>
            </div>
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

        {/* CONTENT */}
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          {loading && <div>Loading...</div>}
          {error && <div className="text-red-600">{error}</div>}

          {/* CHART */}
          {viewMode !== "table" && chartData.length > 0 && (
            <div className="bg-white h-80 p-4 rounded border">
              <ResponsiveContainer key={chartKey} width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {config?.visualization.yAxisColumns.map((col, i) => (
                    <Bar
                      key={col}
                      dataKey={resolveKey(col)}
                      fill={COLORS[i % COLORS.length]}
                      onClick={(d) => handleDrill(d, "chart")}
                      cursor="pointer"
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* TABLE */}
          {viewMode !== "chart" && (
            <div className="bg-white border rounded">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {config?.columns
                      .filter((c) => c.visible)
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
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => handleDrill(row, "table")}
                    >
                      {config?.columns
                        .filter((c) => c.visible)
                        .map((c) => (
                          <td key={c.column_name} className="p-2">
                            {row[resolveKey(c.column_name)] ?? ""}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* PAGINATION */}
              <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
                <div className="text-sm text-slate-600">
                  Page {currentPage}
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => {
                      const p = currentPage - 1;
                      setCurrentPage(p);
                      loadTable(
                        config!.report.id,
                        activeFilters,
                        p
                      );
                    }}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      const p = currentPage + 1;
                      setCurrentPage(p);
                      loadTable(
                        config!.report.id,
                        activeFilters,
                        p
                      );
                    }}
                    className="px-3 py-1 border rounded"
                  >
                    <ChevronRight className="w-4 h-4" />
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

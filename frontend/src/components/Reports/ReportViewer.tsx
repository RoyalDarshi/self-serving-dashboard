import React, { useEffect, useState } from "react";
import { apiService, FullReportConfig } from "../../services/api";
import ReportShareModal from "./ReportShareModal";
// import { SqlDisplay } from "./components/SqlDisplay"; // (Uncomment if needed)
import { ChartSection } from "./components/ChartSection";
import { TableSection } from "./components/TableSection";
import {
  ArrowLeft,
  Share2,
  BarChart2,
  Table as TableIcon,
  Download, // 🔥 NEW IMPORT
} from "lucide-react";
import TemplateRenderer from "./components/TemplateRenderer";

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

  const templateType = config?.report?.template_type || null;
  const template =
    typeof config?.report?.template_json === "string"
      ? JSON.parse(config.report.template_json)
      : config?.report?.template_json;

  // 🔥 NEW: Handle Printing/Downloading
  const handleDownload = () => {
    window.print(); // Triggers browser "Save as PDF" dialog
  };

  useEffect(() => {
    if (initialReportId) {
      loadReport(initialReportId, {}, false, true);
    }
  }, [initialReportId]);

  const loadReport = async (
    reportId: number,
    filters: Record<string, any>,
    pushHistory = false,
    autoRun = true
  ) => {
    try {
      setLoading(true);
      setError(null);

      const cfgRes = await apiService.getReportConfig(reportId);
      const cfg = cfgRes.data;

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

      if (autoRun && !hasMissingMandatoryFilters(cfg, filters)) {
        await Promise.all([
          loadChart(reportId, filters),
          loadTable(reportId, filters, 1),
        ]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const hasMissingMandatoryFilters = (cfg = config, inputs = filterInputs) => {
    if (!cfg?.filters) return false;
    return cfg.filters.some(
      (f: any) =>
        f.is_mandatory &&
        (inputs[f.column_name] === undefined || inputs[f.column_name] === "")
    );
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
    <div className="flex flex-col w-full bg-slate-50 font-sans min-h-screen overflow-x-hidden">
      {/* 🔥 CSS FOR PRINTING ONLY THE TEMPLATE */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #template-container, #template-container * {
            visibility: visible;
          }
          #template-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white;
            border: none;
            box-shadow: none;
          }
          /* Hide headers/footers browser might add */
          @page {
            margin: 0.5cm; 
          }
        }
      `}</style>

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-30 print:hidden">
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

        <div className="flex items-center gap-2">
          {/* 🔥 DOWNLOAD BUTTON (Only shows if template exists) */}
          {templateType && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm mr-2"
              title="Download Template PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}

          {!templateType && (
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
          )}

          <button
            onClick={() => setShareOpen(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex flex-col flex-1 p-6 space-y-6 w-full max-w-full min-w-0 print:p-0">
        {loading && (
          <div className="flex items-center justify-center py-10 print:hidden">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm print:hidden">
            {error}
          </div>
        )}

        {/* FILTERS (Hidden during print) */}
        {config?.filters?.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm w-full print:hidden">
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
                disabled={hasMissingMandatoryFilters()}
                className={`px-5 py-2 rounded-lg text-sm font-medium ${
                  hasMissingMandatoryFilters()
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
                onClick={() => loadReport(config.report.id, filterInputs)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {hasMissingMandatoryFilters() && (
          <div className="p-6 bg-yellow-50 border border-yellow-300 rounded-xl print:hidden">
            <h3 className="font-bold text-yellow-800 mb-2">Filters Required</h3>
            <p className="text-sm text-yellow-700">
              Please fill all mandatory filters to view this report.
            </p>
          </div>
        )}

        {/* ================= TEMPLATE RENDERING ================= */}

        {/* 🔥 WRAPPER DIV WITH ID FOR PRINTING */}
        <div id="template-container">
          {(templateType === "MARKSHEET" || template?.sections?.length) &&
            !hasMissingMandatoryFilters() && (
              <TemplateRenderer rows={tableRows} template={template} />
            )}
        </div>

        {/* ================= NORMAL REPORT ================= */}
        {!templateType && (
          <>
            {viewMode !== "table" &&
              config &&
              !hasMissingMandatoryFilters() && (
                <div className="w-full min-w-0 print:hidden">
                  <ChartSection
                    data={chartData}
                    config={config}
                    resolveKey={resolveKey}
                    onDrill={handleDrill}
                    colors={COLORS}
                  />
                </div>
              )}

            {viewMode !== "chart" &&
              config &&
              !hasMissingMandatoryFilters() && (
                <div className="print:hidden">
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
          </>
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

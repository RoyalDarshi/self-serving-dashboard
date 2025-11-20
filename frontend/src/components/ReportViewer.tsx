// src/components/ReportViewer.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  FullReportConfig,
  RunReportResponse,
  ReportDrillConfig,
} from "../services/api";
import { apiService } from "../services/api";
import ReportFilters from "./ReportFilters";
import { ArrowLeft, ArrowRight, Share2, Download } from "lucide-react";
import ReportShareModal from "./ReportShareModal";

interface ReportViewerProps {
  initialReportId: number;
  onClose?: () => void;
}

interface HistoryEntry {
  reportId: number;
  filters: Record<string, any>;
}

const ReportViewer: React.FC<ReportViewerProps> = ({
  initialReportId,
  onClose,
}) => {
  const [config, setConfig] = useState<FullReportConfig | null>(null);
  const [data, setData] = useState<RunReportResponse | null>(null);
  const [runtimeFilters, setRuntimeFilters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [shareOpen, setShareOpen] = useState(false);

    const currentReportId = config?.report?.id ?? initialReportId;
    console.log("Current Report ID:", currentReportId);

  const loadReport = useCallback(
    async (reportId: number, filters: Record<string, any> = {}) => {
      setLoading(true);
      try {
        const cfg = await apiService.getReportConfig(reportId);
        setConfig(cfg);
        setRuntimeFilters(filters);
          const result = await apiService.runReport(reportId, filters);
          console.log("Report Data:", result);
        setData(result.data);
      } catch (err: any) {
        console.error("Error loading report:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadReport(initialReportId);
    setHistory([{ reportId: initialReportId, filters: {} }]);
  }, [initialReportId, loadReport]);

  const handleFilterChange = async (col: string, val: any) => {
    const newFilters = { ...runtimeFilters, [col]: val };
    setRuntimeFilters(newFilters);
    if (currentReportId) {
      const result = await apiService.runReport(currentReportId, newFilters);
      setData(result);
    }
  };

  const handleRowClick = async (row: Record<string, any>) => {
    if (!config) return;
    const drillConfigs: ReportDrillConfig[] =
      await apiService.getReportDrillConfig(config.report.id);

    if (!drillConfigs || drillConfigs.length === 0) return;

    // Take the first drill config for now
    const drill = drillConfigs[0];
    const mapping = JSON.parse(drill.mapping_json) as Record<string, string>;
    const drillFilters: Record<string, any> = {};

    Object.entries(mapping).forEach(([sourceCol, targetCol]) => {
      if (row[sourceCol] != null) {
        drillFilters[targetCol] = row[sourceCol];
      }
    });

    setHistory((prev) => [
      ...prev,
      { reportId: drill.target_report_id, filters: drillFilters },
    ]);
    await loadReport(drill.target_report_id, drillFilters);
  };

  const handleBack = async () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop();
    const last = newHistory[newHistory.length - 1];
    setHistory(newHistory);
    await loadReport(last.reportId, last.filters);
  };

  const handleExportCSV = () => {
    if (!data || !data.rows || data.rows.length === 0) return;
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
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-100 text-slate-600"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-slate-900">
              {config?.report?.name || "Report"}
            </h2>
            <p className="text-xs text-slate-500">
              {config?.report?.base_table}{" "}
              {history.length > 1 && (
                <span className="ml-2 text-[11px] text-indigo-500">
                  Drill level {history.length}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 1 && (
            <button
              onClick={handleBack}
              className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center gap-1"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center gap-1"
          >
            <Share2 className="h-3 w-3" />
            Share
          </button>
        </div>
      </div>

      {/* Filters */}
      {config && (
        <ReportFilters
          filters={config.filters}
          runtimeFilters={runtimeFilters}
          onChange={handleFilterChange}
        />
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        {loading && <div className="text-sm text-slate-500">Loading...</div>}
        {!loading && data && data.rows && data.rows.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  {Object.keys(data.rows[0]).map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left text-xs font-semibold text-slate-700"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-indigo-50 cursor-pointer"
                    onClick={() => handleRowClick(row)}
                  >
                    {Object.entries(row).map(([col, value]) => (
                      <td
                        key={col}
                        className="px-3 py-2 border-t border-slate-100 text-[13px] text-slate-700"
                      >
                        {String(value ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (!data || !data.rows || data.rows.length === 0) && (
          <div className="text-sm text-slate-500">
            No data found for current filters.
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

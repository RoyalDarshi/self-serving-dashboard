// src/components/ReportList.tsx
import React, { useEffect, useState } from "react";
import { ReportDefinition } from "../services/api";
import { apiService } from "../services/api";
import { FileText, Plus, Trash2, ChevronRight, RefreshCw } from "lucide-react";

interface Props {
  onOpenReport: (reportId: number) => void;
  onCreateNew: () => void;
}

const ReportList: React.FC<Props> = ({ onOpenReport, onCreateNew }) => {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiService.getReports();
      setReports(data);
    } catch (err) {
      console.error("Error loading reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this report?")) return;
    const res = await apiService.deleteReport(id);
    if (res.success) {
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Report
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 grid gap-3">
        {loading && (
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading reports...
          </div>
        )}
        {!loading && reports.length === 0 && (
          <div className="text-sm text-slate-500">
            No reports yet. Click "New Report" to create one.
          </div>
        )}
        {reports.map((r) => (
          <div
            key={r.id}
            className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-500" />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {r.name}
                </div>
                <div className="text-[11px] text-slate-500">
                  {r.base_table} • {r.connection_id}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDelete(r.id)}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onOpenReport(r.id)}
                className="p-1 text-slate-600 hover:bg-slate-100 rounded"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportList;

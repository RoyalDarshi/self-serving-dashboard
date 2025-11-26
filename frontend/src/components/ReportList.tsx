import React, { useEffect, useState } from "react";
import { ReportDefinition } from "../services/api";
import { apiService } from "../services/api";
import {
  FileText,
  Plus,
  Trash2,
  Search,
  PieChart,
  MoreVertical,
  Calendar,
} from "lucide-react";

interface Props {
  onOpenReport: (reportId: number) => void;
  onCreateNew: () => void;
}

const ReportList: React.FC<Props> = ({ onOpenReport, onCreateNew }) => {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

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

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm("Delete this report?")) return;
    const res = await apiService.deleteReport(id);
    if (res.success) {
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const filteredReports = reports.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Modern Header with Search */}
      <div className="px-8 py-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
            Dashboard
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage your analytics and reports
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative group flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
            />
          </div>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-indigo-200 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create Report
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-auto p-8">
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-pulse">
            <div className="h-8 w-8 bg-slate-200 rounded-full mb-3"></div>
            <p>Loading your workspace...</p>
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-indigo-500" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">
              No reports created yet
            </h3>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              Get started by creating your first data visualization.
            </p>
            <button
              onClick={onCreateNew}
              className="text-indigo-600 font-medium hover:underline"
            >
              Create New Report
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredReports.map((r) => (
            <div
              key={r.id}
              onClick={() => onOpenReport(r.id)}
              className="group bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:shadow-lg hover:shadow-slate-200/50 hover:border-indigo-200 transition-all duration-300 relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <div
                  className={`p-3 rounded-lg ${
                    // Random-ish styling based on ID for variety
                    r.id % 2 === 0
                      ? "bg-blue-50 text-blue-600"
                      : "bg-purple-50 text-purple-600"
                  }`}
                >
                  {r.id % 2 === 0 ? (
                    <FileText className="h-6 w-6" />
                  ) : (
                    <PieChart className="h-6 w-6" />
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(e, r.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors truncate">
                {r.name}
              </h3>
              <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date().toLocaleDateString()} {/* Placeholder date */}
              </p>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="bg-slate-100 px-2 py-1 rounded">
                  {r.base_table}
                </span>
                <span>ID: {r.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportList;

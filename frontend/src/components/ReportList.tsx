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
  Edit2,
} from "lucide-react";

interface Props {
  onOpenReport: (reportId: number) => void;
  onCreateNew: () => void;
  // If your layout supports editing, you would pass this. I'll mock the UI for it.
  onEditReport?: (reportId: number) => void;
}

const ReportList: React.FC<Props> = ({
  onOpenReport,
  onCreateNew,
  onEditReport,
}) => {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiService.getReports();
      setReports(data);
    } catch (err) {
      console.error(err);
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
    if (res.success) setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const filtered = reports.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-8 py-6 bg-white border-b border-slate-100 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-slate-500 text-sm">Manage your analytics</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm focus:ring-2 ring-indigo-100 outline-none"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>
      </div>

      <div className="p-8 overflow-auto">
        {loading && (
          <div className="text-center text-slate-400 py-10">
            Loading reports...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((r) => (
            <div
              key={r.id}
              onClick={() => onOpenReport(r.id)}
              className="group bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:shadow-lg hover:border-indigo-200 transition-all relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div
                  className={`p-3 rounded-lg ${
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
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditReport?.(r.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, r.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 truncate">
                {r.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Source: {r.base_table}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportList;

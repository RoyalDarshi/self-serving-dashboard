import React, { useEffect, useState } from "react";
import { ReportDefinition, apiService } from "../../services/api";
import {
  FileText,
  Plus,
  Trash2,
  Search,
  PieChart,
  Edit,
  BarChart3,
  Loader2
} from "lucide-react";

interface Props {
  onOpenReport: (reportId: number) => void;
  onCreateNew: () => void;
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
    if (!window.confirm("Are you sure you want to delete this report?")) return;
    
    // Optimistic update
    setReports((prev) => prev.filter((r) => r.id !== id));
    
    try {
        await apiService.deleteReport(id);
    } catch(err) {
        alert("Failed to delete");
        load(); // Revert on fail
    }
  };

  const filtered = reports.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      {/* Header */}
      <div className="px-10 py-8 bg-white border-b border-slate-200 flex justify-between items-end shadow-sm z-10">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Analytics Dashboard</h2>
          <p className="text-slate-500 mt-2 font-medium">Manage and organize your data reports</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              className="w-64 pl-10 pr-4 py-2.5 bg-slate-100 border border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 rounded-xl text-sm outline-none transition-all"
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-xl transition-all active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[3]" /> New Report
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-10">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
            <span className="text-sm font-medium">Loading your reports...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center pb-20">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <BarChart3 className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">No Reports Found</h3>
            <p className="text-slate-500 max-w-xs mx-auto mb-6">
                {search ? "Try adjusting your search terms." : "Get started by creating your first analytics report."}
            </p>
            {!search && (
                <button
                    onClick={onCreateNew}
                    className="text-indigo-600 font-bold hover:underline"
                >
                    Create a Report now
                </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((r) => {
                // Determine icon style based on report type/id
                const isChart = r.visualization_config && r.visualization_config.includes("showChart");
                const Icon = isChart ? PieChart : FileText;
                
                return (
                    <div
                    key={r.id}
                    onClick={() => onOpenReport(r.id)}
                    className="group bg-white rounded-2xl border border-slate-200 p-6 cursor-pointer hover:border-indigo-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all relative flex flex-col h-48"
                    >
                    <div className="flex justify-between items-start mb-4">
                        <div
                        className={`p-3.5 rounded-xl transition-colors ${
                            isChart
                            ? "bg-purple-50 text-purple-600 group-hover:bg-purple-100"
                            : "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
                        }`}
                        >
                            <Icon className="h-6 w-6" />
                        </div>
                        
                        {/* Action Buttons (Visible on Hover) */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-200">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEditReport?.(r.id);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Report"
                        >
                            <Edit className="h-4 w-4" />
                        </button>
                        <button
                            onClick={(e) => handleDelete(e, r.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Report"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                        </div>
                    </div>
                    
                    <div className="mt-auto">
                        <h3 className="font-bold text-lg text-slate-800 mb-1 line-clamp-1 group-hover:text-indigo-700 transition-colors">
                            {r.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                {r.base_table || "Custom SQL"}
                            </span>
                            <span>•</span>
                            <span>{new Date(r.updated_at || "").toLocaleDateString()}</span>
                        </div>
                    </div>
                    </div>
                );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportList;
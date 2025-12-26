import React from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { FullReportConfig } from "../../../services/api";

interface TableSectionProps {
  rows: any[];
  config: FullReportConfig;
  currentPage: number;
  resolveKey: (key: string) => string;
  onPageChange: (newPage: number) => void;
  onDrill?: (row: any) => void;
}

export const TableSection: React.FC<TableSectionProps> = ({
  rows,
  config,
  currentPage,
  resolveKey,
  onPageChange,
  onDrill,
}) => {
  const visibleColumns = config.columns?.filter((c) => c.visible) || [];

  return (
    // FIX: w-full and max-w-full ensures it doesn't exceed parent width
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col w-full max-w-full">
      {/* Scrollable Container */}
      <div className="overflow-x-auto custom-scrollbar w-full">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c.column_name}
                  className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                >
                  <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
                    {c.alias || c.column_name}
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr
                key={i}
                onClick={() => onDrill && onDrill(row)}
                className={`hover:bg-slate-50 transition-colors ${
                  onDrill ? "cursor-pointer" : ""
                }`}
              >
                {visibleColumns.map((c) => (
                  <td
                    key={c.column_name}
                    className="px-6 py-3.5 text-slate-600 whitespace-nowrap"
                  >
                    {row[resolveKey(c.column_name)] ?? (
                      <span className="text-slate-300 italic">null</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-6 py-8 text-center text-slate-400 italic"
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
        <span className="text-xs font-medium text-slate-500">
          Page {currentPage}
        </span>
        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="p-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            className="p-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 shadow-sm transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

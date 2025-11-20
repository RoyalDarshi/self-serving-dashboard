// src/components/ReportFilters.tsx
import React from "react";
import { ReportFilter } from "../services/api";

interface ReportFiltersProps {
  filters: ReportFilter[];
  runtimeFilters: Record<string, any>;
  onChange: (col: string, value: any) => void;
}

const ReportFilters: React.FC<ReportFiltersProps> = ({
  filters,
  runtimeFilters,
  onChange,
}) => {
  if (!filters || filters.length === 0) return null;

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap gap-4">
      {filters.map((f) => (
        <div key={f.id || f.column_name} className="flex flex-col">
          <label className="text-xs font-medium text-slate-600 mb-1">
            {f.column_name}
          </label>
          <input
            className="px-2 py-1 rounded border border-slate-300 text-sm"
            value={runtimeFilters[f.column_name] ?? ""}
            onChange={(e) => onChange(f.column_name, e.target.value)}
            placeholder={f.operator ? `Operator: ${f.operator}` : ""}
          />
        </div>
      ))}
    </div>
  );
};

export default ReportFilters;

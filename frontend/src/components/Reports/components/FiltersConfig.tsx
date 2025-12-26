import React from "react";
import { Filter } from "lucide-react";
import { ReportFilter } from "../../../services/api";
import { DragItem } from "../types";
import { Shelf } from "./Shelf";

interface FiltersConfigProps {
    filters: ReportFilter[];
    setFilters: (filters: ReportFilter[]) => void;
    handleDropFilter: (item: DragItem) => void;
}

export const FiltersConfig: React.FC<FiltersConfigProps> = ({
    filters,
    setFilters,
    handleDropFilter,
}) => {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-white to-amber-50/30 round-t-xl">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Filter className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Filters</h3>
          <span className="text-xs text-slate-500 ml-auto font-medium">
            {filters.length} active
          </span>
        </div>
        <div className="p-6 space-y-5">
          <Shelf
            title="Active Filters"
            icon={Filter}
            placeholder="Drag fields here to filter your data"
            items={filters.map((f, i) => ({
              id: String(i),
              name: f.column_name,
              type: "string",
              alias: `${f.operator} ${f.value || "?"}`,
            }))}
            accepts={["any"]}
            onDrop={handleDropFilter}
            onRemove={(i) => setFilters(filters.filter((_, idx) => idx !== i))}
            onUpdate={(i, u) => {
              const n = [...filters];
              n[i] = {
                ...n[i],
                column_name: u.name || n[i].column_name,
              };
              setFilters(n);
            }}
          />
          ;
          {filters.map((f, i) => (
            <div
              key={i}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
            >
              <div className="text-sm font-semibold text-slate-700">
                {f.column_name}
              </div>

              <div className="flex items-center gap-6">
                {/* Mandatory Toggle */}
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={!!f.is_mandatory}
                    onChange={(e) => {
                      const n = [...filters];
                      n[i] = {
                        ...n[i],
                        is_mandatory: e.target.checked,
                      };
                      setFilters(n);
                    }}
                  />
                  Mandatory
                </label>

                {/* Operator */}
                <select
                  value={f.operator}
                  onChange={(e) => {
                    const n = [...filters];
                    n[i] = { ...n[i], operator: e.target.value };
                    setFilters(n);
                  }}
                  className="border border-slate-300 rounded px-2 py-1 text-xs"
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value="LIKE">LIKE</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
};

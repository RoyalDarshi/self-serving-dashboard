import { ConfigItem } from "../types";
import { Check } from "lucide-react";

interface ProgressIndicatorProps {
  mode: "TABLE" | "SEMANTIC" | "SQL";
  baseTable: string;
  tableColumns: ConfigItem[];
  name: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  mode,
  baseTable,
  tableColumns,
  name,
}) => {
  const isStep1Done =
    (mode === "TABLE" && !!baseTable) ||
    (mode === "SEMANTIC" && tableColumns.length > 0) ||
    mode === "SQL"; // SQL has no data source step

  const isStep2Done = mode === "SQL" || tableColumns.length > 0;

  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
          isStep1Done
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        <Check className="w-3 h-3" />
        {mode === "SQL"
          ? "SQL Ready"
          : mode === "TABLE"
          ? "Data Source"
          : "Facts & Dimensions"}
      </div>

      <div className="h-px flex-1 bg-slate-200" />

      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
          isStep2Done
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        <Check className="w-3 h-3" />
        Columns
      </div>

      <div className="h-px flex-1 bg-slate-200" />

      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
          name.trim()
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        <Check className="w-3 h-3" />
        Ready
      </div>
    </div>
  );
};

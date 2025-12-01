import React from "react";
import { Check } from "lucide-react";
import { ConfigItem } from "../types";

interface ProgressIndicatorProps {
    mode: "TABLE" | "SEMANTIC";
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
    return (
        <div className="flex items-center gap-2 mb-2">
            <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${(mode === "TABLE" && baseTable) ||
                    (mode === "SEMANTIC" && tableColumns.length > 0)
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                    }`}
            >
                {((mode === "TABLE" && baseTable) ||
                    (mode === "SEMANTIC" && tableColumns.length > 0)) ? (
                    <Check className="w-3 h-3" />
                ) : (
                    <div className="w-3 h-3 rounded-full border-2 border-current" />
                )}
                {mode === "TABLE" ? "Data Source" : "Facts & Dimensions"}
            </div>
            <div className="h-px flex-1 bg-slate-200" />
            <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${tableColumns.length > 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                    }`}
            >
                {tableColumns.length > 0 ? (
                    <Check className="w-3 h-3" />
                ) : (
                    <div className="w-3 h-3 rounded-full border-2 border-current" />
                )}
                Columns
            </div>
            <div className="h-px flex-1 bg-slate-200" />
            <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${name.trim()
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                    }`}
            >
                {name.trim() ? (
                    <Check className="w-3 h-3" />
                ) : (
                    <div className="w-3 h-3 rounded-full border-2 border-current" />
                )}
                Ready
            </div>
        </div>
    );
};

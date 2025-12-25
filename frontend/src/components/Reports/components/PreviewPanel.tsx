import React from "react";
import { Sparkles, Check, X } from "lucide-react";
import { FullReportConfig } from "../../../services/api";
import ReportViewer from "../ReportViewer";

interface PreviewPanelProps {
  previewData: { sql: string; rows: any[] } | null;
  isLoadingPreview: boolean;
  previewConfig: FullReportConfig | null;
  message: { type: "success" | "error"; text: string } | null;

  // 🔥 ADD THIS
  disablePointerEvents?: boolean;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  previewData,
  isLoadingPreview,
  previewConfig,
  message,
  disablePointerEvents,
}) => {
  if (isLoadingPreview) {
    return (
      <div className="p-4 text-sm text-slate-500">Running preview query...</div>
    );
  }

  // ----------------------------
  // 2️⃣ NO DATA YET
  // ----------------------------
  if (!previewData) {
    return (
      <div className="p-4 text-sm text-slate-400">
        No preview data available.
      </div>
    );
  }
  const rows = Array.isArray(previewData.rows) ? previewData.rows : [];

  return (
    <div className="w-[30%] bg-white border-l border-slate-200 flex flex-col z-10 shadow-xl pointer-events-none">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
          Live Preview
        </h3>
        {previewData && (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">
            {rows.length} rows
          </span>
        )}
      </div>
      <div className="flex-1 overflow-hidden relative bg-slate-50">
        {isLoadingPreview ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold text-indigo-600 animate-pulse">
              Running Query...
            </p>
          </div>
        ) : previewData ? (
          <div className="h-full overflow-auto">
            <ReportViewer
              previewConfig={previewConfig!}
              previewData={{ ...previewData, rows }}
            />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">
              Ready to Preview
            </p>
            <p className="text-xs max-w-[200px]">
              Configure your report columns and filters, then click "Run Query"
              to see the results here.
            </p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {message && (
        <div
          className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium animate-in slide-in-from-bottom-5 fade-in duration-300 z-50 ${
            message.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {message.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
          {message.text}
        </div>
      )}
    </div>
  );
};

import React from "react";
import { Sparkles, CheckCircle2, AlertCircle, X } from "lucide-react";
import { FullReportConfig } from "../../../services/api";
import ReportViewer from "../ReportViewer";

interface PreviewPanelProps {
  previewData: { sql: string; rows: any[] } | null;
  isLoadingPreview: boolean;
  previewConfig: FullReportConfig | null;
  message: { type: "success" | "error"; text: string } | null;
  disablePointerEvents?: boolean;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  previewData,
  isLoadingPreview,
  previewConfig,
  message,
}) => {
  const rows = Array.isArray(previewData?.rows) ? previewData!.rows : [];

  return (
    <>
      <div className="w-[35%] bg-white/80 backdrop-blur-xl border-l border-zinc-200 flex flex-col z-20 shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] transition-all duration-300">
        
        {/* Header */}
        <div className="h-16 px-6 border-b border-zinc-100 flex items-center justify-between bg-white/50">
          <h3 className="text-xs font-extrabold text-zinc-500 uppercase tracking-widest">
            Live Preview
          </h3>
          {previewData && (
            <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-full font-bold shadow-sm">
              {rows.length} Results
            </span>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-zinc-50/50">
          {isLoadingPreview ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-30">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                </div>
              </div>
              <p className="mt-4 text-xs font-bold text-indigo-600 uppercase tracking-wide animate-pulse">
                Executing Query...
              </p>
            </div>
          ) : previewData ? (
            <div className="h-full overflow-auto p-4">
              <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden h-full">
                 <ReportViewer
                    previewConfig={previewConfig!}
                    previewData={{ ...previewData, rows }}
                  />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-tr from-zinc-100 to-white border border-zinc-200 rounded-2xl flex items-center justify-center mb-6 shadow-sm rotate-3">
                <Sparkles className="w-8 h-8 text-zinc-300" />
              </div>
              <h4 className="text-base font-semibold text-zinc-800 mb-2">
                Waiting for Data
              </h4>
              <p className="text-sm text-zinc-500 max-w-[240px] leading-relaxed">
                Build your query using the tools on the left, then click <span className="font-bold text-zinc-700">Run Query</span>.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Toast Notification (Error/Success) */}
      {message && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md ${
              message.type === "success"
                ? "bg-emerald-900/90 border-emerald-800 text-emerald-50"
                : "bg-red-900/90 border-red-800 text-red-50"
            }`}
          >
            <div
              className={`p-1 rounded-full ${
                message.type === "success" ? "bg-emerald-500/20" : "bg-red-500/20"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-medium leading-tight">
                {message.text}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
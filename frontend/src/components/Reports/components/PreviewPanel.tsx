import React from "react";
import { Sparkles, CheckCircle2, AlertCircle, BarChart2 } from "lucide-react";
import { FullReportConfig } from "../../../services/api";

interface PreviewPanelProps {
  previewData: { sql?: string; rows?: any[]; data?: any[] } | null;
  isLoadingPreview: boolean;
  previewConfig: FullReportConfig | null;
  message: { type: "success" | "error"; text: string } | null;
}

const resolveKey = (v: string) =>
  v?.toLowerCase().trim().replace(/\s+/g, "_");

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  previewData,
  isLoadingPreview,
  previewConfig,
  message,
}) => {
  // ✅ PREVIEW API RETURNS `data` (not chart rows)
  const rows =
    previewData?.data ||
    previewData?.rows ||
    [];

  const visibleColumns =
    previewConfig?.columns?.filter((c) => c.visible) || [];

  return (
    <>
      <div className="w-[35%] bg-white/80 backdrop-blur-xl border-l border-zinc-200 flex flex-col z-20 shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)]">
        {/* HEADER */}
        <div className="h-16 px-6 border-b border-zinc-100 flex items-center justify-between bg-white/50">
          <h3 className="text-xs font-extrabold text-zinc-500 uppercase tracking-widest">
            Live Preview
          </h3>

          {rows.length > 0 && (
            <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-full font-bold">
              {rows.length} Rows
            </span>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden relative bg-zinc-50/50">
          {isLoadingPreview ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-30">
              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <p className="mt-4 text-xs font-bold text-indigo-600 uppercase">
                Executing Query…
              </p>
            </div>
          ) : previewData ? (
            <div className="h-full overflow-auto p-4 space-y-4">
              {/* ⚠️ CHART INFO */}
              {previewConfig?.visualization?.showChart && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                  <BarChart2 className="w-4 h-4 mt-0.5" />
                  <span>
                    Chart preview is not available.
                    <br />
                    Save the report and open it in{" "}
                    <b>Report Viewer</b> to see charts.
                  </span>
                </div>
              )}

              {/* SQL */}
              {previewData.sql && (
                <pre className="text-[11px] bg-zinc-100 border rounded p-3 overflow-x-auto">
                  {previewData.sql}
                </pre>
              )}

              {/* TABLE */}
              <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-auto">
                {rows.length === 0 ? (
                  <div className="p-6 text-sm text-zinc-500 text-center">
                    No preview data
                  </div>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-zinc-100 sticky top-0">
                      <tr>
                        {visibleColumns.map((c) => (
                          <th
                            key={c.column_name}
                            className="p-2 text-left border-b font-semibold"
                          >
                            {c.alias || c.column_name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b hover:bg-zinc-50"
                        >
                          {visibleColumns.map((c) => (
                            <td key={c.column_name} className="p-2">
                              {row[resolveKey(c.column_name)] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 bg-zinc-100 border rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-zinc-300" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-800">
                Waiting for Data
              </h4>
              <p className="text-xs text-zinc-500 mt-2">
                Build your query and click <b>Run Query</b>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
      {message && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]">
          <div
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border ${
              message.type === "success"
                ? "bg-emerald-900 text-emerald-50 border-emerald-800"
                : "bg-red-900 text-red-50 border-red-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-xs font-medium">
              {message.text}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

import React from "react";
import { Play, Save, ChevronDown } from "lucide-react";

type ReportMode = "TABLE" | "SEMANTIC" | "SQL";

interface ReportHeaderProps {
  name: string;
  setName: (name: string) => void;
  nameError: boolean;
  setNameError: (error: boolean) => void;
  onRun: () => void;
  onSave: () => void;
  saving: boolean;
  canRun: boolean;
  mode: ReportMode;
  setMode: (mode: ReportMode) => void;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  name,
  setName,
  nameError,
  setNameError,
  onRun,
  onSave,
  saving,
  canRun,
  mode,
  setMode,
}) => {
  return (
    <div className="h-20 bg-white/80 backdrop-blur-sm border-b border-zinc-200 px-8 flex items-center justify-between z-10 sticky top-0">
      {/* LEFT: Title & Mode */}
      <div className="flex items-center gap-8 flex-1">
        <div className="group relative">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value) setNameError(false);
            }}
            className={`text-xl font-bold bg-transparent border-b-2 border-transparent hover:border-zinc-200 focus:border-indigo-500 outline-none py-1 transition-all w-80 placeholder:text-zinc-300 ${
              nameError ? "border-red-400 placeholder:text-red-300" : "text-zinc-800"
            }`}
            placeholder="Untitled Report"
          />
          <span className="absolute -top-3 left-0 text-[10px] font-semibold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
            Report Name
          </span>
        </div>

        {/* Modern Segmented Control */}
        <div className="flex bg-zinc-100/80 p-1 rounded-xl shadow-inner">
          {(["TABLE", "SEMANTIC", "SQL"] as ReportMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                mode === m
                  ? "bg-white text-indigo-600 shadow-sm scale-[1.02]"
                  : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onRun}
          disabled={!canRun}
          className="group relative flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none active:scale-95"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Run Query</span>
        </button>

        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Save</span>
        </button>
      </div>
    </div>
  );
};
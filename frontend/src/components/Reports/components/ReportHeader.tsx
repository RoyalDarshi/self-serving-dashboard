import React from "react";
import { PlayCircle, Save } from "lucide-react";

interface ReportHeaderProps {
    name: string;
    setName: (name: string) => void;
    nameError: boolean;
    setNameError: (error: boolean) => void;
    onRun: () => void;
    onSave: () => void;
    saving: boolean;
    canRun: boolean;
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
}) => {
    return (
        <div className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-10">
            <div className="flex-1 max-w-xl">
                <input
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        if (e.target.value) setNameError(false);
                    }}
                    className={`text-xl font-bold text-slate-800 placeholder:text-slate-400 border-b-2 bg-transparent w-full px-2 py-2 focus:outline-none transition-all ${nameError
                        ? "border-red-500 bg-red-50/30 placeholder:text-red-300 animate-pulse"
                        : "border-transparent hover:border-slate-200 focus:border-indigo-500"
                        }`}
                    placeholder="✨ Name your report..."
                    autoFocus
                />
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={onRun}
                    disabled={!canRun}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <PlayCircle className="w-4 h-4" /> Run Query
                </button>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                    {saving ? (
                        "Saving..."
                    ) : (
                        <>
                            <Save className="w-4 h-4" /> Save Report
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

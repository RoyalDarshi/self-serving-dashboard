import React, { useState } from "react";
import ReportList from "./ReportList";
import ReportViewer from "./ReportViewer";
import ReportBuilder from "./ReportBuilder";
import { Connection } from "../../services/api";

type ViewMode = "LIST" | "VIEW" | "BUILD";

const ReportLayout: React.FC<{ connections: Connection[] }> = ({
  connections,
}) => {
  const [mode, setMode] = useState<ViewMode>("LIST");
  const [activeReportId, setActiveReportId] = useState<number | null>(null);

  // --- ACTIONS ---
  const handleCreateNew = () => {
    setActiveReportId(null);
    setMode("BUILD");
  };

  const handleEditReport = (id: number) => {
    setActiveReportId(id);
    setMode("BUILD");
  };

  const handleOpenReport = (id: number) => {
    setActiveReportId(id);
    setMode("VIEW");
  };

  const handleSaved = (id: number) => {
    setActiveReportId(id);
    setMode("VIEW");
  };

  const handleClose = () => {
    setMode("LIST");
    setActiveReportId(null);
  };

  return (
    // FIX: min-h-screen allows vertical scroll. overflow-x-hidden prevents window horizontal scroll.
    <div className="min-h-screen w-full bg-slate-50 overflow-x-hidden flex flex-col">
      {mode === "LIST" && (
        <div className="w-full">
          <ReportList
            onOpenReport={handleOpenReport}
            onCreateNew={handleCreateNew}
            onEditReport={handleEditReport}
          />
        </div>
      )}

      {mode === "BUILD" && (
        <div className="w-full relative z-0">
          <button
            onClick={handleClose}
            className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/90 backdrop-blur text-slate-600 text-xs font-bold rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50"
          >
            Exit Builder
          </button>
          <ReportBuilder
            connections={connections}
            onSaved={handleSaved}
            initialReportId={activeReportId || undefined}
          />
        </div>
      )}

      {mode === "VIEW" && activeReportId && (
        <div className="w-full">
          <ReportViewer
            initialReportId={activeReportId}
            onClose={handleClose}
          />
        </div>
      )}
    </div>
  );
};

export default ReportLayout;

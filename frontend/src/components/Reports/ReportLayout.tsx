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

  // --- RENDER ---

  return (
    // CHANGE 1: Use h-screen to lock height to viewport and overflow-hidden to prevent body scroll
    <div className="h-screen w-full bg-slate-50 overflow-hidden flex flex-col">
      {mode === "LIST" && (
        // CHANGE 2: Wrap List in a scrollable container so only the list area scrolls
        <div className="h-full w-full overflow-y-auto">
          <ReportList
            onOpenReport={handleOpenReport}
            onCreateNew={handleCreateNew}
            onEditReport={handleEditReport}
          />
        </div>
      )}

      {mode === "BUILD" && (
        // CHANGE 3: Ensure Builder takes full height but contains its own overflow
        // If ReportBuilder has its own scrollbars (e.g. sidebar/canvas), keep this overflow-hidden.
        // If ReportBuilder is just a long form, change to overflow-y-auto.
        <div className="h-full w-full relative z-0 overflow-hidden">
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
        // CHANGE 4: Viewer usually needs its own scroll
        <div className="h-full w-full overflow-y-auto">
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

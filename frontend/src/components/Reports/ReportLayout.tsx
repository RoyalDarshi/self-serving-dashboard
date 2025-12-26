import React, { useState } from "react";
import ReportList from "./ReportList";
import ReportViewer from "./ReportViewer";
import ReportBuilder from "./ReportBuilder";
import { Connection } from "../../services/api";

type ViewMode = "LIST" | "VIEW" | "BUILD";

const ReportLayout: React.FC<{ connections: Connection[] }> = ({ connections }) => {
  const [mode, setMode] = useState<ViewMode>("LIST");
  const [activeReportId, setActiveReportId] = useState<number | null>(null);

  // --- ACTIONS ---

  const handleCreateNew = () => {
    setActiveReportId(null); // Clear ID for new report
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
    setMode("VIEW"); // Go to view mode after saving
  };

  const handleClose = () => {
    setMode("LIST");
    setActiveReportId(null);
  };

  // --- RENDER ---

  return (
    <div className="h-full w-full bg-slate-50">
      {mode === "LIST" && (
        <ReportList
          onOpenReport={handleOpenReport}
          onCreateNew={handleCreateNew}
          onEditReport={handleEditReport}
        />
      )}

      {mode === "BUILD" && (
        <div className="h-full relative z-0">
            {/* Optional: Add a 'Back' button overlay if needed, 
                but usually users Save to exit or we add a Cancel button in Builder */}
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
        <ReportViewer
          initialReportId={activeReportId}
          onClose={handleClose}
        />
      )}
    </div>
  );
};

export default ReportLayout;
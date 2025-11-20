// Simple layout combining list + viewer + builder
import React, { useState } from "react";
import ReportList from "./ReportList";
import ReportViewer from "./ReportViewer";
import ReportBuilder from "./ReportBuilder";
import { Connection } from "../services/api";

const ReportLayout: React.FC<{ connections: Connection[] }> = ({ connections }) => {
  const [mode, setMode] = useState<"list" | "view" | "build">("list");
  const [currentReportId, setCurrentReportId] = useState<number | null>(null);

  const handleOpenReport = (id: number) => {
    setCurrentReportId(id);
    setMode("view");
  };

  const handleNewReport = () => {
    setMode("build");
  };

  const handleSaved = (id: number) => {
    setCurrentReportId(id);
    setMode("view");
  };

  return (
    <div className="flex h-full">
      <div className="w-1/3 border-r border-slate-200">
        <ReportList
          onOpenReport={handleOpenReport}
          onCreateNew={handleNewReport}
        />
      </div>
      <div className="flex-1">
        {mode === "view" && currentReportId && (
          <ReportViewer
            initialReportId={currentReportId}
          />
        )}
        {mode === "build" && (
          <ReportBuilder
            connections={connections}
            onSaved={handleSaved}
          />
        )}
        {mode === "list" && !currentReportId && (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            Select a report from the left or create a new one.
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportLayout;
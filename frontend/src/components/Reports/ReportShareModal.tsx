// src/components/ReportShareModal.tsx
import React from "react";
import { ReportDefinition } from "../../services/api";
import { X, Copy, Link as LinkIcon } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  report: ReportDefinition;
}

const ReportShareModal: React.FC<Props> = ({ open, onClose, report }) => {
  if (!open) return null;

  const shareUrl = `${window.location.origin}/reports/${report?.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-5 relative">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Share Report
        </h3>
        <p className="text-sm text-slate-600 mb-2">
          Share read-only access link to this report.
        </p>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
          <LinkIcon className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-700 truncate">{shareUrl}</span>
          <button
            onClick={handleCopy}
            className="ml-auto text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Copy className="h-3 w-3 inline mr-1" />
            Copy
          </button>
        </div>
        <p className="text-xs text-slate-500">
          (This is UI-only now; you can later enforce ACL in backend using
          report_access table.)
        </p>
      </div>
    </div>
  );
};

export default ReportShareModal;

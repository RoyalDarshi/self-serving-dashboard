import React, { useMemo } from "react";
import { Code2, Copy, Check } from "lucide-react";

interface SqlDisplayProps {
  sql: string;
}

const KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "LEFT JOIN",
  "INNER JOIN",
  "LIMIT",
  "OFFSET",
  "AND",
  "OR",
  "ON",
  "AS",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
];

export const SqlDisplay: React.FC<SqlDisplayProps> = ({ sql }) => {
  const [copied, setCopied] = React.useState(false);

  const formattedSql = useMemo(() => {
    if (!sql) return "";
    let formatted = sql;

    // 1. Simple formatting: Add newlines before major keywords
    [
      "FROM",
      "WHERE",
      "GROUP BY",
      "ORDER BY",
      "LIMIT",
      "LEFT JOIN",
      "INNER JOIN",
    ].forEach((keyword) => {
      formatted = formatted.replace(
        new RegExp(`\\b${keyword}\\b`, "gi"),
        `\n${keyword}`
      );
    });

    return formatted;
  }, [sql]);

  const highlightSql = (text: string) => {
    const parts = text.split(/(\s+)/); // Split by whitespace but keep delimiters
    return parts.map((part, i) => {
      const upper = part.toUpperCase();
      if (KEYWORDS.includes(upper)) {
        return (
          <span key={i} className="text-purple-600 font-bold">
            {part}
          </span>
        );
      }
      if (upper.startsWith("'") && upper.endsWith("'")) {
        return (
          <span key={i} className="text-emerald-600">
            {part}
          </span>
        );
      }
      if (!isNaN(Number(part)) && part.trim() !== "") {
        return (
          <span key={i} className="text-amber-600">
            {part}
          </span>
        );
      }
      return (
        <span key={i} className="text-slate-700">
          {part}
        </span>
      );
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!sql) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shadow-sm my-4">
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Generated SQL
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors"
          title="Copy SQL"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* CHANGE: Add 'max-h-60' and 'overflow-y-auto' to constrain height */}
      <div className="p-4 bg-[#f8fafc] max-h-60 overflow-y-auto custom-scrollbar">
        <pre className="text-md font-mono leading-relaxed whitespace-pre-wrap">
          {formattedSql.split("\n").map((line, i) => (
            <div key={i}>{highlightSql(line)}</div>
          ))}
        </pre>
      </div>
    </div>
  );
};

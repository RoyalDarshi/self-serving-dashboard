import React, { useMemo } from "react";
import {
  Database,
  Search,
  Table2,
  Layers,
  Binary,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Schema, Fact, Dimension } from "../../../services/api";
import { DraggableField } from "./DraggableField";
import { DraggableSemanticItem } from "./DraggableSemanticItem";

interface DataSourcePanelProps {
  leftPanelCollapsed: boolean;
  setLeftPanelCollapsed: (collapsed: boolean) => void;
  connections: { id: number; connection_name: string }[];
  connectionId: number | null;
  onConnectionChange: (id: number) => void;
  mode: "TABLE" | "SEMANTIC";
  onModeChange: (mode: "TABLE" | "SEMANTIC") => void;
  baseTable: string;
  onBaseTableChange: (table: string) => void;
  schemas: Schema[];
  facts: Fact[];
  dimensions: Dimension[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export const DataSourcePanel: React.FC<DataSourcePanelProps> = ({
  leftPanelCollapsed,
  setLeftPanelCollapsed,
  connections,
  connectionId,
  onConnectionChange,
  mode,
  onModeChange,
  baseTable,
  onBaseTableChange,
  schemas,
  facts,
  dimensions,
  searchQuery,
  onSearchQueryChange,
}) => {
  // --- Filters (Same as before) ---
  const filteredSchemas = useMemo(() => {
    if (!searchQuery) return schemas;
    return schemas.filter((s) =>
      s.tableName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [schemas, searchQuery]);

  const availableColumns = useMemo(() => {
    if (!baseTable) return [];
    return schemas.find((s) => s.tableName === baseTable)?.columns || [];
  }, [baseTable, schemas]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery) return availableColumns;
    return availableColumns.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableColumns, searchQuery]);

  const filteredFacts = useMemo(() => {
    if (!searchQuery) return facts;
    return facts.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [facts, searchQuery]);

  const filteredDimensions = useMemo(() => {
    if (!searchQuery) return dimensions;
    return dimensions.filter((d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [dimensions, searchQuery]);

  return (
    <>
      {/* Panel Container */}
      <div
        className={`${
          leftPanelCollapsed ? "lg:w-0 lg:opacity-0" : "lg:w-80 lg:opacity-100"
        } w-full bg-white border-b lg:border-b-0 lg:border-r border-zinc-200 flex flex-col z-30 shadow-xl transition-all duration-300 ease-in-out relative flex-shrink-0`}
        style={{
          height: leftPanelCollapsed ? "auto" : "auto",
        }}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Database className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-sm font-bold text-zinc-800 tracking-wide">
                Data Assets
              </h2>
            </div>

            {/* Mobile Collapse Toggle */}
            <button
              className="lg:hidden p-1 text-zinc-400 hover:bg-zinc-100 rounded"
              onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            >
              {leftPanelCollapsed ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronUp className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Only show content if not collapsed on mobile, or always on desktop if expanded */}
          <div
            className={`${
              leftPanelCollapsed ? "hidden lg:block lg:invisible" : "block"
            }`}
          >
            <select
              className="w-full text-sm border-zinc-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-zinc-50 hover:bg-zinc-100 transition-all font-medium mb-3 cursor-pointer"
              value={connectionId ?? ""}
              onChange={(e) => onConnectionChange(Number(e.target.value))}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.connection_name}
                </option>
              ))}
            </select>

            <div className="relative group">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                className="w-full pl-10 pr-8 py-2 text-sm bg-zinc-50 border border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 rounded-xl outline-none transition-all placeholder:text-zinc-400"
                placeholder={
                  baseTable ? `Search in ${baseTable}...` : "Search tables..."
                }
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchQueryChange("")}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content - Hidden if collapsed on mobile */}
        <div
          className={`flex-1 overflow-y-auto p-3 custom-scrollbar ${
            leftPanelCollapsed ? "hidden lg:block lg:invisible" : "block"
          } lg:max-h-none max-h-60`}
        >
          {mode === "TABLE" ? (
            !baseTable ? (
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-2">
                  {searchQuery ? "Matching Tables" : "Select Source Table"}
                </p>
                {filteredSchemas.length === 0 && searchQuery && (
                  <div className="text-center py-8 text-xs text-zinc-400">
                    No tables found matching "{searchQuery}"
                  </div>
                )}
                {filteredSchemas.map((s) => (
                  <button
                    key={s.tableName}
                    onClick={() => {
                      onBaseTableChange(s.tableName);
                      onSearchQueryChange("");
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-all flex items-center gap-3 group border border-transparent hover:border-indigo-100"
                  >
                    <Table2 className="w-4 h-4 text-zinc-400 group-hover:text-indigo-500" />
                    <span className="font-medium truncate" title={s.tableName}>
                      {s.tableName}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="flex items-center justify-between px-3 py-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Table2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span className="text-xs font-bold text-indigo-900 truncate">
                      {baseTable}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onBaseTableChange("");
                      onSearchQueryChange("");
                    }}
                    className="text-[10px] bg-white border border-indigo-200 text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
                  >
                    Change
                  </button>
                </div>
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
                    {searchQuery ? "Matching Columns" : "Columns"}
                  </p>
                  {filteredColumns.map((col) => (
                    <DraggableField
                      key={col.name}
                      name={col.name}
                      label={col.name}
                      table_name={baseTable}
                      type={col.type}
                    />
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-2 flex items-center gap-1.5">
                  <Binary className="w-3.5 h-3.5" /> Facts (Metrics)
                </h3>
                <div className="space-y-1.5">
                  {filteredFacts.map((fact) => (
                    <DraggableSemanticItem
                      key={fact.id}
                      item={fact}
                      type="fact"
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-2 flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5" /> Dimensions
                </h3>
                <div className="space-y-1.5">
                  {filteredDimensions.map((dim) => (
                    <DraggableSemanticItem
                      key={dim.id}
                      item={dim}
                      type="dimension"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Toggle Button (Hidden on Mobile) */}
      <button
        onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
        className="hidden lg:flex absolute top-24 z-40 bg-white border border-zinc-200 text-zinc-400 hover:text-indigo-600 hover:border-indigo-200 rounded-full p-1.5 shadow-md transition-all duration-300"
        style={{
          left: leftPanelCollapsed ? "1rem" : "19rem",
        }}
      >
        {leftPanelCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </>
  );
};

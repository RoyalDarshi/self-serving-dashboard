import React, { useMemo } from "react";
import { Database, Search, Table as TableIcon, Sigma, Layers, ChevronRight, ChevronLeft } from "lucide-react";
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
    // Derived Data
    const availableColumns = useMemo(() => {
        if (!baseTable) return [];
        return schemas.find((s) => s.tableName === baseTable)?.columns || [];
    }, [baseTable, schemas]);

    const filteredColumns = availableColumns.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredFacts = facts.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredDimensions = dimensions.filter((d) =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            <div
                className={`${leftPanelCollapsed ? "w-0" : "w-80"
                    } bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl transition-all duration-300 overflow-hidden`}
            >
                <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Database className="w-4 h-4 text-indigo-600" />
                        </div>
                        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                            Data Source
                        </h2>
                    </div>
                    <select
                        className="w-full text-sm border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none bg-white hover:bg-slate-50 transition-all shadow-sm font-medium mb-4"
                        value={connectionId ?? ""}
                        onChange={(e) => onConnectionChange(Number(e.target.value))}
                    >
                        {connections.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.connection_name}
                            </option>
                        ))}
                    </select>

                    {/* MODE SWITCHER */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                        <button
                            onClick={() => onModeChange("TABLE")}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === "TABLE"
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            Tables
                        </button>
                        <button
                            onClick={() => onModeChange("SEMANTIC")}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === "SEMANTIC"
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            Semantic
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {mode === "TABLE" ? (
                        !baseTable ? (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-500 font-semibold mb-3 px-2">
                                    Available Tables
                                </p>
                                {schemas.map((s) => (
                                    <button
                                        key={s.tableName}
                                        onClick={() => onBaseTableChange(s.tableName)}
                                        className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 hover:text-indigo-700 rounded-xl transition-all flex items-center gap-3 group border border-transparent hover:border-indigo-200 shadow-sm hover:shadow"
                                    >
                                        <TableIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                        <span className="font-semibold">{s.tableName}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                    <div className="flex items-center gap-2">
                                        <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
                                        <span className="text-xs font-bold text-indigo-900">
                                            {baseTable}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => onBaseTableChange("")}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 hover:bg-indigo-100 rounded transition-colors"
                                    >
                                        Change
                                    </button>
                                </div>
                                <div className="space-y-1.5">
                                    {filteredColumns.map((col) => (
                                        <DraggableField
                                            key={col.name}
                                            name={col.name}              // column_name
                                            label={col.name}             // optional display
                                            table_name={baseTable}       // 🔥 THIS IS THE FIX
                                            type={col.type}
                                        />
                                        ))}
                                </div>
                            </div>
                        )
                    ) : (
                        // SEMANTIC MODE LISTS
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                                    <Sigma className="w-3 h-3" /> Facts
                                </h3>
                                <div className="space-y-1.5">
                                    {filteredFacts.map((fact) => (
                                        <DraggableSemanticItem
                                            key={fact.id}
                                            item={fact}
                                            type="fact"
                                        />
                                    ))}
                                    {filteredFacts.length === 0 && (
                                        <p className="text-xs text-slate-400 italic px-2">
                                            No facts found.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                                    <Layers className="w-3 h-3" /> Dimensions
                                </h3>
                                <div className="space-y-1.5">
                                    {filteredDimensions.map((dim) => (
                                        <DraggableSemanticItem
                                            key={dim.id}
                                            item={dim}
                                            type="dimension"
                                        />
                                    ))}
                                    {filteredDimensions.length === 0 && (
                                        <p className="text-xs text-slate-400 italic px-2">
                                            No dimensions found.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Collapse Button */}
            <button
                onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                className="absolute left-[19.75rem] top-6 z-30 bg-white border border-slate-200 rounded-r-lg p-1.5 shadow-lg hover:bg-slate-50 transition-all"
                style={{
                    transform: leftPanelCollapsed
                        ? "translateX(-19.75rem)"
                        : "translateX(0)",
                    transition: "transform 0.3s",
                }}
            >
                {leftPanelCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                ) : (
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                )}
            </button>
        </>
    );
};

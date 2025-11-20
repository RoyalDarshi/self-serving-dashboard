// src/components/ReportBuilder.tsx
import React, { useState, useEffect, useMemo } from "react";
import { ReportColumn, ReportFilter, Schema } from "../services/api"; // Added Schema import
import { apiService } from "../services/api";
import { Plus, Trash2, Save, RefreshCw } from "lucide-react";

interface Props {
  connections: { id: number; connection_name: string }[];
  onSaved?: (reportId: number) => void;
}

const emptyColumn: ReportColumn = {
  column_name: "",
  alias: "",
  visible: true,
  order_index: 0,
};

const emptyFilter: ReportFilter = {
  column_name: "",
  operator: "=",
  value: "",
  is_user_editable: true,
  order_index: 0,
};

const ReportBuilder: React.FC<Props> = ({ connections, onSaved }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [connectionId, setConnectionId] = useState<number | null>(
    connections[0]?.id ?? null
  );
  const [baseTable, setBaseTable] = useState("");
  const [columns, setColumns] = useState<ReportColumn[]>([emptyColumn]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);

  // New State for Schema logic
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 1. Fetch Schemas (Tables & Columns) when Connection Changes
  useEffect(() => {
    if (connectionId) {
      setLoadingSchemas(true);
      apiService
        .getSchemas(connectionId)
        .then((data) => {
          setSchemas(data);
          // Reset base table if the new connection doesn't have the current table
          setBaseTable("");
        })
        .catch((err) => console.error("Failed to load schemas", err))
        .finally(() => setLoadingSchemas(false));
    }
  }, [connectionId]);

  // 2. Derive available columns based on selected baseTable
  const availableColumns = useMemo(() => {
    if (!baseTable) return [];
    const tableSchema = schemas.find((s) => s.tableName === baseTable);
    return tableSchema ? tableSchema.columns : [];
  }, [baseTable, schemas]);

  const handleAddColumn = () => {
    setColumns((prev) => [
      ...prev,
      { ...emptyColumn, order_index: prev.length },
    ]);
  };

  const handleAddFilter = () => {
    setFilters((prev) => [
      ...prev,
      { ...emptyFilter, order_index: prev.length },
    ]);
  };

  const handleSave = async () => {
    if (!name || !connectionId || !baseTable) {
      setMessage("Name, connection and base table are required");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name,
        description,
        connection_id: connectionId,
        base_table: baseTable,
        columns: columns.filter((c) => c.column_name.trim() !== ""),
        filters,
      };
      const res = await apiService.saveReport(payload);
      if (res.success && res.reportId) {
        setMessage("Report saved");
        onSaved?.(res.reportId);
      } else {
        setMessage(res.error || "Failed to save report");
      }
    } catch (err: any) {
      setMessage(err.message || "Error saving report");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Report Builder</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {message && (
          <div className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded px-3 py-2">
            {message}
          </div>
        )}
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Report Name
              </label>
              <input
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sales by Region"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Connection
              </label>
              <select
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                value={connectionId ?? ""}
                onChange={(e) => setConnectionId(Number(e.target.value))}
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.connection_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Base Table Dropdown */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex justify-between">
              <span>Base Table / View</span>
              {loadingSchemas && (
                <span className="text-indigo-500 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Fetching
                  tables...
                </span>
              )}
            </label>
            <select
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
              value={baseTable}
              onChange={(e) => {
                setBaseTable(e.target.value);
                // Optionally clear columns when table changes
                setColumns([emptyColumn]);
                setFilters([]);
              }}
              disabled={loadingSchemas || !connectionId}
            >
              <option value="">-- Select Table --</option>
              {schemas.map((schema) => (
                <option key={schema.tableName} value={schema.tableName}>
                  {schema.tableName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Description (optional)
            </label>
            <textarea
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Monthly sales report grouped by region"
            />
          </div>
        </div>

        {/* Columns */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-800">Columns</h3>
            <button
              onClick={handleAddColumn}
              disabled={!baseTable}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Add Column
            </button>
          </div>

          {/* Show helper text if table not selected */}
          {!baseTable && (
            <div className="text-xs text-slate-500 italic mb-2">
              Select a Base Table to view available columns.
            </div>
          )}

          <div className="space-y-2">
            {columns.map((col, idx) => (
              <div
                key={idx}
                className="grid grid-cols-4 gap-2 items-center text-xs"
              >
                {/* Column Dropdown */}
                <select
                  className="border border-slate-300 rounded px-2 py-1"
                  value={col.column_name}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Auto-fill alias if empty
                    setColumns((prev) =>
                      prev.map((c, i) =>
                        i === idx
                          ? { ...c, column_name: v, alias: c.alias || v }
                          : c
                      )
                    );
                  }}
                >
                  <option value="">-- Select Column --</option>
                  {availableColumns.map((ac) => (
                    <option key={ac.name} value={ac.name}>
                      {ac.name} ({ac.type})
                    </option>
                  ))}
                </select>

                <input
                  className="border border-slate-300 rounded px-2 py-1"
                  placeholder="Alias"
                  value={col.alias ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setColumns((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, alias: v } : c))
                    );
                  }}
                />
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={col.visible ?? true}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setColumns((prev) =>
                        prev.map((c, i) =>
                          i === idx ? { ...c, visible: v } : c
                        )
                      );
                    }}
                  />
                  Visible
                </label>
                <button
                  onClick={() =>
                    setColumns((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-red-500 hover:bg-red-50 rounded p-1 justify-self-end"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-800">
              Default Filters
            </h3>
            <button
              onClick={handleAddFilter}
              disabled={!baseTable}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Add Filter
            </button>
          </div>
          <div className="space-y-2">
            {filters.map((f, idx) => (
              <div
                key={idx}
                className="grid grid-cols-5 gap-2 items-center text-xs"
              >
                {/* Filter Column Dropdown */}
                <select
                  className="border border-slate-300 rounded px-2 py-1"
                  value={f.column_name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilters((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, column_name: v } : x
                      )
                    );
                  }}
                >
                  <option value="">-- Column --</option>
                  {availableColumns.map((ac) => (
                    <option key={ac.name} value={ac.name}>
                      {ac.name}
                    </option>
                  ))}
                </select>

                <select
                  className="border border-slate-300 rounded px-2 py-1"
                  value={f.operator}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilters((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, operator: v } : x
                      )
                    );
                  }}
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<=">&lt;=</option>
                  <option value="LIKE">LIKE</option>
                </select>
                <input
                  className="border border-slate-300 rounded px-2 py-1"
                  placeholder="Value"
                  value={f.value as string}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilters((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, value: v } : x))
                    );
                  }}
                />
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={f.is_user_editable ?? true}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setFilters((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, is_user_editable: v } : x
                        )
                      );
                    }}
                  />
                  User editable
                </label>
                <button
                  onClick={() =>
                    setFilters((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-red-500 hover:bg-red-50 rounded p-1 justify-self-end"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportBuilder;

import React, { useState, useEffect } from "react";
import {
  ReportColumn,
  ReportFilter,
  Schema,
  ReportDefinition,
  FullReportConfig,
  apiService,
  Fact,
  Dimension,
} from "../../services/api";
import { ConfigItem, DragItem, DrillConfig } from "./types";
import { DataSourcePanel } from "./components/DataSourcePanel";
import { ReportHeader } from "./components/ReportHeader";
import { ProgressIndicator } from "./components/ProgressIndicator";
import { TableConfig } from "./components/TableConfig";
import { VisualizationConfig } from "./components/VisualizationConfig";
import { FiltersConfig } from "./components/FiltersConfig";
import { DrillThroughConfig } from "./components/DrillThroughConfig";
import { PreviewPanel } from "./components/PreviewPanel";

// --- Main Application ---

interface Props {
  connections: { id: number; connection_name: string }[];
  onSaved?: (reportId: number) => void;
  initialReportId?: number;
}

type ReportMode = "TABLE" | "SEMANTIC" | "SQL";

const ReportBuilder: React.FC<Props> = ({
  connections,
  onSaved,
  initialReportId,
}) => {
  // UI State
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [mode, setMode] = useState<ReportMode>("TABLE");
  const [loadingReport, setLoadingReport] = useState(false);

  // --- Data Source State ---
  const [connectionId, setConnectionId] = useState<number | null>(
    connections[0]?.id || null
  );
  const [baseTable, setBaseTable] = useState<string>("");
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sqlText, setSqlText] = useState("");

  // Semantic Data
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);

  // --- Report Meta ---
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [description, setDescription] = useState("");

  //--- Configuration Shelves ---
  const [tableColumns, setTableColumns] = useState<ConfigItem[]>([]);

  // Chart Config
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [chartX, setChartX] = useState<ConfigItem | null>(null);
  const [chartY, setChartY] = useState<ConfigItem[]>([]);

  // Filters
  const [filters, setFilters] = useState<ReportFilter[]>([]);

  // Drill-Through Config
  const [availableReports, setAvailableReports] = useState<ReportDefinition[]>(
    []
  );
  const [drillConfig, setDrillConfig] = useState<DrillConfig>({
    targetReportId: 0,
    mapping: {},
  });
  const [targetReportFields, setTargetReportFields] = useState<
    { name: string; alias: string; type: string }[]
  >([]);

  // --- App Status ---
  const [previewConfig, setPreviewConfig] = useState<FullReportConfig | null>(
    null
  );
  const [previewData, setPreviewData] = useState<{
    sql: string;
    rows: any[];
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [templateType, setTemplateType] = useState<null | "MARKSHEET">(null);
  const [templateJson, setTemplateJson] = useState<any>({
    type: "CUSTOM",
    sections: [],
  });

  const allTemplateFields = React.useMemo(() => {
    if (!schemas || schemas.length === 0) return [];

    return schemas.flatMap((schema: any) => {
      if (!schema.tables) return [];

      return schema.tables.flatMap((table: any) => {
        if (!table.columns) return [];

        return table.columns.map((col: any) => ({
          table: table.name,
          column: col.name,
        }));
      });
    });
  }, [schemas]);

  // 1. Load Initial Data (Schemas, Facts, Reports list)
  useEffect(() => {
    if (connectionId) {
      apiService.getSchemas(connectionId).then(setSchemas);
      apiService.getFacts(connectionId).then(setFacts);
      apiService.getDimensions(connectionId).then(setDimensions);
    }
    apiService.getReports().then(setAvailableReports);
  }, [connectionId]);

  // 2. Load Existing Report for Editing
  // 2. Load Existing Report for Editing
  useEffect(() => {
    if (initialReportId) {
      setLoadingReport(true);
      apiService
        .getReportConfig(initialReportId)
        .then((res: any) => {
          const data = res.data || res;
          const { report, columns, filters, drillTargets } = data;

          if (!report) {
            throw new Error("Report data not found");
          }

          // --- 1. Basic Info ---
          setName(report.name);
          setDescription(report.description || "");
          setConnectionId(report.connection_id);
          setMode((report.report_type as ReportMode) || "TABLE");
          setBaseTable(report.base_table);
          setSqlText(report.sql_text || "");

          // --- 2. Template Info (New Fix) ---
          setTemplateType(report.template_type || null);
          if (report.template_json) {
            setTemplateJson(
              typeof report.template_json === "string"
                ? JSON.parse(report.template_json)
                : report.template_json
            );
          }

          // --- 3. Columns & Charts ---
          const vizConfig =
            typeof report.visualization_config === "string"
              ? JSON.parse(report.visualization_config || "{}")
              : report.visualization_config || {};

          const tCols = (columns || [])
            .filter((c: any) => c.visible)
            .map((c: any) => {
              // 🧹 CLEAN ALIAS: Remove extra quotes/slashes if present
              let cleanAlias = c.alias;
              if (cleanAlias && typeof cleanAlias === "string") {
                try {
                  // If it looks like a JSON string (starts with quotes), try to parse it
                  if (
                    cleanAlias.startsWith('"') ||
                    cleanAlias.startsWith("'")
                  ) {
                    cleanAlias = JSON.parse(cleanAlias);
                  }
                } catch (e) {
                  // If parsing fails, just use the original
                }
              }

              return {
                id: Math.random().toString(36).substr(2, 9),
                name: c.column_name,
                table_name: c.table_name || report.base_table,
                alias: cleanAlias, // ✅ Use the cleaned alias
                type: c.data_type || "string",
              };
            });
          setTableColumns(tCols);

          if (vizConfig.showChart) {
            setShowChart(true);
            setChartType(vizConfig.chartType || "bar");

            if (vizConfig.xAxisColumn) {
              const xCol = columns.find(
                (c: any) => c.column_name === vizConfig.xAxisColumn
              );
              if (xCol) {
                setChartX({
                  id: "chart-x",
                  name: xCol.column_name,
                  table_name: xCol.table_name || report.base_table,
                  alias: xCol.alias,
                  type: xCol.data_type || "string",
                });
              }
            }

            if (
              vizConfig.yAxisColumns &&
              Array.isArray(vizConfig.yAxisColumns)
            ) {
              const yItems: ConfigItem[] = [];
              vizConfig.yAxisColumns.forEach((yName: string) => {
                const yCol = columns.find((c: any) => c.column_name === yName);
                if (yCol) {
                  yItems.push({
                    id: Math.random().toString(36).substr(2, 9),
                    name: yCol.column_name,
                    table_name: yCol.table_name || report.base_table,
                    alias: yCol.alias,
                    type: yCol.data_type || "number",
                    aggregation: vizConfig.aggregation || "SUM",
                  });
                }
              });
              setChartY(yItems);
            }
          }

          // --- 4. Filters (Fix: Ensure boolean conversion) ---
          const loadedFilters = (filters || []).map((f: any) => {
            let val = f.value;
            try {
              // The backend sends values as JSON strings (e.g., "\"Draft\"")
              // We must parse them back to raw values (e.g., "Draft")
              if (typeof val === "string") {
                val = JSON.parse(val);
              }
            } catch (e) {
              // If it wasn't valid JSON, just use the raw value
              console.warn("Could not parse filter value:", val);
            }

            return {
              ...f,
              value: val, // ✅ Correctly parsed value
              is_mandatory: Boolean(f.is_mandatory),
              is_user_editable: f.is_user_editable !== 0,
            };
          });
          setFilters(loadedFilters);

          // --- 5. Drill Targets ---
          if (drillTargets && drillTargets.length > 0) {
            const dt = drillTargets[0];
            setDrillConfig({
              targetReportId: dt.target_report_id,
              mapping: JSON.parse(dt.mapping_json || "{}"),
            });
          }
        })
        .catch((err) => {
          console.error("Failed to load report", err);
          setMessage({
            type: "error",
            text: "Failed to load report for editing",
          });
        })
        .finally(() => setLoadingReport(false));
    }
  }, [initialReportId]);

  useEffect(() => {
    if (drillConfig.targetReportId !== 0) {
      apiService
        .getReportDrillFields(drillConfig.targetReportId)
        .then((fields) => {
          const normalized = fields.map((f: any) => ({
            name: f.column || f.name,
            alias: f.label || f.alias || f.column,
            type: f.type || "string",
          }));
          setTargetReportFields(normalized);
        });
    } else {
      setTargetReportFields([]);
    }
  }, [drillConfig.targetReportId]);

  const handleDropTable = (item: DragItem) => {
    if (tableColumns.find((c) => c.name === item.name)) return;
    setTableColumns([
      ...tableColumns,
      { ...item, id: Math.random().toString(36).substr(2, 9) },
    ]);
  };

  const handleDropChartX = (item: DragItem) => {
    setChartX({ ...item, id: Math.random().toString(36).substr(2, 9) });
  };

  const handleDropChartY = (item: DragItem) => {
    const isNum =
      item.type.toLowerCase().includes("int") ||
      item.type.toLowerCase().includes("number");
    setChartY([
      ...chartY,
      {
        ...item,
        id: Math.random().toString(36).substr(2, 9),
        aggregation: item.aggregation || (isNum ? "SUM" : "COUNT"),
      },
    ]);
  };

  const handleDropFilter = (item: DragItem) => {
    // 🚑 HARD STOP: never allow filter without table_name
    if (!item.table_name) {
      console.error(
        "❌ Filter column missing table_name. Filter NOT created.",
        item
      );
      return;
    }

    setFilters([
      ...filters,
      {
        column_name: item.name,
        table_name: item.table_name, // ✅ ALWAYS REAL TABLE
        operator: "=",
        value: "",
        is_user_editable: true,
        order_index: filters.length,
      },
    ]);
  };

  const constructPayload = () => {
    const uniqueFields = new Map<string, ConfigItem>();
    tableColumns.forEach((c) => uniqueFields.set(c.name, { ...c }));
    if (showChart && chartX && !uniqueFields.has(chartX.name)) {
      uniqueFields.set(chartX.name, { ...chartX, visible: false });
    }
    if (showChart) {
      chartY.forEach((c) => {
        if (!uniqueFields.has(c.name))
          uniqueFields.set(c.name, { ...c, visible: false });
      });
    }

    const reportColumns: ReportColumn[] = [];
    tableColumns.forEach((c, idx) => {
      reportColumns.push({
        table_name: c.table_name || baseTable,
        column_name: c.name,
        alias: c.alias,
        data_type: c.type,
        visible: true,
        order_index: idx,
      });
    });

    if (showChart) {
      if (chartX && !tableColumns.find((t) => t.name === chartX.name)) {
        reportColumns.push({
          table_name: chartX.table_name || baseTable,
          column_name: chartX.name,
          alias: chartX.alias,
          data_type: chartX.type,
          visible: false,
          order_index: reportColumns.length,
        });
      }
      chartY.forEach((c) => {
        if (!tableColumns.find((t) => t.name === c.name)) {
          reportColumns.push({
            table_name: c.table_name || baseTable,
            column_name: c.name,
            alias: c.alias,
            data_type: c.type,
            visible: false,
            order_index: reportColumns.length,
          });
        }
      });
    }

    const visualizationConfig: any = showChart
      ? {
          showChart: true,
          chartType,
          xAxisColumn: chartX?.name || "",
          yAxisColumns: chartY.map((y) => y.name),
          aggregation: chartY[0]?.aggregation || "SUM",
        }
      : { showChart: false };

    if (mode === "SEMANTIC") {
      const factIds = tableColumns
        .filter((c) => c.factId)
        .map((c) => c.factId!);
      const dimensionIds = tableColumns
        .filter((c) => c.dimensionId)
        .map((c) => c.dimensionId!);
      visualizationConfig.factIds = factIds;
      visualizationConfig.dimensionIds = dimensionIds;
    }

    const drillTargets =
      drillConfig.targetReportId !== 0
        ? [
            {
              target_report_id: drillConfig.targetReportId,
              mapping_json: drillConfig.mapping,
            },
          ]
        : [];

    return {
      name,
      description,
      connection_id: connectionId,
      base_table: mode === "SEMANTIC" ? "SEMANTIC" : baseTable,
      columns: reportColumns,
      filters: filters,
      visualization_config: visualizationConfig,
      drillTargets: drillTargets,
      report_type: mode,
      sql_text: mode === "SQL" ? sqlText : null,

      // 🔥 ADD THESE
      template_type: templateType,
      template_json: templateJson,
    };
  };

  const availableColumns = React.useMemo(() => {
    return tableColumns.map((c) => ({
      name: c.name,
      label: c.alias || c.name,
    }));
  }, [tableColumns]);

  const handleRun = async () => {
    if (!connectionId) {
      setMessage({ type: "error", text: "Please select a data source." });
      return;
    }
    if (mode === "TABLE" && !baseTable) {
      setMessage({ type: "error", text: "Please select a table first." });
      return;
    }
    if (mode === "SQL" && !sqlText.trim()) {
      setMessage({ type: "error", text: "Please enter a SQL query." });
      return;
    }

    setIsLoadingPreview(true);
    setPreviewData(null);

    try {
      const payload = constructPayload();
      if (mode === "SEMANTIC") payload.base_table = "SEMANTIC";

      const config: FullReportConfig = {
        report: {
          id: initialReportId || 0,
          name,
          connection_id: connectionId!,
          base_table: payload.base_table,
          visualization_config: JSON.stringify(payload.visualization_config),
        },
        columns: payload.columns,
        filters: payload.filters,
        visualization: payload.visualization_config as any,
        drillTargets: [],
      };

      setPreviewConfig(config);
      const res = await apiService.previewReport(payload);
      const data = res.data || res;

      if (data && (data.success || Array.isArray(data.data) || data.rows)) {
        setPreviewData(data);
        setMessage({ type: "success", text: "Query executed successfully" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to fetch preview data",
        });
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "An unexpected error occurred",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError(true);
      setMessage({ type: "error", text: "Please name your report." });
      return;
    }
    if (mode === "TABLE" && !baseTable) {
      setMessage({ type: "error", text: "Please select a table." });
      return;
    }

    setSaving(true);
    try {
      const payload = constructPayload();

      let res;
      if (initialReportId) {
        res = await apiService.updateReport(initialReportId, payload as any);
      } else {
        res = await apiService.saveReport(payload as any);
      }

      const data = res.data || res;
      const success = data.success;
      const reportId = data.reportId || initialReportId;

      if (success) {
        setMessage({
          type: "success",
          text: initialReportId
            ? "Report updated successfully!"
            : "Report created successfully!",
        });
        setTimeout(() => setMessage(null), 3000);
        if (onSaved && reportId) onSaved(reportId);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loadingReport) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium animate-pulse">
            Loading report configuration...
          </p>
        </div>
      </div>
    );
  }

  const canRun =
    (mode === "TABLE" && !!baseTable) ||
    (mode === "SEMANTIC" && tableColumns.length > 0) ||
    (mode === "SQL" && !!sqlText);

  // --- UPDATED LAYOUT CLASS ---
  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-[#fafafa] font-sans text-slate-800 overflow-hidden relative">
      {/* 1. LEFT PANEL: Data Source */}
      <DataSourcePanel
        leftPanelCollapsed={leftPanelCollapsed}
        setLeftPanelCollapsed={setLeftPanelCollapsed}
        connections={connections}
        connectionId={connectionId}
        onConnectionChange={(id) => {
          setConnectionId(id);
          if (!loadingReport) {
            setBaseTable("");
            setTableColumns([]);
          }
        }}
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          setTableColumns([]);
        }}
        baseTable={baseTable}
        onBaseTableChange={setBaseTable}
        schemas={schemas}
        facts={facts}
        dimensions={dimensions}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      {/* 2. MIDDLE PANEL: Builder Canvas */}
      <div className="flex-1 flex flex-col min-w-0 z-0 h-full overflow-hidden">
        <ReportHeader
          name={name}
          setName={setName}
          nameError={nameError}
          setNameError={setNameError}
          onRun={handleRun}
          onSave={handleSave}
          saving={saving}
          canRun={canRun}
          mode={mode}
          setMode={setMode}
        />

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6">
          <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {mode === "SQL" ? (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-[500px]">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-800">
                    SQL Query Editor
                  </h3>
                </div>
                <textarea
                  className="flex-1 p-4 font-mono text-sm focus:outline-none resize-none"
                  placeholder="SELECT * FROM users WHERE..."
                  value={sqlText}
                  onChange={(e) => setSqlText(e.target.value)}
                />
              </div>
            ) : (
              <>
                <ProgressIndicator
                  mode={mode}
                  baseTable={baseTable}
                  tableColumns={tableColumns}
                  name={name}
                />

                <TableConfig
                  tableColumns={tableColumns}
                  setTableColumns={setTableColumns}
                  handleDropTable={handleDropTable}
                />

                <VisualizationConfig
                  showChart={showChart}
                  setShowChart={setShowChart}
                  chartType={chartType}
                  setChartType={setChartType}
                  chartX={chartX}
                  setChartX={setChartX}
                  chartY={chartY}
                  setChartY={setChartY}
                  handleDropChartX={handleDropChartX}
                  handleDropChartY={handleDropChartY}
                />

                <FiltersConfig
                  filters={filters}
                  setFilters={setFilters}
                  handleDropFilter={handleDropFilter}
                />

                <div className="bg-white rounded-xl border p-4 space-y-4">
                  <h3 className="text-sm font-bold">
                    Report Template (Optional)
                  </h3>

                  <select
                    value={templateType || ""}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setTemplateType(val as any);

                      if (val === "MARKSHEET") {
                        setTemplateJson({
                          type: "MARKSHEET",
                          sections: [
                            {
                              type: "header",
                              fields: [
                                { label: "Enrollment No", column: "" },
                                { label: "Semester", column: "" },
                                { label: "Exam Year", column: "" },
                              ],
                            },
                            {
                              type: "table",
                              title: "Marks",
                              columns: [
                                { label: "Subject", column: "" },
                                { label: "Internal Marks", column: "" },
                                { label: "External Marks", column: "" },
                              ],
                            },
                          ],
                        });
                      } else {
                        setTemplateJson(null);
                      }
                    }}
                    className="border rounded px-3 py-2 text-sm w-64"
                  >
                    <option value="">No Template (Normal Report)</option>
                    <option value="MARKSHEET">Marksheet</option>
                  </select>

                  {/* ================= FIELD MAPPING ================= */}

                  {/* ================= BI TOOL TEMPLATE BUILDER ================= */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* HEADER TOOLBAR */}
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 rounded-md">
                          <svg
                            className="w-4 h-4 text-indigo-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Template Designer
                        </h3>
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          value={templateType || ""}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            setTemplateType(val as any);
                            if (
                              val === "MARKSHEET" &&
                              !templateJson?.sections?.length
                            ) {
                              setTemplateJson({
                                type: "CUSTOM",
                                styles: { padding: "40px" },
                                sections: [],
                              });
                            } else if (!val) {
                              setTemplateJson(null);
                            }
                          }}
                          className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">Standard Report</option>
                          <option value="MARKSHEET">Custom Canvas</option>
                        </select>
                      </div>
                    </div>

                    {/* BUILDER AREA */}
                    {templateType === "MARKSHEET" && templateJson && (
                      <div className="flex flex-col md:flex-row h-[600px]">
                        {/* LEFT: COMPONENT LIBRARY */}
                        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-3 overflow-y-auto">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Add Elements
                          </div>

                          <button
                            className="flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:shadow-sm hover:text-indigo-600 transition-all text-left group"
                            onClick={() => {
                              const sections = [
                                ...(templateJson.sections || []),
                              ];
                              sections.push({
                                type: "image",
                                src: "",
                                align: "center",
                                height: "80px",
                              });
                              setTemplateJson({ ...templateJson, sections });
                            }}
                          >
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md group-hover:bg-blue-100">
                              🖼️
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">
                                Image / Logo
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Logos, banners, seals
                              </span>
                            </div>
                          </button>

                          <button
                            className="flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:shadow-sm hover:text-indigo-600 transition-all text-left group"
                            onClick={() => {
                              const sections = [
                                ...(templateJson.sections || []),
                              ];
                              sections.push({
                                type: "text",
                                content: "TITLE TEXT",
                                align: "center",
                                fontSize: "20px",
                                bold: true,
                              });
                              setTemplateJson({ ...templateJson, sections });
                            }}
                          >
                            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md group-hover:bg-emerald-100">
                              📝
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">
                                Text Block
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Headings, paragraphs
                              </span>
                            </div>
                          </button>

                          <button
                            className="flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:shadow-sm hover:text-indigo-600 transition-all text-left group"
                            onClick={() => {
                              const sections = [
                                ...(templateJson.sections || []),
                              ];
                              sections.push({
                                type: "header",
                                fields: [{ label: "Field Name", column: "" }],
                              });
                              setTemplateJson({ ...templateJson, sections });
                            }}
                          >
                            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-md group-hover:bg-amber-100">
                              📇
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">
                                Info Grid
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Student info, details
                              </span>
                            </div>
                          </button>

                          <button
                            className="flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:shadow-sm hover:text-indigo-600 transition-all text-left group"
                            onClick={() => {
                              const sections = [
                                ...(templateJson.sections || []),
                              ];
                              sections.push({
                                type: "table",
                                title: "Marks Statement",
                                columns: [{ label: "Subject", column: "" }],
                              });
                              setTemplateJson({ ...templateJson, sections });
                            }}
                          >
                            <div className="p-1.5 bg-violet-50 text-violet-600 rounded-md group-hover:bg-violet-100">
                              📊
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">
                                Data Table
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Dynamic rows & columns
                              </span>
                            </div>
                          </button>

                          <button
                            className="flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:shadow-sm hover:text-indigo-600 transition-all text-left group"
                            onClick={() => {
                              const sections = [
                                ...(templateJson.sections || []),
                              ];
                              sections.push({
                                type: "signature",
                                label: "Authorized Signatory",
                                src: "",
                              });
                              setTemplateJson({ ...templateJson, sections });
                            }}
                          >
                            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-md group-hover:bg-rose-100">
                              ✍️
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">
                                Signature
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Footer signatures
                              </span>
                            </div>
                          </button>
                        </div>

                        {/* RIGHT: CANVAS / CONFIGURATOR */}
                        <div className="flex-1 bg-slate-100 p-6 overflow-y-auto">
                          <div className="max-w-3xl mx-auto space-y-4">
                            {templateJson.sections?.length === 0 && (
                              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                                <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                                  <svg
                                    className="w-8 h-8 text-slate-300"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                    />
                                  </svg>
                                </div>
                                <h4 className="text-slate-500 font-semibold">
                                  Canvas is Empty
                                </h4>
                                <p className="text-slate-400 text-xs mt-1">
                                  Select elements from the left to start
                                  building.
                                </p>
                              </div>
                            )}

                            {templateJson.sections?.map(
                              (section: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group transition-all hover:shadow-md hover:border-indigo-300"
                                >
                                  {/* SECTION HEADER */}
                                  <div className="bg-slate-50/80 px-4 py-2 flex justify-between items-center border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        {section.type} Block
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                      {/* MOVERS */}
                                      <button
                                        className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30"
                                        disabled={idx === 0}
                                        onClick={() => {
                                          const sections = [
                                            ...templateJson.sections,
                                          ];
                                          [sections[idx - 1], sections[idx]] = [
                                            sections[idx],
                                            sections[idx - 1],
                                          ];
                                          setTemplateJson({
                                            ...templateJson,
                                            sections,
                                          });
                                        }}
                                      >
                                        ↑
                                      </button>
                                      <button
                                        className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30"
                                        disabled={
                                          idx ===
                                          templateJson.sections.length - 1
                                        }
                                        onClick={() => {
                                          const sections = [
                                            ...templateJson.sections,
                                          ];
                                          [sections[idx + 1], sections[idx]] = [
                                            sections[idx],
                                            sections[idx + 1],
                                          ];
                                          setTemplateJson({
                                            ...templateJson,
                                            sections,
                                          });
                                        }}
                                      >
                                        ↓
                                      </button>
                                      <div className="w-px h-4 bg-slate-300 mx-1"></div>
                                      <button
                                        className="p-1 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                                        onClick={() => {
                                          const sections = [
                                            ...templateJson.sections,
                                          ];
                                          sections.splice(idx, 1);
                                          setTemplateJson({
                                            ...templateJson,
                                            sections,
                                          });
                                        }}
                                      >
                                        <svg
                                          className="w-4 h-4"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>

                                  {/* SECTION BODY */}
                                  <div className="p-4 space-y-4">
                                    {/* 🖼️ IMAGE CONFIG */}
                                    {section.type === "image" && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                            Image URL
                                          </label>
                                          <input
                                            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                                            placeholder="https://example.com/logo.png"
                                            value={section.src || ""}
                                            onChange={(e) => {
                                              const s = [
                                                ...templateJson.sections,
                                              ];
                                              s[idx].src = e.target.value;
                                              setTemplateJson({
                                                ...templateJson,
                                                sections: s,
                                              });
                                            }}
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                            Alignment
                                          </label>
                                          <select
                                            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 outline-none"
                                            value={section.align || "center"}
                                            onChange={(e) => {
                                              const s = [
                                                ...templateJson.sections,
                                              ];
                                              s[idx].align = e.target.value;
                                              setTemplateJson({
                                                ...templateJson,
                                                sections: s,
                                              });
                                            }}
                                          >
                                            <option value="left">Left</option>
                                            <option value="center">
                                              Center
                                            </option>
                                            <option value="right">Right</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                            Height
                                          </label>
                                          <input
                                            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 outline-none"
                                            placeholder="e.g. 80px"
                                            value={section.height || ""}
                                            onChange={(e) => {
                                              const s = [
                                                ...templateJson.sections,
                                              ];
                                              s[idx].height = e.target.value;
                                              setTemplateJson({
                                                ...templateJson,
                                                sections: s,
                                              });
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* 📝 TEXT CONFIG */}
                                    {section.type === "text" && (
                                      <div className="space-y-3">
                                        <div>
                                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                            Content
                                          </label>
                                          <textarea
                                            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-indigo-500 outline-none min-h-[80px]"
                                            placeholder="Enter text..."
                                            value={section.content || ""}
                                            onChange={(e) => {
                                              const s = [
                                                ...templateJson.sections,
                                              ];
                                              s[idx].content = e.target.value;
                                              setTemplateJson({
                                                ...templateJson,
                                                sections: s,
                                              });
                                            }}
                                          />
                                        </div>
                                        <div className="flex gap-4">
                                          <div className="flex-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                              Font Size
                                            </label>
                                            <input
                                              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 outline-none"
                                              value={section.fontSize || ""}
                                              onChange={(e) => {
                                                const s = [
                                                  ...templateJson.sections,
                                                ];
                                                s[idx].fontSize =
                                                  e.target.value;
                                                setTemplateJson({
                                                  ...templateJson,
                                                  sections: s,
                                                });
                                              }}
                                            />
                                          </div>
                                          <div className="flex items-center pt-5">
                                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                              <input
                                                type="checkbox"
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                                checked={!!section.bold}
                                                onChange={(e) => {
                                                  const s = [
                                                    ...templateJson.sections,
                                                  ];
                                                  s[idx].bold =
                                                    e.target.checked;
                                                  setTemplateJson({
                                                    ...templateJson,
                                                    sections: s,
                                                  });
                                                }}
                                              />
                                              <span className="font-medium">
                                                Bold Text
                                              </span>
                                            </label>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* 📇 GRID CONFIG */}
                                    {section.type === "header" && (
                                      <div className="space-y-3">
                                        {section.fields?.map(
                                          (f: any, fIdx: number) => (
                                            <div
                                              key={fIdx}
                                              className="flex gap-2 items-center bg-slate-50 p-2 rounded-md border border-slate-200"
                                            >
                                              <div className="flex-1">
                                                <input
                                                  className="w-full text-sm bg-white border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                  placeholder="Label Name"
                                                  value={f.label}
                                                  onChange={(e) => {
                                                    const s = [
                                                      ...templateJson.sections,
                                                    ];
                                                    s[idx].fields[fIdx].label =
                                                      e.target.value;
                                                    setTemplateJson({
                                                      ...templateJson,
                                                      sections: s,
                                                    });
                                                  }}
                                                />
                                              </div>
                                              <div className="text-slate-400">
                                                →
                                              </div>
                                              <div className="flex-1">
                                                <select
                                                  className="w-full text-sm bg-white border border-slate-300 rounded px-2 py-1.5 outline-none"
                                                  value={f.column}
                                                  onChange={(e) => {
                                                    const s = [
                                                      ...templateJson.sections,
                                                    ];
                                                    s[idx].fields[fIdx].column =
                                                      e.target.value;
                                                    setTemplateJson({
                                                      ...templateJson,
                                                      sections: s,
                                                    });
                                                  }}
                                                >
                                                  <option value="">
                                                    Select Field...
                                                  </option>
                                                  {availableColumns.map((c) => (
                                                    <option
                                                      key={c.name}
                                                      value={c.name}
                                                    >
                                                      {c.label}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>
                                              <button
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="Remove Field"
                                                onClick={() => {
                                                  const s = [
                                                    ...templateJson.sections,
                                                  ];
                                                  s[idx].fields.splice(fIdx, 1);
                                                  setTemplateJson({
                                                    ...templateJson,
                                                    sections: s,
                                                  });
                                                }}
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          )
                                        )}
                                        <button
                                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-2 px-2 py-1 hover:bg-indigo-50 rounded"
                                          onClick={() => {
                                            const s = [
                                              ...templateJson.sections,
                                            ];
                                            s[idx].fields.push({
                                              label: "",
                                              column: "",
                                            });
                                            setTemplateJson({
                                              ...templateJson,
                                              sections: s,
                                            });
                                          }}
                                        >
                                          + Add New Field
                                        </button>
                                      </div>
                                    )}

                                    {/* 📊 TABLE CONFIG */}
                                    {section.type === "table" && (
                                      <div className="space-y-4">
                                        <div>
                                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                            Table Title
                                          </label>
                                          <input
                                            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 outline-none"
                                            placeholder="e.g. Semester Marks"
                                            value={section.title || ""}
                                            onChange={(e) => {
                                              const s = [
                                                ...templateJson.sections,
                                              ];
                                              s[idx].title = e.target.value;
                                              setTemplateJson({
                                                ...templateJson,
                                                sections: s,
                                              });
                                            }}
                                          />
                                        </div>

                                        <div className="space-y-2">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase block">
                                            Columns
                                          </label>
                                          {section.columns?.map(
                                            (c: any, cIdx: number) => (
                                              <div
                                                key={cIdx}
                                                className="flex gap-2 items-center bg-slate-50 p-2 rounded-md border border-slate-200"
                                              >
                                                <div className="w-8 text-center text-xs font-bold text-slate-400">
                                                  {cIdx + 1}
                                                </div>
                                                <input
                                                  className="flex-1 text-sm bg-white border border-slate-300 rounded px-2 py-1.5 outline-none"
                                                  placeholder="Header Text"
                                                  value={c.label}
                                                  onChange={(e) => {
                                                    const s = [
                                                      ...templateJson.sections,
                                                    ];
                                                    s[idx].columns[cIdx].label =
                                                      e.target.value;
                                                    setTemplateJson({
                                                      ...templateJson,
                                                      sections: s,
                                                    });
                                                  }}
                                                />
                                                <select
                                                  className="flex-1 text-sm bg-white border border-slate-300 rounded px-2 py-1.5 outline-none"
                                                  value={c.column}
                                                  onChange={(e) => {
                                                    const s = [
                                                      ...templateJson.sections,
                                                    ];
                                                    s[idx].columns[
                                                      cIdx
                                                    ].column = e.target.value;
                                                    setTemplateJson({
                                                      ...templateJson,
                                                      sections: s,
                                                    });
                                                  }}
                                                >
                                                  <option value="">
                                                    Map Data...
                                                  </option>
                                                  {availableColumns.map(
                                                    (col) => (
                                                      <option
                                                        key={col.name}
                                                        value={col.name}
                                                      >
                                                        {col.label}
                                                      </option>
                                                    )
                                                  )}
                                                </select>
                                                <button
                                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                  onClick={() => {
                                                    const s = [
                                                      ...templateJson.sections,
                                                    ];
                                                    s[idx].columns.splice(
                                                      cIdx,
                                                      1
                                                    );
                                                    setTemplateJson({
                                                      ...templateJson,
                                                      sections: s,
                                                    });
                                                  }}
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            )
                                          )}
                                        </div>

                                        <button
                                          className="w-full py-2 border border-dashed border-indigo-300 text-indigo-600 rounded-md text-xs font-bold hover:bg-indigo-50 transition-colors"
                                          onClick={() => {
                                            const s = [
                                              ...templateJson.sections,
                                            ];
                                            s[idx].columns.push({
                                              label: "",
                                              column: "",
                                            });
                                            setTemplateJson({
                                              ...templateJson,
                                              sections: s,
                                            });
                                          }}
                                        >
                                          + Add Column
                                        </button>
                                      </div>
                                    )}

                                    {/* ✍️ SIGNATURE CONFIG */}
                                    {section.type === "signature" && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="col-span-2 md:col-span-1">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                            Label
                                          </label>
                                          <input
                                            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 outline-none"
                                            placeholder="e.g. Principal Signature"
                                            value={section.label || ""}
                                            onChange={(e) => {
                                              const s = [
                                                ...templateJson.sections,
                                              ];
                                              s[idx].label = e.target.value;
                                              setTemplateJson({
                                                ...templateJson,
                                                sections: s,
                                              });
                                            }}
                                          />
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                            Signature Image URL
                                          </label>
                                          <input
                                            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 outline-none"
                                            placeholder="(Optional)"
                                            value={section.src || ""}
                                            onChange={(e) => {
                                              const s = [
                                                ...templateJson.sections,
                                              ];
                                              s[idx].src = e.target.value;
                                              setTemplateJson({
                                                ...templateJson,
                                                sections: s,
                                              });
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <DrillThroughConfig
                  drillConfig={drillConfig}
                  setDrillConfig={setDrillConfig}
                  availableReports={availableReports}
                  tableColumns={tableColumns}
                  targetReportFields={targetReportFields}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. RIGHT PANEL: Preview & Notifications */}
      <PreviewPanel
        previewData={previewData}
        isLoadingPreview={isLoadingPreview}
        previewConfig={previewConfig}
        message={message}
      />
    </div>
  );
};

export default ReportBuilder;

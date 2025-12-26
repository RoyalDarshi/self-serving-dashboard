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

const ReportBuilder: React.FC<Props> = ({ connections, onSaved, initialReportId }) => {
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

          setName(report.name);
          setDescription(report.description || "");
          setConnectionId(report.connection_id);
          setMode((report.report_type as ReportMode) || "TABLE");
          setBaseTable(report.base_table);
          setSqlText(report.sql_text || "");

          const vizConfig =
            typeof report.visualization_config === "string"
              ? JSON.parse(report.visualization_config || "{}")
              : report.visualization_config || {};

          const tCols = (columns || [])
            .filter((c: any) => c.visible)
            .map((c: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              name: c.column_name,
              table_name: c.table_name || report.base_table,
              alias: c.alias,
              type: c.data_type || "string",
            }));
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

          setFilters(filters || []);

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

                  {templateType === "MARKSHEET" && templateJson && (
                    <>
                      {/* ================= HEADER SECTION ================= */}
                      <div className="border rounded p-3 space-y-3">
                        <h4 className="text-sm font-semibold">
                          Header Section
                        </h4>

                        {Array.isArray(templateJson.sections) &&
                          templateJson.sections
                            .find((s: any) => s.type === "header")
                            ?.fields?.map((f: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex gap-2 items-center"
                              >
                                <input
                                  className="border px-2 py-1 text-sm w-40"
                                  placeholder="Label"
                                  value={f.label}
                                  onChange={(e) => {
                                    const sections = [...templateJson.sections];
                                    const header = sections.find(
                                      (s: any) => s.type === "header"
                                    );
                                    if (!header) return;
                                    header.fields.push({
                                      label: "",
                                      column: "",
                                    });

                                    setTemplateJson({
                                      ...templateJson,
                                      sections,
                                    });
                                  }}
                                />

                                <select
                                  className="border px-2 py-1 text-sm flex-1"
                                  value={f.column || ""}
                                  onChange={(e) => {
                                    const sections = [...templateJson.sections];
                                    const header = sections.find(
                                      (s) => s.type === "header"
                                    );
                                    header.fields[idx].column = e.target.value;
                                    setTemplateJson({
                                      ...templateJson,
                                      sections,
                                    });
                                  }}
                                >
                                  <option value="">Select column</option>
                                  {availableColumns.map((c) => (
                                    <option key={c.name} value={c.name}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}

                        <button
                          className="text-xs text-indigo-600"
                          onClick={() => {
                            if (!Array.isArray(templateJson.sections)) return;

                            const sections = [...templateJson.sections];
                            const header = sections.find(
                              (s: any) => s.type === "header"
                            );

                            if (!header) return; // 🔥 SAFETY

                            header.fields.push({ label: "", column: "" });

                            setTemplateJson({ ...templateJson, sections });
                          }}
                        >
                          + Add Header Field
                        </button>
                      </div>
                      {/* ================= TABLE SECTION ================= */}
                      <div className="border rounded p-3 space-y-3">
                        <h4 className="text-sm font-semibold">Table Section</h4>

                        <input
                          className="border px-2 py-1 text-sm w-48"
                          placeholder="Table Title"
                          value={
                            templateJson.sections.find(
                              (s: any) => s.type === "table"
                            )?.title || ""
                          }
                          onChange={(e) => {
                            const sections = [...templateJson.sections];
                            const table = sections.find(
                              (s) => s.type === "table"
                            );
                            table.title = e.target.value;
                            setTemplateJson({ ...templateJson, sections });
                          }}
                        />

                        {Array.isArray(templateJson.sections) &&
                          templateJson.sections
                            .find((s: any) => s.type === "table")
                            ?.columns?.map((c: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex gap-2 items-center"
                              >
                                <input
                                  className="border px-2 py-1 text-sm w-40"
                                  placeholder="Column Label"
                                  value={c.label}
                                  onChange={(e) => {
                                    const sections = [...templateJson.sections];
                                    const table = sections.find(
                                      (s) => s.type === "table"
                                    );
                                    table.columns[idx].label = e.target.value;
                                    setTemplateJson({
                                      ...templateJson,
                                      sections,
                                    });
                                  }}
                                />

                                <select
                                  className="border px-2 py-1 text-sm flex-1"
                                  value={c.column || ""}
                                  onChange={(e) => {
                                    const sections = [...templateJson.sections];
                                    const table = sections.find(
                                      (s) => s.type === "table"
                                    );
                                    table.columns[idx].column = e.target.value;
                                    setTemplateJson({
                                      ...templateJson,
                                      sections,
                                    });
                                  }}
                                >
                                  <option value="">Select column</option>
                                  {availableColumns.map((c) => (
                                    <option key={c.name} value={c.name}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}

                        <button
                          className="text-xs text-green-600"
                          onClick={() => {
                            if (!Array.isArray(templateJson.sections)) return;

                            const sections = [...templateJson.sections];
                            const table = sections.find(
                              (s: any) => s.type === "table"
                            );

                            if (!table) return; // 🔥 SAFETY

                            table.columns.push({ label: "", column: "" });

                            setTemplateJson({ ...templateJson, sections });
                          }}
                        >
                          + Add Table Column
                        </button>
                      </div>
                    </>
                  )}
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
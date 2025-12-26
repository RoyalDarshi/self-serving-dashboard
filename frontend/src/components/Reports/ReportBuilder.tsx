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
}

type ReportMode = "TABLE" | "SEMANTIC" | "SQL";

const ReportBuilder: React.FC<Props> = ({ connections, onSaved }) => {
  // UI State
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [mode, setMode] = useState<ReportMode>("TABLE");
  const [sqlText, setSqlText] = useState("");

  // --- Data Source State ---
  const [connectionId, setConnectionId] = useState<number | null>(
    connections[0]?.id || null
  );
  const [baseTable, setBaseTable] = useState<string>("");
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Semantic Data
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);

  // --- Report Meta ---
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [description] = useState(""); // Description state exists but not used in UI in original code

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

  // Load Initial Data
  useEffect(() => {
    if (connectionId) {
      apiService.getSchemas(connectionId).then(setSchemas);
      // Always fetch facts/dims so they are ready if user switches mode
      apiService.getFacts(connectionId).then(setFacts);
      apiService.getDimensions(connectionId).then(setDimensions);
    }
    apiService.getReports().then(setAvailableReports);
  }, [connectionId]);

  // Fetch Drill Fields when Target Report Changes
  useEffect(() => {
    if (drillConfig.targetReportId !== 0) {
      apiService
        .getReportDrillFields(drillConfig.targetReportId)
        .then((fields) => {
          // 🔥 Normalize backend fields → UI expected shape
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

  // --- Handlers ---

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
    setFilters([
      ...filters,
      {
        column_name: item.name,
        table_name: item.table_name || baseTable,
        operator: "=",
        value: "",
        is_user_editable: true,
        order_index: filters.length,
      },
    ]);
  };

  // --- Payload Construction ---
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
      table_name: c.table_name || baseTable,   // 🔥 CRITICAL
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

    // Semantic Config
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
    };
  };

  const handleRun = async () => {
    if (!connectionId) {
      setMessage({ type: "error", text: "Please select a data source." });
      return;
    }
    if (mode === "TABLE" && !baseTable) return;
    if (mode === "SEMANTIC" && tableColumns.length === 0) return;

    setIsLoadingPreview(true);
    setPreviewData(null);

    const payload = constructPayload();

    // 🔴 ADD THIS SAFETY
    if (mode === "SEMANTIC") {
      payload.base_table = "SEMANTIC";
    }

    const config: FullReportConfig = {
      report: {
        id: 0,
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

    try {
      const res = await apiService.previewReport(payload);

      if (res.success && res.data) {
        setPreviewData(res.data);
        setMessage({ type: "success", text: "Query executed successfully" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({
          type: "error",
          text: res.error || "Failed to fetch preview data",
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
      setMessage({
        type: "error",
        text: "Please enter a report name before saving.",
      });
      return;
    }

    if (mode === "TABLE" && !baseTable) {
      setMessage({
        type: "error",
        text: "Please select a data source table.",
      });
      return;
    }
    if (mode === "SEMANTIC" && tableColumns.length === 0) {
      setMessage({
        type: "error",
        text: "Please select at least one fact or dimension.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = constructPayload();
      const res = await apiService.saveReport(payload as any);
      if (res.success && res.reportId) {
        setMessage({ type: "success", text: "Report saved successfully!" });
        setTimeout(() => setMessage(null), 3000);
        if (onSaved) onSaved(res.reportId);
      } else {
        setMessage({ type: "error", text: res.error || "Failed to save." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const canRun =
    (mode === "TABLE" && !!baseTable) ||
    (mode === "SEMANTIC" && tableColumns.length > 0);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans text-slate-800 overflow-hidden">
      {/* 1. LEFT PANEL: Data Source */}
      <DataSourcePanel
        leftPanelCollapsed={leftPanelCollapsed}
        setLeftPanelCollapsed={setLeftPanelCollapsed}
        connections={connections}
        connectionId={connectionId}
        onConnectionChange={(id) => {
          setConnectionId(id);
          setBaseTable("");
          setTableColumns([]);
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

      {/* 2. MIDDLE PANEL: Configuration */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
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

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
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

          {mode !== "SQL" && (
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
          )}

          <FiltersConfig
            filters={filters}
            setFilters={setFilters}
            handleDropFilter={handleDropFilter}
          />

          {mode !== "SQL" && (
            <DrillThroughConfig
              drillConfig={drillConfig}
              setDrillConfig={setDrillConfig}
              availableReports={availableReports}
              tableColumns={tableColumns}
              targetReportFields={targetReportFields}
            />
          )}
        </div>
      </div>

      {/* 3. RIGHT PANEL: Preview */}
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

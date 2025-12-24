// DynamicSemanticChartBuilder.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import { v4 as uuidv4 } from "uuid";
import { apiService } from "../../services/api";
import ChartDropZone from "./ChartDropZone";
import ChartDataTable from "./ChartDataTable";
import SqlQueryDisplay from "./SqlQueryDisplay";
import ChartControls from "./ChartControls";
import ChartDisplay from "./ChartDisplay";
import { Download, Plus } from "lucide-react";

// ... [Keep Interfaces exactly as they are] ...
interface Fact {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
  aggregate_function: string;
}
interface Dimension {
  id: number;
  name: string;
  column_name: string;
}
interface ChartDataItem {
  name: string;
  [key: string]: number | string;
}
interface AggregationResponse {
  sql?: string;
  rows?: ChartDataItem[];
  error?: string;
}
type AggregationType =
  | "SUM"
  | "AVG"
  | "COUNT"
  | "MAX"
  | "MIN"
  | "MEDIAN"
  | "STDDEV"
  | "VARIANCE";
interface Column {
  key: string;
  label: string;
  type: "number" | "string";
  [key: string]: any;
}

interface ChartConfig {
  id?: string;
  xAxisDimension: Dimension | null;
  yAxisFacts: Fact[];
  groupByDimension: Dimension | null;
  chartType: "bar" | "line" | "pie";
  aggregationType: AggregationType;
  stacked: boolean;
  title?: string;
  description?: string;
  createdAt?: string;
  lastModified?: string;
}

interface DynamicSemanticChartBuilderProps {
  dashboards: {
    id: string;
    name: string;
    description?: string;
    connectionId: number;
    charts: ChartConfig[];
    layout: any[];
  }[];
  addNewDashboard: (name: string, description?: string) => Promise<string>;
  selectedConnectionId: number | null;
  refreshDashboards: () => Promise<void>;
}

const DynamicSemanticChartBuilder: React.FC<
  DynamicSemanticChartBuilderProps
> = ({
  dashboards,
  addNewDashboard,
  selectedConnectionId,
  refreshDashboards,
}) => {
  const [xAxisDimension, setXAxisDimension] = useState<Dimension | null>(null);
  const [yAxisFacts, setYAxisFacts] = useState<Fact[]>([]);
  const [groupByDimension, setGroupByDimension] = useState<Dimension | null>(
    null
  );
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [aggregationType, setAggregationType] =
    useState<AggregationType>("SUM");
  const [yAxisColumns, setYAxisColumns] = useState<Column[]>([]);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stacked, setStacked] = useState(true);
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [activeView, setActiveView] = useState<"graph" | "table" | "query">(
    "graph"
  );

  // 🟢 FIX 1: Add a Ref to track the latest request ID
  const lastRequestId = useRef<number>(0);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<string>("");
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardDescription, setNewDashboardDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const getValidAggregationType = (
    aggregateFunction: string
  ): AggregationType => {
    const validAggregations: AggregationType[] = [
      "SUM",
      "AVG",
      "COUNT",
      "MAX",
      "MIN",
      "MEDIAN",
      "STDDEV",
      "VARIANCE",
    ];
    const upperCaseFunction = aggregateFunction.toUpperCase();
    return validAggregations.includes(upperCaseFunction as AggregationType)
      ? (upperCaseFunction as AggregationType)
      : "SUM";
  };

  // 🟢 FIX 2: Removed the "Reset" useEffect.
  // We will handle clearing data inside generateChartData to avoid conflicts.

  // Set aggregation type based on the first fact's aggregate_function
  useEffect(() => {
    if (yAxisFacts.length > 0 && yAxisFacts[0].aggregate_function) {
      const newAggregationType = getValidAggregationType(
        yAxisFacts[0].aggregate_function
      );
      setAggregationType(newAggregationType);
    } else {
      setAggregationType("SUM");
    }
  }, [yAxisFacts]);

  // Generate chart data when configuration changes
  useEffect(() => {
    if (xAxisDimension && yAxisFacts.length > 0) {
      generateChartData();
    }
  }, [
    xAxisDimension,
    yAxisFacts,
    groupByDimension,
    aggregationType,
    chartType,
  ]);

  useEffect(() => {
    if (showDashboardModal) {
      const availableDashboards = dashboards.filter(
        (d) => d.connectionId === selectedConnectionId
      );
      if (availableDashboards.length > 0 && !selectedDashboard) {
        setSelectedDashboard(availableDashboards[0].id);
      }
      setSuccess(null);
      setError(null);
    }
  }, [showDashboardModal, dashboards, selectedConnectionId, selectedDashboard]);

  const generateChartData = useCallback(async () => {
    if (!selectedConnectionId) {
      setError("No connection selected");
      return;
    }

    if (yAxisFacts.length === 0 || !xAxisDimension) {
      setError(
        "Please select at least one fact for Y-axis and a dimension for X-axis"
      );
      return;
    }

    // 1. Setup Request ID to prevent race conditions
    const requestId = lastRequestId.current + 1;
    lastRequestId.current = requestId;

    setLoading(true);
    setError(null);

    // Clear data only if we are starting a fresh valid request
    setChartData([]);
    setYAxisColumns([]);
    setGeneratedQuery("");

    try {
      const dimensionIds = [xAxisDimension.id];
      if (groupByDimension && groupByDimension.id !== xAxisDimension.id) {
        dimensionIds.push(groupByDimension.id);
      }

      const baseTable = yAxisFacts[0]?.table_name;

      if (!baseTable) {
        if (requestId === lastRequestId.current) {
          setError("Unable to determine base table from selected fact");
          setLoading(false);
        }
        return;
      }

      const body = {
        connection_id: selectedConnectionId,
        base_table: baseTable,
        factIds: yAxisFacts.map((f) => f.id),
        dimensionIds,
        aggregation: aggregationType,
      };

      const res: AggregationResponse = await apiService.runQuery(body);

      // 2. Check for stale request
      if (requestId !== lastRequestId.current) {
        return;
      }

      if (res.rows && res.sql) {
        // ✅ HELPER: Case-insensitive value lookup
        // This solves the issue where DB returns 'sales' but we look for 'Sales'
        const getValue = (row: any, possibleKeys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const key of possibleKeys) {
            // 1. Try exact match
            if (row[key] !== undefined && row[key] !== null) return row[key];

            // 2. Try case-insensitive match
            const foundKey = rowKeys.find(
              (k) => k.toLowerCase() === key.toLowerCase()
            );
            if (
              foundKey &&
              row[foundKey] !== undefined &&
              row[foundKey] !== null
            ) {
              return row[foundKey];
            }
          }
          return null;
        };

        const xKeys = [xAxisDimension.column_name, xAxisDimension.name];
        const gKeys = groupByDimension
          ? [groupByDimension.column_name, groupByDimension.name]
          : [];

        const dataMap = new Map<string, ChartDataItem>();
        const groupSet = new Set<string>();

        res.rows.forEach((row) => {
          // A. Resolve X-Axis Value
          const rawX = getValue(row, xKeys);
          const xValue = rawX !== null ? String(rawX).trim() : null;

          if (!xValue) return; // Skip invalid rows

          // B. Resolve Group-By Value
          let gValue: string | null = null;
          if (groupByDimension) {
            const rawG = getValue(row, gKeys);
            if (rawG !== null) {
              gValue = String(rawG).trim();
            }
          }

          // C. Initialize Data Item
          if (!dataMap.has(xValue)) {
            dataMap.set(xValue, { name: xValue });
          }
          const item = dataMap.get(xValue)!;

          // D. Extract Facts/Metrics
          yAxisFacts.forEach((fact) => {
            const factKeys = [fact.name, fact.column_name];
            const val = getValue(row, factKeys);

            if (val !== null) {
              const parsedVal = parseFloat(String(val));
              if (!isNaN(parsedVal)) {
                if (gValue) {
                  // Dynamic column for Group By (e.g., "2023_Sales")
                  const key = `${gValue}_${fact.name}`;
                  item[key] = parsedVal;
                  groupSet.add(key);
                } else {
                  // Standard column (e.g., "Sales")
                  item[fact.name] = parsedVal;
                }
              }
            }
          });
        });

        // 3. Normalize and Filter Data
        let normalizedData = Array.from(dataMap.values()).filter((item) => {
          return Object.keys(item).some(
            (key) => key !== "name" && item[key] != null
          );
        });

        // 4. Sort by Total Value (Desc)
        normalizedData.sort((a, b) => {
          const getSum = (obj: any) =>
            Object.entries(obj)
              .filter(([key]) => key !== "name")
              .reduce(
                (sum, [, val]) => sum + (typeof val === "number" ? val : 0),
                0
              );
          return getSum(b) - getSum(a);
        });

        // 5. Generate Dynamic Columns
        const newYAxisColumns: Column[] = groupByDimension
          ? Array.from(groupSet).map((g) => ({
              key: g,
              label: g,
              type: "number",
            }))
          : yAxisFacts.map((fact) => ({
              ...fact,
              key: fact.name,
              label: fact.name,
              type: "number",
            }));

        setChartData(normalizedData);
        setYAxisColumns(newYAxisColumns);
        setGeneratedQuery(res.sql);
        setStacked(
          chartType === "bar" &&
            (groupByDimension !== null || yAxisFacts.length > 1)
        );
      } else {
        setError(res.error || "No data returned from query.");
        setChartData([]);
        setYAxisColumns([]);
        setGeneratedQuery("");
      }
    } catch (error) {
      if (requestId === lastRequestId.current) {
        setError("Error generating chart: " + (error as Error).message);
      }
    } finally {
      if (requestId === lastRequestId.current) {
        setLoading(false);
      }
    }
  }, [
    selectedConnectionId,
    xAxisDimension,
    yAxisFacts,
    groupByDimension,
    aggregationType,
    chartType,
  ]);

  // ... [Keep the rest of the file exactly as it is (handleDownloadGraph, handlers, return JSX)] ...
  // (Just copy the rest of your original file from `handleDownloadGraph` onwards)

  const handleDownloadGraph = () => {
    if (chartContainerRef.current) {
      html2canvas(chartContainerRef.current).then((canvas) => {
        const link = document.createElement("a");
        link.download = "chart.png";
        link.href = canvas.toDataURL();
        link.click();
      });
    }
  };

  const handleDownloadTable = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent(
        ["name," + yAxisColumns.map((c) => c.label).join(",")].join("\n") +
          "\n" +
          chartData
            .map((row) =>
              [row.name, ...yAxisColumns.map((c) => row[c.key] || "")].join(",")
            )
            .join("\n")
      );
    const link = document.createElement("a");
    link.href = csvContent;
    link.download = "chart_data.csv";
    link.click();
  };

  const valueFormatter = (value: number | string) => {
    if (typeof value === "number") {
      return value.toLocaleString();
    }
    return value;
  };

  const handleAddToDashboard = () => {
    setShowDashboardModal(true);
  };

  const handleCreateNewDashboard = async () => {
    if (!newDashboardName.trim() || !selectedConnectionId) {
      setError("Dashboard name and connection are required");
      return;
    }

    setIsSaving(true);
    try {
      const newId = await addNewDashboard(
        newDashboardName,
        newDashboardDescription
      );
      // Create tempDashboard since state may not be updated yet
      const tempDashboard = {
        id: newId,
        name: newDashboardName,
        description: newDashboardDescription,
        connectionId: selectedConnectionId,
        charts: [],
        layout: [],
      };
      await handleSaveToDashboard(newId, tempDashboard);
      setNewDashboardName("");
      setNewDashboardDescription("");
    } catch (error) {
      console.error("Error creating new dashboard:", error);
      setError(`Failed to create new dashboard: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToDashboard = async (
    dashboardId: string,
    tempDashboard?: {
      id: string;
      name: string;
      description?: string;
      connectionId: number;
      charts: ChartConfig[];
      layout: any[];
    }
  ) => {
    if (!xAxisDimension || yAxisFacts.length === 0) {
      setError("Incomplete chart configuration");
      return;
    }

    if (!dashboardId) {
      setError("Invalid dashboard ID");
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    // Generate dynamic chart title
    const factNames = yAxisFacts.map((fact) => fact.name).join(" and ");
    const xAxisName = xAxisDimension.name;
    const groupByName = groupByDimension
      ? ` Grouped by ${groupByDimension.name}`
      : "";
    const title = `${factNames} ${aggregationType} by ${xAxisName}${groupByName}`;

    const chartConfig: ChartConfig = {
      id: uuidv4(),
      xAxisDimension,
      yAxisFacts,
      groupByDimension,
      chartType,
      aggregationType,
      stacked,
      title,
      description: "",
    };

    try {
      // Use tempDashboard if provided (for new), else find in state
      const dashboard =
        tempDashboard || dashboards.find((d) => d.id === dashboardId);
      if (!dashboard) {
        setError("Dashboard not found");
        return;
      }

      if (dashboard.connectionId !== selectedConnectionId) {
        setError("Connection ID mismatch");
        return;
      }

      // Calculate new chart index and layout item consistently
      const chartIndex = dashboard.charts.length;
      const newLayoutItem = {
        i: chartConfig.id,
        x: (chartIndex % 2) * 6,
        y: Math.floor(chartIndex / 2) * 7,
        w: 6,
        h: 7,
        minW: 3,
        minH: 3,
      };

      // Prepare updated dashboard data
      const updatedCharts = [...dashboard.charts, chartConfig];
      const updatedLayout = [...dashboard.layout, newLayoutItem];

      // Update dashboard via API
      const response = await apiService.updateDashboard(dashboardId, {
        name: dashboard.name,
        description: dashboard.description,
        charts: updatedCharts,
        layout: updatedLayout,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to update dashboard");
      }

      // Refresh dashboards to sync state
      await refreshDashboards();

      setSuccess(
        `Chart "${title}" added to dashboard "${dashboard.name}" successfully`
      );
      setShowDashboardModal(false); // Close modal after success
      setSelectedDashboard("");
      setError(null);
    } catch (error) {
      console.error("Error saving chart to dashboard:", error);
      setError(
        `Failed to save chart to dashboard: ${(error as Error).message}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const availableDashboards = dashboards.filter(
    (d) => d.connectionId === selectedConnectionId
  );

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
      <ChartDropZone
        setXAxisDimension={setXAxisDimension}
        setYAxisFacts={setYAxisFacts}
        setGroupByDimension={setGroupByDimension}
        xAxisDimension={xAxisDimension}
        yAxisFacts={yAxisFacts}
        groupByDimension={groupByDimension}
      />

      <ChartControls
        chartType={chartType}
        setChartType={setChartType}
        aggregationType={aggregationType}
        setAggregationType={setAggregationType}
        chartData={chartData}
        handleAddToDashboard={handleAddToDashboard}
        handleDownloadGraph={handleDownloadGraph}
        handleDownloadTable={handleDownloadTable}
        stacked={stacked}
        setStacked={setStacked}
        activeView={activeView}
        setActiveView={setActiveView}
        yAxisCount={yAxisColumns.length}
        groupByColumn={
          groupByDimension
            ? {
                ...groupByDimension,
                key: groupByDimension.name,
                label: groupByDimension.name,
                type: "string",
              }
            : null
        }
        isSaving={isSaving}
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      {success && (
        <p className="text-green-500 text-sm mb-4 flex items-center">
          {success}
          <button
            onClick={() => setSuccess(null)}
            className="ml-2 text-green-700 hover:text-green-900"
          >
            ✕
          </button>
        </p>
      )}

      {activeView === "graph" && (
        <ChartDisplay
          chartContainerRef={chartContainerRef}
          chartType={chartType}
          chartData={chartData}
          xAxisColumn={
            xAxisDimension
              ? {
                  ...xAxisDimension,
                  key: xAxisDimension.name,
                  label: xAxisDimension.name,
                  type: "string",
                }
              : null
          }
          yAxisColumns={yAxisColumns}
          groupByColumn={
            groupByDimension
              ? {
                  ...groupByDimension,
                  key: groupByDimension.name,
                  label: groupByDimension.name,
                  type: "string",
                }
              : null
          }
          aggregationType={aggregationType}
          loading={loading}
          error={error}
          stacked={stacked}
          height={360}
        />
      )}
      {activeView === "table" && (
        <ChartDataTable
          chartData={chartData}
          xAxisColumn={
            xAxisDimension
              ? {
                  ...xAxisDimension,
                  key: xAxisDimension.name,
                  label: xAxisDimension.name,
                  type: "string",
                }
              : null
          }
          yAxisColumns={yAxisColumns}
          groupByColumn={
            groupByDimension
              ? {
                  ...groupByDimension,
                  key: groupByDimension.name,
                  label: groupByDimension.name,
                  type: "string",
                }
              : null
          }
          aggregationType={aggregationType}
          valueFormatter={valueFormatter}
        />
      )}
      {activeView === "query" && (
        <SqlQueryDisplay generatedQuery={generatedQuery} />
      )}

      {showDashboardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Add Chart to Dashboard
              </h2>
              <div className="space-y-4">
                {availableDashboards.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Dashboard
                    </label>
                    <select
                      value={selectedDashboard}
                      onChange={(e) => setSelectedDashboard(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a dashboard</option>
                      {availableDashboards.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 mb-2">
                    No dashboards found for this connection. Create a new one
                    below.
                  </p>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {availableDashboards.length > 0
                      ? "Or New Dashboard Name"
                      : "New Dashboard Name"}
                  </label>
                  <input
                    type="text"
                    value={newDashboardName}
                    onChange={(e) => setNewDashboardName(e.target.value)}
                    placeholder="Enter new dashboard name..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newDashboardDescription}
                    onChange={(e) => setNewDashboardDescription(e.target.value)}
                    placeholder="Describe the dashboard..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowDashboardModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                {availableDashboards.length > 0 && (
                  <button
                    onClick={() => handleSaveToDashboard(selectedDashboard)}
                    disabled={!selectedDashboard || isSaving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add to Selected
                  </button>
                )}
                <button
                  onClick={handleCreateNewDashboard}
                  disabled={!newDashboardName.trim() || isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create and Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicSemanticChartBuilder;

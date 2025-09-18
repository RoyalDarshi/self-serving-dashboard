import React, { useState, useEffect, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import { v4 as uuidv4 } from "uuid";
import { apiService } from "../services/api";
import ChartDropZone from "./ChartDropZone";
import ChartDataTable from "./ChartDataTable";
import SqlQueryDisplay from "./SqlQueryDisplay";
import ChartControls from "./ChartControls";
import ChartDisplay from "./ChartDisplay";
import { Download, Plus } from "lucide-react";
import { debounce } from "lodash";

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
  addChartToDashboard: (config: ChartConfig, dashboardId: string) => void;
  selectedConnectionId: number | null;
}

const DynamicSemanticChartBuilder: React.FC<
  DynamicSemanticChartBuilderProps
> = ({
  dashboards,
  addNewDashboard,
  addChartToDashboard,
  selectedConnectionId,
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
  const [stacked, setStacked] = useState(true);
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [activeView, setActiveView] = useState<"graph" | "table" | "query">(
    "graph"
  );
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<string>("");
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardDescription, setNewDashboardDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Validate and map fact's aggregate_function to AggregationType
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
      : "SUM"; // Fallback to SUM if invalid
  };

  // Reset chart data and related states when axes or group-by changes
  useEffect(() => {
    setChartData([]);
    setYAxisColumns([]);
    setGeneratedQuery("");
    setError(null);
  }, [xAxisDimension, yAxisFacts, groupByDimension]);

  // Set aggregation type based on the first fact's aggregate_function
  useEffect(() => {
    if (yAxisFacts.length > 0 && yAxisFacts[0].aggregate_function) {
      const newAggregationType = getValidAggregationType(
        yAxisFacts[0].aggregate_function
      );
      setAggregationType(newAggregationType);
    } else {
      setAggregationType("SUM"); // Default fallback when no facts are selected
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

    setLoading(true);
    setError(null);

    try {
      const dimensionIds = [xAxisDimension.id];
      if (groupByDimension && groupByDimension.id !== xAxisDimension.id) {
        dimensionIds.push(groupByDimension.id);
      }

      const body = {
        connection_id: selectedConnectionId,
        factIds: yAxisFacts.map((f) => f.id),
        dimensionIds,
        aggregation: aggregationType,
      };

      const res: AggregationResponse = await apiService.runQuery(body);
      if (res.rows && res.sql) {
        const xKey = xAxisDimension.column_name;
        const gKey = groupByDimension?.column_name;

        const dataMap = new Map<string, ChartDataItem>();
        const groupSet = new Set<string>();

        res.rows.forEach((row) => {
          const xValue = (row[xKey] || "").toString().trim();
          if (!xValue) return;

          const gValue = gKey ? (row[gKey] || "").toString().trim() : null;

          if (!dataMap.has(xValue)) {
            dataMap.set(xValue, { name: xValue });
          }

          const item = dataMap.get(xValue)!;

          if (gValue) {
            yAxisFacts.forEach((fact) => {
              const val = row[fact.name];
              if (val != null) {
                const parsedVal = parseFloat(val as string);
                if (!isNaN(parsedVal)) {
                  item[`${gValue}_${fact.name}`] = parsedVal;
                  groupSet.add(`${gValue}_${fact.name}`);
                }
              }
            });
          } else {
            yAxisFacts.forEach((fact) => {
              const val = row[fact.name];
              if (val != null) {
                const parsedVal = parseFloat(val as string);
                if (!isNaN(parsedVal)) {
                  item[fact.name] = parsedVal;
                }
              }
            });
          }
        });

        let normalizedData = Array.from(dataMap.values()).filter((item) => {
          return Object.keys(item).some(
            (key) => key !== "name" && item[key] != null
          );
        });

        normalizedData.sort((a, b) => {
          const aTotal = Object.entries(a)
            .filter(([key]) => key !== "name")
            .reduce(
              (sum, [, value]) => sum + (typeof value === "number" ? value : 0),
              0
            );
          const bTotal = Object.entries(b)
            .filter(([key]) => key !== "name")
            .reduce(
              (sum, [, value]) => sum + (typeof value === "number" ? value : 0),
              0
            );
          return bTotal - aTotal;
        });

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
        setError(
          res.error ||
            "Failed to generate chart data. Ensure fact-dimension mappings exist or run auto-mapping."
        );
        setChartData([]);
        setYAxisColumns([]);
        setGeneratedQuery("");
      }
    } catch (error) {
      setError("Error generating chart: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [
    selectedConnectionId,
    xAxisDimension,
    yAxisFacts,
    groupByDimension,
    aggregationType,
    chartType,
  ]);

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

  const handleCreateNewDashboard = debounce(async () => {
    if (newDashboardName.trim() && selectedConnectionId) {
      if (isSaving) return;
      setIsSaving(true);
      try {
        const dashboardId = await addNewDashboard(
          newDashboardName.trim(),
          newDashboardDescription
        );
        await handleSaveToDashboard(dashboardId);
      } catch (error) {
        console.error("Error creating and adding to dashboard:", error);
        setError("Failed to create new dashboard: " + error.message);
      } finally {
        setIsSaving(false);
      }
    } else {
      setError("Dashboard name and connection ID are required");
    }
  }, 1000);

  const handleSaveToDashboard = debounce(async (dashboardId: string) => {
    if (!xAxisDimension || yAxisFacts.length === 0) {
      setError("Incomplete chart configuration");
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    const chartConfig: ChartConfig = {
      id: uuidv4(),
      xAxisDimension,
      yAxisFacts,
      groupByDimension,
      chartType,
      aggregationType,
      stacked,
      title: "New Chart",
      description: "",
    };

    try {
      const dashboard = dashboards.find((d) => d.id === dashboardId);
      if (!dashboard) {
        setError("Dashboard not found");
        return;
      }

      if (dashboard.connectionId !== selectedConnectionId) {
        setError("Connection ID mismatch");
        return;
      }

      addChartToDashboard(chartConfig, dashboardId);

      const updatedCharts = [...dashboard.charts, chartConfig];
      const updatedLayout = [
        ...dashboard.layout,
        {
          i: chartConfig.id,
          x: 0,
          y: Infinity,
          w: 4,
          h: 4,
          minW: 3,
          minH: 3,
        },
      ];

      const response = await apiService.updateDashboard(dashboardId, {
        name: dashboard.name,
        description: dashboard.description,
        charts: updatedCharts,
        layout: updatedLayout,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to update dashboard");
      }

      setShowDashboardModal(false);
      setSelectedDashboard("");
      setNewDashboardName("");
      setNewDashboardDescription("");
      setError(null);
    } catch (error) {
      console.error("Error saving chart to dashboard:", error);
      setError("Failed to save chart to dashboard: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }, 1000);

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
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {chartData.length > 0 && (
        <div className="flex items-center space-x-2 ml-auto mb-2">
          {activeView === "graph" && (
            <button
              onClick={handleDownloadGraph}
              className="flex items-center space-x-1 px-4 py-2 bg-green-500 text-white rounded-lg"
            >
              <Download className="h-4 w-4" />
              <span>Graph</span>
            </button>
          )}
          {activeView === "table" && (
            <button
              onClick={handleDownloadTable}
              className="flex items-center space-x-1 px-4 py-2 bg-green-500 text-white rounded-lg"
            >
              <Download className="h-4 w-4" />
              <span>Table</span>
            </button>
          )}
          <button
            onClick={handleAddToDashboard}
            className="flex items-center space-x-1 px-4 py-2 bg-blue-500 text-white rounded-lg"
            disabled={isSaving}
          >
            <Plus className="h-4 w-4" />
            <span>Add to Dashboard</span>
          </button>
        </div>
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
        <div className="bg-gradient-to-b from-white to-slate-50 rounded-xl border p-1">
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
        </div>
      )}
      {activeView === "query" && (
        <div className="bg-gradient-to-b from-white to-slate-50 rounded-xl border p-1">
          <SqlQueryDisplay generatedQuery={generatedQuery} />
        </div>
      )}

      {showDashboardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Add Chart to Dashboard
              </h2>
              <div className="space-y-4">
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
                    {dashboards
                      .filter((d) => d.connectionId === selectedConnectionId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Or New Dashboard Name
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
                <button
                  onClick={() => handleSaveToDashboard(selectedDashboard)}
                  disabled={!selectedDashboard || isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add to Selected
                </button>
                <button
                  onClick={handleCreateNewDashboard}
                  disabled={!newDashboardName.trim() || isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create New
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

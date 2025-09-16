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

// Types
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
type AggregationType = "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
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
  // State
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

  // Reset chart data when selections change
  useEffect(() => {
    setChartData([]);
    setYAxisColumns([]);
    setGeneratedQuery("");
    setError(null);
  }, [xAxisDimension, yAxisFacts, groupByDimension]);

  // Automatically generate chart when selections change
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

  // Generate chart data
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
          // Skip rows where x-axis dimension is null or empty
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

        // Filter out rows where all y-axis values are missing
        let normalizedData = Array.from(dataMap.values()).filter((item) => {
          return Object.keys(item).some(
            (key) => key !== "name" && item[key] != null
          );
        });

        // Sort data by total y-axis values (high to low)
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
          return bTotal - aTotal; // Descending order
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
    } catch (err) {
      setError(
        "Failed to generate chart data: " +
          (err as Error).message +
          ". Ensure fact-dimension mappings are valid or run auto-mapping."
      );
      setChartData([]);
      setYAxisColumns([]);
      setGeneratedQuery("");
    } finally {
      setLoading(false);
    }
  }, [
    selectedConnectionId,
    yAxisFacts,
    xAxisDimension,
    groupByDimension,
    aggregationType,
    chartType,
  ]);

  // Handle drop for dimensions (X-axis or Group By) and facts (Y-axis)
  const handleDrop = (
    axis: "x" | "y" | "group",
    item: { dimension?: Dimension; fact?: Fact }
  ) => {
    if (axis === "x" && item.dimension) {
      setXAxisDimension(item.dimension);
    } else if (axis === "group" && item.dimension) {
      setGroupByDimension(item.dimension);
    } else if (axis === "y" && item.fact) {
      setYAxisFacts((prev) => {
        if (prev.some((f) => f.id === item.fact!.id)) {
          return prev; // Prevent duplicates
        }
        return [...prev, item.fact!];
      });
    }
  };

  // Handle remove from drop zone
  const handleRemove = (axis: "x" | "y" | "group", factId?: number) => {
    if (axis === "x") setXAxisDimension(null);
    if (axis === "group") setGroupByDimension(null);
    if (axis === "y" && factId) {
      setYAxisFacts((prev) => prev.filter((f) => f.id !== factId));
    }
  };

  // Download graph as PNG
  const handleDownloadGraph = async () => {
    if (chartContainerRef.current) {
      const canvas = await html2canvas(chartContainerRef.current);
      const link = document.createElement("a");
      link.download = `chart-${uuidv4()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  // Download table as CSV
  const handleDownloadTable = () => {
    if (chartData.length === 0) return;
    const headers = ["name", ...yAxisColumns.map((col) => col.key)];
    const csvRows = [headers.join(",")];
    chartData.forEach((row) => {
      const values = [
        row.name,
        ...yAxisColumns.map((col) =>
          row[col.key] != null ? row[col.key] : ""
        ),
      ];
      csvRows.push(values.join(","));
    });
    const csv = csvRows.join("\n");
    const link = document.createElement("a");
    link.download = `chart-data-${uuidv4()}.csv`;
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    link.click();
  };

  // Open the modal for adding to dashboard
  const handleAddToDashboard = () => {
    setShowDashboardModal(true);
  };

  // Save chart to selected dashboard
  const handleSaveToDashboard = async (dashboardId: string) => {
    if (!selectedConnectionId) {
      setError("No connection selected");
      return;
    }
    const config: ChartConfig = {
      xAxisDimension,
      yAxisFacts,
      groupByDimension,
      chartType,
      aggregationType,
      stacked,
    };
    await addChartToDashboard(config, dashboardId);
    setShowDashboardModal(false);
    setSelectedDashboard("");
  };

  // Create new dashboard and save chart
  const handleCreateNewDashboard = async () => {
    if (!newDashboardName.trim() || !selectedConnectionId) {
      setError("Dashboard name and connection are required");
      return;
    }
    try {
      const dashboardId = await addNewDashboard(
        newDashboardName,
        newDashboardDescription
      );
      const config: ChartConfig = {
        xAxisDimension,
        yAxisFacts,
        groupByDimension,
        chartType,
        aggregationType,
        stacked,
      };
      await addChartToDashboard(config, dashboardId);
      setShowDashboardModal(false);
      setSelectedDashboard("");
      setNewDashboardName("");
      setNewDashboardDescription("");
    } catch (error) {
      console.error("Error creating new dashboard:", error);
    }
  };

  // Value formatter for ChartDataTable
  const valueFormatter = (value: number | string) => {
    if (typeof value === "number") {
      return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }
    return value;
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Drop Zones */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border p-2">
          <label className="flex items-center mb-2 text-sm font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full mr-2 bg-blue-500" />
            X-Axis (Dimension)
          </label>
          <ChartDropZone
            axis="x"
            onDrop={(item) => handleDrop("x", item)}
            onRemove={() => handleRemove("x")}
            selectedColumns={
              xAxisDimension
                ? [
                    {
                      ...xAxisDimension,
                      key: xAxisDimension.name,
                      label: xAxisDimension.name,
                      type: "string",
                    },
                  ]
                : []
            }
            label="Drag dimension for categories"
            accept={["dimension"]}
          />
        </div>
        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg border p-2">
          <label className="flex items-center mb-2 text-sm font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full mr-2 bg-indigo-500" />
            Y-Axis (Facts)
          </label>
          <ChartDropZone
            axis="y"
            onDrop={(item) => handleDrop("y", item)}
            onRemove={(factId) => handleRemove("y", factId)}
            selectedColumns={yAxisFacts.map((fact) => ({
              ...fact,
              key: fact.name,
              label: fact.name,
              type: "number",
              id: fact.id, // Include id for removal
            }))}
            label="Drag facts for values"
            accept={["fact"]}
            allowMultiple
          />
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border p-2">
          <label className="flex items-center mb-2 text-sm font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full mr-2 bg-purple-500" />
            Group By (Optional Dimension)
          </label>
          <ChartDropZone
            axis="group"
            onDrop={(item) => handleDrop("group", item)}
            onRemove={() => handleRemove("group")}
            selectedColumns={
              groupByDimension
                ? [
                    {
                      ...groupByDimension,
                      key: groupByDimension.name,
                      label: groupByDimension.name,
                      type: "string",
                    },
                  ]
                : []
            }
            label="Drag dimension to group"
            accept={["dimension"]}
          />
        </div>
      </div>

      {/* Controls */}
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

      {/* Error Display */}
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Download Buttons */}
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
          >
            <Plus className="h-4 w-4" />
            <span>Add to Dashboard</span>
          </button>
        </div>
      )}

      {/* Views */}
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

      {/* Dashboard Modal */}
      {showDashboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Add Chart to Dashboard</h2>
            <div className="mb-4">
              <label
                htmlFor="dashboard-select"
                className="block text-sm font-medium text-gray-700"
              >
                Select a Dashboard:
              </label>
              <select
                id="dashboard-select"
                value={selectedDashboard}
                onChange={(e) => setSelectedDashboard(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="" disabled>
                  Select a dashboard
                </option>
                {dashboards
                  .filter((d) => d.connectionId === selectedConnectionId)
                  .map((dashboard) => (
                    <option key={dashboard.id} value={dashboard.id}>
                      {dashboard.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="mb-4">
              <label
                htmlFor="new-dashboard-name"
                className="block text-sm font-medium text-gray-700"
              >
                Or Create New Dashboard:
              </label>
              <input
                id="new-dashboard-name"
                type="text"
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder="New dashboard name..."
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              />
              <textarea
                value={newDashboardDescription}
                onChange={(e) => setNewDashboardDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="mt-2 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowDashboardModal(false);
                  setSelectedDashboard("");
                  setNewDashboardName("");
                  setNewDashboardDescription("");
                }}
                className="px-4 py-2 text-gray-500 border rounded-md hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveToDashboard(selectedDashboard)}
                disabled={!selectedDashboard}
                className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-blue-300"
              >
                Add to Existing
              </button>
              <button
                onClick={handleCreateNewDashboard}
                disabled={!newDashboardName.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md disabled:bg-green-300"
              >
                Create & Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicSemanticChartBuilder;

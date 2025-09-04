import React, { useState, useEffect, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import { v4 as uuidv4 } from "uuid";
import { apiService } from "../services/api";
import ChartDropZone from "./ChartDropZone";
import ChartDataTable from "./ChartDataTable";
import SqlQueryDisplay from "./SqlQueryDisplay";
import ChartControls from "./ChartControls";
import ChartDisplay from "./ChartDisplay";
import { Download } from "lucide-react";

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

const DynamicSemanticChartBuilder: React.FC = () => {
  // State
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [xAxisDimension, setXAxisDimension] = useState<Dimension | null>(null);
  const [yAxisFact, setYAxisFact] = useState<Fact | null>(null);
  const [groupByDimension, setGroupByDimension] = useState<Dimension | null>(
    null
  );
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [aggregationType, setAggregationType] =
    useState<AggregationType>("SUM");
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stacked, setStacked] = useState(true);
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [activeView, setActiveView] = useState<"graph" | "table" | "query">(
    "graph"
  );
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Fetch facts and dimensions on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [factsRes, dimensionsRes] = await Promise.all([
          apiService.getFacts(),
          apiService.getDimensions(),
        ]);
        setFacts(factsRes);
        setDimensions(dimensionsRes);
      } catch (err) {
        setError(
          "Failed to fetch facts and dimensions: " + (err as Error).message
        );
      }
    };
    fetchData();
  }, []);

  // Reset chart data when selections change
  useEffect(() => {
    setChartData([]);
    setGeneratedQuery("");
    setError(null);
  }, [xAxisDimension, yAxisFact, groupByDimension]);

  // Generate chart data
  const generateChartData = useCallback(async () => {
    if (!yAxisFact || !xAxisDimension) {
      setError("Please select a fact for Y-axis and a dimension for X-axis");
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
        factId: yAxisFact.id,
        dimensionIds,
        aggregation: aggregationType,
      };

      const res: AggregationResponse = await apiService.runQuery(body);
      if (res.rows && res.sql) {
        // Normalize chart data
        const normalizedData = res.rows.map((row) => ({
          name: row[xAxisDimension.column_name], // Use column_name for x-axis
          [yAxisFact.name]: parseFloat(row.value), // Convert value to number
          ...(groupByDimension && row[groupByDimension.column_name]
            ? { [groupByDimension.name]: row[groupByDimension.column_name] }
            : {}),
        }));
        setChartData(normalizedData);
        setGeneratedQuery(res.sql);
        setStacked(chartType === "bar" && groupByDimension !== null);
      } else {
        setError(res.error || "Failed to generate chart data");
        setChartData([]);
        setGeneratedQuery("");
      }
    } catch (err) {
      setError("Failed to generate chart data: " + (err as Error).message);
      setChartData([]);
      setGeneratedQuery("");
    } finally {
      setLoading(false);
    }
  }, [yAxisFact, xAxisDimension, groupByDimension, aggregationType, chartType]);

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
      setYAxisFact(item.fact);
    }
  };

  // Handle remove from drop zone
  const handleRemove = (axis: "x" | "y" | "group") => {
    if (axis === "x") setXAxisDimension(null);
    if (axis === "group") setGroupByDimension(null);
    if (axis === "y") setYAxisFact(null);
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
    const headers = [
      "name",
      yAxisFact?.name || "value",
      groupByDimension?.name || "",
    ].filter(Boolean);
    const csvRows = [headers.join(",")];
    chartData.forEach((row) => {
      const values = [
        row.name,
        row[yAxisFact?.name || "value"],
        groupByDimension ? row[groupByDimension.name] : "",
      ].filter(Boolean);
      csvRows.push(values.join(","));
    });
    const csv = csvRows.join("\n");
    const link = document.createElement("a");
    link.download = `chart-data-${uuidv4()}.csv`;
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    link.click();
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
            Y-Axis (Fact)
          </label>
          <ChartDropZone
            axis="y"
            onDrop={(item) => handleDrop("y", item)}
            onRemove={() => handleRemove("y")}
            selectedColumns={
              yAxisFact
                ? [
                    {
                      ...yAxisFact,
                      key: yAxisFact.name,
                      label: yAxisFact.name,
                      type: "number",
                    },
                  ]
                : []
            }
            label="Drag fact for values"
            accept={["fact"]}
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
        yAxisCount={yAxisFact ? 1 : 0}
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

      {/* Generate Button */}
      <div className="flex items-center space-x-4 mb-4">
        <button
          onClick={generateChartData}
          disabled={!xAxisDimension || !yAxisFact || loading}
          className="flex items-center space-x-1 px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <span>Generate Chart</span>
        </button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

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
          yAxisColumns={
            yAxisFact
              ? [
                  {
                    ...yAxisFact,
                    key: yAxisFact.name,
                    label: yAxisFact.name,
                    type: "number",
                  },
                ]
              : []
          }
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
            yAxisColumns={
              yAxisFact
                ? [
                    {
                      ...yAxisFact,
                      key: yAxisFact.name,
                      label: yAxisFact.name,
                      type: "number",
                    },
                  ]
                : []
            }
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
    </div>
  );
};

export default DynamicSemanticChartBuilder;

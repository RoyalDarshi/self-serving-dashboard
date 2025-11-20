// ChartDisplay.tsx
import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";
import { BarChart3, RefreshCw, Database, Layers } from "lucide-react";
import { DatabaseColumn, AggregationType } from "../services/api";
import { formatNumericValue } from "./utils";

interface ChartDisplayProps {
  chartType: "bar" | "line" | "pie" | "area" | "composed";
  chartData: any[];
  xAxisColumn: DatabaseColumn | null;
  yAxisColumns: DatabaseColumn[];
  groupByColumn: DatabaseColumn | null;
  aggregationType: AggregationType;
  loading: boolean;
  error: string | null;
  stacked: boolean;
  chartContainerRef: React.RefObject<HTMLDivElement>;
  sortOrder?: "asc" | "desc" | null;
  height?: number;
  onDataPointClick?: (payload: any) => void;
}

const COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

const normalizeType = (type: string): "string" | "number" => {
  const lower = type.toLowerCase();
  if (lower.includes("char") || lower === "text") return "string";
  if (
    lower.includes("int") ||
    lower === "float" ||
    lower === "double" ||
    lower === "decimal" ||
    lower === "number"
  )
    return "number";
  return "string";
};

const ChartDisplay: React.FC<ChartDisplayProps> = ({
  chartType,
  chartData,
  xAxisColumn,
  yAxisColumns,
  groupByColumn,
  aggregationType,
  loading,
  error,
  stacked,
  chartContainerRef,
  sortOrder = null,
  height,
  onDataPointClick,
}) => {
  const isGrouped =
    !!groupByColumn && !!xAxisColumn && groupByColumn.key !== xAxisColumn.key;

  const getSeriesName = (col: DatabaseColumn): string => {
    if (isGrouped) {
      return col.label || col.key;
    } else {
      const isStr = normalizeType(col.type) === "string";
      return isStr
        ? `Count of ${col.label || col.key}`
        : `${aggregationType} of ${col.label || col.key}`;
    }
  };

  const processedChartData = React.useMemo(() => {
    if (!sortOrder || yAxisColumns.length === 0) {
      return chartData;
    }

    return [...chartData].sort((a, b) => {
      const key = yAxisColumns[0]?.key;
      const aValue = a[key] || 0;
      const bValue = b[key] || 0;

      if (typeof aValue !== "number" || typeof bValue !== "number") {
        return 0;
      }

      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [chartData, sortOrder, yAxisColumns]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="relative">
          <RefreshCw className="h-10 w-10 animate-spin text-blue-500" />
          <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20" />
        </div>
        <span className="mt-4 text-slate-600 text-sm font-medium">
          Generating visualization...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-red-50 rounded-lg">
        <div className="bg-red-100 p-4 rounded-full mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-red-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <p className="font-medium text-red-700">Chart generation failed</p>
        <p className="text-sm text-red-600 max-w-md text-center">{error}</p>
      </div>
    );
  }

  if (!xAxisColumn || yAxisColumns.length === 0 || chartData.length === 0) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center 
                      bg-gradient-to-br from-blue-50 to-indigo-50 
                      rounded-lg border border-dashed border-blue-200 p-6"
      >
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 rounded-full">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-center text-slate-800">
            Build Your Visualization
          </h3>
          <p className="text-slate-600 text-center mt-2 max-w-md">
            Configure chart settings by dragging columns to the X and Y axes
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm flex items-center">
              <Database className="h-4 w-4 mr-2" />
              <span>X-Axis: {xAxisColumn ? "Selected" : "Required"}</span>
            </div>
            <div className="bg-indigo-100 text-indigo-800 px-3 py-2 rounded-lg text-sm flex items-center">
              <Layers className="h-4 w-4 mr-2" />
              <span>
                Y-Axis: {yAxisColumns.length > 0 ? "Selected" : "Required"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const commonProps = {
    data: processedChartData,
    margin: { top: 20, right: 30, left: 20, bottom: 5 },
  };

  const renderChart = () => {
    if (chartType === "bar") {
      return (
        <BarChart
          {...commonProps}
          onClick={(e: any) => {
            if (
              onDataPointClick &&
              e &&
              e.activePayload &&
              e.activePayload[0]
            ) {
              onDataPointClick(e.activePayload[0].payload);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" stroke="#6b7280" interval="preserveStartEnd" />
          <YAxis tickFormatter={formatNumericValue} stroke="#6b7280" />
          <Tooltip formatter={formatNumericValue} />
          <Legend />
          {yAxisColumns.map((col, i) => (
            <Bar
              key={col.key}
              dataKey={col.key}
              name={getSeriesName(col)}
              fill={COLORS[i % COLORS.length]}
              stackId={stacked ? "a" : undefined}
            />
          ))}
        </BarChart>
      );
    }

    if (chartType === "line") {
      return (
        <LineChart
          {...commonProps}
          onClick={(e: any) => {
            if (
              onDataPointClick &&
              e &&
              e.activePayload &&
              e.activePayload[0]
            ) {
              onDataPointClick(e.activePayload[0].payload);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" stroke="#6b7280" />
          <YAxis tickFormatter={formatNumericValue} stroke="#6b7280" />
          <Tooltip formatter={formatNumericValue} />
          <Legend />
          {yAxisColumns.map((col, i) => (
            <Line
              key={col.key}
              dataKey={col.key}
              name={getSeriesName(col)}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot
            />
          ))}
        </LineChart>
      );
    }

    if (chartType === "area") {
      return (
        <AreaChart
          {...commonProps}
          onClick={(e: any) => {
            if (
              onDataPointClick &&
              e &&
              e.activePayload &&
              e.activePayload[0]
            ) {
              onDataPointClick(e.activePayload[0].payload);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" stroke="#6b7280" />
          <YAxis tickFormatter={formatNumericValue} stroke="#6b7280" />
          <Tooltip formatter={formatNumericValue} />
          <Legend />
          {yAxisColumns.map((col, i) => (
            <Area
              key={col.key}
              dataKey={col.key}
              name={getSeriesName(col)}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.3}
              stackId={stacked ? "a" : undefined}
            />
          ))}
        </AreaChart>
      );
    }

    if (chartType === "composed") {
      return (
        <ComposedChart
          {...commonProps}
          onClick={(e: any) => {
            if (
              onDataPointClick &&
              e &&
              e.activePayload &&
              e.activePayload[0]
            ) {
              onDataPointClick(e.activePayload[0].payload);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" stroke="#6b7280" />
          <YAxis tickFormatter={formatNumericValue} stroke="#6b7280" />
          <Tooltip formatter={formatNumericValue} />
          <Legend />
          {yAxisColumns.map((col, i) =>
            i % 2 === 0 ? (
              <Line
                key={col.key}
                dataKey={col.key}
                name={getSeriesName(col)}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
              />
            ) : (
              <Bar
                key={col.key}
                dataKey={col.key}
                name={getSeriesName(col)}
                fill={COLORS[i % COLORS.length]}
                stackId={stacked ? "a" : undefined}
              />
            )
          )}
        </ComposedChart>
      );
    }

    if (chartType === "pie") {
      const pieData = processedChartData.map((r) => ({
        name: r.name,
        value: r[yAxisColumns[0].key] || 0,
      }));
      return (
        <PieChart
          onClick={(e: any) => {
            if (
              onDataPointClick &&
              e &&
              e.activePayload &&
              e.activePayload[0]
            ) {
              onDataPointClick(e.activePayload[0].payload);
            }
          }}
        >
          <Tooltip formatter={(v) => formatNumericValue(v)} />
          <Legend />
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={120}
            label={({ name, percent }) =>
              `${name}: ${(percent * 100).toFixed(0)}%`
            }
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      );
    }

    return null;
  };

  return (
    <div ref={chartContainerRef} className="p-0.5 w-full h-full">
      <ResponsiveContainer width="100%" height={height || "100%"}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default ChartDisplay;

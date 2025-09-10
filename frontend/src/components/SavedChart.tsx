import React, { useState, useEffect, useRef } from "react";
import { apiService } from "../services/api";
import ChartDisplay from "./ChartDisplay";
import {
  MoreVertical,
  Maximize2,
  Download,
  Edit3,
  Trash2,
  RefreshCw,
} from "lucide-react";

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
  title?: string;
  description?: string;
}

interface SavedChartProps {
  config: ChartConfig;
  showControls?: boolean;
}

const SavedChart: React.FC<SavedChartProps> = ({
  config,
  showControls = true,
}) => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [yAxisColumns, setYAxisColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(320);

  // Observe container height changes for responsive charts
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height } = entry.contentRect;
        setContainerHeight(height - 60); // Account for header
      }
    });

    resizeObserver.observe(chartContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch facts and dimensions
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

  // Generate chart data
  useEffect(() => {
    if (
      config.xAxisDimension &&
      config.yAxisFacts.length > 0 &&
      facts.length > 0 &&
      dimensions.length > 0
    ) {
      generateChartData();
    }
  }, [config, facts, dimensions]);

  const generateChartData = async () => {
    setLoading(true);
    setError(null);

    try {
      const dimensionIds = [config.xAxisDimension!.id];
      if (
        config.groupByDimension &&
        config.groupByDimension.id !== config.xAxisDimension!.id
      ) {
        dimensionIds.push(config.groupByDimension.id);
      }

      const body = {
        factIds: config.yAxisFacts.map((f) => f.id),
        dimensionIds,
        aggregation: config.aggregationType,
      };

      const res: AggregationResponse = await apiService.runQuery(body);
      if (res.rows && res.sql) {
        const xKey = config.xAxisDimension!.column_name;
        const gKey = config.groupByDimension?.column_name;

        const dataMap = new Map<string, ChartDataItem>();
        const groupSet = new Set<string>();

        res.rows.forEach((row) => {
          const xValue = (row[xKey] || "").toString().trim();
          const gValue = gKey ? (row[gKey] || "").toString().trim() : null;

          if (!dataMap.has(xValue)) {
            dataMap.set(xValue, { name: xValue });
          }

          const item = dataMap.get(xValue)!;

          if (gValue) {
            config.yAxisFacts.forEach((fact) => {
              const val = parseFloat(row[fact.name]);
              if (!isNaN(val)) {
                item[`${gValue}_${fact.name}`] = val;
                groupSet.add(`${gValue}_${fact.name}`);
              }
            });
          } else {
            config.yAxisFacts.forEach((fact) => {
              const val = parseFloat(row[fact.name]);
              if (!isNaN(val)) {
                item[fact.name] = val;
              }
            });
          }
        });

        const normalizedData = Array.from(dataMap.values());

        const newYAxisColumns: Column[] = config.groupByDimension
          ? Array.from(groupSet).map((g) => ({
              key: g,
              label: g,
              type: "number",
            }))
          : config.yAxisFacts.map((fact) => ({
              ...fact,
              key: fact.name,
              label: fact.name,
              type: "number",
            }));

        setChartData(normalizedData);
        setYAxisColumns(newYAxisColumns);
      } else {
        setError(
          res.error ||
            "Failed to generate chart data. Ensure fact-dimension mappings exist or run auto-mapping."
        );
      }
    } catch (err) {
      setError(
        "Failed to generate chart data: " +
          (err as Error).message +
          ". Ensure fact-dimension mappings are valid or run auto-mapping."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await generateChartData();
    setIsRefreshing(false);
    setShowMenu(false);
  };

  const handleDownload = async () => {
    if (chartContainerRef.current) {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(chartContainerRef.current);
      const link = document.createElement("a");
      link.download = `${config.title || "chart"}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
    setShowMenu(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-slate-600">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center p-4">
          <div className="text-red-600 mb-2">⚠️</div>
          <p className="text-sm text-red-700 font-medium mb-1">Chart Error</p>
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-3 px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative group">
      {/* Chart Controls Overlay */}
      {showControls && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-sm hover:bg-white transition-colors"
            >
              <MoreVertical className="h-4 w-4 text-slate-600" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  <span>Refresh Data</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PNG</span>
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span>Full Screen</span>
                </button>
                <hr className="my-1" />
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Edit Chart</span>
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Chart</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart Content */}
      <div ref={chartContainerRef} className="h-full">
        <ChartDisplay
          chartContainerRef={chartContainerRef}
          chartType={config.chartType}
          chartData={chartData}
          xAxisColumn={
            config.xAxisDimension
              ? {
                  key: config.xAxisDimension.name,
                  label: config.xAxisDimension.name,
                  type: "string",
                }
              : null
          }
          yAxisColumns={yAxisColumns}
          groupByColumn={
            config.groupByDimension
              ? {
                  key: config.groupByDimension.name,
                  label: config.groupByDimension.name,
                  type: "string",
                }
              : null
          }
          aggregationType={config.aggregationType}
          loading={loading}
          error={error}
          stacked={config.stacked}
          height={containerHeight}
        />
      </div>
    </div>
  );
};

export default SavedChart;

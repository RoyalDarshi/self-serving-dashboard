// SavedChart.tsx
import React, { useState, useEffect, useRef } from "react";
import { apiService } from "../services/api";
import ChartDisplay from "./ChartDisplay";

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
  xAxisDimension: Dimension | null;
  yAxisFacts: Fact[];
  groupByDimension: Dimension | null;
  chartType: "bar" | "line" | "pie";
  aggregationType: AggregationType;
  stacked: boolean;
}

interface SavedChartProps {
  config: ChartConfig;
}

const SavedChart: React.FC<SavedChartProps> = ({ config }) => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [yAxisColumns, setYAxisColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const chartContainerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="p-4 bg-white rounded shadow">
      {error && <p className="text-red-500">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
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
        />
      )}
    </div>
  );
};

export default SavedChart;

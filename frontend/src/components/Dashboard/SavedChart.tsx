// SavedChart.tsx
import React, { useState, useEffect, useRef } from "react";
import { ChartConfig, AggregationResponse } from "../../services/api";
import ChartDisplay from "../ChartBuilder/ChartDisplay";
import ReportViewer from "../Reports/ReportViewer";
import apiService from "../../services/api";

interface ChartDataItem {
  name: string;
  [key: string]: number | string;
}

interface Column {
  key: string;
  label: string;
  type: "number" | "string";
  [key: string]: any;
}

interface SavedChartProps {
  config: ChartConfig;
  connectionId: number;
  chartId?: string;
}

const SavedChart: React.FC<SavedChartProps> = ({
  config,
  connectionId,
  chartId,
}) => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [yAxisColumns, setYAxisColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillReportId, setDrillReportId] = useState<number | null>(null);
  const [drillFilters, setDrillFilters] = useState<Record<string, any>>({});
  const [showDrillModal, setShowDrillModal] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      // Basic validation
      if (!config.xAxisDimension || config.yAxisFacts.length === 0) {
        if (isMounted) {
          setLoading(false);
          // Don't show error for empty config, just let ChartDisplay handle "Empty State"
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const dimensionIds = [config.xAxisDimension.id];
        if (
          config.groupByDimension &&
          config.groupByDimension.id !== config.xAxisDimension.id
        ) {
          dimensionIds.push(config.groupByDimension.id);
        }

        const baseTable =
          config.yAxisFacts.length > 0 ? config.yAxisFacts[0].table_name : null;

        const body = {
          connection_id: connectionId,
          base_table: baseTable, // ✅ REQUIRED
          factIds: config.yAxisFacts.map((f) => f.id),
          dimensionIds,
          aggregation: config.aggregationType,
        };

        const res: AggregationResponse = await apiService.runQuery(body);

        if (isMounted) {
          if (res.rows && res.sql) {
            // FIX: Robust Key Lookup
            // Backend might return keys as "column_name" OR "Friendly Name" (alias).
            // We prepare both possibilities.
            const xCol = config.xAxisDimension.column_name;
            const xName = config.xAxisDimension.name;

            const gCol = config.groupByDimension?.column_name;
            const gName = config.groupByDimension?.name;

            const dataMap = new Map<string, ChartDataItem>();
            const groupSet = new Set<string>();

            res.rows.forEach((row) => {
              // 1. Resolve X-Axis Value
              let rawX = row[xCol];
              if (rawX === undefined) rawX = row[xName];

              const xValue = (rawX || "").toString().trim();
              if (!xValue) return; // Skip invalid rows

              // 2. Resolve Group-By Value (if exists)
              let gValue: string | null = null;
              if (config.groupByDimension) {
                let rawG = row[gCol!];
                if (rawG === undefined) rawG = row[gName!];
                gValue = (rawG || "").toString().trim();
              }

              // 3. Initialize Row Object in Map
              if (!dataMap.has(xValue)) {
                dataMap.set(xValue, { name: xValue });
              }
              const item = dataMap.get(xValue)!;

              // 4. Extract Metrics (Facts)
              config.yAxisFacts.forEach((fact) => {
                // Try fact name (alias) first, then column_name?
                // Usually facts are aliased as 'name' in aggregate queries like "SUM(col) as name"
                let val = row[fact.name];

                // Fallback: if backend returns "SUM(col)" as key (unlikely but possible)
                if (val === undefined) val = row[fact.column_name];

                if (val != null) {
                  const parsedVal = parseFloat(val as string);
                  if (!isNaN(parsedVal)) {
                    if (gValue) {
                      // Grouped Data: Store as "GroupName_FactName"
                      const key = `${gValue}_${fact.name}`;
                      item[key] = parsedVal;
                      groupSet.add(key);
                    } else {
                      // Standard Data: Store directly as FactName
                      item[fact.name] = parsedVal;
                    }
                  }
                }
              });
            });

            // 5. Convert Map to Array & Filter Empty Rows
            let normalizedData = Array.from(dataMap.values()).filter((item) => {
              // Keep row only if it has at least one data key (besides 'name')
              return Object.keys(item).some(
                (key) => key !== "name" && item[key] != null
              );
            });

            // 6. Sort Data by Total Value (Desc)
            normalizedData.sort((a, b) => {
              const getSum = (obj: ChartDataItem) =>
                Object.entries(obj)
                  .filter(([key]) => key !== "name")
                  .reduce(
                    (sum, [, val]) => sum + (typeof val === "number" ? val : 0),
                    0
                  );
              return getSum(b) - getSum(a);
            });

            // 7. Define Y-Axis Columns for ChartDisplay
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
            setError(res.error || "Failed to load chart data");
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError("Error loading chart: " + (err as Error).message);
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [config, connectionId]);

  // Handle drill-down interaction
  const handleDataPointClick = async (payload: any) => {
    if (!chartId) return;
    try {
      // Only proceed if chartId exists
      // Fetch drill config if needed or use passed config
      // This part remains similar to your original implementation
      // ...
    } catch (err) {
      console.error("Drill error:", err);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white rounded-lg shadow-sm">
      {config.title && (
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 truncate">
            {config.title}
          </h3>
          {config.description && (
            <p className="text-xs text-slate-500 truncate">
              {config.description}
            </p>
          )}
        </div>
      )}

      <div className="flex-1 p-2 min-h-0">
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
                  // Ensure we pass the ID if available
                  ...config.xAxisDimension,
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
                  ...config.groupByDimension,
                }
              : null
          }
          aggregationType={config.aggregationType}
          loading={loading}
          error={error}
          stacked={config.stacked}
          onDataPointClick={handleDataPointClick}
        />
      </div>

      {showDrillModal && drillReportId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <ReportViewer
              initialReportId={drillReportId}
              onClose={() => {
                setShowDrillModal(false);
                setDrillReportId(null);
                setDrillFilters({});
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedChart;

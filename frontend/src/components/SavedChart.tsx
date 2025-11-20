// SavedChart.tsx
import React, { useState, useEffect, useRef } from "react";
import { ChartConfig, AggregationResponse } from "../services/api";
import ChartDisplay from "./ChartDisplay";
import ReportViewer from "./ReportViewer";
import apiService from "../services/api";

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

const SavedChart: React.FC<SavedChartProps> = ({ config, connectionId }) => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [yAxisColumns, setYAxisColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillReportId, setDrillReportId] = useState<number | null>(null);
  const [drillFilters, setDrillFilters] = useState<Record<string, any>>({});
  const [showDrillModal, setShowDrillModal] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const dimensionIds = [config.xAxisDimension?.id];
        if (
          config.groupByDimension &&
          config.groupByDimension.id !== config.xAxisDimension?.id
        ) {
          dimensionIds.push(config.groupByDimension.id);
        }

        const body = {
          connection_id: connectionId,
          factIds: config.yAxisFacts.map((f) => f.id),
          dimensionIds,
          aggregation: config.aggregationType,
        };

        const res: AggregationResponse = await apiService.runQuery(body);
        if (res.rows && res.sql) {
          const xKey = config.xAxisDimension?.column_name;
          const gKey = config.groupByDimension?.column_name;

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
              config.yAxisFacts.forEach((fact) => {
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
              config.yAxisFacts.forEach((fact) => {
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
                (sum, [, value]) =>
                  sum + (typeof value === "number" ? value : 0),
                0
              );
            const bTotal = Object.entries(b)
              .filter(([key]) => key !== "name")
              .reduce(
                (sum, [, value]) =>
                  sum + (typeof value === "number" ? value : 0),
                0
              );
            return bTotal - aTotal;
          });

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
      } catch (err) {
        setError("Error loading chart: " + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    if (config.xAxisDimension && config.yAxisFacts.length > 0) {
      fetchData();
    } else {
      setLoading(false);
      setError("Invalid chart configuration");
    }
  }, [config, connectionId]);

  const handleDataPointClick = async (payload: any) => {
    if (!chartId) return;
    try {
      const cfg = await apiService.getChartDrillConfig(chartId);
      if (!cfg.drillEnabled || !cfg.targetDashboardId || !cfg.mapping) return;

      // For now, we just log or you can later wire chart->dashboard navigation.
      // If you instead want chart -> report, you can map to a fixed reportId here.

      // Example: if mapping keys correspond to xAxis value in payload
      const filters: Record<string, any> = {};
      const [sourceKey, targetKey] = Object.entries(cfg.mapping)[0] as [
        string,
        string
      ];
      if (payload[sourceKey] != null) {
        filters[targetKey] = payload[sourceKey];
      }

      // If you have a detail reportId for this chart, set it here.
      // For now we'll assume one report per chart saved in config (optional custom field).
      if ((config as any).detailReportId) {
        setDrillReportId((config as any).detailReportId);
        setDrillFilters(filters);
        setShowDrillModal(true);
      }
    } catch (err) {
      console.error("Drill error:", err);
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      <h3 className="text-lg flex justify-center font-semibold p-2">
        {config.title || "Chart"}
      </h3>
      <div className="flex-1">
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
          onDataPointClick={handleDataPointClick}
        />
      </div>
      {showDrillModal && drillReportId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-[80vw] h-[80vh]">
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

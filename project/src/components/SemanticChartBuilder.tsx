import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { apiService, Fact, Dimension, FactDimension } from "../services/api";
import ChartDropZone from "./ChartDropZone";
import ChartDataTable from "./ChartDataTable";
import SqlQueryDisplay from "./SqlQueryDisplay";
import ChartDisplay from "./ChartDisplay";
import { Download, Database } from "lucide-react";
import { AggregationType, ChartType } from "./types";
import { formatNumericValue } from "./utils";
import html2canvas from "html2canvas";
import { v4 as uuidv4 } from "uuid";

// Types
interface ChartDataPoint {
  name: string;
  [key: string]: any;
}

interface SemanticChartBuilderProps {
  facts: Fact[];
  dimensions: Dimension[];
  factDimensions: FactDimension[];
}

const SemanticChartBuilder: React.FC<SemanticChartBuilderProps> = ({
  facts,
  dimensions,
  factDimensions,
}) => {
  // State
  const [xAxisDimension, setXAxisDimension] = useState<Dimension | null>(null);
  const [yAxisFacts, setYAxisFacts] = useState<Fact[]>([]);
  const [groupByDimension, setGroupByDimension] = useState<Dimension | null>(
    null
  );
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [aggregationType, setAggregationType] =
    useState<AggregationType>("SUM");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stacked, setStacked] = useState(true);
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [activeView, setActiveView] = useState<"graph" | "table" | "query">(
    "graph"
  );
  const [uniqueGroupKeys, setUniqueGroupKeys] = useState<string[]>([]);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Effective group-by (avoid duplicating x-axis)
  const effectiveGroupByDimension = useMemo(() => {
    if (!groupByDimension || !xAxisDimension) return null;
    return groupByDimension.id === xAxisDimension.id ? null : groupByDimension;
  }, [groupByDimension, xAxisDimension]);

  // Find join for fact-dimension pair
  const findJoin = useCallback(
    (fact: Fact, dimension: Dimension) => {
      return factDimensions.find(
        (fd) =>
          fd.fact_id === fact.id &&
          fd.dimension_id === dimension.id &&
          fd.join_table
      );
    },
    [factDimensions]
  );

  // Construct SQL query
  const constructSqlQuery = useCallback(() => {
    if (!xAxisDimension || yAxisFacts.length === 0) return "";

    const tables: Set<string> = new Set();
    const joins: string[] = [];
    const selections: string[] = [];
    const groups: string[] = [];

    // Add primary table (first fact's table)
    const primaryTable = yAxisFacts[0].table_name;
    const pAlias = "t1";
    tables.add(primaryTable);

    // Add x-axis dimension table
    const xJoin = yAxisFacts
      .map((f) => findJoin(f, xAxisDimension))
      .find((j) => j);
    if (xJoin) {
      tables.add(xJoin.join_table);
      joins.push(
        `INNER JOIN "${xJoin.join_table}" AS t2 ON t1."${xJoin.fact_column}" = t2."${xJoin.dimension_column}"`
      );
      selections.push(`t2."${xAxisDimension.column_name}" AS name`);
      groups.push(`t2."${xAxisDimension.column_name}"`);
    } else {
      // Assume dimension is in primary table
      selections.push(`t1."${xAxisDimension.column_name}" AS name`);
      groups.push(`t1."${xAxisDimension.column_name}"`);
    }

    // Add group-by dimension table
    if (effectiveGroupByDimension) {
      const gJoin = yAxisFacts
        .map((f) => findJoin(f, effectiveGroupByDimension))
        .find((j) => j);
      if (gJoin) {
        const gAlias = `t${tables.size + 1}`;
        tables.add(gJoin.join_table);
        joins.push(
          `INNER JOIN "${gJoin.join_table}" AS ${gAlias} ON t1."${gJoin.fact_column}" = ${gAlias}."${gJoin.dimension_column}"`
        );
        selections.push(`${gAlias}."${effectiveGroupByDimension.column_name}"`);
        groups.push(`${gAlias}."${effectiveGroupByDimension.column_name}"`);
      } else {
        selections.push(`t1."${effectiveGroupByDimension.column_name}"`);
        groups.push(`t1."${effectiveGroupByDimension.column_name}"`);
      }
    }

    // Add y-axis facts
    yAxisFacts.forEach((fact, index) => {
      const agg = fact.aggregate_function || aggregationType;
      selections.push(`${agg}(t1."${fact.column_name}") AS "${fact.name}"`);
    });

    let sql = `SELECT ${selections.join(
      ", "
    )}\nFROM "${primaryTable}" AS ${pAlias}`;
    if (joins.length > 0) {
      sql += `\n${joins.join("\n")}`;
    }
    if (groups.length > 0) {
      sql += `\nGROUP BY ${groups.join(", ")}`;
      sql += `\nORDER BY ${groups.join(", ")}`;
    }

    return sql;
  }, [
    xAxisDimension,
    yAxisFacts,
    effectiveGroupByDimension,
    aggregationType,
    findJoin,
  ]);

  // Fetch chart data
  useEffect(() => {
    if (!xAxisDimension || yAxisFacts.length === 0) {
      setChartData([]);
      setGeneratedQuery("");
      setUniqueGroupKeys([]);
      return;
    }

    setLoading(true);
    setError(null);

    const sql = constructSqlQuery();
    setGeneratedQuery(sql);

    apiService
      .query({ query: sql })
      .then((response) => {
        if (response.error) {
          setError(response.error);
          setChartData([]);
          setUniqueGroupKeys([]);
        } else {
          const data = response.data || [];
          setChartData(data);
          if (effectiveGroupByDimension) {
            const keys = [
              ...new Set(
                data.map((d) => d[effectiveGroupByDimension.column_name])
              ),
            ];
            setUniqueGroupKeys(keys);
          } else {
            setUniqueGroupKeys([]);
          }
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to fetch chart data");
        setChartData([]);
        setUniqueGroupKeys([]);
      })
      .finally(() => setLoading(false));
  }, [
    xAxisDimension,
    yAxisFacts,
    effectiveGroupByDimension,
    aggregationType,
    constructSqlQuery,
  ]);

  // Handle drop
  const handleDrop = useCallback(
    (
      item: { fact?: Fact; dimension?: Dimension },
      axis: "x" | "y" | "group"
    ) => {
      if (item.fact && axis === "y") {
        setYAxisFacts((prev) => {
          if (prev.some((f) => f.id === item.fact!.id)) return prev;
          return [...prev, item.fact!];
        });
      } else if (item.dimension && axis === "x") {
        setXAxisDimension(item.dimension);
      } else if (item.dimension && axis === "group") {
        setGroupByDimension(item.dimension);
      }
    },
    []
  );

  // Handle remove
  const handleRemove = useCallback(
    (item: Fact | Dimension, axis: "x" | "y" | "group") => {
      if (axis === "x" && item.id === xAxisDimension?.id) {
        setXAxisDimension(null);
      } else if (axis === "y" && "table_name" in item) {
        setYAxisFacts((prev) => prev.filter((f) => f.id !== item.id));
      } else if (axis === "group" && item.id === groupByDimension?.id) {
        setGroupByDimension(null);
      }
    },
    [xAxisDimension, groupByDimension]
  );

  // Handle download graph
  const handleDownloadGraph = useCallback(() => {
    if (chartContainerRef.current) {
      html2canvas(chartContainerRef.current).then((canvas) => {
        const link = document.createElement("a");
        link.download = `chart-${uuidv4()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      });
    }
  }, []);

  // Handle download table
  const handleDownloadTable = useCallback(() => {
    const headers = [
      "name",
      ...(effectiveGroupByDimension
        ? [effectiveGroupByDimension.column_name]
        : []),
      ...yAxisFacts.map((f) => f.name),
    ];
    const csv = [
      headers.join(","),
      ...chartData.map((row) =>
        headers
          .map((h) => `"${(row[h] || "").toString().replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.download = `chart-data-${uuidv4()}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }, [chartData, yAxisFacts, effectiveGroupByDimension]);

  return (
    <div className="p-6 bg-slate-100 rounded-xl shadow-sm">
      <h2 className="text-xl font-semibold text-slate-800 mb-4">
        Semantic Chart Builder
      </h2>

      {/* Drop Zones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border p-2">
          <label className="flex items-center mb-2 text-sm font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full mr-2 bg-blue-500" />
            X-Axis (Dimension)
          </label>
          <ChartDropZone
            axis="x"
            onDrop={handleDrop}
            onRemove={handleRemove}
            selectedColumns={xAxisDimension ? [xAxisDimension] : []}
            label="Drag a dimension for x-axis"
            acceptType="dimension"
          />
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border p-2">
          <label className="flex items-center mb-2 text-sm font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full mr-2 bg-indigo-500" />
            Y-Axis (Facts)
          </label>
          <ChartDropZone
            axis="y"
            onDrop={handleDrop}
            onRemove={handleRemove}
            selectedColumns={yAxisFacts}
            allowMultiple
            label="Drag facts for values"
            acceptType="fact"
          />
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border p-2">
          <label className="flex items-center mb-2 text-sm font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full mr-2 bg-purple-500" />
            Group By (Optional, Dimension)
          </label>
          <ChartDropZone
            axis="group"
            onDrop={handleDrop}
            onRemove={handleRemove}
            selectedColumns={
              effectiveGroupByDimension ? [effectiveGroupByDimension] : []
            }
            label="Drag dimension to group"
            acceptType="dimension"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Chart Type
          </label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className="border rounded p-2"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Aggregation
          </label>
          <select
            value={aggregationType}
            onChange={(e) =>
              setAggregationType(e.target.value as AggregationType)
            }
            className="border rounded p-2"
          >
            <option value="SUM">SUM</option>
            <option value="AVG">AVG</option>
            <option value="COUNT">COUNT</option>
            <option value="MAX">MAX</option>
            <option value="MIN">MIN</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Stacking
          </label>
          <input
            type="checkbox"
            checked={stacked}
            onChange={(e) => setStacked(e.target.checked)}
            disabled={yAxisFacts.length <= 1 && !effectiveGroupByDimension}
            className="border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            View
          </label>
          <select
            value={activeView}
            onChange={(e) =>
              setActiveView(e.target.value as "graph" | "table" | "query")
            }
            className="border rounded p-2"
          >
            <option value="graph">Graph</option>
            <option value="table">Table</option>
            <option value="query">Query</option>
          </select>
        </div>
      </div>

      {/* Download Buttons */}
      {chartData.length > 0 && (
        <div className="flex items-center space-x-2 mb-4">
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
          xAxisColumn={xAxisDimension}
          yAxisColumns={yAxisFacts}
          groupByColumn={effectiveGroupByDimension}
          uniqueGroupKeys={uniqueGroupKeys}
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
            xAxisColumn={xAxisDimension}
            yAxisColumns={yAxisFacts}
            groupByColumn={effectiveGroupByDimension}
            aggregationType={aggregationType}
            valueFormatter={formatNumericValue}
          />
        </div>
      )}
      {activeView === "query" && (
        <div className="bg-gradient-to-b from-white to-slate-50 rounded-xl border p-1">
          <SqlQueryDisplay generatedQuery={generatedQuery} />
        </div>
      )}

      {/* Empty State */}
      {chartData.length === 0 && !loading && !error && (
        <div className="text-center py-8 text-slate-500">
          <div className="bg-gradient-to-r from-blue-100 to-indigo-100 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
            <Database className="h-8 w-8 text-blue-500" />
          </div>
          <p>
            Select a dimension for x-axis and facts for y-axis to create a chart
          </p>
        </div>
      )}

      {/* Error State */}
      {error && <div className="text-red-500 p-4">{error}</div>}
    </div>
  );
};

export default SemanticChartBuilder;

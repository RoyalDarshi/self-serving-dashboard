import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";

interface Schema {
  tableName: string;
  columns: { name: string; type: string; notnull: number; pk: number }[];
}

interface Dashboard {
  id: number;
  name: string;
  layout: string;
}

interface ChartConfig {
  tableName: string;
  column: string;
  aggregation: string;
  groupBy?: string;
}

const DynamicChartBuilder: React.FC = () => {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [aggregation, setAggregation] = useState<string>("SUM");
  const [groupBy, setGroupBy] = useState<string>("");
  const [selectedDashboard, setSelectedDashboard] = useState<string>("");
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schemaResponse, dashboardResponse] = await Promise.all([
          apiService.getSchemas(),
          apiService.getDashboards(),
        ]);
        if (schemaResponse.success) {
          setSchemas(schemaResponse.schemas);
          if (schemaResponse.schemas.length > 0) {
            setSelectedTable(schemaResponse.schemas[0].tableName);
            if (schemaResponse.schemas[0].columns.length > 0) {
              setSelectedColumn(schemaResponse.schemas[0].columns[0].name);
              setGroupBy(schemaResponse.schemas[0].columns[0].name);
            }
          }
        } else {
          setError("Failed to fetch schemas");
        }
        if (dashboardResponse.success) {
          setDashboards(dashboardResponse.dashboards);
          if (dashboardResponse.dashboards.length > 0) {
            setSelectedDashboard(dashboardResponse.dashboards[0].id.toString());
          }
        } else {
          setError("Failed to fetch dashboards");
        }
      } catch (err) {
        console.error("Fetch data error:", err);
        setError("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAddToDashboard = async () => {
    if (!chartConfig || !selectedDashboard) {
      setError("Please select a dashboard and configure the chart");
      return;
    }
    try {
      const dashboard = dashboards.find(
        (d) => d.id.toString() === selectedDashboard
      );
      if (!dashboard) {
        setError("Invalid dashboard selected");
        return;
      }
      const layout = JSON.parse(dashboard.layout || "[]");
      layout.push({ ...chartConfig, id: Date.now() });
      const response = await apiService.saveDashboard(dashboard.name, layout);
      if (response.success) {
        alert("Chart added to dashboard");
      } else {
        setError("Failed to add chart to dashboard");
      }
    } catch (err) {
      console.error("Add to dashboard error:", err);
      setError("Failed to add chart to dashboard");
    }
  };

  const handleChartConfig = async () => {
    if (!selectedTable || !selectedColumn) {
      setError("Please select a table and column");
      return;
    }
    try {
      const response = await apiService.aggregateData(
        selectedTable,
        selectedColumn,
        aggregation,
        groupBy
      );
      if (response.success) {
        setChartConfig({
          tableName: selectedTable,
          column: selectedColumn,
          aggregation,
          groupBy,
        });
        setError(null);
      } else {
        setError("Failed to fetch chart data");
      }
    } catch (err) {
      console.error("Fetch chart data error:", err);
      setError("Failed to fetch chart data");
    }
  };

  if (loading) return <div className="text-center">Loading...</div>;
  if (error)
    return <div className="text-red-500 text-center">Error: {error}</div>;
  if (schemas.length === 0)
    return <div className="text-center">No tables available</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Dynamic Chart Builder</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Table:
          </label>
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          >
            {schemas.map((schema) => (
              <option key={schema.tableName} value={schema.tableName}>
                {schema.tableName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Column:
          </label>
          <select
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          >
            {schemas
              .find((s) => s.tableName === selectedTable)
              ?.columns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name} ({col.type})
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Aggregation:
          </label>
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="SUM">Sum</option>
            <option value="AVG">Average</option>
            <option value="COUNT">Count</option>
            <option value="MIN">Min</option>
            <option value="MAX">Max</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Group By:
          </label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">None</option>
            {schemas
              .find((s) => s.tableName === selectedTable)
              ?.columns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <button
        onClick={handleChartConfig}
        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 mb-6"
      >
        Generate Chart
      </button>
      {chartConfig && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Chart Preview</h3>
          <pre className="bg-gray-100 p-4 rounded-md">
            {JSON.stringify(chartConfig, null, 2)}
          </pre>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Add to Dashboard:
            </label>
            <select
              value={selectedDashboard}
              onChange={(e) => setSelectedDashboard(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Select Dashboard</option>
              {dashboards.map((dashboard) => (
                <option key={dashboard.id} value={dashboard.id}>
                  {dashboard.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddToDashboard}
              className="mt-2 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
            >
              Add to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicChartBuilder;

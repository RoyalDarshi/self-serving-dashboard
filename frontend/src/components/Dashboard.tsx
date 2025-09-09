// Dashboard.tsx
import React, { useState } from "react";
import SavedChart from "./SavedChart";

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
type AggregationType = "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
interface ChartConfig {
  id?: string;
  xAxisDimension: Dimension | null;
  yAxisFacts: Fact[];
  groupByDimension: Dimension | null;
  chartType: "bar" | "line" | "pie";
  aggregationType: AggregationType;
  stacked: boolean;
}

interface DashboardProps {
  dashboards: { id: string; name: string; charts: ChartConfig[] }[];
  addNewDashboard: (name: string) => string;
}

const Dashboard: React.FC<DashboardProps> = ({
  dashboards,
  addNewDashboard,
}) => {
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(
    null
  );

  const handleCreateNew = () => {
    const name = window.prompt("Enter new dashboard name:");
    if (name) {
      addNewDashboard(name);
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={handleCreateNew}
        className="mb-4 px-4 py-2 bg-green-500 text-white rounded"
      >
        Create New Dashboard
      </button>
      <div className="mb-4">
        <h2 className="text-xl font-bold">My Dashboards</h2>
        <ul>
          {dashboards.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => setSelectedDashboard(d.id)}
                className="text-blue-500"
              >
                {d.name} ({d.charts.length} charts)
              </button>
            </li>
          ))}
        </ul>
      </div>
      {selectedDashboard && (
        <div>
          <h3 className="text-lg font-bold">
            {dashboards.find((d) => d.id === selectedDashboard)?.name}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {dashboards
              .find((d) => d.id === selectedDashboard)
              ?.charts.map((chart) => (
                <SavedChart key={chart.id} config={chart} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

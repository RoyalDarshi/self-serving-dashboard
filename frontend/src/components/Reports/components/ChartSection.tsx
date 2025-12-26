import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { FullReportConfig } from "../../../services/api";

interface ChartSectionProps {
  data: any[];
  config: FullReportConfig;
  resolveKey: (key: string) => string;
  onDrill?: (data: any) => void;
  colors: string[];
}

export const ChartSection: React.FC<ChartSectionProps> = ({
  data,
  config,
  resolveKey,
  onDrill,
  colors,
}) => {
  const xKey = config.visualization?.xAxisColumn
    ? resolveKey(config.visualization.xAxisColumn)
    : undefined;

  const yCols = config.visualization?.yAxisColumns || [];

  if (!data.length || !xKey || !yCols.length) return null;

  return (
    <div className="bg-white h-[400px] p-4 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 px-2">
        Visualization
      </h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey={xKey}
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            cursor={{ fill: "#f1f5f9" }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} />

          {yCols.map((col: string, i: number) => (
            <Bar
              key={col}
              dataKey={resolveKey(col)}
              fill={colors[i % colors.length]}
              onClick={(d) => onDrill && onDrill(d.payload)}
              cursor={onDrill ? "pointer" : "default"}
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

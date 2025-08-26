// components/Dashboard.tsx
import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";

const Dashboard: React.FC = () => {
  const [facts, setFacts] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState<any[]>([]);
  const [factId, setFactId] = useState("");
  const [dimensionId, setDimensionId] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [sql, setSql] = useState("");

  useEffect(() => {
    const fetchMeta = async () => {
      const f = await apiService.getFacts();
      const d = await apiService.getDimensions();
      if (f.success) setFacts(f.facts);
      if (d.success) setDimensions(d.dimensions);
    };
    fetchMeta();
  }, []);

  const runQuery = async () => {
    if (!factId) return;
    const res = await apiService.runQuery({
      factId: Number(factId),
      dimensionId: dimensionId ? Number(dimensionId) : undefined,
    });
    if (res.success) {
      setData(res.data);
      setSql(res.sql);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Dashboard</h2>

      <div className="flex space-x-4">
        <select
          value={factId}
          onChange={(e) => setFactId(e.target.value)}
          className="border p-2"
        >
          <option value="">Select Fact</option>
          {facts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          value={dimensionId}
          onChange={(e) => setDimensionId(e.target.value)}
          className="border p-2"
        >
          <option value="">No Dimension</option>
          {dimensions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          onClick={runQuery}
          className="bg-green-600 text-white px-4 py-2"
        >
          Run
        </button>
      </div>

      {sql && <pre className="bg-gray-100 p-2 text-sm">{sql}</pre>}

      {data.length > 0 && (
        <table className="border mt-4 w-full">
          <thead>
            <tr>
              {Object.keys(data[0]).map((h) => (
                <th key={h} className="border px-2 py-1">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {Object.values(row).map((v, j) => (
                  <td key={j} className="border px-2 py-1">
                    {String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Dashboard;

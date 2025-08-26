import React, { useEffect, useState } from "react";
import { apiService } from "../services/api";

const AdminPanel: React.FC = () => {
  const [schemas, setSchemas] = useState<any[]>([]);
  const [facts, setFacts] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);

  // --- Fact Form ---
  const [factName, setFactName] = useState("");
  const [factTable, setFactTable] = useState("");
  const [factColumn, setFactColumn] = useState("");
  const [factAggregation, setFactAggregation] = useState("SUM");

  // --- Dimension Form ---
  const [dimensionName, setDimensionName] = useState("");
  const [dimensionFactTable, setDimensionFactTable] = useState("");
  const [dimensionFactColumn, setDimensionFactColumn] = useState("");
  const [dimensionTable, setDimensionTable] = useState("");
  const [dimensionJoinColumn, setDimensionJoinColumn] = useState("");
  const [dimensionDisplayColumn, setDimensionDisplayColumn] = useState("");

  // --- KPI Form ---
  const [kpiName, setKpiName] = useState("");
  const [kpiQuery, setKpiQuery] = useState("");

  useEffect(() => {
    // Load schema
    apiService.getSchemas().then((res) => {
      if (res.success) setSchemas(res.schemas);
    });

    // Load metadata
    apiService.getFacts().then((res) => res.success && setFacts(res.facts));
    apiService
      .getDimensions()
      .then((res) => res.success && setDimensions(res.dimensions));
    apiService.getKpis().then((res) => res.success && setKpis(res.kpis));
  }, []);

  // --- Handlers ---
  const handleCreateFact = async () => {
    if (!factName || !factTable || !factColumn) {
      alert("Fill all fields");
      return;
    }
    const res = await apiService.createFact({
      name: factName,
      table_name: factTable,
      column_name: factColumn,
      aggregation: factAggregation,
    });
    if (res.success) {
      alert("Fact created");
      setFacts([
        ...facts,
        res.fact || {
          name: factName,
          table_name: factTable,
          column_name: factColumn,
          aggregation: factAggregation,
        },
      ]);
      setFactName("");
      setFactTable("");
      setFactColumn("");
      setFactAggregation("SUM");
    } else alert("Failed to create fact");
  };

  const handleCreateDimension = async () => {
    if (
      !dimensionName ||
      !dimensionFactTable ||
      !dimensionFactColumn ||
      !dimensionTable ||
      !dimensionJoinColumn ||
      !dimensionDisplayColumn
    ) {
      alert("Fill all fields");
      return;
    }
    const res = await apiService.createDimension({
      name: dimensionName,
      fact_table: dimensionFactTable,
      fact_column: dimensionFactColumn,
      dimension_table: dimensionTable,
      dimension_column: dimensionJoinColumn,
      display_column: dimensionDisplayColumn,
    });
    if (res.success) {
      alert("Dimension created");
      setDimensions([
        ...dimensions,
        res.dimension || {
          name: dimensionName,
          fact_table: dimensionFactTable,
          fact_column: dimensionFactColumn,
          dimension_table: dimensionTable,
          dimension_column: dimensionJoinColumn,
          display_column: dimensionDisplayColumn,
        },
      ]);
      setDimensionName("");
      setDimensionFactTable("");
      setDimensionFactColumn("");
      setDimensionTable("");
      setDimensionJoinColumn("");
      setDimensionDisplayColumn("");
    } else alert("Failed to create dimension");
  };

  const handleCreateKPI = async () => {
    if (!kpiName || !kpiQuery) {
      alert("Fill all fields");
      return;
    }
    const res = await apiService.createKPI({
      name: kpiName,
      sql_query: kpiQuery,
    });
    if (res.success) {
      alert("KPI created");
      setKpis([...kpis, res.kpi || { name: kpiName, sql_query: kpiQuery }]);
      setKpiName("");
      setKpiQuery("");
    } else alert("Failed to create KPI");
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold">Admin Panel</h2>

      {/* FACT CREATION */}
      <div className="p-4 border rounded">
        <h3 className="font-semibold mb-2">Create Fact</h3>
        <input
          type="text"
          placeholder="Fact Name"
          value={factName}
          onChange={(e) => setFactName(e.target.value)}
          className="border p-2 w-full mb-2"
        />
        <select
          value={factTable}
          onChange={(e) => setFactTable(e.target.value)}
          className="border p-2 w-full mb-2"
        >
          <option value="">Select Table</option>
          {schemas.map((t) => (
            <option key={t.tableName} value={t.tableName}>
              {t.tableName}
            </option>
          ))}
        </select>
        {factTable && (
          <select
            value={factColumn}
            onChange={(e) => setFactColumn(e.target.value)}
            className="border p-2 w-full mb-2"
          >
            <option value="">Select Column</option>
            {schemas
              .find((t) => t.tableName === factTable)
              ?.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
          </select>
        )}
        <select
          value={factAggregation}
          onChange={(e) => setFactAggregation(e.target.value)}
          className="border p-2 w-full mb-2"
        >
          <option value="SUM">SUM</option>
          <option value="AVG">AVG</option>
          <option value="COUNT">COUNT</option>
          <option value="MAX">MAX</option>
          <option value="MIN">MIN</option>
        </select>
        <button
          onClick={handleCreateFact}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Create Fact
        </button>
      </div>

      {/* DIMENSION CREATION */}
      <div className="p-4 border rounded">
        <h3 className="font-semibold mb-2">Create Dimension</h3>
        <input
          type="text"
          placeholder="Dimension Name"
          value={dimensionName}
          onChange={(e) => setDimensionName(e.target.value)}
          className="border p-2 w-full mb-2"
        />

        <select
          value={dimensionFactTable}
          onChange={(e) => setDimensionFactTable(e.target.value)}
          className="border p-2 w-full mb-2"
        >
          <option value="">Select Fact Table</option>
          {schemas.map((t) => (
            <option key={t.tableName} value={t.tableName}>
              {t.tableName}
            </option>
          ))}
        </select>

        {dimensionFactTable && (
          <select
            value={dimensionFactColumn}
            onChange={(e) => setDimensionFactColumn(e.target.value)}
            className="border p-2 w-full mb-2"
          >
            <option value="">Select Fact Column</option>
            {schemas
              .find((t) => t.tableName === dimensionFactTable)
              ?.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
          </select>
        )}

        <select
          value={dimensionTable}
          onChange={(e) => setDimensionTable(e.target.value)}
          className="border p-2 w-full mb-2"
        >
          <option value="">Select Dimension Table</option>
          {schemas.map((t) => (
            <option key={t.tableName} value={t.tableName}>
              {t.tableName}
            </option>
          ))}
        </select>

        {dimensionTable && (
          <>
            <select
              value={dimensionJoinColumn}
              onChange={(e) => setDimensionJoinColumn(e.target.value)}
              className="border p-2 w-full mb-2"
            >
              <option value="">Select Join Column</option>
              {schemas
                .find((t) => t.tableName === dimensionTable)
                ?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>

            <select
              value={dimensionDisplayColumn}
              onChange={(e) => setDimensionDisplayColumn(e.target.value)}
              className="border p-2 w-full mb-2"
            >
              <option value="">Select Display Column</option>
              {schemas
                .find((t) => t.tableName === dimensionTable)
                ?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
          </>
        )}

        <button
          onClick={handleCreateDimension}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Create Dimension
        </button>
      </div>

      {/* KPI CREATION */}
      <div className="p-4 border rounded">
        <h3 className="font-semibold mb-2">Create KPI</h3>
        <input
          type="text"
          placeholder="KPI Name"
          value={kpiName}
          onChange={(e) => setKpiName(e.target.value)}
          className="border p-2 w-full mb-2"
        />
        <textarea
          placeholder="SQL Query"
          value={kpiQuery}
          onChange={(e) => setKpiQuery(e.target.value)}
          className="border p-2 w-full mb-2 h-24"
        />
        <button
          onClick={handleCreateKPI}
          className="bg-purple-500 text-white px-4 py-2 rounded"
        >
          Create KPI
        </button>
      </div>

      {/* LISTS */}
      <div>
        <h3 className="font-semibold mb-2">Existing Facts</h3>
        <ul className="list-disc pl-6">
          {facts.map((f, i) => (
            <li key={i}>
              {f.name} → {f.aggregation}({f.table_name}.{f.column_name})
            </li>
          ))}
        </ul>

        <h3 className="font-semibold mb-2 mt-4">Existing Dimensions</h3>
        <ul className="list-disc pl-6">
          {dimensions.map((d, i) => (
            <li key={i}>
              {d.name} → {d.fact_table}.{d.fact_column} ⇆ {d.dimension_table}.
              {d.dimension_column} (display: {d.display_column})
            </li>
          ))}
        </ul>

        <h3 className="font-semibold mb-2 mt-4">Existing KPIs</h3>
        <ul className="list-disc pl-6">
          {kpis.map((k, i) => (
            <li key={i}>
              {k.name} → {k.sql_query}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AdminPanel;

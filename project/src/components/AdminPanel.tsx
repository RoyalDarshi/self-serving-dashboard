import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";

// Types
interface Schema {
  tableName: string;
  columns: { name: string; type: string; notnull: number; pk: number }[];
}
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
interface FactDimension {
  id: number;
  fact_id: number;
  dimension_id: number;
  join_table: string;
  fact_column: string;
  dimension_column: string;
}
interface KPI {
  id: number;
  name: string;
  expression: string;
  description?: string;
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <h1 className="text-red-500 p-4">
          Something went wrong. Please refresh or check the console for details.
        </h1>
      );
    }
    return this.props.children;
  }
}

const AdminPanel: React.FC = () => {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [factDimensions, setFactDimensions] = useState<FactDimension[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fact form state
  const [factName, setFactName] = useState("");
  const [factTable, setFactTable] = useState("");
  const [factColumn, setFactColumn] = useState("");
  const [factAggregation, setFactAggregation] = useState("SUM");

  // Dimension form state
  const [dimensionName, setDimensionName] = useState("");
  const [dimensionTable, setDimensionTable] = useState("");
  const [dimensionColumn, setDimensionColumn] = useState("");

  // Fact-Dimension mapping form state
  const [mappingFactId, setMappingFactId] = useState("");
  const [mappingDimensionId, setMappingDimensionId] = useState("");
  const [mappingJoinTable, setMappingJoinTable] = useState("");
  const [mappingFactColumn, setMappingFactColumn] = useState("");
  const [mappingDimensionColumn, setMappingDimensionColumn] = useState("");

  // KPI form state
  const [kpiName, setKpiName] = useState("");
  const [kpiExpression, setKpiExpression] = useState("");
  const [kpiInsertType, setKpiInsertType] = useState<"fact" | "column" | "">(
    ""
  );
  const [kpiInsertFactId, setKpiInsertFactId] = useState("");
  const [kpiInsertTable, setKpiInsertTable] = useState("");
  const [kpiInsertColumn, setKpiInsertColumn] = useState("");
  const [kpiDescription, setKpiDescription] = useState("");

  // Debug apiService
  console.log("apiService:", apiService);
  console.log("apiService.getFacts:", apiService.getFacts);

  // Fetch data on mount if authenticated
  useEffect(() => {
    if (token) {
      // Check if API methods exist
      if (
        !apiService.getSchemas ||
        !apiService.getFacts ||
        !apiService.getDimensions ||
        !apiService.getFactDimensions ||
        !apiService.getKpis
      ) {
        setError(
          "API service methods are missing. Check services/api.ts import."
        );
        console.error("Missing API methods:", {
          getSchemas: !!apiService.getSchemas,
          getFacts: !!apiService.getFacts,
          getDimensions: !!apiService.getDimensions,
          getFactDimensions: !!apiService.getFactDimensions,
          getKpis: !!apiService.getKpis,
        });
        return;
      }
      Promise.all([
        apiService.getSchemas().catch((err) => ({ error: err.message })),
        apiService.getFacts().catch((err) => ({ error: err.message })),
        apiService.getDimensions().catch((err) => ({ error: err.message })),
        apiService.getFactDimensions().catch((err) => ({ error: err.message })),
        apiService.getKpis().catch((err) => ({ error: err.message })),
      ])
        .then(
          ([
            schemasRes,
            factsRes,
            dimensionsRes,
            factDimensionsRes,
            kpisRes,
          ]) => {
            if (schemasRes.error) {
              setError("Failed to fetch schemas: " + schemasRes.error);
              return;
            }
            if (factsRes.error) {
              setError("Failed to fetch facts: " + factsRes.error);
              return;
            }
            if (dimensionsRes.error) {
              setError("Failed to fetch dimensions: " + dimensionsRes.error);
              return;
            }
            if (factDimensionsRes.error) {
              setError(
                "Failed to fetch fact dimensions: " + factDimensionsRes.error
              );
              return;
            }
            if (kpisRes.error) {
              setError("Failed to fetch KPIs: " + kpisRes.error);
              return;
            }
            setSchemas(schemasRes.schemas || []);
            setFacts(factsRes);
            setDimensions(dimensionsRes);
            setFactDimensions(factDimensionsRes);
            setKpis(kpisRes);
          }
        )
        .catch((err) =>
          setError("Failed to fetch data: " + (err.error || err.message))
        );
    }
  }, [token]);

  // Handle login
  const handleLogin = async () => {
    try {
      const res = await apiService.login({ username, password });
      if (res.success) {
        setToken(res.token);
        localStorage.setItem("token", res.token);
        setError("");
        setSuccess("Logged in successfully");
      } else {
        setError(res.error || "Login failed");
        setSuccess("");
      }
    } catch (err) {
      setError("Login failed: " + (err.error || err.message));
      setSuccess("");
    }
  };

  // Handle fact creation
  const handleCreateFact = async () => {
    if (!factName || !factTable || !factColumn) {
      setError("All fact fields are required");
      return;
    }
    try {
      const res = await apiService.createFact({
        name: factName,
        table_name: factTable,
        column_name: factColumn,
        aggregate_function: factAggregation,
      });
      if (res.success !== false) {
        setFacts([...facts, res]);
        setFactName("");
        setFactTable("");
        setFactColumn("");
        setFactAggregation("SUM");
        setSuccess(`Fact created: ${res.name}`);
        setError("");
      } else {
        setError(res.error || "Failed to create fact");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to create fact: " + (err.error || err.message));
      setSuccess("");
    }
  };

  // Handle dimension creation
  const handleCreateDimension = async () => {
    if (!dimensionName || !dimensionColumn) {
      setError("All dimension fields are required");
      return;
    }
    try {
      const res = await apiService.createDimension({
        name: dimensionName,
        column_name: dimensionColumn,
      });
      if (res.success !== false) {
        setDimensions([...dimensions, res]);
        setDimensionName("");
        setDimensionTable("");
        setDimensionColumn("");
        setSuccess(`Dimension created: ${res.name}`);
        setError("");
      } else {
        setError(res.error || "Failed to create dimension");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to create dimension: " + (err.error || err.message));
      setSuccess("");
    }
  };

  // Handle fact-dimension mapping creation
  const handleCreateFactDimension = async () => {
    if (
      !mappingFactId ||
      !mappingDimensionId ||
      !mappingJoinTable ||
      !mappingFactColumn ||
      !mappingDimensionColumn
    ) {
      setError("All mapping fields are required");
      return;
    }
    try {
      const res = await apiService.createFactDimension({
        fact_id: Number(mappingFactId),
        dimension_id: Number(mappingDimensionId),
        join_table: mappingJoinTable,
        fact_column: mappingFactColumn,
        dimension_column: mappingDimensionColumn,
      });
      if (res.success !== false) {
        setFactDimensions([...factDimensions, res]);
        setMappingFactId("");
        setMappingDimensionId("");
        setMappingJoinTable("");
        setMappingFactColumn("");
        setMappingDimensionColumn("");
        setSuccess("Fact-Dimension mapping created");
        setError("");
      } else {
        setError(res.error || "Failed to create mapping");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to create mapping: " + (err.error || err.message));
      setSuccess("");
    }
  };

  // Handle KPI creation
  const handleCreateKPI = async () => {
    if (!kpiName || !kpiExpression) {
      setError("KPI name and expression are required");
      return;
    }
    // Basic validation: ensure expression references valid facts or columns
    const factNames = facts.map((f) => f.name.toLowerCase());
    const columnRefs = schemas.flatMap((s) =>
      s.columns.map((c) => `${s.tableName}.${c.name}`.toLowerCase())
    );
    const exprWords = kpiExpression.toLowerCase().split(/[\s+\-*/%()]+/);
    const invalidTerms = exprWords.filter(
      (w) =>
        w &&
        !factNames.includes(w) &&
        !columnRefs.includes(w) &&
        !["sum", "avg", "count", "max", "min"].includes(w)
    );
    if (invalidTerms.length > 0) {
      setError(
        `Invalid terms in expression: ${invalidTerms.join(
          ", "
        )}. Use fact names or table.column references.`
      );
      return;
    }
    try {
      const res = await apiService.createKPI({
        name: kpiName,
        expression: kpiExpression,
        description: kpiDescription,
      });
      if (res.success !== false) {
        setKpis([...kpis, res]);
        setKpiName("");
        setKpiExpression("");
        setKpiInsertType("");
        setKpiInsertFactId("");
        setKpiInsertTable("");
        setKpiInsertColumn("");
        setKpiDescription("");
        setSuccess(`KPI created: ${res.name}`);
        setError("");
      } else {
        setError(res.error || "Failed to create KPI");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to create KPI: " + (err.error || err.message));
      setSuccess("");
    }
  };

  // Insert fact or column into KPI expression
  const insertIntoKpiExpression = () => {
    if (kpiInsertType === "fact" && kpiInsertFactId) {
      const fact = facts.find((f) => f.id === Number(kpiInsertFactId));
      if (fact) {
        setKpiExpression(
          kpiExpression + (kpiExpression ? " " : "") + fact.name
        );
      }
    } else if (
      kpiInsertType === "column" &&
      kpiInsertTable &&
      kpiInsertColumn
    ) {
      setKpiExpression(
        kpiExpression +
          (kpiExpression ? " " : "") +
          `${kpiInsertTable}.${kpiInsertColumn}`
      );
    }
    setKpiInsertType("");
    setKpiInsertFactId("");
    setKpiInsertTable("");
    setKpiInsertColumn("");
  };

  if (!token) {
    return (
      <ErrorBoundary>
        <div className="max-w-md mx-auto p-6 bg-white shadow rounded-xl">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Login</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border rounded p-2 w-full"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded p-2 w-full"
            />
            <button
              onClick={handleLogin}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow"
            >
              Login
            </button>
            {error && <p className="text-red-500 mt-2">{error}</p>}
            {success && <p className="text-green-500 mt-2">{success}</p>}
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800">
          Create Analytics Entities
        </h2>

        {/* Fact Creation */}
        <div className="p-6 bg-white shadow rounded-xl">
          <h3 className="text-lg font-semibold mb-3 text-blue-600">
            Create Fact
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Fact Name (e.g., Revenue)"
              value={factName}
              onChange={(e) => setFactName(e.target.value)}
              className="border rounded p-2 w-full"
            />
            <select
              value={factTable}
              onChange={(e) => {
                setFactTable(e.target.value);
                setFactColumn(""); // Reset column when table changes
              }}
              className="border rounded p-2 w-full"
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
                className="border rounded p-2 w-full"
              >
                <option value="">Select Column</option>
                {schemas
                  .find((t) => t.tableName === factTable)
                  ?.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
              </select>
            )}
            <select
              value={factAggregation}
              onChange={(e) => setFactAggregation(e.target.value)}
              className="border rounded p-2 w-full"
            >
              <option value="SUM">SUM</option>
              <option value="AVG">AVG</option>
              <option value="COUNT">COUNT</option>
              <option value="MAX">MIN</option>
              <option value="MIN">MAX</option>
            </select>
            <button
              onClick={handleCreateFact}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow"
            >
              Create Fact
            </button>
          </div>
        </div>

        {/* Dimension Creation */}
        <div className="p-6 bg-white shadow rounded-xl">
          <h3 className="text-lg font-semibold mb-3 text-green-600">
            Create Dimension
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Dimension Name (e.g., Product)"
              value={dimensionName}
              onChange={(e) => setDimensionName(e.target.value)}
              className="border rounded p-2 w-full"
            />
            <select
              value={dimensionTable}
              onChange={(e) => {
                setDimensionTable(e.target.value);
                setDimensionColumn(""); // Reset column when table changes
              }}
              className="border rounded p-2 w-full"
            >
              <option value="">Select Table</option>
              {schemas.map((t) => (
                <option key={t.tableName} value={t.tableName}>
                  {t.tableName}
                </option>
              ))}
            </select>
            {dimensionTable && (
              <select
                value={dimensionColumn}
                onChange={(e) => setDimensionColumn(e.target.value)}
                className="border rounded p-2 w-full"
              >
                <option value="">Select Column</option>
                {schemas
                  .find((t) => t.tableName === dimensionTable)
                  ?.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
              </select>
            )}
            <button
              onClick={handleCreateDimension}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow"
            >
              Create Dimension
            </button>
          </div>
        </div>

        {/* Fact-Dimension Mapping Creation */}
        <div className="p-6 bg-white shadow rounded-xl">
          <h3 className="text-lg font-semibold mb-3 text-yellow-600">
            Create Fact-Dimension Mapping
          </h3>
          <div className="space-y-3">
            <select
              value={mappingFactId}
              onChange={(e) => setMappingFactId(e.target.value)}
              className="border rounded p-2 w-full"
            >
              <option value="">Select Fact</option>
              {facts.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.table_name}.{f.column_name})
                </option>
              ))}
            </select>
            <select
              value={mappingDimensionId}
              onChange={(e) => setMappingDimensionId(e.target.value)}
              className="border rounded p-2 w-full"
            >
              <option value="">Select Dimension</option>
              {dimensions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.column_name})
                </option>
              ))}
            </select>
            <select
              value={mappingJoinTable}
              onChange={(e) => {
                setMappingJoinTable(e.target.value);
                setMappingDimensionColumn("");
              }}
              className="border rounded p-2 w-full"
            >
              <option value="">Select Join Table</option>
              {schemas.map((t) => (
                <option key={t.tableName} value={t.tableName}>
                  {t.tableName}
                </option>
              ))}
            </select>
            {mappingFactId && (
              <select
                value={mappingFactColumn}
                onChange={(e) => setMappingFactColumn(e.target.value)}
                className="border rounded p-2 w-full"
              >
                <option value="">Select Fact Column</option>
                {schemas
                  .find(
                    (t) =>
                      t.tableName ===
                      facts.find((f) => f.id === Number(mappingFactId))
                        ?.table_name
                  )
                  ?.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
              </select>
            )}
            {mappingJoinTable && (
              <select
                value={mappingDimensionColumn}
                onChange={(e) => setMappingDimensionColumn(e.target.value)}
                className="border rounded p-2 w-full"
              >
                <option value="">Select Dimension Column</option>
                {schemas
                  .find((t) => t.tableName === mappingJoinTable)
                  ?.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
              </select>
            )}
            <button
              onClick={handleCreateFactDimension}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg shadow"
            >
              Create Mapping
            </button>
          </div>
        </div>

        {/* KPI Creation */}
        <div className="p-6 bg-white shadow rounded-xl">
          <h3 className="text-lg font-semibold mb-3 text-purple-600">
            Create KPI
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="KPI Name (e.g., Profit Margin)"
              value={kpiName}
              onChange={(e) => setKpiName(e.target.value)}
              className="border rounded p-2 w-full"
            />
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Expression (e.g., Revenue - Cost or sales.amount - orders.cost)"
                value={kpiExpression}
                onChange={(e) => setKpiExpression(e.target.value)}
                className="border rounded p-2 flex-1"
                title="Enter an expression using fact names (e.g., Revenue) or table.column references (e.g., sales.amount)"
              />
              <select
                value={kpiInsertType}
                onChange={(e) => {
                  setKpiInsertType(e.target.value as "fact" | "column" | "");
                  setKpiInsertFactId("");
                  setKpiInsertTable("");
                  setKpiInsertColumn("");
                }}
                className="border rounded p-2 w-32"
              >
                <option value="">Insert...</option>
                <option value="fact">Fact</option>
                <option value="column">Column</option>
              </select>
            </div>
            {kpiInsertType === "fact" && (
              <select
                value={kpiInsertFactId}
                onChange={(e) => setKpiInsertFactId(e.target.value)}
                className="border rounded p-2 w-full"
              >
                <option value="">Select Fact</option>
                {facts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            {kpiInsertType === "column" && (
              <>
                <select
                  value={kpiInsertTable}
                  onChange={(e) => {
                    setKpiInsertTable(e.target.value);
                    setKpiInsertColumn("");
                  }}
                  className="border rounded p-2 w-full"
                >
                  <option value="">Select Table</option>
                  {schemas.map((t) => (
                    <option key={t.tableName} value={t.tableName}>
                      {t.tableName}
                    </option>
                  ))}
                </select>
                {kpiInsertTable && (
                  <select
                    value={kpiInsertColumn}
                    onChange={(e) => setKpiInsertColumn(e.target.value)}
                    className="border rounded p-2 w-full"
                  >
                    <option value="">Select Column</option>
                    {schemas
                      .find((t) => t.tableName === kpiInsertTable)
                      ?.columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                  </select>
                )}
              </>
            )}
            {(kpiInsertType === "fact" && kpiInsertFactId) ||
            (kpiInsertType === "column" &&
              kpiInsertTable &&
              kpiInsertColumn) ? (
              <button
                onClick={insertIntoKpiExpression}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg shadow"
              >
                Insert
              </button>
            ) : null}
            <div className="text-sm text-gray-600">
              Preview: {kpiExpression || "No expression entered"}
            </div>
            <textarea
              placeholder="Description (optional)"
              value={kpiDescription}
              onChange={(e) => setKpiDescription(e.target.value)}
              className="border rounded p-2 w-full"
            />
            <button
              onClick={handleCreateKPI}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg shadow"
            >
              Create KPI
            </button>
          </div>
        </div>

        {/* Lists */}
        <div className="p-6 bg-gray-50 shadow-inner rounded-xl">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">
            Existing Facts
          </h3>
          <ul className="list-disc pl-6 text-gray-700">
            {facts.map((f) => (
              <li key={f.id}>
                {f.name} → {f.aggregate_function}({f.table_name}.{f.column_name}
                )
              </li>
            ))}
          </ul>
          <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-700">
            Existing Dimensions
          </h3>
          <ul className="list-disc pl-6 text-gray-700">
            {dimensions.map((d) => (
              <li key={d.id}>
                {d.name} → {d.column_name}
              </li>
            ))}
          </ul>
          <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-700">
            Existing Fact-Dimension Mappings
          </h3>
          <ul className="list-disc pl-6 text-gray-700">
            {factDimensions.map((fd) => (
              <li key={fd.id}>
                {facts.find((f) => f.id === fd.fact_id)?.name || "Unknown Fact"}{" "}
                →
                {dimensions.find((d) => d.id === fd.dimension_id)?.name ||
                  "Unknown Dimension"}
                ({fd.join_table}.{fd.dimension_column} ={" "}
                {facts.find((f) => f.id === fd.fact_id)?.table_name ||
                  "Unknown Table"}
                .{fd.fact_column})
              </li>
            ))}
          </ul>
          <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-700">
            Existing KPIs
          </h3>
          <ul className="list-disc pl-6 text-gray-700">
            {kpis.map((k) => (
              <li key={k.id}>
                {k.name} → {k.expression}{" "}
                {k.description && `(${k.description})`}
              </li>
            ))}
          </ul>
        </div>

        {/* Feedback Messages */}
        {error && <p className="text-red-500 mt-2">{error}</p>}
        {success && <p className="text-green-500 mt-2">{success}</p>}
      </div>
    </ErrorBoundary>
  );
};

export default AdminPanel;

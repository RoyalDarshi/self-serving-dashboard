// src/components/SemanticBuilder.tsx
import React, { useState, useEffect } from "react";
import { Database, BarChart3, Layers, Target, Zap, Table, AlertCircle } from "lucide-react";
import { apiService } from "../services/api";
import FactForm from "./FactForm";
import DimensionForm from "./DimensionForm";
import MappingForm from "./MappingForm";
import KPIForm from "./KPIForm";
import DataList from "./DataList";
import SchemaVisualizer from "./SchemaVisualizer";
import ErrorBoundary from "./ErrorBoundary";
import { ConnectionSelector } from "./ConnectionSelector";
import { ReactFlowProvider } from "react-flow-renderer";

// Types
interface Schema {
  tableName: string;
  columns: { name: string; type: string; notnull: number; pk: number }[];
  // NEW FIELDS for connection context
  connection_id: number;
  connection_name: string;
}
interface Fact {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
  aggregate_function: string;
  // NEW FIELD
  connection_name?: string;
}
interface Dimension {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
  // NEW FIELD
  connection_name?: string;
}
interface FactDimension {
  id: number;
  fact_id: number;
  fact_name: string;
  dimension_id: number;
  dimension_name: string;
  join_table: string;
  fact_column: string;
  dimension_column: string;
  // NEW FIELD
  connection_name?: string;
}
interface KPI {
  id: number;
  name: string;
  expression: string;
  description?: string;
}
interface Connection {
  id: number;
  connection_name: string;
  description?: string;
  type: string;
  hostname: string;
  port: number;
  database: string;
  command_timeout?: number;
  max_transport_objects?: number;
  username: string;
  selected_db: string;
  created_at: string;
}

interface SemanticBuilderProps {
  connections: Connection[];
  selectedConnectionIds: number[];
  setSelectedConnectionIds: (ids: number[]) => void;
}

const SemanticBuilder: React.FC<SemanticBuilderProps> = ({
  connections,
  selectedConnectionIds,
  setSelectedConnectionIds,
}) => {
  const [token] = useState(localStorage.getItem("token") || "");
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [factDimensions, setFactDimensions] = useState<FactDimension[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("schemas");
  const [searchTerm, setSearchTerm] = useState("");

  // Edit states
  const [editingFact, setEditingFact] = useState<Fact | null>(null);
  const [editingDimension, setEditingDimension] = useState<Dimension | null>(
    null
  );
  const [editingFactDimension, setEditingFactDimension] =
    useState<FactDimension | null>(null);
  const [editingKPI, setEditingKPI] = useState<KPI | null>(null);

  // Form states
  const [factName, setFactName] = useState("");
  const [factTable, setFactTable] = useState("");
  const [factColumn, setFactColumn] = useState("");
  const [factAggregation, setFactAggregation] = useState("SUM");

  const [dimensionName, setDimensionName] = useState("");
  const [dimensionTable, setDimensionTable] = useState("");
  const [dimensionColumn, setDimensionColumn] = useState("");

  const [mappingFactId, setMappingFactId] = useState("");
  const [mappingDimensionId, setMappingDimensionId] = useState("");
  const [mappingJoinTable, setMappingJoinTable] = useState("");
  const [mappingFactColumn, setMappingFactColumn] = useState("");
  const [mappingDimensionColumn, setMappingDimensionColumn] = useState("");

  const [kpiName, setKpiName] = useState("");
  const [kpiExpression, setKpiExpression] = useState("");
  const [kpiDescription, setKpiDescription] = useState("");
  const [kpiInsertType, setKpiInsertType] = useState<"fact" | "column" | "">(
    ""
  );
  const [kpiInsertFactId, setKpiInsertFactId] = useState("");
  const [kpiInsertTable, setKpiInsertTable] = useState("");
  const [kpiInsertColumn, setKpiInsertColumn] = useState("");

  const isCreationTab = activeTab === "facts" || activeTab === "dimensions";

  // Fetch data
  useEffect(() => {
    if (!token || selectedConnectionIds.length === 0) {
      setSchemas([]);
      setFacts([]);
      setDimensions([]);
      setFactDimensions([]);
      setKpis([]);
      return;
    }

    const fetchAll = async () => {
      setError("");

      // Fetch data for ALL selected connections and enrich with connection info
      const [sch, fct, dim, kpi] = await Promise.all([
        Promise.all(
          selectedConnectionIds.map((id) => {
            const conn = connections.find((c) => c.id === id);
            return apiService
              .getSchemas(id)
              .then((s) =>
                s.map((schema) => ({
                  ...schema,
                  connection_id: id,
                  connection_name: conn?.connection_name || `Conn ${id}`, // Enrich schemas
                }))
              )
              .catch(() => []);
          })
        ),
        Promise.all(
          selectedConnectionIds.map((id) => {
            const conn = connections.find((c) => c.id === id);
            return apiService
              .getFacts(id)
              .then((f) =>
                f.map((fact) => ({
                  ...fact,
                  connection_name: conn?.connection_name || `Conn ${id}`, // Enrich facts
                }))
              )
              .catch(() => []);
          })
        ),
        Promise.all(
          selectedConnectionIds.map((id) => {
            const conn = connections.find((c) => c.id === id);
            return apiService
              .getDimensions(id)
              .then((d) =>
                d.map((dimension) => ({
                  ...dimension,
                  connection_name: conn?.connection_name || `Conn ${id}`, // Enrich dimensions
                }))
              )
              .catch(() => []);
          })
        ),
        Promise.all(
          selectedConnectionIds.map((id) =>
            apiService.getKpis(id).catch(() => [])
          )
        ),
      ]);

      const allFacts = fct.flat();
      const allDimensions = dim.flat();

      setSchemas(sch.flat());
      setFacts(allFacts);
      setDimensions(allDimensions);
      setKpis(kpi.flat());

      // Fetch and Enrich Mappings
      if (allFacts.length && allDimensions.length) {
        let allMappings: FactDimension[] = [];

        const mappingsResults = await Promise.all(
          selectedConnectionIds.map((id) =>
            apiService.getFactDimensions(id).catch(() => [])
          )
        );
        allMappings = mappingsResults.flat();

        const uniqueAll = allMappings.filter(
          (m, index, self) => index === self.findIndex((t) => t.id === m.id)
        );

        const enrichedFactDimensions: FactDimension[] = uniqueAll.map((m) => {
          const fact = allFacts.find((f) => f.id === m.fact_id);
          const dimension = allDimensions.find((d) => d.id === m.dimension_id);

          // Determine the connection name for the mapping display (using the fact's connection is a good proxy)
          const connection_name =
            fact?.connection_name ??
            dimension?.connection_name ??
            "Unknown Connection";

          return {
            ...m,
            fact_name: fact?.name ?? "Unknown Fact",
            dimension_name: dimension?.name ?? "Unknown Dimension",
            connection_name: connection_name,
          };
        });

        setFactDimensions(enrichedFactDimensions);
      } else {
        setFactDimensions([]);
      }
    };

    fetchAll();
  }, [token, selectedConnectionIds]);

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  // Prefill mapping
  useEffect(() => {
    if (mappingDimensionId) {
      const dim = dimensions.find((d) => d.id === Number(mappingDimensionId));
      if (dim) {
        setMappingJoinTable(dim.table_name);
        setMappingDimensionColumn(dim.column_name);
      }
    }
  }, [mappingDimensionId, dimensions]);

  useEffect(() => {
    if (editingFactDimension) {
      setMappingFactId(String(editingFactDimension.fact_id));
      setMappingDimensionId(String(editingFactDimension.dimension_id));
      setMappingJoinTable(editingFactDimension.join_table);
      setMappingFactColumn(editingFactDimension.fact_column);
      setMappingDimensionColumn(editingFactDimension.dimension_column);
    }
  }, [editingFactDimension]);

  const clearForm = () => {
    setFactName("");
    setFactTable("");
    setFactColumn("");
    setFactAggregation("SUM");
    setDimensionName("");
    setDimensionTable("");
    setDimensionColumn("");
    setMappingFactId("");
    setMappingDimensionId("");
    setMappingJoinTable("");
    setMappingFactColumn("");
    setMappingDimensionColumn("");
    setKpiName("");
    setKpiExpression("");
    setKpiDescription("");
    setKpiInsertType("");
    setKpiInsertFactId("");
    setKpiInsertTable("");
    setKpiInsertColumn("");
    setEditingFact(null);
    setEditingDimension(null);
    setEditingFactDimension(null);
    setEditingKPI(null);
  };

  const selectedConnId = selectedConnectionIds[0] ?? null;

  // CRUD Handlers
  const handleCreateFact = async () => {
    if (!selectedConnId) return setError("Select a connection");
    if (!factName || !factTable || !factColumn)
      return setError("All fields required");
    const r = await apiService.createFact({
      connection_id: selectedConnId,
      name: factName,
      table_name: factTable,
      column_name: factColumn,
      aggregate_function: factAggregation,
    });
    if (r.success && r.data) {
      setFacts((p) => [
        ...p,
        {
          ...r.data,
          connection_name: connections.find((c) => c.id === selectedConnId)
            ?.connection_name,
        },
      ]);
      clearForm();
      setSuccess(`Fact created`);
    } else setError(r.error ?? "Failed");
  };

  const handleUpdateFact = async () => {
    if (!editingFact || !selectedConnId) return setError("Missing data");
    const r = await apiService.updateFact(editingFact.id, {
      connection_id: selectedConnId,
      name: factName,
      table_name: factTable,
      column_name: factColumn,
      aggregate_function: factAggregation,
    });
    if (r.success && r.data) {
      setFacts((p) =>
        p.map((f) =>
          f.id === editingFact.id
            ? { ...r.data, connection_name: editingFact.connection_name }
            : f
        )
      );
      clearForm();
      setSuccess(`Updated`);
    } else setError(r.error ?? "Failed");
  };

  const handleDeleteFact = async (id: number, name: string) => {
    if (!confirm(`Delete fact "${name}"?`)) return;
    const r = await apiService.deleteFact(id);
    if (r.success) {
      setFacts((p) => p.filter((f) => f.id !== id));
      setSuccess(`Deleted`);
    } else setError(r.error ?? "Failed");
  };

  const startEditFact = (f: Fact) => {
    setEditingFact(f);
    setFactName(f.name);
    setFactTable(f.table_name);
    setFactColumn(f.column_name);
    setFactAggregation(f.aggregate_function);
  };

  // Dimension handlers (same pattern)
  const handleCreateDimension = async () => {
    if (!selectedConnId) return setError("Select a connection");
    if (!dimensionName || !dimensionTable || !dimensionColumn)
      return setError("All fields required");
    const r = await apiService.createDimension({
      connection_id: selectedConnId,
      name: dimensionName,
      table_name: dimensionTable,
      column_name: dimensionColumn,
    });
    if (r.success && r.data) {
      setDimensions((p) => [
        ...p,
        {
          ...r.data,
          connection_name: connections.find((c) => c.id === selectedConnId)
            ?.connection_name,
        },
      ]);
      clearForm();
      setSuccess(`Dimension created`);
    } else setError(r.error ?? "Failed");
  };

  const handleUpdateDimension = async () => {
    if (!editingDimension || !selectedConnId) return setError("Missing data");
    const r = await apiService.updateDimension(editingDimension.id, {
      connection_id: selectedConnId,
      name: dimensionName,
      table_name: dimensionTable,
      column_name: dimensionColumn,
    });
    if (r.success && r.data) {
      setDimensions((p) =>
        p.map((d) =>
          d.id === editingDimension.id
            ? { ...r.data, connection_name: editingDimension.connection_name }
            : d
        )
      );
      clearForm();
      setSuccess(`Updated`);
    } else setError(r.error ?? "Failed");
  };

  const handleDeleteDimension = async (id: number, name: string) => {
    if (!confirm(`Delete dimension "${name}"?`)) return;
    const r = await apiService.deleteDimension(id);
    if (r.success) {
      setDimensions((p) => p.filter((d) => d.id !== id));
      setSuccess(`Deleted`);
    } else setError(r.error ?? "Failed");
  };

  const startEditDimension = (d: Dimension) => {
    setEditingDimension(d);
    setDimensionName(d.name);
    setDimensionTable(d.table_name);
    setDimensionColumn(d.column_name);
  };

  // Mapping handlers
  const handleCreateMapping = async () => {
    if (
      !mappingFactId ||
      !mappingDimensionId ||
      !mappingJoinTable ||
      !mappingFactColumn ||
      !mappingDimensionColumn
    )
      return setError("Fill all mapping fields");
    const r = await apiService.createFactDimension({
      fact_id: Number(mappingFactId),
      dimension_id: Number(mappingDimensionId),
      join_table: mappingJoinTable,
      fact_column: mappingFactColumn,
      dimension_column: mappingDimensionColumn,
    });
    if (r.success && r.data) {
      const fact = facts.find((f) => f.id === Number(mappingFactId));
      const dimension = dimensions.find(
        (d) => d.id === Number(mappingDimensionId)
      );
      const connection_name =
        fact?.connection_name ??
        dimension?.connection_name ??
        "Unknown Connection";

      const newMapping: FactDimension = {
        ...r.data!,
        fact_name: fact?.name ?? "Unknown Fact",
        dimension_name: dimension?.name ?? "Unknown Dimension",
        connection_name: connection_name,
      };

      setFactDimensions((p) => [...p, newMapping]);
      clearForm();
      setSuccess(`Mapping created`);
    } else setError(r.error ?? "Failed");
  };

  const handleUpdateMapping = async () => {
    if (!editingFactDimension) return setError("No mapping selected");
    const r = await apiService.updateFactDimension(editingFactDimension.id, {
      fact_id: Number(mappingFactId),
      dimension_id: Number(mappingDimensionId),
      join_table: mappingJoinTable,
      fact_column: mappingFactColumn,
      dimension_column: mappingDimensionColumn,
    });
    if (r.success && r.data) {
      const fact = facts.find((f) => f.id === Number(mappingFactId));
      const dimension = dimensions.find(
        (d) => d.id === Number(mappingDimensionId)
      );
      const connection_name =
        fact?.connection_name ??
        dimension?.connection_name ??
        "Unknown Connection";

      const updatedMapping: FactDimension = {
        ...r.data!,
        fact_name: fact?.name ?? "Unknown Fact",
        dimension_name: dimension?.name ?? "Unknown Dimension",
        connection_name: connection_name,
      };

      setFactDimensions((p) =>
        p.map((m) => (m.id === editingFactDimension.id ? updatedMapping : m))
      );
      clearForm();
      setSuccess(`Updated`);
    } else setError(r.error ?? "Failed");
  };

  const handleDeleteMapping = async (id: number, fact: string, dim: string) => {
    if (!confirm(`Delete mapping ${fact} to ${dim}?`)) return;
    const r = await apiService.deleteFactDimension(id);
    if (r.success) {
      setFactDimensions((p) => p.filter((m) => m.id !== id));
      setSuccess(`Deleted`);
    } else setError(r.error ?? "Failed");
  };

  const startEditMapping = (m: FactDimension) => setEditingFactDimension(m);

  const handleAutoMap = async () => {
    if (!selectedConnectionIds.length)
      return setError("Select at least one connection");

    let all: FactDimension[] = [];
    let ok = 0,
      err = 0;
    const allFacts = facts;
    const allDimensions = dimensions;

    for (const id of selectedConnectionIds) {
      const r = await apiService.autoMap(id);
      if (r.success && r.data) {
        // Find connection name for enrichment
        const conn = connections.find((c) => c.id === id);
        const connection_name = conn?.connection_name ?? `Conn ${id}`;

        const enriched = r.data.map((m) => {
          const fact = allFacts.find((f) => f.id === m.fact_id);
          const dimension = allDimensions.find((d) => d.id === m.dimension_id);
          return {
            ...m,
            fact_name: fact?.name ?? "Unknown Fact",
            dimension_name: dimension?.name ?? "Unknown Dimension",
            connection_name: connection_name,
          };
        });
        all.push(...enriched);
        ok++;
      } else err++;
    }
    const uniqueAll = all.filter(
      (m, index, self) => index === self.findIndex((t) => t.id === m.id)
    );
    setFactDimensions(uniqueAll);
    setSuccess(ok ? `Auto-mapped ${uniqueAll.length} relations` : "");
    if (err) setError(`${err} connection(s) failed`);
  };

  // KPI handlers
  const handleCreateKPI = async () => {
    if (!selectedConnId) return setError("Select a connection");
    if (!kpiName || !kpiExpression)
      return setError("Name & expression required");
    const r = await apiService.createKpi({
      connection_id: selectedConnId,
      name: kpiName,
      expression: kpiExpression,
      description: kpiDescription,
    });
    if (r.success && r.data) {
      setKpis((p) => [...p, r.data!]);
      clearForm();
      setSuccess(`KPI created`);
    } else setError(r.error ?? "Failed");
  };

  const handleUpdateKPI = async () => {
    if (!editingKPI) return setError("No KPI selected");
    const r = await apiService.updateKpi(editingKPI.id, {
      name: kpiName,
      expression: kpiExpression,
      description: kpiDescription,
    });
    if (r.success && r.data) {
      setKpis((p) => p.map((k) => (k.id === editingKPI.id ? r.data! : k)));
      clearForm();
      setSuccess(`Updated`);
    } else setError(r.error ?? "Failed");
  };

  const handleDeleteKPI = async (id: number, name: string) => {
    if (!confirm(`Delete KPI "${name}"?`)) return;
    const r = await apiService.deleteKpi(id);
    if (r.success) {
      setKpis((p) => p.filter((k) => k.id !== id));
      setSuccess(`Deleted`);
    } else setError(r.error ?? "Failed");
  };

  const startEditKPI = (k: KPI) => {
    setEditingKPI(k);
    setKpiName(k.name);
    setKpiExpression(k.expression);
    setKpiDescription(k.description ?? "");
  };

  const insertIntoKpi = () => {
    let txt = "";
    if (kpiInsertType === "fact" && kpiInsertFactId) {
      const f = facts.find((f) => f.id === Number(kpiInsertFactId));
      if (f) txt = `${f.aggregate_function}(${f.table_name}.${f.column_name})`;
    } else if (
      kpiInsertType === "column" &&
      kpiInsertTable &&
      kpiInsertColumn
    ) {
      txt = `${kpiInsertTable}.${kpiInsertColumn}`;
    }
    if (txt) setKpiExpression((p) => p + " " + txt);
    setKpiInsertType("");
    setKpiInsertFactId("");
    setKpiInsertTable("");
    setKpiInsertColumn("");
  };

  // Filtering
  const filteredFacts = facts.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredDimensions = dimensions.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredMappings = factDimensions.filter((m) =>
    `${m.fact_name} ${m.dimension_name} ${m.connection_name || ""}` // Filter by connection name too
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );
  const filteredKpis = kpis.filter((k) =>
    k.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto p-2">
          {/* Header + Selector */}
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Semantic Builder
            </h1>
            <ConnectionSelector
              connections={connections}
              selectedIds={selectedConnectionIds}
              onChange={setSelectedConnectionIds}
              singleSelect={isCreationTab}
              placeholder="Select connection(s)"
            />
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 bg-white p-2 rounded-xl shadow-md border border-gray-100 mb-2">
            {[
              { id: "schemas", label: "Schemas", icon: Table },
              { id: "facts", label: "Facts", icon: BarChart3 },
              { id: "dimensions", label: "Dimensions", icon: Layers },
              { id: "mappings", label: "Mappings", icon: Target },
              { id: "kpis", label: "KPIs", icon: Zap },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-semibold rounded-lg transition-all duration-300 ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {activeTab === "schemas" && (
            <ReactFlowProvider>
              <SchemaVisualizer
                schemas={schemas}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
              />
            </ReactFlowProvider>
          )}

          {["facts", "dimensions", "mappings", "kpis"].includes(activeTab) && (
            <div className="grid lg:grid-cols-3 gap-2">
              <div>
                {activeTab === "facts" && (
                  <FactForm
                    schemas={schemas}
                    editingFact={editingFact}
                    factName={factName}
                    factTable={factTable}
                    factColumn={factColumn}
                    factAggregation={factAggregation}
                    setFactName={setFactName}
                    setFactTable={setFactTable}
                    setFactColumn={setFactColumn}
                    setFactAggregation={setFactAggregation}
                    onCreate={handleCreateFact}
                    onUpdate={handleUpdateFact}
                    onCancel={clearForm}
                  />
                )}
                {activeTab === "dimensions" && (
                  <DimensionForm
                    schemas={schemas}
                    editingDimension={editingDimension}
                    dimensionName={dimensionName}
                    dimensionTable={dimensionTable}
                    dimensionColumn={dimensionColumn}
                    setDimensionName={setDimensionName}
                    setDimensionTable={setDimensionTable}
                    setDimensionColumn={setDimensionColumn}
                    onCreate={handleCreateDimension}
                    onUpdate={handleUpdateDimension}
                    onCancel={clearForm}
                  />
                )}
                {activeTab === "mappings" && (
                  <MappingForm
                    schemas={schemas}
                    facts={facts}
                    dimensions={dimensions}
                    mappingFactId={mappingFactId}
                    mappingDimensionId={mappingDimensionId}
                    mappingJoinTable={mappingJoinTable}
                    mappingFactColumn={mappingFactColumn}
                    mappingDimensionColumn={mappingDimensionColumn}
                    setMappingFactId={setMappingFactId}
                    setMappingDimensionId={setMappingDimensionId}
                    setMappingJoinTable={setMappingJoinTable}
                    setMappingFactColumn={setMappingFactColumn}
                    setMappingDimensionColumn={setMappingDimensionColumn}
                    onCreate={handleCreateMapping}
                    onUpdate={handleUpdateMapping}
                    onCancel={clearForm}
                    onAutoMap={handleAutoMap}
                    editingFactDimension={editingFactDimension}
                    selectedConnectionIds={selectedConnectionIds}
                  />
                )}
                {activeTab === "kpis" && (
                  <KPIForm
                    schemas={schemas}
                    facts={facts}
                    editingKPI={editingKPI}
                    kpiName={kpiName}
                    kpiExpression={kpiExpression}
                    kpiDescription={kpiDescription}
                    kpiInsertType={kpiInsertType}
                    kpiInsertFactId={kpiInsertFactId}
                    kpiInsertTable={kpiInsertTable}
                    kpiInsertColumn={kpiInsertColumn}
                    setKpiName={setKpiName}
                    setKpiExpression={setKpiExpression}
                    setKpiDescription={setKpiDescription}
                    setKpiInsertType={setKpiInsertType}
                    setKpiInsertFactId={setKpiInsertFactId}
                    setKpiInsertTable={setKpiInsertTable}
                    setKpiInsertColumn={setKpiInsertColumn}
                    onCreate={handleCreateKPI}
                    onUpdate={handleUpdateKPI}
                    onCancel={clearForm}
                    onInsert={insertIntoKpi}
                  />
                )}
              </div>

              {/* DataList component renders the list on the right side (col-span-2) */}
              <DataList
                activeTab={activeTab}
                facts={facts}
                dimensions={dimensions}
                factDimensions={factDimensions}
                kpis={kpis}
                filteredFacts={filteredFacts}
                filteredDimensions={filteredDimensions}
                filteredFactDimensions={filteredMappings}
                filteredKpis={filteredKpis}
                onEditFact={startEditFact}
                onDeleteFact={handleDeleteFact}
                onEditDimension={startEditDimension}
                onDeleteDimension={handleDeleteDimension}
                onEditFactDimension={startEditMapping}
                onDeleteFactDimension={handleDeleteMapping}
                onEditKPI={startEditKPI}
                onDeleteKPI={handleDeleteKPI}
              />
            </div>
          )}

          {(error || success) && (
            <div className="fixed bottom-4 right-4 z-50">
              {error && (
                <div className="bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg mb-2 flex items-center space-x-3 animate-slide-up">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg mb-2 flex items-center space-x-3 animate-slide-up">
                  <span>{success}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default SemanticBuilder;
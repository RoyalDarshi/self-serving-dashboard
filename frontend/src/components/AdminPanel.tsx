import React, { useState, useEffect } from "react";
import { Database, BarChart3, Layers, Target, Zap, Table } from "lucide-react";
import { apiService } from "../services/api";
import ConnectionForm from "./ConnectionForm";
import ConnectionsList from "./ConnectionsList";
import FactForm from "./FactForm";
import DimensionForm from "./DimensionForm";
import MappingForm from "./MappingForm";
import KPIForm from "./KPIForm";
import DataList from "./DataList";
import SchemaVisualizer from "./SchemaVisualizer";
import ErrorBoundary from "./ErrorBoundary";
import Button from "./ui/Button";

// Types
interface Schema {
  tableName: string;
  columns: {
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }[];
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
  table_name: string;
  column_name: string;
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

interface AdminPanelProps {
  onConnectionsUpdate: (connections: Connection[]) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onConnectionsUpdate }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    number | null
  >(null);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [factDimensions, setFactDimensions] = useState<FactDimension[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("connections");
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
  const [kpiInsertType, setKpiInsertType] = useState<"fact" | "column" | "">(
    ""
  );
  const [kpiInsertFactId, setKpiInsertFactId] = useState("");
  const [kpiInsertTable, setKpiInsertTable] = useState("");
  const [kpiInsertColumn, setKpiInsertColumn] = useState("");
  const [kpiDescription, setKpiDescription] = useState("");

  // Fetch connections on mount if authenticated
  useEffect(() => {
    if (token) {
      apiService
        .getConnections()
        .then((conns) => {
          setConnections(conns);
          onConnectionsUpdate(conns); // Update App.tsx connections
          if (conns.length > 0 && selectedConnectionId === null) {
            setSelectedConnectionId(conns[0].id);
          }
        })
        .catch((err) =>
          setError(`Failed to fetch connections: ${err.message}`)
        );
    }
  }, [token, onConnectionsUpdate]);

  // Fetch data when selectedConnectionId changes
  useEffect(() => {
    if (!token || !selectedConnectionId) {
      setSchemas([]);
      setFacts([]);
      setDimensions([]);
      setFactDimensions([]);
      setKpis([]);
      return;
    }

    Promise.all([
      apiService
        .getSchemas(selectedConnectionId)
        .catch((err) => ({ error: err.message })),
      apiService
        .getFacts(selectedConnectionId)
        .catch((err) => ({ error: err.message })),
      apiService
        .getDimensions(selectedConnectionId)
        .catch((err) => ({ error: err.message })),
      apiService
        .getFactDimensions(selectedConnectionId)
        .catch((err) => ({ error: err.message })),
      apiService
        .getKpis(selectedConnectionId)
        .catch((err) => ({ error: err.message })),
    ])
      .then(
        ([schemasRes, factsRes, dimensionsRes, factDimensionsRes, kpisRes]) => {
          if (schemasRes.error)
            return setError(`Failed to fetch schemas: ${schemasRes.error}`);
          if (factsRes.error)
            return setError(`Failed to fetch facts: ${factsRes.error}`);
          if (dimensionsRes.error)
            return setError(
              `Failed to fetch dimensions: ${dimensionsRes.error}`
            );
          if (factDimensionsRes.error)
            return setError(
              `Failed to fetch fact dimensions: ${factDimensionsRes.error}`
            );
          if (kpisRes.error)
            return setError(`Failed to fetch KPIs: ${kpisRes.error}`);
          setSchemas(schemasRes);
          setFacts(factsRes);
          setDimensions(dimensionsRes);
          setFactDimensions(factDimensionsRes);
          setKpis(kpisRes);
        }
      )
      .catch((err) => setError(`Failed to fetch data: ${err.message}`));
  }, [token, selectedConnectionId]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Prefill mapping fields when dimension is selected
  useEffect(() => {
    if (mappingDimensionId) {
      const dim = dimensions.find((d) => d.id === Number(mappingDimensionId));
      if (dim) {
        setMappingJoinTable(dim.table_name);
        setMappingDimensionColumn(dim.column_name);
      }
    }
  }, [mappingDimensionId, dimensions]);

  // Prefill mapping fields when editing fact-dimension
  useEffect(() => {
    if (editingFactDimension) {
      setMappingFactId(editingFactDimension.fact_id.toString());
      setMappingDimensionId(editingFactDimension.dimension_id.toString());
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

  // Fact CRUD operations
  const handleCreateFact = async () => {
    if (!selectedConnectionId)
      return setError("Please select a connection first.");
    if (!factName || !factTable || !factColumn)
      return setError("All fact fields are required");
    try {
      const response = await apiService.createFact({
        connection_id: selectedConnectionId,
        name: factName,
        table_name: factTable,
        column_name: factColumn,
        aggregate_function: factAggregation,
      });
      if (response.success && response.data) {
        setFacts([...facts, response.data]);
        clearForm();
        setSuccess(`Fact "${response.data.name}" created successfully`);
      } else {
        setError(response.error || "Failed to create fact");
      }
    } catch (err) {
      setError(`Failed to create fact: ${(err as Error).message}`);
    }
  };

  const handleEditFact = (fact: Fact) => {
    setEditingFact(fact);
    setFactName(fact.name);
    setFactTable(fact.table_name);
    setFactColumn(fact.column_name);
    setFactAggregation(fact.aggregate_function);
  };

  const handleUpdateFact = async () => {
    if (!editingFact || !factName || !factTable || !factColumn)
      return setError("All fact fields are required");
    try {
      const response = await apiService.updateFact(editingFact.id, {
        connection_id: selectedConnectionId!,
        name: factName,
        table_name: factTable,
        column_name: factColumn,
        aggregate_function: factAggregation,
      });
      if (response.success && response.data) {
        setFacts(
          facts.map((f) => (f.id === editingFact.id ? response.data : f))
        );
        clearForm();
        setSuccess(`Fact "${response.data.name}" updated successfully`);
      } else {
        setError(response.error || "Failed to update fact");
      }
    } catch (err) {
      setError(`Failed to update fact: ${(err as Error).message}`);
    }
  };

  const handleDeleteFact = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the fact "${name}"?`)) return;
    try {
      const response = await apiService.deleteFact(id);
      if (response.success) {
        setFacts(facts.filter((f) => f.id !== id));
        setSuccess(`Fact "${name}" deleted successfully`);
      } else {
        setError(response.error || "Failed to delete fact");
      }
    } catch (err) {
      setError(`Failed to delete fact: ${(err as Error).message}`);
    }
  };

  // Dimension CRUD operations
  const handleCreateDimension = async () => {
    if (!selectedConnectionId)
      return setError("Please select a connection first.");
    if (!dimensionName || !dimensionTable || !dimensionColumn)
      return setError("All dimension fields are required");
    try {
      const response = await apiService.createDimension({
        connection_id: selectedConnectionId,
        name: dimensionName,
        table_name: dimensionTable,
        column_name: dimensionColumn,
      });
      if (response.success && response.data) {
        setDimensions([...dimensions, response.data]);
        clearForm();
        setSuccess(`Dimension "${response.data.name}" created successfully`);
      } else {
        setError(response.error || "Failed to create dimension");
      }
    } catch (err) {
      setError(`Failed to create dimension: ${(err as Error).message}`);
    }
  };

  const handleEditDimension = (dimension: Dimension) => {
    setEditingDimension(dimension);
    setDimensionName(dimension.name);
    setDimensionTable(dimension.table_name);
    setDimensionColumn(dimension.column_name);
  };

  const handleUpdateDimension = async () => {
    if (
      !editingDimension ||
      !dimensionName ||
      !dimensionTable ||
      !dimensionColumn
    ) {
      return setError("All dimension fields are required");
    }
    try {
      const response = await apiService.updateDimension(editingDimension.id, {
        connection_id: selectedConnectionId!,
        name: dimensionName,
        table_name: dimensionTable,
        column_name: dimensionColumn,
      });
      if (response.success && response.data) {
        setDimensions(
          dimensions.map((d) =>
            d.id === editingDimension.id ? response.data : d
          )
        );
        clearForm();
        setSuccess(`Dimension "${response.data.name}" updated successfully`);
      } else {
        setError(response.error || "Failed to update dimension");
      }
    } catch (err) {
      setError(`Failed to update dimension: ${(err as Error).message}`);
    }
  };

  const handleDeleteDimension = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the dimension "${name}"?`))
      return;
    try {
      const response = await apiService.deleteDimension(id);
      if (response.success) {
        setDimensions(dimensions.filter((d) => d.id !== id));
        setSuccess(`Dimension "${name}" deleted successfully`);
      } else {
        setError(response.error || "Failed to delete dimension");
      }
    } catch (err) {
      setError(`Failed to delete dimension: ${(err as Error).message}`);
    }
  };

  // Fact-Dimension CRUD operations
  const handleCreateFactDimension = async () => {
    if (
      !mappingFactId ||
      !mappingDimensionId ||
      !mappingJoinTable ||
      !mappingFactColumn ||
      !mappingDimensionColumn
    ) {
      return setError("All mapping fields are required");
    }
    try {
      const response = await apiService.createFactDimension({
        fact_id: Number(mappingFactId),
        dimension_id: Number(mappingDimensionId),
        join_table: mappingJoinTable,
        fact_column: mappingFactColumn,
        dimension_column: mappingDimensionColumn,
      });
      if (response.success && response.data) {
        setFactDimensions([...factDimensions, response.data]);
        clearForm();
        setSuccess("Fact-Dimension mapping created successfully");
      } else {
        setError(response.error || "Failed to create mapping");
      }
    } catch (err) {
      setError(`Failed to create mapping: ${(err as Error).message}`);
    }
  };

  const handleEditFactDimension = (factDimension: FactDimension) => {
    setEditingFactDimension(factDimension);
  };

  const handleUpdateFactDimension = async () => {
    if (
      !editingFactDimension ||
      !mappingFactId ||
      !mappingDimensionId ||
      !mappingJoinTable ||
      !mappingFactColumn ||
      !mappingDimensionColumn
    ) {
      return setError("All mapping fields are required");
    }
    try {
      const response = await apiService.updateFactDimension(
        editingFactDimension.id,
        {
          fact_id: Number(mappingFactId),
          dimension_id: Number(mappingDimensionId),
          join_table: mappingJoinTable,
          fact_column: mappingFactColumn,
          dimension_column: mappingDimensionColumn,
        }
      );
      if (response.success && response.data) {
        setFactDimensions(
          factDimensions.map((fd) =>
            fd.id === editingFactDimension.id ? response.data : fd
          )
        );
        clearForm();
        setSuccess("Fact-Dimension mapping updated successfully");
      } else {
        setError(response.error || "Failed to update mapping");
      }
    } catch (err) {
      setError(`Failed to update mapping: ${(err as Error).message}`);
    }
  };

  const handleDeleteFactDimension = async (
    id: number,
    factName: string,
    dimensionName: string
  ) => {
    if (
      !confirm(
        `Are you sure you want to delete the mapping between "${factName}" and "${dimensionName}"?`
      )
    )
      return;
    try {
      const response = await apiService.deleteFactDimension(id);
      if (response.success) {
        setFactDimensions(factDimensions.filter((fd) => fd.id !== id));
        setSuccess(
          `Mapping between "${factName}" and "${dimensionName}" deleted successfully`
        );
      } else {
        setError(response.error || "Failed to delete mapping");
      }
    } catch (err) {
      setError(`Failed to delete mapping: ${(err as Error).message}`);
    }
  };

  // KPI CRUD operations
  const handleCreateKPI = async () => {
    if (!selectedConnectionId)
      return setError("Please select a connection first.");
    if (!kpiName || !kpiExpression)
      return setError("KPI name and expression are required");
    try {
      const response = await apiService.createKPI({
        connection_id: selectedConnectionId,
        name: kpiName,
        expression: kpiExpression,
        description: kpiDescription,
      });
      if (response.success && response.data) {
        setKpis([...kpis, response.data]);
        clearForm();
        setSuccess(`KPI "${response.data.name}" created successfully`);
      } else {
        setError(response.error || "Failed to create KPI");
      }
    } catch (err) {
      setError(`Failed to create KPI: ${(err as Error).message}`);
    }
  };

  const handleEditKPI = (kpi: KPI) => {
    setEditingKPI(kpi);
    setKpiName(kpi.name);
    setKpiExpression(kpi.expression);
    setKpiDescription(kpi.description || "");
  };

  const handleUpdateKPI = async () => {
    if (!editingKPI || !kpiName || !kpiExpression)
      return setError("KPI name and expression are required");
    try {
      const response = await apiService.updateKPI(editingKPI.id, {
        name: kpiName,
        expression: kpiExpression,
        description: kpiDescription,
      });
      if (response.success && response.data) {
        setKpis(kpis.map((k) => (k.id === editingKPI.id ? response.data : k)));
        clearForm();
        setSuccess(`KPI "${response.data.name}" updated successfully`);
      } else {
        setError(response.error || "Failed to update KPI");
      }
    } catch (err) {
      setError(`Failed to update KPI: ${(err as Error).message}`);
    }
  };

  const handleDeleteKPI = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the KPI "${name}"?`)) return;
    try {
      const response = await apiService.deleteKPI(id);
      if (response.success) {
        setKpis(kpis.filter((k) => k.id !== id));
        setSuccess(`KPI "${name}" deleted successfully`);
      } else {
        setError(response.error || "Failed to delete KPI");
      }
    } catch (err) {
      setError(`Failed to delete KPI: ${(err as Error).message}`);
    }
  };

  const handleAutoMap = async () => {
    if (!selectedConnectionId)
      return setError("Please select a connection first.");
    try {
      const res = await apiService.getFactDimensions(selectedConnectionId);
      setFactDimensions(res);
      setSuccess(`Auto-mapped ${res.length} fact-dimension pairs successfully`);
    } catch (err) {
      setError(`Failed to auto-map: ${(err as Error).message}`);
    }
  };

  const filteredFacts = facts.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredDimensions = dimensions.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredFactDimensions = factDimensions.filter((fd) =>
    `${fd.fact_name} ${fd.dimension_name}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );
  const filteredKpis = kpis.filter((k) =>
    k.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const insertIntoKpiExpression = () => {
    let insertText = "";
    if (kpiInsertType === "fact" && kpiInsertFactId) {
      const fact = facts.find((f) => f.id === Number(kpiInsertFactId));
      if (fact) {
        insertText = `${fact.aggregate_function}(${fact.table_name}.${fact.column_name})`;
      }
    } else if (
      kpiInsertType === "column" &&
      kpiInsertTable &&
      kpiInsertColumn
    ) {
      insertText = `${kpiInsertTable}.${kpiInsertColumn}`;
    }
    if (insertText) {
      setKpiExpression((prev) => prev + " " + insertText);
    }
    setKpiInsertType("");
    setKpiInsertFactId("");
    setKpiInsertTable("");
    setKpiInsertColumn("");
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto p-2">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <div className="w-64">
              <select
                value={selectedConnectionId || ""}
                onChange={(e) =>
                  setSelectedConnectionId(Number(e.target.value) || null)
                }
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="" disabled>
                  Select a connection
                </option>
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.connection_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 bg-white p-2 rounded-xl shadow-md border border-gray-100 mb-2">
            {[
              { id: "connections", label: "Connections", icon: Database },
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

          {activeTab === "connections" && (
            <div className="grid grid-cols-2 gap-2 min-h-[500px]">
              <ConnectionForm
                onSuccess={setSuccess}
                onError={setError}
                onCreate={(newConn) => {
                  const updatedConnections = [...connections, newConn];
                  setConnections(updatedConnections);
                  onConnectionsUpdate(updatedConnections); // Notify App.tsx
                }}
                onUpdate={(updatedConn) => {
                  const updatedConnections = connections.map((c) =>
                    c.id === updatedConn.id ? updatedConn : c
                  );
                  setConnections(updatedConnections);
                  onConnectionsUpdate(updatedConnections); // Notify App.tsx
                }}
              />
              <ConnectionsList
                connections={connections}
                selectedConnectionId={selectedConnectionId}
                setSelectedConnectionId={setSelectedConnectionId}
                onDelete={(id, name) =>
                  apiService.deleteConnection(id).then((response) => {
                    if (response.success) {
                      const updatedConnections = connections.filter(
                        (c) => c.id !== id
                      );
                      setConnections(updatedConnections);
                      onConnectionsUpdate(updatedConnections); // Notify App.tsx
                      setSuccess(`Connection "${name}" deleted successfully`);
                      if (selectedConnectionId === id) {
                        setSelectedConnectionId(
                          connections.length > 1
                            ? connections.find((c) => c.id !== id)!.id
                            : null
                        );
                      }
                    } else {
                      setError(response.error || "Failed to delete connection");
                    }
                  })
                }
              />
            </div>
          )}

          {activeTab === "schemas" && (
            <SchemaVisualizer schemas={schemas} searchTerm={searchTerm} />
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
                    editingFactDimension={editingFactDimension}
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
                    onCreate={handleCreateFactDimension}
                    onUpdate={handleUpdateFactDimension}
                    onCancel={clearForm}
                    onAutoMap={handleAutoMap}
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
                    onInsert={insertIntoKpiExpression}
                  />
                )}
              </div>

              <DataList
                activeTab={activeTab}
                facts={facts}
                dimensions={dimensions}
                factDimensions={factDimensions}
                filteredFactDimensions={filteredFactDimensions}
                kpis={kpis}
                filteredFacts={filteredFacts}
                filteredDimensions={filteredDimensions}
                filteredKpis={filteredKpis}
                onEditFact={handleEditFact}
                onDeleteFact={handleDeleteFact}
                onEditDimension={handleEditDimension}
                onDeleteDimension={handleDeleteDimension}
                onEditFactDimension={handleEditFactDimension}
                onDeleteFactDimension={handleDeleteFactDimension}
                onEditKPI={handleEditKPI}
                onDeleteKPI={handleDeleteKPI}
              />
            </div>
          )}

          {(error || success) && (
            <div className="fixed bottom-4 right-4 z-50">
              {error && (
                <div className="bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg mb-2 flex items-center space-x-3 animate-slide-up">
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

export default AdminPanel;

import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Database,
  BarChart3,
  Layers,
  Target,
  Zap,
  Eye,
  EyeOff,
  Search,
  Filter,
  ChevronDown,
  Settings,
  Globe,
  Server,
  Key,
} from "lucide-react";
import { apiService } from "../services/api";

// Copy of apiFetch from api.ts since it's not exported
const API_BASE = "http://localhost:3001/api"; // Adjust to your backend URL

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function localApiFetch<T>(
  endpoint: string,
  method: string = "GET",
  body?: any,
  requiresAuth: boolean = true
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (requiresAuth) {
    const token = localStorage.getItem("token");
    if (!token) {
      return { success: false, error: "No authentication token found" };
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || "Request failed" };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

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

// Modern Card Component
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}
  >
    {children}
  </div>
);

// Modern Button Component
const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "success" | "warning";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}> = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary:
      "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl focus:ring-blue-500",
    secondary:
      "bg-gray-100 hover:bg-gray-200 text-gray-700 focus:ring-gray-500",
    danger:
      "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl focus:ring-red-500",
    success:
      "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl focus:ring-green-500",
    warning:
      "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-lg hover:shadow-xl focus:ring-yellow-500",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

// Modern Input Component
const Input: React.FC<{
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  icon?: React.ReactNode;
}> = ({
  type = "text",
  placeholder,
  value,
  onChange,
  className = "",
  icon,
}) => (
  <div className="relative">
    {icon && (
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
        {icon}
      </div>
    )}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`w-full px-4 py-3 ${
        icon ? "pl-10" : ""
      } bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${className}`}
    />
  </div>
);

// Modern Select Component
const Select: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  className?: string;
}> = ({ value, onChange, children, className = "" }) => (
  <div className="relative">
    <select
      value={value}
      onChange={onChange}
      className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none ${className}`}
    >
      {children}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
  </div>
);

// Modern Textarea Component
const Textarea: React.FC<{
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  rows?: number;
}> = ({ placeholder, value, onChange, className = "", rows = 3 }) => (
  <textarea
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    rows={rows}
    className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none ${className}`}
  />
);

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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Card className="p-8 max-w-md mx-auto text-center">
            <div className="text-red-500 mb-4">
              <Database className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600">
              Please refresh the page or check the console for details.
            </p>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Connection Form Component for creating and testing database connections */
const ConnectionForm: React.FC<{
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onCreate: (conn: Connection) => void;
}> = ({ onSuccess, onError, onCreate }) => {
  const [connName, setConnName] = useState("");
  const [connDescription, setConnDescription] = useState("");
  const [connType, setConnType] = useState("");
  const [connHostname, setConnHostname] = useState("");
  const [connPort, setConnPort] = useState("");
  const [connDatabase, setConnDatabase] = useState("");
  const [connUsername, setConnUsername] = useState("");
  const [connPassword, setConnPassword] = useState("");
  const [connSelectedDb, setConnSelectedDb] = useState("");
  const [connCommandTimeout, setConnCommandTimeout] = useState("");
  const [connMaxTransportObjects, setConnMaxTransportObjects] = useState("");
  const [showConnPassword, setShowConnPassword] = useState(false);

  const clearForm = () => {
    setConnName("");
    setConnDescription("");
    setConnType("");
    setConnHostname("");
    setConnPort("");
    setConnDatabase("");
    setConnUsername("");
    setConnPassword("");
    setConnSelectedDb("");
    setConnCommandTimeout("");
    setConnMaxTransportObjects("");
    setShowConnPassword(false);
  };

  const handleTestConnection = async () => {
    if (
      !connType ||
      !connHostname ||
      !connPort ||
      !connDatabase ||
      !connUsername ||
      !connPassword
    ) {
      onError("All required fields must be filled for testing.");
      return;
    }
    try {
      const body = {
        connection_name: connName,
        type: connType,
        hostname: connHostname,
        port: Number(connPort),
        database: connDatabase,
        username: connUsername,
        password: connPassword,
        selected_db: connSelectedDb,
        ...(connCommandTimeout && {
          command_timeout: Number(connCommandTimeout),
        }),
        ...(connMaxTransportObjects && {
          max_transport_objects: Number(connMaxTransportObjects),
        }),
      };
      const res = await apiService.testConnection(body);
      if (res.success) {
        onSuccess(res.data?.message || "Connection test successful!");
      } else {
        onError(res.error || "Connection test failed.");
      }
    } catch (err) {
      onError(`Failed to test connection: ${(err as Error).message}`);
    }
  };

  const handleCreateConnection = async () => {
    if (
      !connName ||
      !connType ||
      !connHostname ||
      !connPort ||
      !connDatabase ||
      !connUsername ||
      !connPassword
    ) {
      onError("All required fields must be filled.");
      return;
    }
    try {
      const body = {
        connection_name: connName,
        description: connDescription,
        type: connType,
        hostname: connHostname,
        port: Number(connPort),
        database: connDatabase,
        username: connUsername,
        password: connPassword,
        selected_db: connSelectedDb,
        ...(connCommandTimeout && {
          command_timeout: Number(connCommandTimeout),
        }),
        ...(connMaxTransportObjects && {
          max_transport_objects: Number(connMaxTransportObjects),
        }),
      };
      const res = await apiService.createConnection(body);
      if (res.success) {
        const newConn: Connection = {
          id: res.data.id!,
          connection_name: res.data.connection_name!,
          description: res.data.description,
          type: res.data.type!,
          hostname: res.data.hostname!,
          port: res.data.port!,
          database: res.data.database!,
          command_timeout: res.data.command_timeout,
          max_transport_objects: res.data.max_transport_objects,
          username: res.data.username!,
          selected_db: res.data.selected_db!,
          created_at: new Date().toISOString(),
        };
        onCreate(newConn);
        clearForm();
        onSuccess(
          `Connection "${newConn.connection_name}" created successfully`
        );
      } else {
        onError(res.error || "Failed to create connection");
      }
    } catch (err) {
      onError(`Failed to create connection: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Connection Name (required)"
        value={connName}
        onChange={(e) => setConnName(e.target.value)}
        icon={<Database className="w-4 h-4" />}
      />
      <Textarea
        placeholder="Description (optional)"
        value={connDescription}
        onChange={(e) => setConnDescription(e.target.value)}
      />
      <Input
        placeholder="Database Type (e.g., postgres, required)"
        value={connType}
        onChange={(e) => setConnType(e.target.value)}
        icon={<Server className="w-4 h-4" />}
      />
      <Input
        placeholder="Hostname (required)"
        value={connHostname}
        onChange={(e) => setConnHostname(e.target.value)}
        icon={<Globe className="w-4 h-4" />}
      />
      <Input
        type="number"
        placeholder="Port (required)"
        value={connPort}
        onChange={(e) => setConnPort(e.target.value)}
      />
      <Input
        placeholder="Database Name (required)"
        value={connDatabase}
        onChange={(e) => setConnDatabase(e.target.value)}
      />
      <Input
        placeholder="Username (required)"
        value={connUsername}
        onChange={(e) => setConnUsername(e.target.value)}
        icon={<Settings className="w-4 h-4" />}
      />
      <div className="relative">
        <Input
          type={showConnPassword ? "text" : "password"}
          placeholder="Password (required)"
          value={connPassword}
          onChange={(e) => setConnPassword(e.target.value)}
          icon={<Key className="w-4 h-4" />}
        />
        <button
          type="button"
          onClick={() => setShowConnPassword(!showConnPassword)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showConnPassword ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      <Input
        placeholder="Selected DB (optional)"
        value={connSelectedDb}
        onChange={(e) => setConnSelectedDb(e.target.value)}
      />
      <Input
        type="number"
        placeholder="Command Timeout (optional)"
        value={connCommandTimeout}
        onChange={(e) => setConnCommandTimeout(e.target.value)}
      />
      <Input
        type="number"
        placeholder="Max Transport Objects (optional)"
        value={connMaxTransportObjects}
        onChange={(e) => setConnMaxTransportObjects(e.target.value)}
      />
      <div className="flex space-x-2">
        <Button
          onClick={handleTestConnection}
          variant="secondary"
          className="flex-1"
        >
          Test Connection
        </Button>
        <Button onClick={handleCreateConnection} className="flex-1">
          <Plus className="w-4 h-4" />
          Create Connection
        </Button>
      </div>
    </div>
  );
};

/** Main Admin Panel Component */
const AdminPanel: React.FC = () => {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
          if (conns.length > 0 && selectedConnectionId === null) {
            setSelectedConnectionId(conns[0].id);
          }
        })
        .catch((err) =>
          setError(`Failed to fetch connections: ${err.message}`)
        );
    }
  }, [token]);

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

  const clearForm = () => {
    setFactName("");
    setFactTable("");
    setFactColumn("");
    setFactAggregation("SUM");
    setDimensionName("");
    setDimensionTable("");
    setDimensionColumn("");
    setKpiName("");
    setKpiExpression("");
    setKpiDescription("");
    setEditingFact(null);
    setEditingDimension(null);
    setEditingKPI(null);
  };

  const handleLogin = async () => {
    try {
      const res = await apiService.login(username, password);
      if (res.success) {
        setToken(res.data?.token || "");
        localStorage.setItem("token", res.data?.token || "");
        setSuccess("Welcome back! Login successful");
      } else {
        setError(res.error || "Login failed");
      }
    } catch (err) {
      setError(`Login failed: ${(err as Error).message}`);
    }
  };

  const handleLogout = () => {
    setToken("");
    localStorage.removeItem("token");
    setUsername("");
    setPassword("");
    setConnections([]);
    setSelectedConnectionId(null);
  };

  // Fact CRUD operations
  const handleCreateFact = async () => {
    if (!selectedConnectionId)
      return setError("Please select a connection first.");
    if (!factName || !factTable || !factColumn)
      return setError("All fact fields are required");
    try {
      const response = await localApiFetch<Fact>("/semantic/facts", "POST", {
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
      const response = await localApiFetch<Fact>(
        `/semantic/facts/${editingFact.id}`,
        "PUT",
        {
          name: factName,
          table_name: factTable,
          column_name: factColumn,
          aggregate_function: factAggregation,
        }
      );
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
      const response = await localApiFetch<any>(
        `/semantic/facts/${id}`,
        "DELETE"
      );
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
      const response = await localApiFetch<Dimension>(
        "/semantic/dimensions",
        "POST",
        {
          connection_id: selectedConnectionId,
          name: dimensionName,
          table_name: dimensionTable,
          column_name: dimensionColumn,
        }
      );
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
      const response = await localApiFetch<Dimension>(
        `/semantic/dimensions/${editingDimension.id}`,
        "PUT",
        {
          name: dimensionName,
          table_name: dimensionTable,
          column_name: dimensionColumn,
        }
      );
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
      const response = await localApiFetch<any>(
        `/semantic/dimensions/${id}`,
        "DELETE"
      );
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

  // KPI CRUD operations
  const handleCreateKPI = async () => {
    if (!selectedConnectionId)
      return setError("Please select a connection first.");
    if (!kpiName || !kpiExpression)
      return setError("KPI name and expression are required");
    try {
      const response = await localApiFetch<KPI>("/semantic/kpis", "POST", {
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
      const response = await localApiFetch<KPI>(
        `/semantic/kpis/${editingKPI.id}`,
        "PUT",
        {
          name: kpiName,
          expression: kpiExpression,
          description: kpiDescription,
        }
      );
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
      const response = await localApiFetch<any>(
        `/semantic/kpis/${id}`,
        "DELETE"
      );
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
      const response = await localApiFetch<FactDimension>(
        "/semantic/fact-dimensions",
        "POST",
        {
          fact_id: Number(mappingFactId),
          dimension_id: Number(mappingDimensionId),
          join_table: mappingJoinTable,
          fact_column: mappingFactColumn,
          dimension_column: mappingDimensionColumn,
        }
      );
      if (response.success && response.data) {
        setFactDimensions([...factDimensions, response.data]);
        setMappingFactId("");
        setMappingDimensionId("");
        setMappingJoinTable("");
        setMappingFactColumn("");
        setMappingDimensionColumn("");
        setSuccess("Fact-Dimension mapping created successfully");
      } else {
        setError(response.error || "Failed to create mapping");
      }
    } catch (err) {
      setError(`Failed to create mapping: ${(err as Error).message}`);
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
        {!token ? (
          <div className="flex items-center justify-center min-h-screen">
            <Card className="p-8 max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Admin Login
              </h2>
              <div className="space-y-4">
                <Input
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  icon={<Settings className="w-4 h-4" />}
                />
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<Key className="w-4 h-4" />}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <Button onClick={handleLogin} className="w-full">
                  Login
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
              <Button onClick={handleLogout} variant="secondary">
                Logout
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-white p-1 rounded-2xl shadow-sm border border-gray-100 mb-8">
              {[
                { id: "connections", label: "Connections", icon: Database },
                { id: "facts", label: "Facts", icon: BarChart3 },
                { id: "dimensions", label: "Dimensions", icon: Layers },
                { id: "mappings", label: "Mappings", icon: Target },
                { id: "kpis", label: "KPIs", icon: Zap },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium rounded-xl transition-all ${
                    activeTab === tab.id
                      ? "bg-white shadow-sm text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {activeTab === "connections" && (
              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Database className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Create Connection
                      </h3>
                      <p className="text-sm text-gray-500">
                        Add a new database connection
                      </p>
                    </div>
                  </div>
                  <ConnectionForm
                    onSuccess={setSuccess}
                    onError={setError}
                    onCreate={(newConn) =>
                      setConnections([...connections, newConn])
                    }
                  />
                </Card>
                <Card className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Server className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Connections ({connections.length})
                      </h3>
                      <p className="text-sm text-gray-500">
                        Select a connection to manage
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {connections.map((conn) => (
                      <button
                        key={conn.id}
                        onClick={() => setSelectedConnectionId(conn.id)}
                        className={`w-full text-left p-4 rounded-xl transition-colors ${
                          selectedConnectionId === conn.id
                            ? "bg-blue-50 border border-blue-200"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <h4 className="font-medium text-gray-900">
                          {conn.connection_name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {conn.type}://{conn.hostname}:{conn.port}/
                          {conn.database}
                        </p>
                      </button>
                    ))}
                    {connections.length === 0 && (
                      <div className="text-center py-12">
                        <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">
                          No connections found. Create one to get started.
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {activeTab !== "connections" && (
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Form Column */}
                <div>
                  <Card className="p-6 mb-6 sticky top-6">
                    <div className="relative mb-4">
                      <Input
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        icon={<Search className="w-4 h-4" />}
                      />
                    </div>
                  </Card>

                  {activeTab === "facts" && (
                    <Card className="p-6">
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {editingFact ? "Edit Fact" : "Create Fact"}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Define measurable business metrics
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Input
                          placeholder="Fact Name (e.g., Revenue)"
                          value={factName}
                          onChange={(e) => setFactName(e.target.value)}
                        />
                        <Select
                          value={factTable}
                          onChange={(e) => {
                            setFactTable(e.target.value);
                            setFactColumn("");
                          }}
                        >
                          <option value="">Select Table</option>
                          {schemas.map((t) => (
                            <option key={t.tableName} value={t.tableName}>
                              {t.tableName}
                            </option>
                          ))}
                        </Select>
                        {factTable && (
                          <Select
                            value={factColumn}
                            onChange={(e) => setFactColumn(e.target.value)}
                          >
                            <option value="">Select Column</option>
                            {schemas
                              .find((t) => t.tableName === factTable)
                              ?.columns.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {c.name} ({c.type})
                                </option>
                              ))}
                          </Select>
                        )}
                        <Select
                          value={factAggregation}
                          onChange={(e) => setFactAggregation(e.target.value)}
                        >
                          <option value="SUM">SUM</option>
                          <option value="AVG">AVG</option>
                          <option value="COUNT">COUNT</option>
                          <option value="MIN">MIN</option>
                          <option value="MAX">MAX</option>
                        </Select>
                        <div className="flex space-x-2">
                          <Button
                            onClick={
                              editingFact ? handleUpdateFact : handleCreateFact
                            }
                            className="flex-1"
                          >
                            <Save className="w-4 h-4" />
                            {editingFact ? "Update" : "Create"} Fact
                          </Button>
                          {editingFact && (
                            <Button onClick={clearForm} variant="secondary">
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  )}

                  {activeTab === "dimensions" && (
                    <Card className="p-6">
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                          <Layers className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {editingDimension
                              ? "Edit Dimension"
                              : "Create Dimension"}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Define data categorization attributes
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Input
                          placeholder="Dimension Name (e.g., Date)"
                          value={dimensionName}
                          onChange={(e) => setDimensionName(e.target.value)}
                        />
                        <Select
                          value={dimensionTable}
                          onChange={(e) => {
                            setDimensionTable(e.target.value);
                            setDimensionColumn("");
                          }}
                        >
                          <option value="">Select Table</option>
                          {schemas.map((t) => (
                            <option key={t.tableName} value={t.tableName}>
                              {t.tableName}
                            </option>
                          ))}
                        </Select>
                        {dimensionTable && (
                          <Select
                            value={dimensionColumn}
                            onChange={(e) => setDimensionColumn(e.target.value)}
                          >
                            <option value="">Select Column</option>
                            {schemas
                              .find((t) => t.tableName === dimensionTable)
                              ?.columns.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {c.name} ({c.type})
                                </option>
                              ))}
                          </Select>
                        )}
                        <div className="flex space-x-2">
                          <Button
                            onClick={
                              editingDimension
                                ? handleUpdateDimension
                                : handleCreateDimension
                            }
                            variant="success"
                            className="flex-1"
                          >
                            <Save className="w-4 h-4" />
                            {editingDimension ? "Update" : "Create"} Dimension
                          </Button>
                          {editingDimension && (
                            <Button onClick={clearForm} variant="secondary">
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  )}

                  {activeTab === "mappings" && (
                    <>
                      <Card className="p-6">
                        <div className="flex items-center space-x-3 mb-6">
                          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Zap className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              Auto-Map
                            </h3>
                            <p className="text-sm text-gray-500">
                              Automatically detect relationships
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={handleAutoMap}
                          variant="warning"
                          className="w-full"
                        >
                          <Zap className="w-4 h-4" />
                          Run Auto-Map
                        </Button>
                      </Card>
                      <Card className="p-6">
                        <div className="flex items-center space-x-3 mb-6">
                          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                            <Target className="w-5 h-5 text-yellow-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              Create Mapping
                            </h3>
                            <p className="text-sm text-gray-500">
                              Link facts with dimensions
                            </p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <Select
                            value={mappingFactId}
                            onChange={(e) => setMappingFactId(e.target.value)}
                          >
                            <option value="">Select Fact</option>
                            {facts.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </Select>
                          <Select
                            value={mappingDimensionId}
                            onChange={(e) =>
                              setMappingDimensionId(e.target.value)
                            }
                          >
                            <option value="">Select Dimension</option>
                            {dimensions.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </Select>
                          <Select
                            value={mappingJoinTable}
                            onChange={(e) =>
                              setMappingJoinTable(e.target.value)
                            }
                          >
                            <option value="">Select Join Table</option>
                            {schemas.map((t) => (
                              <option key={t.tableName} value={t.tableName}>
                                {t.tableName}
                              </option>
                            ))}
                          </Select>
                          {mappingFactId && (
                            <Select
                              value={mappingFactColumn}
                              onChange={(e) =>
                                setMappingFactColumn(e.target.value)
                              }
                            >
                              <option value="">Select Fact Column</option>
                              {schemas
                                .find(
                                  (t) =>
                                    t.tableName ===
                                    facts.find(
                                      (f) => f.id === Number(mappingFactId)
                                    )?.table_name
                                )
                                ?.columns.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.name} ({c.type})
                                  </option>
                                ))}
                            </Select>
                          )}
                          {mappingJoinTable && (
                            <Select
                              value={mappingDimensionColumn}
                              onChange={(e) =>
                                setMappingDimensionColumn(e.target.value)
                              }
                            >
                              <option value="">Select Dimension Column</option>
                              {schemas
                                .find((t) => t.tableName === mappingJoinTable)
                                ?.columns.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.name} ({c.type})
                                  </option>
                                ))}
                            </Select>
                          )}
                          <Button
                            onClick={handleCreateFactDimension}
                            variant="warning"
                            className="w-full"
                          >
                            <Plus className="w-4 h-4" />
                            Create Mapping
                          </Button>
                        </div>
                      </Card>
                    </>
                  )}

                  {activeTab === "kpis" && (
                    <Card className="p-6">
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                          <Zap className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {editingKPI ? "Edit KPI" : "Create KPI"}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Define key performance indicators
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Input
                          placeholder="KPI Name (e.g., Profit Margin)"
                          value={kpiName}
                          onChange={(e) => setKpiName(e.target.value)}
                        />
                        <div className="flex space-x-2">
                          <Input
                            placeholder="Expression (e.g., Revenue - Cost)"
                            value={kpiExpression}
                            onChange={(e) => setKpiExpression(e.target.value)}
                            className="flex-1"
                          />
                          <Select
                            value={kpiInsertType}
                            onChange={(e) => {
                              setKpiInsertType(
                                e.target.value as "fact" | "column" | ""
                              );
                              setKpiInsertFactId("");
                              setKpiInsertTable("");
                              setKpiInsertColumn("");
                            }}
                            className="w-32"
                          >
                            <option value="">Insert...</option>
                            <option value="fact">Fact</option>
                            <option value="column">Column</option>
                          </Select>
                        </div>
                        {kpiInsertType === "fact" && (
                          <Select
                            value={kpiInsertFactId}
                            onChange={(e) => setKpiInsertFactId(e.target.value)}
                          >
                            <option value="">Select Fact</option>
                            {facts.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </Select>
                        )}
                        {kpiInsertType === "column" && (
                          <>
                            <Select
                              value={kpiInsertTable}
                              onChange={(e) => {
                                setKpiInsertTable(e.target.value);
                                setKpiInsertColumn("");
                              }}
                            >
                              <option value="">Select Table</option>
                              {schemas.map((t) => (
                                <option key={t.tableName} value={t.tableName}>
                                  {t.tableName}
                                </option>
                              ))}
                            </Select>
                            {kpiInsertTable && (
                              <Select
                                value={kpiInsertColumn}
                                onChange={(e) =>
                                  setKpiInsertColumn(e.target.value)
                                }
                              >
                                <option value="">Select Column</option>
                                {schemas
                                  .find((t) => t.tableName === kpiInsertTable)
                                  ?.columns.map((c) => (
                                    <option key={c.name} value={c.name}>
                                      {c.name} ({c.type})
                                    </option>
                                  ))}
                              </Select>
                            )}
                          </>
                        )}
                        {((kpiInsertType === "fact" && kpiInsertFactId) ||
                          (kpiInsertType === "column" &&
                            kpiInsertTable &&
                            kpiInsertColumn)) && (
                          <Button
                            onClick={insertIntoKpiExpression}
                            variant="secondary"
                            size="sm"
                          >
                            <Plus className="w-4 h-4" />
                            Insert
                          </Button>
                        )}
                        {kpiExpression && (
                          <div className="p-3 bg-gray-50 rounded-xl">
                            <p className="text-sm text-gray-600 mb-1">
                              Preview:
                            </p>
                            <code className="text-sm font-mono text-gray-800">
                              {kpiExpression}
                            </code>
                          </div>
                        )}
                        <Textarea
                          placeholder="Description (optional)"
                          value={kpiDescription}
                          onChange={(e) => setKpiDescription(e.target.value)}
                        />
                        <div className="flex space-x-2">
                          <Button
                            onClick={
                              editingKPI ? handleUpdateKPI : handleCreateKPI
                            }
                            variant="warning"
                            className="flex-1"
                          >
                            <Save className="w-4 h-4" />
                            {editingKPI ? "Update" : "Create"} KPI
                          </Button>
                          {editingKPI && (
                            <Button onClick={clearForm} variant="secondary">
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Data Lists Column */}
                <div className="lg:col-span-2">
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {activeTab === "facts" &&
                          `Facts (${filteredFacts.length})`}
                        {activeTab === "dimensions" &&
                          `Dimensions (${filteredDimensions.length})`}
                        {activeTab === "mappings" &&
                          `Mappings (${factDimensions.length})`}
                        {activeTab === "kpis" &&
                          `KPIs (${filteredKpis.length})`}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Filter className="w-4 h-4" />
                        <span>Filtered by search</span>
                      </div>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {activeTab === "facts" &&
                        filteredFacts.map((fact) => (
                          <div
                            key={fact.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                {fact.name}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {fact.aggregate_function}({fact.table_name}.
                                {fact.column_name})
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                onClick={() => handleEditFact(fact)}
                                variant="secondary"
                                size="sm"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() =>
                                  handleDeleteFact(fact.id, fact.name)
                                }
                                variant="danger"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      {activeTab === "dimensions" &&
                        filteredDimensions.map((dimension) => (
                          <div
                            key={dimension.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                {dimension.name}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {dimension.table_name}.{dimension.column_name}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                onClick={() => handleEditDimension(dimension)}
                                variant="secondary"
                                size="sm"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() =>
                                  handleDeleteDimension(
                                    dimension.id,
                                    dimension.name
                                  )
                                }
                                variant="danger"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      {activeTab === "mappings" &&
                        factDimensions.map((mapping) => (
                          <div
                            key={mapping.id}
                            className="p-4 bg-gray-50 rounded-xl"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">
                                  {facts.find((f) => f.id === mapping.fact_id)
                                    ?.name || "Unknown Fact"}{" "}
                                  →{" "}
                                  {dimensions.find(
                                    (d) => d.id === mapping.dimension_id
                                  )?.name || "Unknown Dimension"}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {mapping.join_table}.
                                  {mapping.dimension_column} ={" "}
                                  {facts.find((f) => f.id === mapping.fact_id)
                                    ?.table_name || "Unknown Table"}
                                  .{mapping.fact_column}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      {activeTab === "kpis" &&
                        filteredKpis.map((kpi) => (
                          <div
                            key={kpi.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                {kpi.name}
                              </h4>
                              <p className="text-sm text-gray-600 font-mono">
                                {kpi.expression}
                              </p>
                              {kpi.description && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {kpi.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                onClick={() => handleEditKPI(kpi)}
                                variant="secondary"
                                size="sm"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() =>
                                  handleDeleteKPI(kpi.id, kpi.name)
                                }
                                variant="danger"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                    {activeTab === "facts" && filteredFacts.length === 0 && (
                      <div className="text-center py-12">
                        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">
                          No facts found. Create your first fact to get started.
                        </p>
                      </div>
                    )}
                    {activeTab === "dimensions" &&
                      filteredDimensions.length === 0 && (
                        <div className="text-center py-12">
                          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">
                            No dimensions found. Create your first dimension to
                            get started.
                          </p>
                        </div>
                      )}
                    {activeTab === "mappings" &&
                      factDimensions.length === 0 && (
                        <div className="text-center py-12">
                          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">
                            No mappings found. Create relationships between
                            facts and dimensions.
                          </p>
                        </div>
                      )}
                    {activeTab === "kpis" && filteredKpis.length === 0 && (
                      <div className="text-center py-12">
                        <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">
                          No KPIs found. Create your first KPI to get started.
                        </p>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toast Notifications */}
        {(error || success) && (
          <div className="fixed bottom-4 right-4 z-50">
            {error && (
              <div className="bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg mb-2 flex items-center space-x-3 animate-slide-up">
                <X className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg mb-2 flex items-center space-x-3 animate-slide-up">
                <Save className="w-5 h-5" />
                <span>{success}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default AdminPanel;

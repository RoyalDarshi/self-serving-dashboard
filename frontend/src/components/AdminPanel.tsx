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
} from "lucide-react";
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

const AdminPanel: React.FC = () => {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [factDimensions, setFactDimensions] = useState<FactDimension[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("facts");
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

  // Fetch data on mount if authenticated
  useEffect(() => {
    if (token) {
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
        setToken(res.token);
        localStorage.setItem("token", res.token);
        setError("");
        setSuccess("Welcome back! Login successful");
      } else {
        setError(res.error || "Login failed");
        setSuccess("");
      }
    } catch (err) {
      setError("Login failed: " + (err.error || err.message));
      setSuccess("");
    }
  };

  const handleLogout = () => {
    setToken("");
    localStorage.removeItem("token");
    setUsername("");
    setPassword("");
  };

  // Fact CRUD operations
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
        clearForm();
        setSuccess(`Fact "${res.name}" created successfully`);
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

  const handleEditFact = (fact: Fact) => {
    setEditingFact(fact);
    setFactName(fact.name);
    setFactTable(fact.table_name);
    setFactColumn(fact.column_name);
    setFactAggregation(fact.aggregate_function);
  };

  const handleUpdateFact = async () => {
    if (!editingFact || !factName || !factTable || !factColumn) {
      setError("All fact fields are required");
      return;
    }
    try {
      const res = await apiService.updateFact(editingFact.id, {
        name: factName,
        table_name: factTable,
        column_name: factColumn,
        aggregate_function: factAggregation,
      });
      if (res.success !== false) {
        setFacts(facts.map((f) => (f.id === editingFact.id ? res : f)));
        clearForm();
        setSuccess(`Fact "${res.name}" updated successfully`);
        setError("");
      } else {
        setError(res.error || "Failed to update fact");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to update fact: " + (err.error || err.message));
      setSuccess("");
    }
  };

  const handleDeleteFact = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the fact "${name}"?`)) return;
    try {
      const res = await apiService.deleteFact(id);
      if (res.success !== false) {
        setFacts(facts.filter((f) => f.id !== id));
        setSuccess(`Fact "${name}" deleted successfully`);
        setError("");
      } else {
        setError(res.error || "Failed to delete fact");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to delete fact: " + (err.error || err.message));
      setSuccess("");
    }
  };

  // Dimension CRUD operations
  const handleCreateDimension = async () => {
    if (!dimensionName || !dimensionTable || !dimensionColumn) {
      setError("All dimension fields are required");
      return;
    }
    try {
      const res = await apiService.createDimension({
        name: dimensionName,
        table_name: dimensionTable,
        column_name: dimensionColumn,
      });
      if (res.success !== false) {
        setDimensions([...dimensions, res]);
        clearForm();
        setSuccess(`Dimension "${res.name}" created successfully`);
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
      setError("All dimension fields are required");
      return;
    }
    try {
      const res = await apiService.updateDimension(editingDimension.id, {
        name: dimensionName,
        table_name: dimensionTable,
        column_name: dimensionColumn,
      });
      if (res.success !== false) {
        setDimensions(
          dimensions.map((d) => (d.id === editingDimension.id ? res : d))
        );
        clearForm();
        setSuccess(`Dimension "${res.name}" updated successfully`);
        setError("");
      } else {
        setError(res.error || "Failed to update dimension");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to update dimension: " + (err.error || err.message));
      setSuccess("");
    }
  };

  const handleDeleteDimension = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the dimension "${name}"?`))
      return;
    try {
      const res = await apiService.deleteDimension(id);
      if (res.success !== false) {
        setDimensions(dimensions.filter((d) => d.id !== id));
        setSuccess(`Dimension "${name}" deleted successfully`);
        setError("");
      } else {
        setError(res.error || "Failed to delete dimension");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to delete dimension: " + (err.error || err.message));
      setSuccess("");
    }
  };

  // KPI CRUD operations
  const handleCreateKPI = async () => {
    if (!kpiName || !kpiExpression) {
      setError("KPI name and expression are required");
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
        clearForm();
        setSuccess(`KPI "${res.name}" created successfully`);
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

  const handleEditKPI = (kpi: KPI) => {
    setEditingKPI(kpi);
    setKpiName(kpi.name);
    setKpiExpression(kpi.expression);
    setKpiDescription(kpi.description || "");
  };

  const handleUpdateKPI = async () => {
    if (!editingKPI || !kpiName || !kpiExpression) {
      setError("KPI name and expression are required");
      return;
    }
    try {
      const res = await apiService.updateKPI(editingKPI.id, {
        name: kpiName,
        expression: kpiExpression,
        description: kpiDescription,
      });
      if (res.success !== false) {
        setKpis(kpis.map((k) => (k.id === editingKPI.id ? res : k)));
        clearForm();
        setSuccess(`KPI "${res.name}" updated successfully`);
        setError("");
      } else {
        setError(res.error || "Failed to update KPI");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to update KPI: " + (err.error || err.message));
      setSuccess("");
    }
  };

  const handleDeleteKPI = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the KPI "${name}"?`)) return;
    try {
      const res = await apiService.deleteKPI(id);
      if (res.success !== false) {
        setKpis(kpis.filter((k) => k.id !== id));
        setSuccess(`KPI "${name}" deleted successfully`);
        setError("");
      } else {
        setError(res.error || "Failed to delete KPI");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to delete KPI: " + (err.error || err.message));
      setSuccess("");
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
        setSuccess("Fact-Dimension mapping created successfully");
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

  const handleAutoMap = async () => {
    try {
      const res = await apiService.runAutoMap();
      if (res.success) {
        setFactDimensions(await apiService.getFactDimensions());
        setSuccess(
          `Auto-mapped ${res.autoMappings.length} fact-dimension pairs successfully`
        );
        setError("");
      } else {
        setError(res.error || "Failed to auto-map");
        setSuccess("");
      }
    } catch (err) {
      setError("Failed to auto-map: " + (err.error || err.message));
      setSuccess("");
    }
  };

  const insertIntoKpiExpression = () => {
    let insertText = "";
    if (kpiInsertType === "fact" && kpiInsertFactId) {
      const fact = facts.find((f) => f.id === Number(kpiInsertFactId));
      if (fact) insertText = fact.name;
    } else if (
      kpiInsertType === "column" &&
      kpiInsertTable &&
      kpiInsertColumn
    ) {
      insertText = `${kpiInsertTable}.${kpiInsertColumn}`;
    }
    if (insertText) {
      setKpiExpression((prev) => `${prev} ${insertText}`.trim());
      setKpiInsertType("");
      setKpiInsertFactId("");
      setKpiInsertTable("");
      setKpiInsertColumn("");
    }
  };

  // Filter data based on search term
  const filteredFacts = facts.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDimensions = dimensions.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredKpis = kpis.filter(
    (k) =>
      k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.expression.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!token) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Admin Portal
              </h1>
              <p className="text-gray-600">
                Sign in to manage your data warehouse
              </p>
            </div>

            <div className="space-y-4">
              <Input
                type="text"
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
              <Button onClick={handleLogin} className="w-full" size="lg">
                Sign In
              </Button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}
          </Card>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Data Warehouse Admin
                  </h1>
                  <p className="text-sm text-gray-500">
                    Manage facts, dimensions & KPIs
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={<Search className="w-4 h-4" />}
                  className="w-64"
                />
                <Button onClick={handleLogout} variant="secondary" size="sm">
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
            {[
              { id: "facts", label: "Facts", icon: BarChart3 },
              { id: "dimensions", label: "Dimensions", icon: Layers },
              { id: "mappings", label: "Mappings", icon: Target },
              { id: "kpis", label: "KPIs", icon: Zap },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Forms Column */}
            <div className="lg:col-span-1 space-y-6">
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
                        onChange={(e) => setMappingDimensionId(e.target.value)}
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
                        onChange={(e) => setMappingJoinTable(e.target.value)}
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
                          onChange={(e) => setMappingFactColumn(e.target.value)}
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
                            onChange={(e) => setKpiInsertColumn(e.target.value)}
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
                        <p className="text-sm text-gray-600 mb-1">Preview:</p>
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
                        onClick={editingKPI ? handleUpdateKPI : handleCreateKPI}
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
                    {activeTab === "facts" && `Facts (${filteredFacts.length})`}
                    {activeTab === "dimensions" &&
                      `Dimensions (${filteredDimensions.length})`}
                    {activeTab === "mappings" &&
                      `Mappings (${factDimensions.length})`}
                    {activeTab === "kpis" && `KPIs (${filteredKpis.length})`}
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
                            onClick={() => handleDeleteFact(fact.id, fact.name)}
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
                              {mapping.join_table}.{mapping.dimension_column} ={" "}
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
                            onClick={() => handleDeleteKPI(kpi.id, kpi.name)}
                            variant="danger"
                            size="sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Empty States */}
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
                        No dimensions found. Create your first dimension to get
                        started.
                      </p>
                    </div>
                  )}

                {activeTab === "mappings" && factDimensions.length === 0 && (
                  <div className="text-center py-12">
                    <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      No mappings found. Create relationships between facts and
                      dimensions.
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
        </div>

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

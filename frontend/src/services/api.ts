// updated: api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Interfaces
export interface Fact {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
  aggregate_function: string;
}

export interface Dimension {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
}

export interface Connection {
  id: number;
  connection_name: string;
  type: string;
  hostname: string;
  port: number;
  database: string;
  username: string;
  created_at: string;
}

export interface ChartConfig {
  id?: string;
  xAxisDimension: Dimension | null;
  yAxisFacts: Fact[];
  groupByDimension: Dimension | null;
  chartType: "bar" | "line" | "pie";
  aggregationType:
    | "SUM"
    | "AVG"
    | "COUNT"
    | "MAX"
    | "MIN"
    | "MEDIAN"
    | "STDDEV"
    | "VARIANCE";
  stacked: boolean;
  title?: string;
  description?: string;
  createdAt?: string;
  lastModified?: string;
}

export interface DashboardData {
  id: string;
  name: string;
  description?: string;
  connectionId: number;
  charts: ChartConfig[];
  layout: any[];
  isPublic?: boolean;
  createdAt?: string;
  lastModified?: string;
}

export interface ReportDefinition {
  id: number;
  name: string;
  description?: string | null;
  connection_id: number;
  base_table: string;
  visualization_config?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReportColumn {
  id?: number;
  report_id?: number;
  column_name: string;
  alias?: string | null;
  data_type?: string | null;
  visible?: boolean;
  order_index?: number;
}

export interface ReportVisualization {
  showChart: boolean;
  chartType: "bar" | "line" | "pie" | "area";
  xAxisColumn: string;
  yAxisColumns: string[]; // Columns to aggregate (e.g., Sum of Sales)
  aggregation: "SUM" | "COUNT" | "AVG";
}

export interface ReportFilter {
  id?: number;
  report_id?: number;
  column_name: string;
  operator: string;
  value: any; // can be string or array
  is_user_editable?: boolean;
  order_index?: number;
}

export interface ReportDrillConfig {
  target_report_id: number;
  mapping_json: string; // JSON string from backend
  label?: string | null;
}

export interface FullReportConfig {
  report: ReportDefinition;
  columns: ReportColumn[];
  filters: ReportFilter[];
  drillTargets: ReportDrillConfig[];
  visualization?: ReportVisualization;
}

export interface RunReportResponse {
  mode: "chart" | "table" | "sql";
  sql: string;

  // chart mode
  data?: Record<string, any>[];

  // table mode
  rows?: Record<string, any>[];
  page?: number;
  pageSize?: number;

  // sql mode
  preview?: Record<string, any>[];
  rowCount?: number;
}


export interface AggregationResponse {
  sql?: string;
  rows?: { [key: string]: number | string }[];
  error?: string;
}

export interface Schema {
  tableName: string;
  columns: {
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }[];
}

export interface TableRelationship {
  id: number;
  fact_id: number;
  fact_name: string;
  dimension_id: number;
  dimension_name: string;
  join_table: string;
  fact_column: string;
  dimension_column: string;
}

export interface Kpi {
  id: number;
  connection_id: number;
  name: string;
  expression: string;
  description?: string;
  created_by?: number;
}

export type Role = "admin" | "user" | "designer";
export type AccessLevel = "viewer" | "editor";
export type Designation =
  | "Business Analyst"
  | "Data Scientist"
  | "Operations Manager"
  | "Finance Manager"
  | "Consumer Insights Manager"
  | "Store / Regional Manager"
  | null;

export interface User {
  id: number;
  username: string;
  role: Role;
  accessLevel?: AccessLevel;
  designation?: Designation;
  created_at: string;
  is_ad_user: boolean;
}

export interface ConnectionDesignation {
  id: number;
  connection_id: number;
  designation: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    role: Role;
    designation?: string | null;
    accessLevel?: AccessLevel;
  };
}

export interface ImportUsersResponse {
  importedCount: number;
}

// Utility Functions
const createApiFetch = <T = unknown>(
  endpoint: string,
  method: string = "GET",
  body?: any,
  requiresAuth: boolean = true
): Promise<ApiResponse<T>> => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (requiresAuth) {
    const token = localStorage.getItem("token");
    if (!token) {
      return Promise.resolve({
        success: false,
        error: "No authentication token found",
      });
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) }),
  };

  return fetch(`${API_BASE}${endpoint}`, config)
    .then(async (response) => {
      if (response.status === 204) {
        return { success: true, data: undefined };
      }
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Request failed" };
      }

      return { success: true, data };
    })
    .catch((error) => ({
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    }));
};

// API Service
export const apiService = {
  // Authentication
  login: (
    username: string,
    password: string
  ): Promise<ApiResponse<AuthResponse>> =>
    createApiFetch("/auth/login", "POST", { username, password }, false),

  validateToken: (): Promise<
    ApiResponse<{
      user: {
        id: number;
        role: Role;
        designation?: string | null;
        accessLevel?: AccessLevel;
      };
    }>
  > => createApiFetch("/auth/validate"),

  // User Management
  createUser: (
    user: Omit<User, "id" | "created_at" | "is_ad_user"> & { password?: string }
  ): Promise<ApiResponse<{ user: User }>> =>
    createApiFetch("/user/users", "POST", user),

  getUsers: (): Promise<User[]> =>
    createApiFetch<User[]>("/user/users", "GET").then((response) =>
      response.success ? response.data || [] : []
    ),

  getUser: (id: number): Promise<ApiResponse<User>> =>
    createApiFetch(`/user/users/${id}`),

  updateUser: (
    id: number,
    user: Partial<
      Omit<User, "id" | "created_at" | "is_ad_user"> & { password?: string }
    >
  ): Promise<ApiResponse<User>> =>
    createApiFetch(`/user/users/${id}`, "PUT", user),

  deleteUser: (id: number): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/user/users/${id}`, "DELETE"),

  importUsersFromAD: (): Promise<ApiResponse<ImportUsersResponse>> =>
    createApiFetch("/user/import-ldap-users", "POST"),

  // Connection Management
  getConnections: (): Promise<Connection[]> =>
    createApiFetch<Connection[]>("/connection/connections", "GET").then(
      (response) => (response.success ? response.data || [] : [])
    ),

  createConnection: (
    connection: Omit<Connection, "id" | "created_at">
  ): Promise<ApiResponse<unknown>> =>
    createApiFetch("/connection/connections", "POST", connection),

  updateConnection: (
    id: number,
    connection: Omit<Connection, "id" | "created_at">
  ): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/connection/connections/${id}`, "PUT", connection),

  deleteConnection: (id: number): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/connection/connections/${id}`, "DELETE"),

  testConnection: (
    connection: Omit<Connection, "id" | "created_at">
  ): Promise<ApiResponse<{ success: boolean; message?: string }>> =>
    createApiFetch("/connection/connections/test", "POST", connection),

  getConnectionDesignations: (
    connectionId?: number
  ): Promise<ConnectionDesignation[]> => {
    const query = connectionId ? `?connection_id=${connectionId}` : "";
    return createApiFetch<ConnectionDesignation[]>(
      `/connection/connection-designations${query}`,
      "GET"
    ).then((response) => (response.success ? response.data || [] : []));
  },

  addConnectionDesignation: (
    connectionId: number,
    designation: string
  ): Promise<ApiResponse<unknown>> =>
    createApiFetch("/connection/connection-designations", "POST", {
      connection_id: connectionId,
      designation,
    }),

  deleteConnectionDesignation: (id: number): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/connection/connection-designations/${id}`, "DELETE"),

  // Schema Management
  getSchemas: (connectionId: number): Promise<Schema[]> =>
    createApiFetch<Schema[]>(
      `/database/schemas?connection_id=${connectionId}`,
      "GET"
    ).then((response) => (response.success ? response.data || [] : [])),

  // Facts and Dimensions
  getFacts: (connectionId: number): Promise<Fact[]> =>
    createApiFetch<Fact[]>(
      `/semantic/facts?connection_id=${connectionId}`,
      "GET"
    ).then((response) => (response.success ? response.data || [] : [])),

  createFact: (fact: Omit<Fact, "id">): Promise<ApiResponse<Fact>> =>
    createApiFetch("/semantic/facts", "POST", fact),

  updateFact: (
    id: number,
    fact: Omit<Fact, "id">
  ): Promise<ApiResponse<Fact>> =>
    createApiFetch(`/semantic/facts/${id}`, "PUT", fact),

  deleteFact: (id: number): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/semantic/facts/${id}`, "DELETE"),

  getDimensions: (connectionId: number): Promise<Dimension[]> =>
    createApiFetch<Dimension[]>(
      `/semantic/dimensions?connection_id=${connectionId}`,
      "GET"
    ).then((response) => (response.success ? response.data || [] : [])),

  createDimension: (
    dimension: Omit<Dimension, "id">
  ): Promise<ApiResponse<Dimension>> =>
    createApiFetch("/semantic/dimensions", "POST", dimension),

  updateDimension: (
    id: number,
    dimension: Omit<Dimension, "id">
  ): Promise<ApiResponse<Dimension>> =>
    createApiFetch(`/semantic/dimensions/${id}`, "PUT", dimension),

  deleteDimension: (id: number): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/semantic/dimensions/${id}`, "DELETE"),

  getTableRelationships: (connectionId: number): Promise<TableRelationship[]> =>
    createApiFetch<TableRelationship[]>(
      `/semantic/table-relationships?connection_id=${connectionId}`,
      "GET"
    ).then((response) => (response.success ? response.data || [] : [])),

  autoMap: (connectionId: number): Promise<ApiResponse<TableRelationship[]>> =>
    createApiFetch(`/semantic/auto-map`, "POST", {
      connection_id: connectionId,
    }),

  createTableRelationship: (
    tableRelationship: Omit<
      TableRelationship,
      "id" | "fact_name" | "dimension_name"
    >
  ): Promise<ApiResponse<TableRelationship>> =>
    createApiFetch("/semantic/table-relationships", "POST", tableRelationship),

  updateTableRelationship: (
    id: number,
    tableRelationship: Omit<
      TableRelationship,
      "id" | "fact_name" | "dimension_name"
    >
  ): Promise<ApiResponse<TableRelationship>> =>
    createApiFetch(
      `/semantic/table-relationships/${id}`,
      "PUT",
      tableRelationship
    ),

  deleteTableRelationship: (id: number): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/semantic/table-relationships/${id}`, "DELETE"),

  // KPIs
  getKpis: (connectionId: number): Promise<Kpi[]> =>
    createApiFetch<Kpi[]>(
      `/semantic/kpis?connection_id=${connectionId}`,
      "GET"
    ).then((response) => (response.success ? response.data || [] : [])),

  createKpi: (kpi: Omit<Kpi, "id" | "created_by">): Promise<ApiResponse<Kpi>> =>
    createApiFetch("/semantic/kpis", "POST", kpi),

  updateKpi: (
    id: number,
    kpi: Omit<Kpi, "id" | "connection_id" | "created_by">
  ): Promise<ApiResponse<Kpi>> =>
    createApiFetch(`/semantic/kpis/${id}`, "PUT", kpi),

  deleteKpi: (id: number): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/semantic/kpis/${id}`, "DELETE"),

  // Query Execution
  runQuery: (body: {
    connection_id: number;
    factIds: number[];
    dimensionIds: number[];
    aggregation: string;
  }): Promise<AggregationResponse> =>
    createApiFetch<AggregationResponse>("/analytics/query", "POST", body).then(
      (response) =>
        response.success
          ? response.data || {}
          : { error: response.error || "Failed to run query" }
    ),

  // Dashboard Management
  saveDashboard: (dashboard: {
    name: string;
    description?: string;
    connection_id: number;
    charts: ChartConfig[];
    layout: any[];
  }): Promise<ApiResponse<{ dashboardId: string }>> =>
    createApiFetch("/dashboard/save", "POST", dashboard),

  getDashboards: (): Promise<DashboardData[]> =>
    createApiFetch<DashboardData[]>("/dashboard/list", "GET").then((response) =>
      response.success ? response.data || [] : []
    ),

  updateDashboard: (
    id: string,
    dashboard: {
      name: string;
      description?: string;
      charts: ChartConfig[];
      layout: any[];
    }
  ): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/dashboard/${id}`, "PUT", dashboard),

  deleteDashboard: (id: string): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/dashboard/${id}`, "DELETE"),

  deleteChart: (chartId: string): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/dashboard/chart/${chartId}`, "DELETE"),

  // Report Management (Refactored)
  getReports: (): Promise<ReportDefinition[]> =>
    createApiFetch<ReportDefinition[]>("/reports/list", "GET").then(
      (response) => (response.success ? response.data || [] : [])
    ),

  getReportConfig: (reportId: number): Promise<ApiResponse<FullReportConfig>> =>
    createApiFetch(`/reports/${reportId}`, "GET"),

  saveReport: (payload: {
    id?: number;
    name: string;
    description?: string;
    connection_id: number;
    base_table: string;
    columns: ReportColumn[];
    filters: ReportFilter[];
  }): Promise<ApiResponse<{ reportId?: number }>> => {
    const method = payload.id ? "PUT" : "POST";
    const endpoint = payload.id ? `/reports/${payload.id}` : "/reports/save";
    return createApiFetch(endpoint, method, payload);
  },

  // Add this new function
  previewReport: (payload: {
    connection_id: number;
    base_table: string;
    columns: ReportColumn[];
    filters: ReportFilter[];
  }): Promise<ApiResponse<RunReportResponse>> =>
    createApiFetch("/reports/preview", "POST", payload),

  deleteReport: (reportId: number): Promise<ApiResponse<unknown>> =>
    createApiFetch(`/reports/${reportId}`, "DELETE"),

  runReport: (
    reportId: number,
    filters: Record<string, any> = {}
  ): Promise<ApiResponse<RunReportResponse>> => {
    const params = new URLSearchParams({ reportId: String(reportId) });
    Object.entries(filters).forEach(([k, v]) => {
      if (v != null) params.append(k, String(v));
    });
    return createApiFetch(`/reports/run?${params.toString()}`, "GET");
  },

  getReportDrillConfig: (reportId: number): Promise<ReportDrillConfig[]> =>
    createApiFetch<ReportDrillConfig[]>(
      `/reports/${reportId}/drill-config`,
      "GET"
    ).then((response) => (response.success ? response.data || [] : [])),

  getReportDrillFields: (
    reportId: number
  ): Promise<{ name: string; alias: string; type: string }[]> =>
    createApiFetch<{ name: string; alias: string; type: string }[]>(
      `/reports/${reportId}/drill-fields`,
      "GET"
    ).then((response) => (response.success ? response.data || [] : [])),

  // For chart drill-through
  getChartDrillConfig: (
    chartId: string
  ): Promise<
    ApiResponse<{
      drillEnabled: boolean;
      targetDashboardId?: number;
      mapping?: Record<string, string>;
    }>
  > => createApiFetch(`/dashboard/chart/${chartId}/drill-config`, "GET"),
};

export default apiService;

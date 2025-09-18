// Updated api.ts (minor changes to include designation in responses where relevant)
// api.ts
const API_BASE = "http://localhost:3001/api"; // Adjust to your backend URL

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

export interface FactDimension {
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

export interface User {
  id: number;
  username: string;
  role: "admin" | "user" | "designer";
  designation?:
    | "Business Analyst"
    | "Data Scientist"
    | "Operations Manager"
    | "Finance Manager"
    | "Consumer Insights Manager"
    | "Store / Regional Manager"
    | null;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ConnectionDesignation {
  id: number;
  connection_id: number;
  designation: string;
}

async function apiFetch<T>(
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

export const apiService = {
  // User Authentication
  async login(
    username: string,
    password: string
  ): Promise<
    ApiResponse<{
      token: string;
      user: { id: number; role: string; designation?: string | null };
    }>
  > {
    return apiFetch("/auth/login", "POST", { username, password }, false);
  },

  async validateToken(): Promise<
    ApiResponse<{
      user: { id: number; role: string; designation?: string | null };
    }>
  > {
    return apiFetch("/auth/validate", "GET");
  },

  // User Management
  async createUser(
    username: string,
    password: string,
    role: "admin" | "user" | "designer",
    designation?:
      | "Business Analyst"
      | "Data Scientist"
      | "Operations Manager"
      | "Finance Manager"
      | "Consumer Insights Manager"
      | "Store / Regional Manager"
      | null
  ): Promise<ApiResponse<{ user: User }>> {
    return apiFetch("/semantic/users", "POST", {
      username,
      password,
      role,
      designation,
    });
  },

  async getUsers(): Promise<User[]> {
    const response = await apiFetch<User[]>("/semantic/users", "GET");
    return response.success ? response.data || [] : [];
  },

  async getUser(id: number): Promise<ApiResponse<User>> {
    return apiFetch(`/semantic/users/${id}`, "GET");
  },

  async updateUser(
    id: number,
    user: Partial<Omit<User, "id" | "created_at">>
  ): Promise<ApiResponse<User>> {
    return apiFetch(`/semantic/users/${id}`, "PUT", user);
  },

  async deleteUser(id: number): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/users/${id}`, "DELETE");
  },

  // Connection Management
  async getConnections(): Promise<Connection[]> {
    const response = await apiFetch<Connection[]>(
      "/semantic/connections",
      "GET"
    );
    return response.success ? response.data || [] : [];
  },

  async createConnection(
    connection: Omit<Connection, "id" | "created_at">
  ): Promise<ApiResponse<unknown>> {
    return apiFetch("/semantic/connections", "POST", connection);
  },

  async updateConnection(
    id: number,
    connection: Omit<Connection, "id" | "created_at">
  ): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/connections/${id}`, "PUT", connection);
  },

  async deleteConnection(id: number): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/connections/${id}`, "DELETE");
  },

  async testConnection(
    connection: Omit<Connection, "id" | "created_at">
  ): Promise<ApiResponse<{ success: boolean; message?: string }>> {
    return apiFetch("/semantic/connections/test", "POST", connection);
  },

  async getConnectionDesignations(
    connectionId?: number
  ): Promise<ConnectionDesignation[]> {
    const query = connectionId ? `?connection_id=${connectionId}` : "";
    const response = await apiFetch<ConnectionDesignation[]>(
      `/semantic/connection-designations${query}`,
      "GET"
    );
    return response.success ? response.data || [] : [];
  },

  async addConnectionDesignation(
    connectionId: number,
    designation: string
  ): Promise<ApiResponse<unknown>> {
    return apiFetch("/semantic/connection-designations", "POST", {
      connection_id: connectionId,
      designation,
    });
  },

  async deleteConnectionDesignation(id: number): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/connection-designations/${id}`, "DELETE");
  },

  // Schema Management
  async getSchemas(connectionId: number): Promise<Schema[]> {
    const response = await apiFetch<Schema[]>(
      `/database/schemas?connection_id=${connectionId}`,
      "GET"
    );
    return response.success ? response.data || [] : [];
  },

  // Facts and Dimensions
  async getFacts(connectionId: number): Promise<Fact[]> {
    const response = await apiFetch<Fact[]>(
      `/semantic/facts?connection_id=${connectionId}`,
      "GET"
    );
    return response.success ? response.data || [] : [];
  },

  async createFact(fact: Omit<Fact, "id">): Promise<ApiResponse<unknown>> {
    return apiFetch("/semantic/facts", "POST", fact);
  },

  async updateFact(
    id: number,
    fact: Omit<Fact, "id">
  ): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/facts/${id}`, "PUT", fact);
  },

  async deleteFact(id: number): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/facts/${id}`, "DELETE");
  },

  async getDimensions(connectionId: number): Promise<Dimension[]> {
    const response = await apiFetch<Dimension[]>(
      `/semantic/dimensions?connection_id=${connectionId}`,
      "GET"
    );
    return response.success ? response.data || [] : [];
  },

  async createDimension(
    dimension: Omit<Dimension, "id">
  ): Promise<ApiResponse<unknown>> {
    return apiFetch("/semantic/dimensions", "POST", dimension);
  },

  async updateDimension(
    id: number,
    dimension: Omit<Dimension, "id">
  ): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/dimensions/${id}`, "PUT", dimension);
  },

  async deleteDimension(id: number): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/dimensions/${id}`, "DELETE");
  },

  async getFactDimensions(connectionId: number): Promise<FactDimension[]> {
    const response = await apiFetch<FactDimension[]>(
      `/semantic/auto-map`,
      "POST",
      { connection_id: connectionId }
    );
    return response.success ? response.data || [] : [];
  },

  async createFactDimension(
    factDimension: Omit<FactDimension, "id" | "fact_name" | "dimension_name">
  ): Promise<ApiResponse<unknown>> {
    return apiFetch("/semantic/fact-dimensions", "POST", factDimension);
  },

  async updateFactDimension(
    id: number,
    factDimension: Omit<FactDimension, "id" | "fact_name" | "dimension_name">
  ): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/fact-dimensions/${id}`, "PUT", factDimension);
  },

  async deleteFactDimension(id: number): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/fact-dimensions/${id}`, "DELETE");
  },

  async getKpis(connectionId: number): Promise<Kpi[]> {
    const response = await apiFetch<Kpi[]>(
      `/semantic/kpis?connection_id=${connectionId}`,
      "GET"
    );
    return response.success ? response.data || [] : [];
  },

  async createKpi(
    kpi: Omit<Kpi, "id" | "created_by">
  ): Promise<ApiResponse<unknown>> {
    return apiFetch("/semantic/kpis", "POST", kpi);
  },

  async updateKpi(
    id: number,
    kpi: Omit<Kpi, "id" | "connection_id" | "created_by">
  ): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/kpis/${id}`, "PUT", kpi);
  },

  async deleteKpi(id: number): Promise<ApiResponse<unknown>> {
    return apiFetch(`/semantic/kpis/${id}`, "DELETE");
  },

  // Query Execution
  async runQuery(body: {
    connection_id: number;
    factIds: number[];
    dimensionIds: number[];
    aggregation: string;
  }): Promise<AggregationResponse> {
    const response = await apiFetch<AggregationResponse>(
      "/analytics/query",
      "POST",
      body
    );
    return response.success
      ? response.data || {}
      : { error: response.error || "Failed to run query" };
  },

  // Dashboard Management
  async saveDashboard(dashboard: {
    name: string;
    description?: string;
    connection_id: number;
    charts: ChartConfig[];
    layout: any[];
  }): Promise<ApiResponse<{ dashboardId: string }>> {
    return apiFetch("/dashboard/save", "POST", dashboard);
  },

  async getDashboards(): Promise<DashboardData[]> {
    const response = await apiFetch<DashboardData[]>("/dashboard/list", "GET");
    return response.success ? response.data || [] : [];
  },

  async updateDashboard(
    id: string,
    dashboard: {
      name: string;
      description?: string;
      charts: ChartConfig[];
      layout: any[];
    }
  ): Promise<ApiResponse<unknown>> {
    return apiFetch(`/dashboard/${id}`, "PUT", dashboard);
  },

  async deleteDashboard(id: string): Promise<ApiResponse<unknown>> {
    return apiFetch(`/dashboard/${id}`, "DELETE");
  },

  async deleteChart(chartId: string): Promise<ApiResponse<unknown>> {
    return apiFetch(`/dashboard/chart/${chartId}`, "DELETE");
  },
};

export default apiService;

const API_BASE = "http://localhost:3001/api"; // Adjust to your backend URL

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

interface ChartConfig {
  id?: string;
  xAxisDimension: Dimension | null;
  yAxisFacts: Fact[];
  groupByDimension: Dimension | null;
  chartType: "bar" | "line" | "pie";
  aggregationType: "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
  stacked: boolean;
  title?: string;
  description?: string;
  createdAt?: string;
  lastModified?: string;
}

interface DashboardData {
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

interface AggregationResponse {
  sql?: string;
  rows?: { [key: string]: number | string }[];
  error?: string;
}

interface Schema {
  tableName: string;
  columns: {
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }[];
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

interface Kpi {
  id: number;
  connection_id: number;
  name: string;
  expression: string;
  description?: string;
  created_by?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
    ApiResponse<{ token: string; user: { id: number; role: string } }>
  > {
    return apiFetch("/auth/login", "POST", { username, password }, false);
  },

  async validateToken(): Promise<
    ApiResponse<{ user: { id: number; role: string } }>
  > {
    return apiFetch("/auth/validate", "GET");
  },

  // User Management
  async createUser(
    username: string,
    password: string,
    role: string
  ): Promise<ApiResponse<unknown>> {
    return apiFetch("/semantic/users", "POST", { username, password, role });
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

  async testConnection(
    connection: Omit<Connection, "id" | "created_at">
  ): Promise<ApiResponse<{ success: boolean; message?: string }>> {
    return apiFetch("/semantic/connections/test", "POST", connection);
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

  async getDimensions(connectionId: number): Promise<Dimension[]> {
    const response = await apiFetch<Dimension[]>(
      `/semantic/dimensions?connection_id=${connectionId}`,
      "GET"
    );
    return response.success ? response.data || [] : [];
  },

  async getFactDimensions(connectionId: number): Promise<FactDimension[]> {
    const response = await apiFetch<FactDimension[]>(
      `/semantic/auto-map`,
      "POST",
      { connection_id: connectionId }
    );
    return response.success ? response.data || [] : [];
  },

  async getKpis(connectionId: number): Promise<Kpi[]> {
    const response = await apiFetch<Kpi[]>(
      `/semantic/kpis?connection_id=${connectionId}`,
      "GET"
    );
    return response.success ? response.data || [] : [];
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
};

export default apiService;

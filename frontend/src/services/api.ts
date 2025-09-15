const API_BASE = "http://192.168.29.66:3001/api";

async function apiFetch(path: string, method = "GET", body?: any) {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  try {
    return await res.json();
  } catch (e) {
    return { success: false, error: "Invalid server response" };
  }
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

interface Fact {
  id: number;
  connection_id: number;
  name: string;
  table_name: string;
  column_name: string;
  aggregate_function: string;
}

interface Dimension {
  id: number;
  connection_id: number;
  name: string;
  table_name: string;
  column_name: string;
}

interface FactDimension {
  id: number;
  fact_id: number;
  fact_name: string;
  fact_table: string;
  fact_column: string;
  dimension_id: number;
  dimension_name: string;
  dimension_table: string;
  dimension_column: string;
  join_table: string;
}

interface KPI {
  id: number;
  connection_id: number;
  name: string;
  expression: string;
  description?: string;
  created_by?: number;
  created_at: string;
}

interface AggregationResponse {
  sql?: string;
  rows?: { [key: string]: number | string }[];
  error?: string;
}

interface AutoMapResponse {
  success: boolean;
  autoMappings: {
    id: number;
    fact_id: number;
    fact_name: string;
    dimension_id: number;
    dimension_name: string;
    join_table: string;
    fact_column: string;
    dimension_column: string;
  }[];
}

interface User {
  id: number;
  username: string;
  role: string;
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

export const apiService = {
  /**
   * AUTH
   */
  login: (
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    token?: string;
    user?: { role: string };
    error?: string;
  }> => apiFetch("/semantic/login", "POST", { username, password }),

  validateToken: (): Promise<{
    success: boolean;
    user?: User;
    error?: string;
  }> => apiFetch("/semantic/validate"),

  /**
   * USER MANAGEMENT
   */
  createUser: (
    username: string,
    password: string,
    role: string
  ): Promise<{ success: boolean; user?: User; error?: string }> =>
    apiFetch("/semantic/users", "POST", { username, password, role }),

  /**
   * CONNECTION MANAGEMENT
   */
  getConnections: (): Promise<Connection[]> =>
    apiFetch("/semantic/connections"),

  testConnection: (body: {
    type: string;
    hostname: string;
    port: number;
    database: string;
    username: string;
    password: string;
    command_timeout?: number;
    max_transport_objects?: number;
    selected_db: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> =>
    apiFetch("/semantic/connections/test", "POST", body),

  createConnection: (body: {
    connection_name: string;
    description?: string;
    type: string;
    hostname: string;
    port: number;
    database: string;
    command_timeout?: number;
    max_transport_objects?: number;
    username: string;
    password: string;
    selected_db: string;
  }): Promise<{
    success: boolean;
    id?: number;
    connection_name?: string;
    description?: string;
    type?: string;
    hostname?: string;
    port?: number;
    database?: string;
    command_timeout?: number;
    max_transport_objects?: number;
    username?: string;
    selected_db?: string;
    error?: string;
  }> => apiFetch("/semantic/connections", "POST", body),

  deleteConnection: (
    id: number
  ): Promise<{ success: boolean; error?: string }> =>
    apiFetch(`/semantic/connections/${id}`, "DELETE"),

  /**
   * SCHEMA MANAGEMENT
   */
  getSchemas: (
    connection_id: number
  ): Promise<{ success: boolean; schemas?: Schema[]; error?: string }> =>
    apiFetch(`/database/schemas?connection_id=${connection_id}`),

  /**
   * FACT MANAGEMENT
   */
  getFacts: (connection_id: number): Promise<Fact[]> =>
    apiFetch(`/semantic/facts?connection_id=${connection_id}`),

  createFact: (body: {
    connection_id: number;
    name: string;
    table_name: string;
    column_name: string;
    aggregate_function: string;
  }): Promise<{
    id?: number;
    connection_id?: number;
    name?: string;
    table_name?: string;
    column_name?: string;
    aggregate_function?: string;
    error?: string;
  }> => apiFetch("/semantic/facts", "POST", body),

  updateFact: (
    id: number,
    body: {
      name: string;
      table_name: string;
      column_name: string;
      aggregate_function: string;
    }
  ): Promise<Fact | { error: string }> =>
    apiFetch(`/semantic/facts/${id}`, "PUT", body),

  deleteFact: (id: number): Promise<{ success: boolean; error?: string }> =>
    apiFetch(`/semantic/facts/${id}`, "DELETE"),

  /**
   * DIMENSION MANAGEMENT
   */
  getDimensions: (connection_id: number): Promise<Dimension[]> =>
    apiFetch(`/semantic/dimensions?connection_id=${connection_id}`),

  createDimension: (body: {
    connection_id: number;
    name: string;
    table_name: string;
    column_name: string;
  }): Promise<{
    id?: number;
    connection_id?: number;
    name?: string;
    table_name?: string;
    column_name?: string;
    error?: string;
  }> => apiFetch("/semantic/dimensions", "POST", body),

  updateDimension: (
    id: number,
    body: {
      name: string;
      table_name: string;
      column_name: string;
    }
  ): Promise<Dimension | { error: string }> =>
    apiFetch(`/semantic/dimensions/${id}`, "PUT", body),

  deleteDimension: (
    id: number
  ): Promise<{ success: boolean; error?: string }> =>
    apiFetch(`/semantic/dimensions/${id}`, "DELETE"),

  /**
   * FACT-DIMENSION MAPPING
   */
  getFactDimensions: (connection_id: number): Promise<FactDimension[]> =>
    apiFetch(`/semantic/fact-dimensions?connection_id=${connection_id}`),

  createFactDimension: (body: {
    fact_id: number;
    dimension_id: number;
    join_table: string;
    fact_column: string;
    dimension_column: string;
  }): Promise<{
    id?: number;
    fact_id?: number;
    dimension_id?: number;
    join_table?: string;
    fact_column?: string;
    dimension_column?: string;
    error?: string;
  }> => apiFetch("/semantic/fact-dimensions", "POST", body),

  /**
   * KPI MANAGEMENT
   */
  getKpis: (connection_id: number): Promise<KPI[]> =>
    apiFetch(`/semantic/kpis?connection_id=${connection_id}`),

  createKPI: (body: {
    connection_id: number;
    name: string;
    expression: string;
    description?: string;
  }): Promise<{
    id?: number;
    connection_id?: number;
    name?: string;
    expression?: string;
    description?: string;
    error?: string;
  }> => apiFetch("/semantic/kpis", "POST", body),

  updateKPI: (
    id: number,
    body: {
      name: string;
      expression: string;
      description?: string;
    }
  ): Promise<KPI | { error: string }> =>
    apiFetch(`/semantic/kpis/${id}`, "PUT", body),

  deleteKPI: (id: number): Promise<{ success: boolean; error?: string }> =>
    apiFetch(`/semantic/kpis/${id}`, "DELETE"),

  /**
   * QUERY EXECUTION
   */
  runQuery: (body: {
    connection_id: number;
    factIds: number[];
    dimensionIds: number[];
    aggregation: string;
    kpiId?: number;
  }): Promise<AggregationResponse> =>
    apiFetch("/analytics/query", "POST", body),

  /**
   * AUTO-MAPPING
   */
  runAutoMap: (connection_id: number): Promise<AutoMapResponse> =>
    apiFetch("/semantic/auto-map", "POST", { connection_id }),
};

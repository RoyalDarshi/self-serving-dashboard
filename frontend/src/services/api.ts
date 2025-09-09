const API_BASE = "http://localhost:3001/api";

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

export const apiService = {
  /**
   * AUTH
   */
  login: (username: string, password: string) =>
    apiFetch("/semantic/login", "POST", { username, password }),

  validateToken: () => apiFetch("/semantic/validate"),

  /**
   * USER MANAGEMENT
   */
  createUser: (
    username: string,
    password: string,
    role: string
  ): Promise<{ success: boolean; user?: User; error?: string }> =>
    apiFetch("/semantic/users", "POST", { username, password, role }),

  getSchemas: () => apiFetch("/database/schemas"),

  getFacts: (): Promise<Fact[]> => apiFetch("/semantic/facts"),
  createFact: (body: {
    name: string;
    table_name: string;
    column_name: string;
    aggregate_function: string;
  }) => apiFetch("/semantic/facts", "POST", body),
  updateFact: (
    id: number,
    body: {
      name: string;
      table_name: string;
      column_name: string;
      aggregate_function: string;
    }
  ) => apiFetch(`/semantic/facts/${id}`, "PUT", body),
  deleteFact: (id: number) => apiFetch(`/semantic/facts/${id}`, "DELETE"),

  getDimensions: (): Promise<Dimension[]> => apiFetch("/semantic/dimensions"),
  createDimension: (body: {
    name: string;
    table_name: string;
    column_name: string;
  }) => apiFetch("/semantic/dimensions", "POST", body),
  updateDimension: (
    id: number,
    body: {
      name: string;
      table_name: string;
      column_name: string;
    }
  ) => apiFetch(`/semantic/dimensions/${id}`, "PUT", body),
  deleteDimension: (id: number) =>
    apiFetch(`/semantic/dimensions/${id}`, "DELETE"),

  getFactDimensions: () => apiFetch("/semantic/fact-dimensions"),
  createFactDimension: (body: {
    fact_id: number;
    dimension_id: number;
    join_table: string;
    fact_column: string;
    dimension_column: string;
  }) => apiFetch("/semantic/fact-dimensions", "POST", body),

  getKpis: () => apiFetch("/semantic/kpis"),
  createKPI: (body: {
    name: string;
    expression: string;
    description?: string;
  }) => apiFetch("/semantic/kpis", "POST", body),
  updateKPI: (
    id: number,
    body: {
      name: string;
      expression: string;
      description?: string;
    }
  ) => apiFetch(`/semantic/kpis/${id}`, "PUT", body),
  deleteKPI: (id: number) => apiFetch(`/semantic/kpis/${id}`, "DELETE"),

  runQuery: (body: {
    factId: number;
    dimensionIds: number[];
    aggregation: string;
  }): Promise<AggregationResponse> =>
    apiFetch("/analytics/query", "POST", body),

  runAutoMap: (): Promise<AutoMapResponse> =>
    apiFetch("/semantic/auto-map", "POST"),
};

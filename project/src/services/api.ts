// src/services/api.ts
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
  createUser: (username: string, password: string, role: string) =>
    apiFetch("/semantic/users", "POST", { username, password, role }),

  getSchemas: () => apiFetch("/database/schemas"),

  getFacts: () => apiFetch("/semantic/facts"),
  createFact: (body: {
    name: string;
    table_name: string;
    column_name: string;
    aggregate_function: string;
  }) => apiFetch("/semantic/facts", "POST", body),

  getDimensions: () => apiFetch("/semantic/dimensions"),
  createDimension: (body: { name: string; column_name: string }) =>
    apiFetch("/semantic/dimensions", "POST", body),

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
  runQuery: (body: {
    factId: number;
    dimensionIds: number[];
    aggregation: string;
  }) => apiFetch("/analytics/query", "POST", body),
};

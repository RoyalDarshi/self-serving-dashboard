// services/api.ts
const API_BASE = "http://localhost:3001/api"; // adjust if your backend runs elsewhere

// Generic helper
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

  /**
   * SOURCE DB SCHEMA
   */
  getSchemas: () => apiFetch("/database/schemas"),

  /**
   * FACTS
   */
  createFact: (body: {
    name: string;
    table_name: string;
    column_name: string;
    aggregation: string;
  }) => apiFetch("/semantic/facts", "POST", body),

  getFacts: () => apiFetch("/semantic/facts"),

  /**
   * DIMENSIONS
   */
  createDimension: (body: {
    name: string;
    table_name: string;
    column_name: string;
  }) => apiFetch("/semantic/dimensions", "POST", body),

  getDimensions: () => apiFetch("/semantic/dimensions"),

  /**
   * KPIs
   */
  createKPI: (body: {
    name: string;
    sql_query: string;
    fact_id?: number;
    dimension_id?: number;
  }) => apiFetch("/semantic/kpis", "POST", body),

  getKpis: () => apiFetch("/semantic/kpis"),

  /**
   * ANALYTICS
   */
  runQuery: (body: {
    factId: number;
    dimensionId?: number;
    filters?: any[];
    limit?: number;
  }) => apiFetch("/analytics/query", "POST", body),

  /**
   * DASHBOARDS (save/load layouts)
   */
  saveDashboard: (dashboardName: string, layout: any) =>
    apiFetch("/dashboard/save", "POST", { dashboardName, layout }),

  listDashboards: () => apiFetch("/dashboard/list"),
};

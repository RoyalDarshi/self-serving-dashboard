import { dbPromise } from "../database/sqliteConnection.js";

/* =========================================================
   Helper: Parse table from column string (table.column)
========================================================= */
function getTableFromColumn(expr) {
  if (!expr) return null;

  let cleaned = expr.replace(/\s+AS\s+.*/i, "").trim();

  const aggMatch = cleaned.match(/\(([^)]+)\)/);
  if (aggMatch) {
    cleaned = aggMatch[1];
  }

  if (!cleaned.includes(".")) return null;

  return cleaned.split(".")[0].trim();
}

/* =========================================================
   Build relationship graph
========================================================= */
function buildRelationshipGraph(relationships) {
  const graph = {};

  relationships.forEach((r) => {
    if (!graph[r.left_table]) graph[r.left_table] = [];
    if (!graph[r.right_table]) graph[r.right_table] = [];

    graph[r.left_table].push({
      table: r.right_table,
      on: `${r.left_table}.${r.left_column} = ${r.right_table}.${r.right_column}`,
      join_type: r.join_type,
    });

    graph[r.right_table].push({
      table: r.left_table,
      on: `${r.right_table}.${r.right_column} = ${r.left_table}.${r.left_column}`,
      join_type: r.join_type,
    });
  });

  return graph;
}

/* =========================================================
   Find JOIN path
========================================================= */
function findJoinPath(graph, start, target) {
  if (start === target) return [];

  const queue = [[start, []]];
  const visited = new Set();

  while (queue.length) {
    const [current, path] = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    for (const edge of graph[current] || []) {
      if (edge.table === target) {
        return [...path, edge];
      }
      queue.push([edge.table, [...path, edge]]);
    }
  }

  return null;
}

/* =========================================================
   MAIN QUERY BUILDER
========================================================= */
export async function buildSemanticQuery({
  connection_id,
  base_table,
  select = [],
  filters = [],
  group_by = [],
  order_by = [],
  limit,
  offset, // ✅ ADDED
}) {
  if (!connection_id) throw new Error("connection_id required");
  if (!base_table) throw new Error("base_table required");

  const db = await dbPromise;

  const relationships = await db.all(
    `SELECT left_table, left_column, right_table, right_column, join_type
     FROM table_relationships
     WHERE connection_id = ?`,
    [connection_id]
  );

  const graph = buildRelationshipGraph(relationships);

  const requiredTables = new Set([base_table]);

  [...select, ...filters.map((f) => f.column), ...group_by].forEach((c) => {
    const t = getTableFromColumn(c);
    if (t) requiredTables.add(t);
  });

  const joins = [];
  const joinedTables = new Set([base_table]);

  for (const table of requiredTables) {
    if (table === base_table) continue;

    const path = findJoinPath(graph, base_table, table);
    if (!path) {
      throw new Error(`No join path found from ${base_table} to ${table}`);
    }

    for (const step of path) {
      if (!joinedTables.has(step.table)) {
        joins.push(`${step.join_type} JOIN ${step.table} ON ${step.on}`);
        joinedTables.add(step.table);
      }
    }
  }

  const selectClause =
    select.length > 0 ? select.join(", ") : `${base_table}.*`;

  let sql = `SELECT ${selectClause} FROM ${base_table}`;

  if (joins.length) {
    sql += " " + joins.join(" ");
  }

  const params = [];

  if (filters.length) {
    const whereParts = filters.map((f) => {
      const qualifiedColumn = f.column.includes(".")
        ? f.column
        : `${base_table}.${f.column}`;

      params.push(f.value);
      return `${qualifiedColumn} ${f.operator} ?`;
    });

    sql += ` WHERE ${whereParts.join(" AND ")}`;
  }

  if (group_by.length) {
    sql += ` GROUP BY ${group_by.join(", ")}`;
  }

  if (order_by.length) {
    const parts = order_by.map((o) => `${o.column} ${o.direction || "ASC"}`);
    sql += ` ORDER BY ${parts.join(", ")}`;
  }

  // ✅ FIXED PAGINATION
  if (limit !== undefined) {
    sql += ` LIMIT ${limit}`;
  }

  if (offset !== undefined) {
    sql += ` OFFSET ${offset}`;
  }

  return { sql, params };
}

// routes/database.js (FULLY FIXED VERSION)

import { Router } from "express";
import { getPoolForConnection } from "../database/connection.js";

const router = Router();

// ==========================================================
// 1. SQL QUERIES
// ==========================================================
const sqlQueries = {
  postgres: {
    getTables: `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'management')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name;
    `,
    getColumnsAndKeys: `
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        tc.constraint_type,
        ccu.table_schema AS foreign_schema,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_name = kcu.table_name
        AND c.column_name = kcu.column_name
        AND c.table_schema = kcu.table_schema
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
        AND tc.table_schema = c.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_type = 'FOREIGN KEY'
        AND kcu.constraint_name = ccu.constraint_name
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position;
    `,
  },

  mysql: {
    getTables: `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `,
    getColumnsAndKeys: `
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.column_key,
        kcu.referenced_table_schema AS foreign_schema,
        kcu.referenced_table_name AS foreign_table,
        kcu.referenced_column_name AS foreign_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_schema = kcu.table_schema
        AND c.table_name = kcu.table_name
        AND c.column_name = kcu.column_name
      WHERE c.table_schema = ? AND c.table_name = ?
      ORDER BY c.ordinal_position;
    `,
  },
};

// ==========================================================
// 2. ROUTES
// ==========================================================
router.get("/schemas", async (req, res) => {
  const { connection_id } = req.query;

  if (!connection_id) {
    return res.status(400).json({ error: "connection_id required" });
  }

  try {
    const { pool, type, selected_db } = await getPoolForConnection(
      connection_id,
      req.user?.userId
    );

    const dbQueries = sqlQueries[type];
    if (!dbQueries) {
      return res.status(501).json({
        error: `Database type '${type}' not supported.`,
      });
    }

    const client = await pool.connect();

    try {
      // 1️⃣ Fetch tables
      const tableParams = type === "mysql" ? [selected_db] : [];
      const tablesResult = await client.query(dbQueries.getTables, tableParams);
      const tableRows = tablesResult.rows || tablesResult[0];
      if (!tableRows) return res.json([]);

      const schemas = [];

      // 2️⃣ Loop tables → Fetch + merge columns
      for (const { table_schema, table_name } of tableRows) {
        const columnParams =
          type === "postgres"
            ? [table_schema, table_name]
            : [selected_db, table_name];

        const columnsResult = await client.query(
          dbQueries.getColumnsAndKeys,
          columnParams
        );

        let columnRows = columnsResult.rows || columnsResult[0];
        if (!columnRows) continue;

        // 🔥 3️⃣ Deduplicate and merge constraint rows
        const columnMap = {};

        columnRows.forEach((col) => {
          const name = col.column_name;

          if (!columnMap[name]) {
            columnMap[name] = {
              name,
              type: col.data_type?.toUpperCase?.() || col.data_type,
              isNullable:
                col.is_nullable === "YES" ||
                col.is_nullable === "yes" ||
                col.is_nullable === "YES",
              isPk: false,
              fk: null,
            };
          }

          // --- Merge PK ---
          if (type === "postgres" && col.constraint_type === "PRIMARY KEY") {
            columnMap[name].isPk = true;
          }
          if (type === "mysql" && col.column_key === "PRI") {
            columnMap[name].isPk = true;
          }

          // --- Merge FK ---
          const isFk =
            (type === "postgres" && col.constraint_type === "FOREIGN KEY") ||
            (type === "mysql" && col.foreign_table);

          if (isFk) {
            columnMap[name].fk = {
              schema: col.foreign_schema || table_schema,
              table: col.foreign_table,
              column: col.foreign_column,
            };
          }
        });

        const finalColumns = Object.values(columnMap);

        schemas.push({
          schema: table_schema,
          tableName: table_name,
          columns: finalColumns,
        });
      }

      res.json(schemas);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error fetching schemas:", err);
    res.status(500).json({ error: "Failed to fetch schemas" });
  }
});

export default router;

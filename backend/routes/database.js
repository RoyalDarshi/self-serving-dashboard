// routes/database.js (SINGLE FILE VERSION)

import { Router } from "express";
import { getPoolForConnection } from "../database/connection.js";

const router = Router();

// ==========================================================
// 1. SQL QUERIES DEFINITION (Combined from sql_queries.js)
// ==========================================================
const sqlQueries = {
  // --- POSTGRES QUERIES ---
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
        AND kcu.constraint_name = ccu.constraint_name -- Link FK usage to target column
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position;
    `,
  },

  // --- MYSQL QUERIES ---
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
        AND kcu.referenced_table_name IS NOT NULL -- Filters for Foreign Keys
      WHERE c.table_schema = ? AND c.table_name = ?
      ORDER BY c.ordinal_position;
    `,
  },
};

// ==========================================================
// 2. ROUTER IMPLEMENTATION
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
      return res
        .status(501)
        .json({
          error: `Database type '${type}' not supported for schema fetching.`,
        });
    }

    const client = await pool.connect();

    try {
      // --- Fetch all tables ---
      let tablesResult;
      let tablesParams = [];

      if (type === "mysql") {
        tablesParams = [selected_db];
      }
      tablesResult = await client.query(dbQueries.getTables, tablesParams);

      const tableRows = tablesResult.rows || tablesResult[0];
      if (!tableRows) {
        return res.json([]);
      }

      const schemas = [];

      // --- Loop through tables to fetch columns and key info (PK + FK) ---
      for (const { table_schema, table_name } of tableRows) {
        let columnsResult;
        let columnsParams;

        if (type === "postgres") {
          columnsParams = [table_schema, table_name];
        } else if (type === "mysql") {
          columnsParams = [selected_db, table_name];
        }

        columnsResult = await client.query(
          dbQueries.getColumnsAndKeys,
          columnsParams
        );

        const columnRows = columnsResult.rows || columnsResult[0];
        if (!columnRows) continue;

        schemas.push({
          schema: table_schema,
          tableName: table_name,
          columns: columnRows.map((col) => {
            let isPk = false;
            let fkData = null;

            if (type === "postgres") {
              // PK detection
              isPk = col.constraint_type === "PRIMARY KEY";
              // FK detection
              if (col.constraint_type === "FOREIGN KEY" && col.foreign_table) {
                fkData = {
                  schema: col.foreign_schema,
                  table: col.foreign_table,
                  column: col.foreign_column,
                };
              }
            } else if (type === "mysql") {
              // PK detection
              isPk = col.column_key === "PRI";
              // FK detection
              if (col.foreign_table) {
                fkData = {
                  schema: col.foreign_schema || table_schema,
                  table: col.foreign_table,
                  column: col.foreign_column,
                };
              }
            }

            return {
              name: col.column_name,
              type: col.data_type?.toUpperCase?.() || col.data_type,
              // Frontend friendly structure
              isNullable: col.is_nullable === "YES",
              isPk: isPk,
              fk: fkData, // Structured FK object (used for drawing connections)
            };
          }),
        });
      }

      res.json(schemas);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching schemas:", error);
    res.status(500).json({ error: "Failed to fetch schemas" });
  }
});

export default router;

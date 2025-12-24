// routes/analytics.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
import { getPoolForConnection } from "../database/connection.js";
import { buildSemanticQuery } from "../utils/semanticQueryBuilder.js";

const router = Router();

/**
 * Builds and executes a dynamic SQL query based on facts + dimensions or KPI + dimensions.
 * Handles auto-join detection if no explicit mappings.
 * @route POST /query
 * @param {number} connection_id - ID of the connection to use (required).
 * @param {number[]} factIds - Array of fact IDs (required for fact flow).
 * @param {number[]} dimensionIds - Array of dimension IDs.
 * @param {string} aggregation - Aggregation function (e.g., SUM).
 * @param {number} kpiId - ID of the KPI (required for KPI flow).
 * @returns {object} - SQL query and result rows.
 */
router.post("/query", async (req, res) => {
  try {
    const {
      connection_id,
      factIds,
      dimensionIds = [],
      aggregation,
      kpiId,
    } = req.body;
    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }
    const { pool, type } = await getPoolForConnection(
      connection_id,
      req.user?.userId
    );

    // FIX: Differentiate connection acquisition based on DB type
    let client;
    if (type === "postgres") {
      client = await pool.connect();
    } else if (type === "mysql") {
      client = await pool.getConnection();
    } else {
      throw new Error(`Unsupported database type: ${type}`);
    }

    const db = await dbPromise;

    try {
      const { sql } = await buildSemanticQuery({
        db,
        client,
        type,
        connection_id,
        factIds,
        dimensionIds,
        kpiId,
        aggregation,
      });

      console.log("Generated SQL:", sql);

      const result = await client.query(sql);
      // Handle difference in result structure (Postgres: .rows, MySQL: result[0])
      const rows = result.rows || result[0];

      res.json({ sql, rows });
    } catch (err) {
      if (
        err.message.includes("No facts") ||
        err.message.includes("No valid")
      ) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    } finally {
      // Both PG and MySQL2 clients support .release()
      if (client) client.release();
    }
  } catch (err) {
    console.error("Analytics query error:", err.message, err.stack);
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

export default router;

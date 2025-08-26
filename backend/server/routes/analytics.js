// routes/analytics.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js"; // App DB (metadata)
import { sourceDbPromise } from "../database/postgresConnection.js"; // Source DB (business data)
import { isSafeIdent, qIdent } from "../utils/sanitize.js";

const router = Router();

/**
 * POST /api/analytics/query
 * Body: { factId: number, dimensionId?: number, filters?: Array<{table:string,column:string,op:string,value:any}> , limit?: number }
 *
 * - Looks up fact & dimension metadata in App DB
 * - Builds a SELECT against Source DB
 * - Executes and returns rows
 */
router.post("/query", async (req, res) => {
  const { factId, dimensionId, filters = [] } = req.body;
  const appDb = await dbPromise;
  try {
    const fact = await appDb.get(`SELECT * FROM facts WHERE id = ?`, [factId]);
    if (!fact)
      return res.status(400).json({ success: false, error: "Fact not found" });

    let sql,
      params = [];

    if (dimensionId) {
      const dimension = await appDb.get(
        `SELECT * FROM dimensions WHERE id = ?`,
        [dimensionId]
      );
      if (!dimension)
        return res
          .status(400)
          .json({ success: false, error: "Dimension not found" });

      sql = `
        SELECT d.${dimension.display_column} AS dimension,
               ${fact.aggregation}(f.${fact.column_name}) AS value
        FROM ${fact.table_name} f
        JOIN ${dimension.dimension_table} d
          ON f.${dimension.fact_column} = d.${dimension.dimension_column}
      `;

      if (filters.length > 0) {
        const whereClauses = filters.map((filt, i) => {
          params.push(filt.value);
          return `f.${filt.column} ${filt.op} $${i + 1}`;
        });
        sql += ` WHERE ${whereClauses.join(" AND ")}`;
      }

      sql += ` GROUP BY d.${dimension.display_column}`;
    } else {
      sql = `
        SELECT ${fact.aggregation}(f.${fact.column_name}) AS value
        FROM ${fact.table_name} f
      `;
    }

    const client = await sourceDbPromise.connect();
    try {
      const result = await client.query(sql, params);
      res.json({ success: true, data: result.rows, sql });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Analytics query error:", err.message);
    res.status(500).json({ success: false, error: "Query failed" });
  }
});

export default router;

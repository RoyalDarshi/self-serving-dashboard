// analytics.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js"; // SQLite for metadata
import pool from "../database/connection.js"; // PostgreSQL for data

const router = Router();

/**
 * Build dynamic query from fact + dimensions or KPI + dimensions
 */
router.post("/query", async (req, res) => {
  try {
    const { factId, dimensionIds = [], aggregation, kpiId } = req.body;
    const db = await dbPromise; // SQLite connection for metadata

    let selectClause = "";
    let fromClause = "";
    let groupByClause = "";
    let dimSelects = "";

    // Deduplicate dimensionIds to prevent duplicate joins
    const uniqueDimensionIds = [...new Set(dimensionIds)];

    if (kpiId) {
      // --- KPI FLOW ---
      const kpi = await db.get("SELECT * FROM kpis WHERE id = ?", [kpiId]);
      if (!kpi) return res.status(400).json({ error: "Invalid kpiId" });

      // Get all facts (to replace fact names in expression)
      const facts = await db.all("SELECT * FROM facts");
      let expr = kpi.expression; // e.g. "(Revenue - Cost) / Revenue"

      for (const f of facts) {
        const regex = new RegExp(`\\b${f.name}\\b`, "gi");
        expr = expr.replace(regex, `SUM("${f.table_name}"."${f.column_name}")`);
      }

      selectClause = `${expr} AS value`;

      // For FROM and JOINs, we need at least one fact to anchor
      if (facts.length === 0) {
        return res
          .status(400)
          .json({ error: "No facts available to build KPI" });
      }
      const baseFact = facts[0]; // anchor on first fact for FROM clause
      fromClause = `"${baseFact.table_name}"`;

      // Dimensions
      if (uniqueDimensionIds.length > 0) {
        const dimensions = await db.all(
          `SELECT d.*, fd.join_table, fd.fact_column, fd.dimension_column 
           FROM fact_dimensions fd
           JOIN dimensions d ON fd.dimension_id = d.id
           WHERE fd.fact_id = ? AND d.id IN (${uniqueDimensionIds
             .map(() => "?")
             .join(",")})`,
          [baseFact.id, ...uniqueDimensionIds]
        );

        // Track unique join tables to prevent duplicate joins
        const seenJoinTables = new Set([baseFact.table_name]); // Exclude base fact table
        const uniqueDimensions = [];
        dimensions.forEach((d) => {
          if (!seenJoinTables.has(d.join_table)) {
            seenJoinTables.add(d.join_table);
            uniqueDimensions.push(d);
          }
        });

        if (uniqueDimensions.length === 0) {
          return res
            .status(400)
            .json({ error: "No valid dimensions found after deduplication" });
        }

        // Build SELECT and GROUP BY clauses with unique columns
        const dimColumns = new Set();
        dimSelects = uniqueDimensions
          .map((d) => {
            const col = `"${d.join_table}"."${d.column_name}"`;
            dimColumns.add(col);
            return col;
          })
          .join(", ");
        groupByClause = [...dimColumns].join(", ");

        // Build JOIN clauses
        uniqueDimensions.forEach((d) => {
          fromClause += ` JOIN "${d.join_table}" ON "${d.join_table}"."${d.dimension_column}" = "${baseFact.table_name}"."${d.fact_column}"`;
        });
      }
    } else {
      // --- FACT FLOW ---
      const fact = await db.get("SELECT * FROM facts WHERE id = ?", [factId]);
      if (!fact) return res.status(400).json({ error: "Invalid factId" });

      const dimensions = await db.all(
        `SELECT d.*, fd.join_table, fd.fact_column, fd.dimension_column 
         FROM fact_dimensions fd
         JOIN dimensions d ON fd.dimension_id = d.id
         WHERE fd.fact_id = ? AND d.id IN (${uniqueDimensionIds
           .map(() => "?")
           .join(",")})`,
        [fact.id, ...uniqueDimensionIds]
      );

      if (dimensions.length === 0)
        return res.status(400).json({ error: "No valid dimensions found" });

      // Track unique join tables to prevent duplicate joins
      const seenJoinTables = new Set([fact.table_name]);
      const uniqueDimensions = [];
      dimensions.forEach((d) => {
        if (!seenJoinTables.has(d.join_table)) {
          seenJoinTables.add(d.join_table);
          uniqueDimensions.push(d);
        }
      });

      if (uniqueDimensions.length === 0) {
        return res
          .status(400)
          .json({ error: "No valid dimensions found after deduplication" });
      }

      const aggFunc = aggregation || "SUM";
      selectClause = `${aggFunc}("${fact.table_name}"."${fact.column_name}") AS value`;

      // Build SELECT and GROUP BY clauses with unique columns
      const dimColumns = new Set();
      dimSelects = uniqueDimensions
        .map((d) => {
          const col = `"${d.join_table}"."${d.column_name}"`;
          dimColumns.add(col);
          return col;
        })
        .join(", ");
      groupByClause = [...dimColumns].join(", ");

      fromClause = `"${fact.table_name}"`;
      uniqueDimensions.forEach((d) => {
        fromClause += ` JOIN "${d.join_table}" ON "${d.join_table}"."${d.dimension_column}" = "${fact.table_name}"."${d.fact_column}"`;
      });
    }

    // Final SQL for PostgreSQL
    const sql = `
      SELECT ${selectClause}${dimSelects ? ", " + dimSelects : ""}
      FROM ${fromClause}
      ${groupByClause ? "GROUP BY " + groupByClause : ""}
    `;

    console.log("Generated SQL:", sql);

    // Execute the query on PostgreSQL
    const result = await pool.query(sql);
    const rows = result.rows;

    res.json({ sql, rows });
  } catch (err) {
    console.error("Analytics query error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

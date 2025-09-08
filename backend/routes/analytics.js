// analytics.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
import pool from "../database/connection.js";

const router = Router();

/**
 * Build dynamic query from fact + dimensions or KPI + dimensions
 */
router.post("/query", async (req, res) => {
  try {
    const { factId, dimensionIds = [], aggregation, kpiId } = req.body;
    const db = await dbPromise;

    let selectClause = "";
    let fromClause = "";
    let groupByClause = "";
    let dimSelects = "";

    const uniqueDimensionIds = [...new Set(dimensionIds)];

    if (kpiId) {
      // --- KPI FLOW ---
      const kpi = await db.get("SELECT * FROM kpis WHERE id = ?", [kpiId]);
      if (!kpi) return res.status(400).json({ error: "Invalid kpiId" });

      const facts = await db.all("SELECT * FROM facts");
      let expr = kpi.expression;

      for (const f of facts) {
        const regex = new RegExp(`\\b${f.name}\\b`, "gi");
        expr = expr.replace(regex, `SUM("${f.table_name}"."${f.column_name}")`);
      }

      selectClause = `${expr} AS value`;

      if (facts.length === 0) {
        return res
          .status(400)
          .json({ error: "No facts available to build KPI" });
      }
      const baseFact = facts[0];
      fromClause = `"${baseFact.table_name}"`; // ✅ always include base table

      if (uniqueDimensionIds.length > 0) {
        let dimensions = await db.all(
          `SELECT d.*, fd.join_table, fd.fact_column, fd.dimension_column 
           FROM fact_dimensions fd
           JOIN dimensions d ON fd.dimension_id = d.id
           WHERE fd.fact_id = ? AND d.id IN (${uniqueDimensionIds
             .map(() => "?")
             .join(",")})`,
          [baseFact.id, ...uniqueDimensionIds]
        );

        // Auto-detect joins if no mapping found
        if (dimensions.length === 0) {
          const factColumnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
            [baseFact.table_name]
          );
          const factColumns = factColumnsResult.rows.map(
            (row) => row.column_name
          );

          for (const dimId of uniqueDimensionIds) {
            const dim = await db.get("SELECT * FROM dimensions WHERE id = ?", [
              dimId,
            ]);
            if (!dim) continue;

            const dimTableColumnsResult = await pool.query(
              `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
              [dim.table_name]
            );
            const dimTableColumns = dimTableColumnsResult.rows.map(
              (row) => row.column_name
            );

            if (!dimTableColumns.includes(dim.column_name)) continue;

            const commonColumns = factColumns.filter((col) =>
              dimTableColumns.includes(col)
            );

            if (commonColumns.length > 0) {
              const commonCol = commonColumns[0];
              dimensions.push({
                ...dim,
                join_table: dim.table_name,
                fact_column: commonCol,
                dimension_column: commonCol,
              });
            } else if (dim.table_name === baseFact.table_name) {
              dimensions.push({
                ...dim,
                join_table: dim.table_name,
                fact_column: dim.column_name,
                dimension_column: dim.column_name,
              });
            }
          }
        }

        const seenJoins = new Set();
        const dimColumns = [];

        dimensions.forEach((d) => {
          const table = d.join_table || d.table_name;

          // ✅ Always alias dimension columns to just column_name
          const col = `"${table}"."${d.column_name}" AS "${d.column_name}"`;
          dimColumns.push(col);

          if (
            table !== baseFact.table_name &&
            !seenJoins.has(`${table}.${d.column_name}`)
          ) {
            seenJoins.add(`${table}.${d.column_name}`);
            fromClause += ` JOIN "${table}" ON "${table}"."${d.dimension_column}" = "${baseFact.table_name}"."${d.fact_column}"`;
          }
        });

        if (dimColumns.length > 0) {
          dimSelects = dimColumns.join(", ");
          groupByClause = dimensions
            .map((d) => `"${d.join_table || d.table_name}"."${d.column_name}"`)
            .join(", ");
        }
      }
    } else {
      // --- FACT FLOW ---
      const fact = await db.get("SELECT * FROM facts WHERE id = ?", [factId]);
      if (!fact) return res.status(400).json({ error: "Invalid factId" });

      let dimensions = await db.all(
        `SELECT d.*, fd.join_table, fd.fact_column, fd.dimension_column 
         FROM fact_dimensions fd
         JOIN dimensions d ON fd.dimension_id = d.id
         WHERE fd.fact_id = ? AND d.id IN (${uniqueDimensionIds
           .map(() => "?")
           .join(",")})`,
        [fact.id, ...uniqueDimensionIds]
      );

      // Auto-detect joins if no mapping found
      if (dimensions.length === 0) {
        const factColumnsResult = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [fact.table_name]
        );
        const factColumns = factColumnsResult.rows.map(
          (row) => row.column_name
        );

        for (const dimId of uniqueDimensionIds) {
          const dim = await db.get("SELECT * FROM dimensions WHERE id = ?", [
            dimId,
          ]);
          if (!dim) continue;

          const dimTableColumnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
            [dim.table_name]
          );
          const dimTableColumns = dimTableColumnsResult.rows.map(
            (row) => row.column_name
          );

          if (!dimTableColumns.includes(dim.column_name)) continue;

          const commonColumns = factColumns.filter((col) =>
            dimTableColumns.includes(col)
          );

          if (commonColumns.length > 0) {
            const commonCol = commonColumns[0];
            dimensions.push({
              ...dim,
              join_table: dim.table_name,
              fact_column: commonCol,
              dimension_column: commonCol,
            });
          } else if (dim.table_name === fact.table_name) {
            dimensions.push({
              ...dim,
              join_table: dim.table_name,
              fact_column: dim.column_name,
              dimension_column: dim.column_name,
            });
          }
        }
      }

      if (dimensions.length === 0)
        return res.status(400).json({ error: "No valid dimensions found" });

      fromClause = `"${fact.table_name}"`; // ✅ always include base table
      const seenJoins = new Set();
      const dimColumns = [];

      dimensions.forEach((d) => {
        const table = d.join_table || d.table_name;

        // ✅ Always alias dimension columns to just column_name
        const col = `"${table}"."${d.column_name}" AS "${d.column_name}"`;
        dimColumns.push(col);

        if (
          table !== fact.table_name &&
          !seenJoins.has(`${table}.${d.column_name}`)
        ) {
          seenJoins.add(`${table}.${d.column_name}`);
          fromClause += ` JOIN "${table}" ON "${table}"."${d.dimension_column}" = "${fact.table_name}"."${d.fact_column}"`;
        }
      });

      const aggFunc = aggregation || fact.aggregate_function || "SUM";
      selectClause = `${aggFunc}("${fact.table_name}"."${fact.column_name}") AS value`;

      if (dimColumns.length > 0) {
        dimSelects = dimColumns.join(", ");
        groupByClause = dimensions
          .map((d) => `"${d.join_table || d.table_name}"."${d.column_name}"`)
          .join(", ");
      }
    }

    const sql = `
      SELECT ${selectClause}${dimSelects ? ", " + dimSelects : ""}
      FROM ${fromClause}
      ${groupByClause ? "GROUP BY " + groupByClause : ""}
    `;

    console.log("Generated SQL:", sql);

    const result = await pool.query(sql);
    const rows = result.rows;

    res.json({ sql, rows });
  } catch (err) {
    console.error("Analytics query error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

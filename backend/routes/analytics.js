import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
import pool from "../database/connection.js";

const router = Router();

/**
 * Builds and executes a dynamic SQL query based on facts + dimensions or KPI + dimensions.
 * Handles auto-join detection if no explicit mappings.
 * @route POST /query
 * @param {number[]} factIds - Array of fact IDs (required for fact flow).
 * @param {number[]} dimensionIds - Array of dimension IDs.
 * @param {string} aggregation - Aggregation function (e.g., SUM).
 * @param {number} kpiId - ID of the KPI (required for KPI flow).
 * @returns {object} - SQL query and result rows.
 */
router.post("/query", async (req, res) => {
  try {
    const { factIds, dimensionIds = [], aggregation, kpiId } = req.body;
    const db = await dbPromise;

    let selectClause = "";
    let fromClause = "";
    let groupByClause = "";
    let dimSelects = "";

    const uniqueDimensionIds = [...new Set(dimensionIds)];

    if (kpiId) {
      // KPI Flow (unchanged)
      const kpi = await db.get("SELECT * FROM kpis WHERE id = ?", [kpiId]);
      if (!kpi) return res.status(400).json({ error: "Invalid kpiId" });

      const facts = await db.all("SELECT * FROM facts");
      if (facts.length === 0) {
        return res
          .status(400)
          .json({ error: "No facts available to build KPI" });
      }

      let expr = kpi.expression;
      for (const f of facts) {
        const regex = new RegExp(`\\b${f.name}\\b`, "gi");
        expr = expr.replace(regex, `SUM("${f.table_name}"."${f.column_name}")`);
      }

      selectClause = `${expr} AS value`;

      const baseFact = facts[0];
      fromClause = `"${baseFact.table_name}"`; // Always include base table

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
      // Fact Flow (modified to handle multiple factIds)
      if (!factIds || !Array.isArray(factIds) || factIds.length === 0) {
        return res.status(400).json({ error: "Invalid or missing factIds" });
      }

      const facts = await db.all(
        `SELECT * FROM facts WHERE id IN (${factIds.map(() => "?").join(",")})`,
        [...factIds]
      );
      if (facts.length !== factIds.length) {
        return res.status(400).json({ error: "One or more invalid factIds" });
      }

      let dimensions = await db.all(
        `SELECT d.*, fd.join_table, fd.fact_column, fd.dimension_column 
         FROM fact_dimensions fd
         JOIN dimensions d ON fd.dimension_id = d.id
         WHERE fd.fact_id IN (${factIds
           .map(() => "?")
           .join(",")}) AND d.id IN (${uniqueDimensionIds
          .map(() => "?")
          .join(",")})`,
        [...factIds, ...uniqueDimensionIds]
      );

      // Auto-detect joins if no mapping found
      if (dimensions.length < uniqueDimensionIds.length * factIds.length) {
        const factTables = [...new Set(facts.map((f) => f.table_name))];
        const factColumnsByTable = {};

        for (const table of factTables) {
          const factColumnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
            [table]
          );
          factColumnsByTable[table] = factColumnsResult.rows.map(
            (row) => row.column_name
          );
        }

        for (const dimId of uniqueDimensionIds) {
          const existingDim = dimensions.find((d) => d.id === dimId);
          if (
            existingDim &&
            facts.every((f) =>
              dimensions.some((d) => d.id === dimId && d.fact_id === f.id)
            )
          )
            continue;

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

          for (const fact of facts) {
            const factColumns = factColumnsByTable[fact.table_name];
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
                fact_id: fact.id,
              });
            } else if (dim.table_name === fact.table_name) {
              dimensions.push({
                ...dim,
                join_table: dim.table_name,
                fact_column: dim.column_name,
                dimension_column: dim.column_name,
                fact_id: fact.id,
              });
            }
          }
        }
      }

      if (uniqueDimensionIds.length > 0 && dimensions.length === 0) {
        return res.status(400).json({ error: "No valid dimensions found" });
      }

      // Use the first fact's table as the base table for joins
      const baseFact = facts[0];
      fromClause = `"${baseFact.table_name}"`;
      const seenJoins = new Set();
      const dimColumns = [];

      dimensions.forEach((d) => {
        const table = d.join_table || d.table_name;
        const col = `"${table}"."${d.column_name}" AS "${d.column_name}"`;
        if (!dimColumns.includes(col)) {
          dimColumns.push(col);
        }

        if (
          table !== baseFact.table_name &&
          !seenJoins.has(`${table}.${d.column_name}`)
        ) {
          seenJoins.add(`${table}.${d.column_name}`);
          fromClause += ` LEFT JOIN "${table}" ON "${table}"."${d.dimension_column}" = "${baseFact.table_name}"."${d.fact_column}"`;
        }
      });

      // Generate select clause for multiple facts
      const aggFunc = aggregation || facts[0].aggregate_function || "SUM";
      selectClause = facts
        .map(
          (f) =>
            `${aggFunc}("${f.table_name}"."${f.column_name}") AS "${f.name}"`
        )
        .join(", ");

      if (dimColumns.length > 0) {
        dimSelects = dimColumns.join(", ");
        groupByClause = dimensions
          .map((d) => `"${d.join_table || d.table_name}"."${d.column_name}"`)
          .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
          .join(", ");
      }
    }

    const sql = `
      SELECT ${selectClause}${dimSelects ? ", " + dimSelects : ""}
      FROM ${fromClause}
      ${groupByClause ? "GROUP BY " + groupByClause : ""}
    `.trim();

    console.log("Generated SQL:", sql); // For debugging

    const result = await pool.query(sql);
    const rows = result.rows;

    res.json({ sql, rows });
  } catch (err) {
    console.error("Analytics query error:", err.message, err.stack); // Improved logging
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

export default router;

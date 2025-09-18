// routes/analytics.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
import {
  getPoolForConnection,
  quoteIdentifier,
} from "../database/connection.js";

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
    const client = await pool.connect();
    const db = await dbPromise;

    let selectClause = "";
    let fromClause = "";
    let groupByClause = "";
    let dimSelects = "";

    const uniqueDimensionIds = [...new Set(dimensionIds)];
    const quote = (name) => quoteIdentifier(name, type);

    function getSqlAggregate(agg, col) {
      const upperAgg = agg.toUpperCase();
      switch (upperAgg) {
        case "SUM":
        case "AVG":
        case "MIN":
        case "MAX":
          return `${upperAgg}(${col})`;
        case "COUNT":
          return `COUNT(${col})`;
        case "MEDIAN":
          return `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${col})`;
        case "STDDEV":
          return `STDDEV_POP(${col})`;
        case "VARIANCE":
          return `VAR_POP(${col})`;
        default:
          return `${upperAgg}(${col})`;
      }
    }

    try {
      if (kpiId) {
        // KPI Flow
        const kpi = await db.get(
          "SELECT * FROM kpis WHERE id = ? AND connection_id = ?",
          [kpiId, connection_id]
        );
        if (!kpi) return res.status(400).json({ error: "Invalid kpiId" });

        const facts = await db.all(
          "SELECT * FROM facts WHERE connection_id = ?",
          [connection_id]
        );
        if (facts.length === 0) {
          return res
            .status(400)
            .json({ error: "No facts available to build KPI" });
        }

        let expr = kpi.expression;
        for (const f of facts) {
          const regex = new RegExp(`\\b${f.name}\\b`, "gi");
          const col = `${quote(f.table_name)}.${quote(f.column_name)}`;
          const aggExpr = getSqlAggregate(f.aggregate_function, col);
          expr = expr.replace(regex, aggExpr);
        }

        selectClause = `${expr} AS value`;
        const baseFact = facts[0];
        fromClause = `${quote(baseFact.table_name)}`;

        if (uniqueDimensionIds.length > 0) {
          let dimensions = await db.all(
            `SELECT d.*, fd.join_table, fd.fact_column, fd.dimension_column 
             FROM fact_dimensions fd
             JOIN dimensions d ON fd.dimension_id = d.id
             WHERE fd.fact_id = ? AND d.id IN (${uniqueDimensionIds
               .map(() => "?")
               .join(",")}) AND d.connection_id = ?`,
            [baseFact.id, ...uniqueDimensionIds, connection_id]
          );

          // Auto-detect joins if no mapping found
          if (dimensions.length === 0) {
            let factColumnsQuery =
              type === "postgres"
                ? `SELECT column_name FROM information_schema.columns WHERE table_name = $1`
                : `SELECT column_name FROM information_schema.columns WHERE table_name = ?`;
            const factColumnsResult = await client.query(factColumnsQuery, [
              baseFact.table_name,
            ]);
            const factColumns = (
              factColumnsResult.rows || factColumnsResult[0]
            ).map((row) => row.column_name);

            for (const dimId of uniqueDimensionIds) {
              const dim = await db.get(
                "SELECT * FROM dimensions WHERE id = ? AND connection_id = ?",
                [dimId, connection_id]
              );
              if (!dim) continue;

              const dimTableColumnsResult = await client.query(
                factColumnsQuery,
                [dim.table_name]
              );
              const dimTableColumns = (
                dimTableColumnsResult.rows || dimTableColumnsResult[0]
              ).map((row) => row.column_name);

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

          if (dimensions.length === 0) {
            return res.status(400).json({ error: "No valid dimensions found" });
          }

          const seenJoins = new Set();
          const dimColumns = [];

          dimensions.forEach((d) => {
            const table = d.join_table || d.table_name;
            const col = `${quote(table)}.${quote(d.column_name)} AS ${quote(
              d.column_name
            )}`;
            if (!dimColumns.includes(col)) {
              dimColumns.push(col);
            }

            if (
              table !== baseFact.table_name &&
              !seenJoins.has(`${table}.${d.column_name}`)
            ) {
              seenJoins.add(`${table}.${d.column_name}`);
              fromClause += ` LEFT JOIN ${quote(table)} ON ${quote(
                table
              )}.${quote(d.dimension_column)} = ${quote(
                baseFact.table_name
              )}.${quote(d.fact_column)}`;
            }
          });

          if (dimColumns.length > 0) {
            dimSelects = dimColumns.join(", ");
            groupByClause = dimensions
              .map(
                (d) =>
                  `${quote(d.join_table || d.table_name)}.${quote(
                    d.column_name
                  )}`
              )
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(", ");
          }
        }

        const sql = `
          SELECT ${selectClause}${dimSelects ? ", " + dimSelects : ""}
          FROM ${fromClause}
          ${groupByClause ? "GROUP BY " + groupByClause : ""}
        `.trim();

        console.log("Generated SQL:", sql);

        const result = await client.query(sql);
        const rows = result.rows || result[0];

        res.json({ sql, rows });
      } else if (factIds && factIds.length > 0) {
        // Fact Flow
        const facts = await db.all(
          `SELECT * FROM facts WHERE id IN (${factIds
            .map(() => "?")
            .join(",")}) AND connection_id = ?`,
          [...factIds, connection_id]
        );
        if (facts.length === 0) {
          return res.status(400).json({ error: "No valid facts found" });
        }

        const factTables = [...new Set(facts.map((f) => f.table_name))];

        let dimensions = [];
        if (uniqueDimensionIds.length > 0) {
          dimensions = await db.all(
            `SELECT d.*, fd.join_table, fd.fact_column, fd.dimension_column 
             FROM fact_dimensions fd
             JOIN dimensions d ON fd.dimension_id = d.id
             WHERE fd.fact_id IN (${factIds
               .map(() => "?")
               .join(",")}) AND d.id IN (${uniqueDimensionIds
              .map(() => "?")
              .join(",")}) AND d.connection_id = ?`,
            [...factIds, ...uniqueDimensionIds, connection_id]
          );

          const factColumnsByTable = {};
          let columnsQuery =
            type === "postgres"
              ? `SELECT column_name FROM information_schema.columns WHERE table_name = $1`
              : `SELECT column_name FROM information_schema.columns WHERE table_name = ?`;

          for (const table of factTables) {
            const factColumnsResult = await client.query(columnsQuery, [table]);
            factColumnsByTable[table] = (
              factColumnsResult.rows || factColumnsResult[0]
            ).map((row) => row.column_name);
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

            const dim = await db.get(
              "SELECT * FROM dimensions WHERE id = ? AND connection_id = ?",
              [dimId, connection_id]
            );
            if (!dim) continue;

            const dimTableColumnsResult = await client.query(columnsQuery, [
              dim.table_name,
            ]);
            const dimTableColumns = (
              dimTableColumnsResult.rows || dimTableColumnsResult[0]
            ).map((row) => row.column_name);

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

        const baseFact = facts[0];
        fromClause = `${quote(baseFact.table_name)}`;
        const seenJoins = new Set();
        const dimColumns = [];

        dimensions.forEach((d) => {
          const table = d.join_table || d.table_name;
          const col = `${quote(table)}.${quote(d.column_name)} AS ${quote(
            d.column_name
          )}`;
          if (!dimColumns.includes(col)) {
            dimColumns.push(col);
          }

          if (
            table !== baseFact.table_name &&
            !seenJoins.has(`${table}.${d.column_name}`)
          ) {
            seenJoins.add(`${table}.${d.column_name}`);
            fromClause += ` LEFT JOIN ${quote(table)} ON ${quote(
              table
            )}.${quote(d.dimension_column)} = ${quote(
              baseFact.table_name
            )}.${quote(d.fact_column)}`;
          }
        });

        const aggFunc = aggregation || facts[0].aggregate_function || "SUM";
        selectClause = facts
          .map((f) => {
            const col = `${quote(f.table_name)}.${quote(f.column_name)}`;
            const aggExpr = getSqlAggregate(aggFunc, col);
            return `${aggExpr} AS ${quote(f.name)}`;
          })
          .join(", ");

        if (dimColumns.length > 0) {
          dimSelects = dimColumns.join(", ");
          groupByClause = dimensions
            .map(
              (d) =>
                `${quote(d.join_table || d.table_name)}.${quote(d.column_name)}`
            )
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", ");
        }

        const sql = `
          SELECT ${selectClause}${dimSelects ? ", " + dimSelects : ""}
          FROM ${fromClause}
          ${groupByClause ? "GROUP BY " + groupByClause : ""}
        `.trim();

        console.log("Generated SQL:", sql);

        const result = await client.query(sql);
        const rows = result.rows || result[0];

        res.json({ sql, rows });
      } else {
        return res.status(400).json({ error: "factIds or kpiId required" });
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Analytics query error:", err.message, err.stack);
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

export default router;

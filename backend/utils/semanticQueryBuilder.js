
import { quoteIdentifier } from "../database/connection.js";

/**
 * Helper to get SQL aggregate function string
 */
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

/**
 * Builds a semantic query based on facts, dimensions, or KPIs.
 * 
 * @param {object} params
 * @param {object} params.db - SQLite database instance (for metadata lookups)
 * @param {object} params.client - Database client (for schema lookups)
 * @param {string} params.type - Database type ('postgres' or 'mysql')
 * @param {number} params.connection_id - Connection ID
 * @param {number[]} [params.factIds] - Array of fact IDs
 * @param {number[]} [params.dimensionIds] - Array of dimension IDs
 * @param {number} [params.kpiId] - KPI ID
 * @param {string} [params.aggregation] - Optional override for aggregation
 * 
 * @returns {Promise<{sql: string}>}
 */
export async function buildSemanticQuery({
    db,
    client,
    type,
    connection_id,
    factIds,
    dimensionIds = [],
    kpiId,
    aggregation,
}) {
    let selectClause = "";
    let fromClause = "";
    let groupByClause = "";
    let dimSelects = "";

    const uniqueDimensionIds = [...new Set(dimensionIds)];
    const quote = (name) => quoteIdentifier(name, type);

    if (kpiId) {
        // KPI Flow
        const kpi = await db.get(
            "SELECT * FROM kpis WHERE id = ? AND connection_id = ?",
            [kpiId, connection_id]
        );
        if (!kpi) throw new Error("Invalid kpiId");

        const facts = await db.all(
            "SELECT * FROM facts WHERE connection_id = ?",
            [connection_id]
        );
        if (facts.length === 0) {
            throw new Error("No facts available to build KPI");
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
                throw new Error("No valid dimensions found");
            }

            // Group dimensions by table and join each table only once
            const tableToDimensions = {};
            dimensions.forEach((d) => {
                const table = d.join_table || d.table_name;
                if (!tableToDimensions[table]) {
                    tableToDimensions[table] = [];
                }
                tableToDimensions[table].push(d);
            });

            const dimColumns = [];
            const seenJoins = new Set();

            // Add dimension columns to SELECT clause
            dimensions.forEach((d) => {
                const table = d.join_table || d.table_name;
                const col = `${quote(table)}.${quote(d.column_name)} AS ${quote(
                    d.name
                )}`;
                if (!dimColumns.includes(col)) {
                    dimColumns.push(col);
                }
            });

            // Build joins - only one join per table
            Object.keys(tableToDimensions).forEach((table) => {
                if (table === baseFact.table_name) return; // Skip if same as base table

                const dimsForTable = tableToDimensions[table];
                const firstDim = dimsForTable[0];

                // Use the first dimension's join info for the table join
                const joinCondition = `${quote(table)}.${quote(
                    firstDim.dimension_column
                )}::text = ${quote(baseFact.table_name)}.${quote(
                    firstDim.fact_column
                )}::text`;

                if (!seenJoins.has(table)) {
                    seenJoins.add(table);
                    fromClause += ` LEFT JOIN ${quote(table)} ON ${joinCondition}`;
                }
            });

            if (dimColumns.length > 0) {
                dimSelects = dimColumns.join(", ");
                // Group by unique table.column combinations
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

        return { sql };

    } else if (factIds && factIds.length > 0) {
        // Fact Flow
        const facts = await db.all(
            `SELECT * FROM facts WHERE id IN (${factIds
                .map(() => "?")
                .join(",")}) AND connection_id = ?`,
            [...factIds, connection_id]
        );
        if (facts.length === 0) {
            throw new Error("No valid facts found");
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
            throw new Error("No valid dimensions found");
        }

        const baseFact = facts[0];
        fromClause = `${quote(baseFact.table_name)}`;

        // Group dimensions by table and join each table only once
        const tableToDimensions = {};
        dimensions.forEach((d) => {
            const table = d.join_table || d.table_name;
            if (!tableToDimensions[table]) {
                tableToDimensions[table] = [];
            }
            tableToDimensions[table].push(d);
        });

        const dimColumns = [];
        const seenJoins = new Set();

        // Add dimension columns to SELECT clause
        dimensions.forEach((d) => {
            const table = d.join_table || d.table_name;
            const col = `${quote(table)}.${quote(d.column_name)} AS ${quote(
                d.name
            )}`;
            if (!dimColumns.includes(col)) {
                dimColumns.push(col);
            }
        });

        // Build joins - only one join per table
        Object.keys(tableToDimensions).forEach((table) => {
            if (table === baseFact.table_name) return; // Skip if same as base table

            const dimsForTable = tableToDimensions[table];
            const firstDim = dimsForTable[0];

            // Use the first dimension's join info for the table join
            const joinCondition = `${quote(table)}.${quote(
                firstDim.dimension_column
            )}::text = ${quote(baseFact.table_name)}.${quote(
                firstDim.fact_column
            )}::text`;

            if (!seenJoins.has(table)) {
                seenJoins.add(table);
                fromClause += ` LEFT JOIN ${quote(table)} ON ${joinCondition}`;
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
            // Group by unique table.column combinations
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

        return { sql };
    } else {
        throw new Error("factIds or kpiId required");
    }
}

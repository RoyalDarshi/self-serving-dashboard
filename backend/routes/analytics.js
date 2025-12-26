// routes/analytics.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
import { getPoolForConnection } from "../database/connection.js";
import { buildSemanticQuery } from "../utils/semanticQueryBuilder.js";
import { safeAlias } from "../utils/sanitize.js";

const router = Router();

// routes/analytics.js
router.post("/query", async (req, res) => {
  try {
    const {
      connection_id,
      base_table,
      factIds = [],
      dimensionIds = [],
      aggregation,
    } = req.body;

    // if (!base_table) {
    //   return res.status(400).json({ error: "base_table is required" });
    // }

    const db = await dbPromise;

    const facts =
      factIds.length > 0
        ? await db.all(
            `SELECT id, name, table_name, column_name
             FROM facts WHERE id IN (${factIds.map(() => "?").join(",")})`,
            factIds
          )
        : [];

    const dimensions =
      dimensionIds.length > 0
        ? await db.all(
            `SELECT id, name, table_name, column_name, display_column
             FROM dimensions WHERE id IN (${dimensionIds
               .map(() => "?")
               .join(",")})`,
            dimensionIds
          )
        : [];
    
    // 🔥 AUTO-DETERMINE BASE TABLE (MULTI-TABLE SUPPORT)
    const resolvedBaseTable =
      facts.length > 0
        ? facts[0].table_name
        : dimensions.length > 0
        ? dimensions[0].table_name
        : base_table;

    if (!resolvedBaseTable) {
      return res.status(400).json({ error: "Unable to determine base table" });
    }


    const select = [];
    const group_by = [];

    dimensions.forEach((d) => {
      const keyCol = `${d.table_name}.${d.column_name}`; // sales_id
      const displayCol = d.display_column
        ? `${d.table_name}.${d.display_column}` // pod
        : keyCol;

      const alias = safeAlias(d.name);

      // ✅ SELECT uses display column
      select.push(`${d.table_name}.${d.display_column || d.column_name} AS ${alias}`);

      // ✅ GROUP BY uses key column
      group_by.push(keyCol);
    });

    facts.forEach((f) => {
      const alias = safeAlias(f.name); // 👈 FIX

      select.push(
        `${aggregation}(${f.table_name}.${f.column_name}) AS ${alias}`
      );
    });

    const { sql, params } = await buildSemanticQuery({
      connection_id,
      base_table: resolvedBaseTable,
      select,
      group_by,
    });


    // ✅ EXECUTE ON SOURCE DB (FIX)
    const { pool, type } = await getPoolForConnection(connection_id);

    let rows;
    if (type === "postgres") {
      const result = await pool.query(sql, params);
      rows = result.rows;
    } else if (type === "mysql") {
      const [result] = await pool.query(sql, params);
      rows = result;
    }

    res.json({ sql, rows });
  } catch (err) {
    console.error("Analytics query error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

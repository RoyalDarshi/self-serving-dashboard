// routes/analytics.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
import { getPoolForConnection } from "../database/connection.js";
import { buildSemanticQuery } from "../utils/semanticQueryBuilder.js";

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

    if (!base_table) {
      return res.status(400).json({ error: "base_table is required" });
    }

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
            `SELECT id, name, table_name, column_name
             FROM dimensions WHERE id IN (${dimensionIds
               .map(() => "?")
               .join(",")})`,
            dimensionIds
          )
        : [];

    const select = [];
    const group_by = [];

    dimensions.forEach((d) => {
      const col = `${d.table_name}.${d.column_name}`;
      select.push(col);
      group_by.push(col);
    });

    facts.forEach((f) => {
      select.push(
        `${aggregation}(${f.table_name}.${f.column_name}) AS ${f.name}`
      );
    });

    const { sql, params } = await buildSemanticQuery({
      connection_id,
      base_table,
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

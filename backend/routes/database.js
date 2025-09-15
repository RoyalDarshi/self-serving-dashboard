// routes/database.js
import { Router } from "express";
import { getPoolForConnection } from "../database/connection.js";

const router = Router();

router.get("/schemas", async (req, res) => {
  const { connection_id } = req.query;
  if (!connection_id) {
    return res
      .status(400)
      .json({ success: false, error: "connection_id required" });
  }

  try {
    const { pool, type, selected_db } = await getPoolForConnection(
      connection_id,
      req.user?.userId
    );
    const client = await pool.connect();
    try {
      let tablesResult;
      if (type === "postgres") {
        tablesResult = await client.query(
          `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = $1
        `,
          [selected_db]
        );
      } else if (type === "mysql") {
        tablesResult = await client.query(
          `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = ?
        `,
          [selected_db]
        );
      }

      const schemas = [];
      for (const { table_name } of tablesResult.rows || tablesResult[0]) {
        let columnsResult;
        if (type === "postgres") {
          columnsResult = await client.query(
            `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            `,
            [selected_db, table_name]
          );
        } else if (type === "mysql") {
          columnsResult = await client.query(
            `
            SELECT column_name, data_type, is_nullable, column_default, column_key
            FROM information_schema.columns
            WHERE table_schema = ? AND table_name = ?
            `,
            [selected_db, table_name]
          );
        }

        schemas.push({
          tableName: table_name,
          columns: (columnsResult.rows || columnsResult[0]).map((col) => ({
            name: col.column_name,
            type: col.data_type.toUpperCase(),
            notnull: col.is_nullable === "NO" ? 1 : 0,
            pk:
              type === "postgres"
                ? col.column_default && col.column_default.includes("nextval")
                  ? 1
                  : 0
                : col.column_key === "PRI"
                ? 1
                : 0,
          })),
        });
      }
      res.json({ success: true, schemas });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching schemas:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch schemas" });
  }
});

export default router;

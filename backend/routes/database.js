import { Router } from "express";
import { sourceDbPromise } from "../database/postgresConnection.js";

const router = Router();

router.get("/schemas", async (req, res) => {
  try {
    console.log("Fetching source DB schemas...");
    console.log(sourceDbPromise)
    const client = await sourceDbPromise.connect();
    try {
      const tablesResult = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);
      const schemas = [];
      for (const { table_name } of tablesResult.rows) {
        const columnsResult = await client.query(
          `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
        `,
          [table_name]
        );
        schemas.push({
          tableName: table_name,
          columns: columnsResult.rows.map((col) => ({
            name: col.column_name,
            type: col.data_type.toUpperCase(),
            notnull: col.is_nullable === "NO" ? 1 : 0,
            pk:
              col.column_default && col.column_default.includes("nextval")
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

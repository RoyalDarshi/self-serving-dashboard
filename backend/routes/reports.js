import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
import {
  getPoolForConnection,
  quoteIdentifier,
} from "../database/connection.js";

const router = Router();

/**
 * CREATE REPORT
 */
router.post("/save", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { name, description, connection_id, base_table, columns, filters } =
    req.body;

  if (!name || !connection_id || !base_table) {
    return res
      .status(400)
      .json({ error: "name, connection_id and base_table are required" });
  }

  try {
    await db.run("BEGIN TRANSACTION");

    const result = await db.run(
      `INSERT INTO reports (user_id, connection_id, name, description, base_table)
       VALUES (?, ?, ?, ?, ?)`,
      [user.userId, connection_id, name, description || null, base_table]
    );
    const reportId = result.lastID;

    for (const col of columns || []) {
      await db.run(
        `INSERT INTO report_columns (report_id, column_name, alias, data_type, visible, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          col.column_name,
          col.alias || null,
          col.data_type || null,
          col.visible ? 1 : 0,
          col.order_index || 0,
        ]
      );
    }

    for (const f of filters || []) {
      await db.run(
        `INSERT INTO report_filters (report_id, column_name, operator, value, is_user_editable, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          f.column_name,
          f.operator,
          JSON.stringify(f.value),
          f.is_user_editable ? 1 : 0,
          f.order_index || 0,
        ]
      );
    }

    await db.run("COMMIT");
    res.json({ success: true, reportId });
  } catch (err) {
    await db.run("ROLLBACK");
    console.error("Create report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * UPDATE REPORT
 */
router.put("/:id", async (req, res) => {
  const db = await dbPromise;
  const { id } = req.params;
  const { name, description, columns, filters } = req.body;

  try {
    await db.run("BEGIN TRANSACTION");

    await db.run(
      `UPDATE reports SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, description || null, id]
    );

    await db.run(`DELETE FROM report_columns WHERE report_id = ?`, [id]);
    for (const col of columns || []) {
      await db.run(
        `INSERT INTO report_columns (report_id, column_name, alias, data_type, visible, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          col.column_name,
          col.alias || null,
          col.data_type || null,
          col.visible ? 1 : 0,
          col.order_index || 0,
        ]
      );
    }

    await db.run(`DELETE FROM report_filters WHERE report_id = ?`, [id]);
    for (const f of filters || []) {
      await db.run(
        `INSERT INTO report_filters (report_id, column_name, operator, value, is_user_editable, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          f.column_name,
          f.operator,
          JSON.stringify(f.value),
          f.is_user_editable ? 1 : 0,
          f.order_index || 0,
        ]
      );
    }

    await db.run("COMMIT");
    res.json({ success: true, message: "Report updated" });
  } catch (err) {
    await db.run("ROLLBACK");
    console.error("Update report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * LIST REPORTS
 */
router.get("/list", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;

  try {
    const reports = await db.all(
      `SELECT id, name, description, connection_id, base_table, created_at, updated_at
       FROM reports
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [user.userId]
    );
    res.json(reports);
  } catch (err) {
    console.error("List reports error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * RUN REPORT (dynamic filters)
 */
router.get("/run", async (req, res) => {
  console.log("Run report request received with query:", req.query);
  const db = await dbPromise;
  const { reportId, ...runtimeFilters } = req.query;
  console.log("Running report:", reportId, "with filters:", runtimeFilters);

  try {
    const report = await db.get(`SELECT * FROM reports WHERE id = ?`, [
      reportId,
    ]);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const columns = await db.all(
      `SELECT column_name FROM report_columns WHERE report_id = ? AND visible = 1 ORDER BY order_index`,
      [reportId]
    );

    const storedFilters = await db.all(
      `SELECT column_name, operator, value FROM report_filters WHERE report_id = ?`,
      [reportId]
    );

    const { pool, type } = await getPoolForConnection(
      report.connection_id,
      req.user?.userId
    );
    const client = await pool.connect();
    const quote = (v) => quoteIdentifier(v, type);

    let where = [];

    // Stored filters from DB
    for (const f of storedFilters) {
      const v = JSON.parse(f.value);
      if (Array.isArray(v)) {
        where.push(
          `${quote(f.column_name)} IN (${v.map((v2) => `'${v2}'`).join(",")})`
        );
      } else {
        where.push(`${quote(f.column_name)} ${f.operator} '${v}'`);
      }
    }

    // Runtime filters from query params
    for (const [col, val] of Object.entries(runtimeFilters)) {
      where.push(`${quote(col)} = '${val}'`);
    }

    const sql = `
      SELECT ${columns.map((c) => quote(c.column_name)).join(", ")}
      FROM ${quote(report.base_table)}
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
    `.trim();

    const result = await client.query(sql);
    const rows = result.rows || result[0];
    client.release();

    res.json({ sql, rows });
  } catch (err) {
    console.error("Run report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET FULL REPORT CONFIG
 */
router.get("/:id", async (req, res) => {
  const db = await dbPromise;
  const { id } = req.params;
  console.log("Fetching report with ID:", id);

  try {
    const report = await db.get(`SELECT * FROM reports WHERE id = ?`, [id]);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const columns = await db.all(
      `SELECT * FROM report_columns WHERE report_id = ? ORDER BY order_index`,
      [id]
    );
    const filters = await db.all(
      `SELECT * FROM report_filters WHERE report_id = ? ORDER BY order_index`,
      [id]
    );
    const drillTargets = await db.all(
      `SELECT * FROM report_drillthrough WHERE parent_report_id = ?`,
      [id]
    );

    res.json({ report, columns, filters, drillTargets });
  } catch (err) {
    console.error("Fetch report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET DRILL-THROUGH CONFIGURATION
 */
router.get("/:id/drill-config", async (req, res) => {
  const db = await dbPromise;
  const { id } = req.params;

  try {
    const config = await db.all(
      `SELECT target_report_id, mapping_json, label
       FROM report_drillthrough WHERE parent_report_id = ?`,
      [id]
    );
    res.json(config);
  } catch (err) {
    console.error("Fetch drill config error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE REPORT
 */
router.delete("/:id", async (req, res) => {
  const db = await dbPromise;
  const { id } = req.params;

  try {
    await db.run(`DELETE FROM reports WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

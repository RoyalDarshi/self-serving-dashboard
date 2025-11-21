// routes/reports.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
import {
  getPoolForConnection,
  quoteIdentifier,
} from "../database/connection.js";

const router = Router();

// ==================================================================
// 1. STATIC ROUTES (Must come BEFORE /:id)
// ==================================================================

/**
 * LIST REPORTS
 */
router.get("/list", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  try {
    let reports;
    if (user.role === "admin") {
      reports = await db.all(`
        SELECT r.id, r.name, r.description, r.connection_id, r.base_table, r.created_at, r.updated_at, 
               u.username as creator_name
        FROM reports r
        LEFT JOIN users u ON r.user_id = u.id
        ORDER BY r.updated_at DESC
      `);
    } else {
      reports = await db.all(
        `
        SELECT DISTINCT r.id, r.name, r.description, r.connection_id, r.base_table, r.created_at, r.updated_at,
               u.username as creator_name
        FROM reports r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN connection_designations cd ON r.connection_id = cd.connection_id
        WHERE r.user_id = ? OR cd.designation = ?
        ORDER BY r.updated_at DESC
      `,
        [user.userId, user.designation]
      );
    }
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * RUN REPORT (Moved UP to prevent conflict with /:id)
 */
router.get("/run", async (req, res) => {
  const db = await dbPromise;
  const { reportId, ...runtimeFilters } = req.query;
  const { user } = req;

  try {
    const report = await db.get(`SELECT * FROM reports WHERE id = ?`, [
      reportId,
    ]);
    if (!report) return res.status(404).json({ error: "Report not found" });

    if (user.role !== "admin" && report.user_id !== user.userId) {
      const accessCheck = await db.get(
        `SELECT count(*) as count FROM connection_designations WHERE connection_id = ? AND designation = ?`,
        [report.connection_id, user.designation]
      );
      if (!accessCheck || accessCheck.count === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

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

    for (const f of storedFilters) {
      const v = JSON.parse(f.value);
      if (Array.isArray(v)) {
        where.push(
          `${quote(f.column_name)} IN (${v.map((v2) => `'${v2}'`).join(",")})`
        );
      } else {
        if (v !== "")
          where.push(`${quote(f.column_name)} ${f.operator} '${v}'`);
      }
    }

    for (const [col, val] of Object.entries(runtimeFilters)) {
      if (val !== "") where.push(`${quote(col)} = '${val}'`);
    }

    const selectClause =
      columns.length > 0
        ? columns.map((c) => quote(c.column_name)).join(", ")
        : "*";

    const sql = `
      SELECT ${selectClause}
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
 * SAVE REPORT (Also static, keep it high up)
 */
router.post("/save", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const {
    name,
    description,
    connection_id,
    base_table,
    columns,
    filters,
    visualization_config,
    drillTargets,
  } = req.body;

  if (!name || !connection_id || !base_table) {
    return res
      .status(400)
      .json({ error: "name, connection_id and base_table are required" });
  }

  if (user.role !== "admin") {
    const accessCheck = await db.get(
      `SELECT count(*) as count FROM connection_designations WHERE connection_id = ? AND designation = ?`,
      [connection_id, user.designation]
    );
    if (!accessCheck || accessCheck.count === 0) {
      return res
        .status(403)
        .json({ error: "You do not have access to this connection" });
    }
  }

  try {
    await db.run("BEGIN TRANSACTION");

    const result = await db.run(
      `INSERT INTO reports (user_id, connection_id, name, description, base_table, visualization_config)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        user.userId,
        connection_id,
        name,
        description || null,
        base_table,
        JSON.stringify(visualization_config || {}),
      ]
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

    if (drillTargets && drillTargets.length > 0) {
      for (const dt of drillTargets) {
        await db.run(
          `INSERT INTO report_drillthrough (parent_report_id, target_report_id, mapping_json)
           VALUES (?, ?, ?)`,
          [reportId, dt.target_report_id, JSON.stringify(dt.mapping_json)]
        );
      }
    }

    await db.run("COMMIT");
    res.json({ success: true, reportId });
  } catch (err) {
    await db.run("ROLLBACK");
    res.status(500).json({ error: err.message });
  }
});

// ==================================================================
// 2. DYNAMIC ROUTES (Must come AFTER static routes)
// ==================================================================

/**
 * GET REPORT CONFIG (Dynamic ID)
 */
router.get("/:id", async (req, res) => {
  const db = await dbPromise;
  const { id } = req.params;
  const { user } = req;

  try {
    const report = await db.get(`SELECT * FROM reports WHERE id = ?`, [id]);
    if (!report) return res.status(404).json({ error: "Report not found" });

    if (user.role !== "admin" && report.user_id !== user.userId) {
      const accessCheck = await db.get(
        `SELECT count(*) as count FROM connection_designations WHERE connection_id = ? AND designation = ?`,
        [report.connection_id, user.designation]
      );
      if (!accessCheck || accessCheck.count === 0) {
        return res.status(403).json({
          error: "You do not have access to this report's connection",
        });
      }
    }

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
    res.status(500).json({ error: err.message });
  }
});

/**
 * UPDATE REPORT (Dynamic ID)
 */
router.put("/:id", async (req, res) => {
  const db = await dbPromise;
  const { id } = req.params;
  const { user } = req;
  const {
    name,
    description,
    columns,
    filters,
    visualization_config,
    drillTargets,
  } = req.body;

  try {
    const report = await db.get("SELECT user_id FROM reports WHERE id = ?", [
      id,
    ]);
    if (!report) return res.status(404).json({ error: "Report not found" });

    if (user.role !== "admin" && report.user_id !== user.userId) {
      return res
        .status(403)
        .json({ error: "Only the creator or admin can edit this report" });
    }

    await db.run("BEGIN TRANSACTION");

    await db.run(
      `UPDATE reports SET name = ?, description = ?, visualization_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [
        name,
        description || null,
        JSON.stringify(visualization_config || {}),
        id,
      ]
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

    await db.run(`DELETE FROM report_drillthrough WHERE parent_report_id = ?`, [
      id,
    ]);
    if (drillTargets && drillTargets.length > 0) {
      for (const dt of drillTargets) {
        await db.run(
          `INSERT INTO report_drillthrough (parent_report_id, target_report_id, mapping_json)
                 VALUES (?, ?, ?)`,
          [id, dt.target_report_id, JSON.stringify(dt.mapping_json)]
        );
      }
    }

    await db.run("COMMIT");
    res.json({ success: true, message: "Report updated" });
  } catch (err) {
    await db.run("ROLLBACK");
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE REPORT (Dynamic ID)
 */
router.delete("/:id", async (req, res) => {
  const db = await dbPromise;
  const { id } = req.params;
  const { user } = req;
  try {
    const report = await db.get("SELECT user_id FROM reports WHERE id = ?", [
      id,
    ]);
    if (!report) return res.status(404).json({ error: "Report not found" });

    if (user.role !== "admin" && report.user_id !== user.userId) {
      return res
        .status(403)
        .json({ error: "Only the creator or admin can delete this report" });
    }

    await db.run(`DELETE FROM reports WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET DRILL CONFIG (Specific sub-path, usually fine after :id if distinct, but safer before :id if possible.
 * However, since it has extra segments /:id/drill-config, Express distinguishes it from just /:id unless strict routing issues occur.
 * Ideally, place BEFORE /:id too if you encounter issues, but Express handles specific subpaths well.)
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
    res.status(500).json({ error: err.message });
  }
});

export default router;

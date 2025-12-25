// routes/reports.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
import {
  getPoolForConnection,
  quoteIdentifier,
} from "../database/connection.js";
import { buildSemanticQuery } from "../utils/semanticQueryBuilder.js";
import { safeAlias } from "../utils/sanitize.js";

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

  let client = null;
  let isPgClient = false;

  try {
    // --------------------------------------------------
    // 1. LOAD REPORT
    // --------------------------------------------------
    const report = await db.get(`SELECT * FROM reports WHERE id = ?`, [
      reportId,
    ]);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // --------------------------------------------------
    // 2. ACCESS CHECK
    // --------------------------------------------------
    if (user.role !== "admin" && report.user_id !== user.userId) {
      const accessCheck = await db.get(
        `SELECT count(*) as count
         FROM connection_designations
         WHERE connection_id = ? AND designation = ?`,
        [report.connection_id, user.designation]
      );
      if (!accessCheck || accessCheck.count === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // --------------------------------------------------
    // 3. GET DB CLIENT
    // --------------------------------------------------
    const { pool, type } = await getPoolForConnection(
      report.connection_id,
      user?.userId
    );

    if (type === "postgres") {
      client = await pool.connect();
      isPgClient = true;
    } else {
      client = pool; // mysql / sqlite
    }

    const quote = (v) => quoteIdentifier(v, type);

    // --------------------------------------------------
    // 4. BUILD COLUMN MAP (ALIAS → REAL COLUMN)
    // --------------------------------------------------
    const reportColumnRows = await db.all(
      `SELECT column_name, alias
       FROM report_columns
       WHERE report_id = ?`,
      [reportId]
    );

    const columnMap = {};
    for (const c of reportColumnRows) {
      if (c.alias) {
        columnMap[c.alias.toLowerCase()] = c.column_name;
      }
      columnMap[c.column_name.toLowerCase()] = c.column_name;
    }

    // ==================================================
    // =============== SEMANTIC REPORT ==================
    // ==================================================
    if (report.base_table === "SEMANTIC") {
      const vizConfig = JSON.parse(report.visualization_config || "{}");
      const { factIds, dimensionIds, kpiId, aggregation } = vizConfig;

      const factId = factIds?.[0] || (kpiId ? Number(kpiId) : null);
      if (!factId) {
        return res
          .status(400)
          .json({ error: "Semantic report requires at least one fact" });
      }

      // Resolve base table from facts
      const factRow = await db.get(
        `SELECT table_name FROM facts WHERE id = ?`,
        [factId]
      );
      if (!factRow?.table_name) {
        return res
          .status(400)
          .json({ error: "Invalid fact configuration" });
      }

      const resolvedBaseTable = factRow.table_name;

      // Build INNER semantic SQL
      const { sql: baseSql } = await buildSemanticQuery({
        db,
        client,
        type,
        connection_id: report.connection_id,
        base_table: resolvedBaseTable,
        factIds,
        dimensionIds,
        kpiId,
        aggregation,
      });

      // Visible columns
      const columns = await db.all(
        `SELECT column_name, alias
         FROM report_columns
         WHERE report_id = ? AND visible = 1
         ORDER BY order_index`,
        [reportId]
      );

      // Runtime drill filters (RESOLVED)
      const where = [];
      for (const [col, val] of Object.entries(runtimeFilters)) {
        if (val !== "") {
          const resolvedCol = columnMap[col.toLowerCase()];
          if (!resolvedCol) continue;
          where.push(`${quote(resolvedCol)} = '${val}'`);
        }
      }

      // OUTER SELECT MUST USE safeAlias(real_column)
      let finalSql;
      if (columns.length > 0) {
        const selectClause = columns
          .map((c) => {
            const realCol = columnMap[c.column_name.toLowerCase()];
            const innerCol = safeAlias(realCol || c.column_name);
            return `${quote(innerCol)}${
              c.alias ? ` AS ${quote(c.alias)}` : ""
            }`;
          })
          .join(", ");

        finalSql = `SELECT ${selectClause} FROM (${baseSql}) AS sub`;
      } else {
        finalSql = `SELECT * FROM (${baseSql}) AS sub`;
      }

      if (where.length > 0) {
        finalSql += ` WHERE ${where.join(" AND ")}`;
      }

      let rows;
      if (type === "postgres") {
        const result = await client.query(finalSql);
        rows = result.rows;
      } else {
        const [result] = await client.query(finalSql);
        rows = result;
      }

      return res.json({ sql: finalSql, rows });
    }

    // ==================================================
    // ============ STANDARD TABLE REPORT ================
    // ==================================================
    const columns = await db.all(
      `SELECT column_name
       FROM report_columns
       WHERE report_id = ? AND visible = 1
       ORDER BY order_index`,
      [reportId]
    );

    const storedFilters = await db.all(
      `SELECT column_name, operator, value
       FROM report_filters
       WHERE report_id = ?`,
      [reportId]
    );

    const where = [];

    // Stored filters
    for (const f of storedFilters) {
      const v = JSON.parse(f.value);
      if (Array.isArray(v)) {
        where.push(
          `${quote(f.column_name)} IN (${v.map((x) => `'${x}'`).join(",")})`
        );
      } else if (v !== "") {
        where.push(`${quote(f.column_name)} ${f.operator} '${v}'`);
      }
    }

    // Runtime drill filters (RESOLVED)
    for (const [col, val] of Object.entries(runtimeFilters)) {
      if (val !== "") {
        const resolvedCol = columnMap[col.toLowerCase()];
        if (!resolvedCol) continue;
        where.push(`${quote(resolvedCol)} = '${val}'`);
      }
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

    let rows;
    if (type === "postgres") {
      const result = await client.query(sql);
      rows = result.rows;
    } else {
      const [result] = await client.query(sql);
      rows = result;
    }

    return res.json({ sql, rows });
  } catch (err) {
    console.error("Run report error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  } finally {
    if (isPgClient && client) {
      try {
        client.release();
      } catch {
        // ignore
      }
    }
  }
});



/**
 * SAVE REPORT (Also static, keep it high up)
 */
router.post("/save", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  let {
    name,
    description,
    connection_id,
    base_table,
    columns,
    filters,
    visualization_config,
    drillTargets,
  } = req.body;

  // Handle Semantic Reports: If base_table is missing but we have semantic config, set base_table to "SEMANTIC"
  if (
    !base_table &&
    visualization_config &&
    (visualization_config.factIds || visualization_config.kpiId)
  ) {
    base_table = "SEMANTIC";
  }

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

/**
 * PREVIEW REPORT (Runs query without saving)
 */
router.post("/preview", async (req, res) => {
  try {
    const {
      connection_id,
      base_table,
      visualization_config,
      columns = [],
      filters = [],
    } = req.body;

    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }

    // --------------------------------------------------
    // 1️⃣ RESOLVE BASE TABLE
    // --------------------------------------------------
    let resolvedBaseTable = base_table;

    if (base_table === "SEMANTIC") {
      const factIds = visualization_config?.factIds;

      if (!factIds || factIds.length === 0) {
        return res
          .status(400)
          .json({ error: "Semantic query requires at least one fact" });
      }

      // Get pool to read metadata
      // ✅ READ METADATA FROM SQLITE
      const db = await dbPromise;

      const factRow = await db.get(
        "SELECT table_name FROM facts WHERE id = ?",
        [factIds[0]]
      );

      if (!factRow?.table_name) {
        return res.status(400).json({ error: "Invalid fact selected" });
      }

      resolvedBaseTable = factRow.table_name;

      if (!factRow?.table_name) {
        return res.status(400).json({ error: "Invalid fact selected" });
      }

      resolvedBaseTable = factRow.table_name;
    }

    if (!resolvedBaseTable) {
      return res.status(400).json({ error: "base_table required" });
    }

    // --------------------------------------------------
    // 2️⃣ BUILD SELECT / GROUP BY (SAFE ALIASES ONLY)
    // --------------------------------------------------
    const visibleColumns = columns.filter((c) => c.visible !== false);

    const select = [];
    const group_by = [];

    for (const col of visibleColumns) {
      const alias = safeAlias(col.column_name);
      select.push(alias);

      if (col.dimensionId) {
        group_by.push(alias);
      }
    }

    // --------------------------------------------------
    // 3️⃣ BUILD INNER SEMANTIC QUERY
    // --------------------------------------------------
    const { sql, params } = await buildSemanticQuery({
      connection_id,
      base_table: resolvedBaseTable,
      select,
      filters,
      group_by,
    });

    // --------------------------------------------------
    // 4️⃣ OUTER QUERY (DISPLAY NAMES)
    // --------------------------------------------------
    const meta = await getPoolForConnection(connection_id);
    const { pool, type } = meta;

    const q = (n) => quoteIdentifier(n, type);

    const outerSelect = visibleColumns
      .map((c) => {
        const innerCol = q(safeAlias(c.column_name));
        return `${innerCol} AS ${q(c.column_name)}`;
      })
      .join(", ");

    const finalSQL = `
      SELECT ${outerSelect}
      FROM (
        ${sql}
      ) semantic_sub
    `;

    // --------------------------------------------------
    // 5️⃣ EXECUTE
    // --------------------------------------------------
    let rows;
    if (type === "postgres") {
      const r = await pool.query(finalSQL, params);
      rows = r.rows;
    } else {
      const [r] = await pool.query(finalSQL, params);
      rows = r;
    }

    return res.json({
      sql: finalSQL,
      data: rows,
    });
  } catch (err) {
    console.error("REPORT PREVIEW ERROR:", err);
    return res.status(500).json({ error: err.message });
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
 * GET DRILL CONFIG
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

/**
 * GET DRILL FIELDS
 * Returns available fields for drill-down based on report type.
 */
router.get("/:reportId/drill-fields", async (req, res) => {
  const db = await dbPromise;
  const { reportId } = req.params;
  const { user } = req;

  let client = null;
  let isPgClient = false;

  try {
    // ---------------- LOAD REPORT ----------------
    const report = await db.get(`SELECT * FROM reports WHERE id = ?`, [
      reportId,
    ]);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // ---------------- ACCESS CHECK ----------------
    if (user.role !== "admin" && report.user_id !== user.userId) {
      const accessCheck = await db.get(
        `SELECT count(*) as count
         FROM connection_designations
         WHERE connection_id = ? AND designation = ?`,
        [report.connection_id, user.designation]
      );

      if (!accessCheck || accessCheck.count === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // ---------------- DB CONNECTION ----------------
    const { pool, type } = await getPoolForConnection(
      report.connection_id,
      user?.userId
    );

    if (type === "postgres") {
      client = await pool.connect();
      isPgClient = true;
    } else {
      client = pool; // mysql2 / sqlite
    }

    // =================================================
    // 🔥 SEMANTIC REPORT DRILL FIELDS
    // =================================================
    if (report.base_table === "SEMANTIC") {
      const vizConfig = JSON.parse(report.visualization_config || "{}");
      const { factIds, dimensionIds } = vizConfig;

      if (!factIds?.length) {
        return res.json([]);
      }

      const factRow = await db.get(
        `SELECT table_name FROM facts WHERE id = ?`,
        [factIds[0]]
      );

      if (!factRow?.table_name) {
        return res.json([]);
      }

      // Fetch drillable dimensions
      const drillFields = await db.all(
        `
        SELECT
          d.name AS label,
          d.column_name AS column,
          d.table_name AS table_name
        FROM dimensions d
        WHERE d.id IN (${dimensionIds.map(() => "?").join(",")})
        `,
        dimensionIds
      );

      return res.json(drillFields);
    }

    // =================================================
    // 🔥 STANDARD TABLE REPORT DRILL FIELDS
    // =================================================
    const columns = await db.all(
      `
      SELECT column_name AS column, column_name AS label
      FROM report_columns
      WHERE report_id = ? AND visible = 1
      ORDER BY order_index
      `,
      [reportId]
    );

    return res.json(columns);
  } catch (err) {
    console.error("Drill fields error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  } finally {
    if (isPgClient && client) {
      try {
        client.release();
      } catch {
        // ignore
      }
    }
  }
});


export default router;

// routes/reports.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
import {
  getPoolForConnection,
  quoteIdentifier,
} from "../database/connection.js";
import { buildSemanticQuery } from "../utils/semanticQueryBuilder.js";
import { safeAlias } from "../utils/sanitize.js";
import { validateSelectSQL } from "../utils/sqlValidator.js";
import { extractSqlParams } from "../utils/sqlParams.js";

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
  const {
    reportId,
    mode = "table",
    page = 1,
    pageSize = 50,
    ...runtimeFilters
  } = req.query;

  if (!reportId) {
    return res.status(400).json({ error: "reportId required" });
  }

  try {
    // 1️⃣ Load report
    const report = await db.get(
      `SELECT * FROM reports WHERE id = ?`,
      [reportId]
    );
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // 2️⃣ SQL report
    if (report.report_type === "SQL") {
      validateSelectSQL(report.sql_text);

      const params = extractSqlParams(report.sql_text);
      const values = [];
      let finalSql = report.sql_text;

      for (const p of params) {
        if (!(p in runtimeFilters)) {
          return res.status(400).json({ error: `Missing parameter: ${p}` });
        }
        values.push(runtimeFilters[p]);
        finalSql = finalSql.replace(`:${p}`, "?");
      }

      finalSql += " LIMIT 1000";

      const { pool, type } = await getPoolForConnection(report.connection_id);
      const [rows] = type === "postgres"
        ? [ (await pool.query(finalSql, values)).rows ]
        : await pool.query(finalSql, values);

      return res.json({ sql: finalSql, rows });
    }

    // 3️⃣ Load columns + filters
    const columns = await db.all(
      `SELECT * FROM report_columns WHERE report_id = ? ORDER BY order_index`,
      [reportId]
    );

    const filtersFromDB = await db.all(
      `SELECT * FROM report_filters WHERE report_id = ? ORDER BY order_index`,
      [reportId]
    );

    // 4️⃣ Build FINAL FILTERS (ONLY from report_filters)
    const finalFilters = [];

    for (const f of filtersFromDB) {
      const runtimeVal = runtimeFilters[f.column_name];

      if (
        runtimeVal === "" ||
        runtimeVal === null ||
        runtimeVal === undefined
      ) {
        continue;
      }

      if (!f.table_name) {
        console.warn("Filter missing table_name:", f);
        continue;
      }

      finalFilters.push({
        column: `${f.table_name}.${f.column_name}`,
        operator: f.operator || "=",
        value: runtimeVal,
      });
    }

    // 5️⃣ Chart mode
    if (mode === "chart") {
      const dimensions = columns.filter(c => c.data_type !== "number");
      const measures = columns.filter(c => c.data_type === "number");

      if (!dimensions.length || !measures.length) {
        return res.status(400).json({
          error: "Chart requires at least 1 dimension and 1 measure",
        });
      }

      const select = [
        ...dimensions.map(c => `${c.table_name}.${c.column_name}`),
        ...measures.map(
          c => `SUM(${c.table_name}.${c.column_name}) AS ${safeAlias(c.column_name)}`
        ),
      ];

      const group_by = dimensions.map(
        c => `${c.table_name}.${c.column_name}`
      );

      const { sql, params } = await buildSemanticQuery({
        connection_id: report.connection_id,
        base_table: report.base_table,
        select,
        filters: finalFilters,
        group_by,
        limit: 1000,
      });

      const { pool, type } = await getPoolForConnection(report.connection_id);
      const [rows] = type === "postgres"
        ? [ (await pool.query(sql, params)).rows ]
        : await pool.query(sql, params);

      return res.json({ sql, data: rows });
    }

    // 6️⃣ Table mode
    const limit = Math.min(Number(pageSize), 100);
    const offset = (Number(page) - 1) * limit;

    const select = columns.map(
      c => `${c.table_name}.${c.column_name}`
    );

    const { sql, params } = await buildSemanticQuery({
      connection_id: report.connection_id,
      base_table: report.base_table,
      select,
      filters: finalFilters,
      limit,
      offset,
    });

    const { pool, type } = await getPoolForConnection(report.connection_id);
    const [rows] = type === "postgres"
      ? [ (await pool.query(sql, params)).rows ]
      : await pool.query(sql, params);

    return res.json({ sql, rows });
  } catch (err) {
    console.error("Run report error:", err);
    return res.status(500).json({ error: err.message });
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
    columns = [],
    filters = [],
    visualization_config,
    drillTargets = [],
    report_type = "TABLE",
    sql_text = null,
  } = req.body;

  if (!name || !connection_id) {
    return res.status(400).json({
      error: "name and connection_id are required",
    });
  }

  // --------------------------------------------
  // SQL REPORT VALIDATION
  // --------------------------------------------
  if (report_type === "SQL") {
    validateSelectSQL(sql_text);

    const params = extractSqlParams(sql_text);
    filters = params.map((p, idx) => ({
      column_name: p,
      table_name: null,
      operator: "=",
      value: "",
      is_user_editable: true,
      order_index: idx,
    }));

    base_table = "__SQL__";
  }

  try {
    await db.run("BEGIN TRANSACTION");

    // ---------------- SAVE REPORT ----------------
    const result = await db.run(
      `INSERT INTO reports
       (user_id, connection_id, name, description, base_table, visualization_config, report_type, sql_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.userId,
        connection_id,
        name,
        description || null,
        base_table,
        JSON.stringify(visualization_config || {}),
        report_type,
        sql_text,
      ]
    );

    const reportId = result.lastID;

    // ---------------- SAVE COLUMNS ----------------
    for (const col of columns) {
      if (!col.column_name) {
        throw new Error("column_name is required in columns");
      }

      await db.run(
        `INSERT INTO report_columns
         (report_id, table_name, column_name, alias, data_type, visible, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          col.table_name || null,
          col.column_name,
          col.alias || null,
          col.data_type || null,
          col.visible ? 1 : 0,
          col.order_index || 0,
        ]
      );
    }

    // ---------------- SAVE FILTERS ----------------
    for (const f of filters || []) {
      await db.run(
        `INSERT INTO report_filters
         (report_id, table_name, column_name, operator, value, is_user_editable, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          f.table_name || null,          // 🔥 CRITICAL
          f.column_name,
          f.operator || "=",
          JSON.stringify(f.value ?? ""),
          f.is_user_editable ? 1 : 0,
          f.order_index || 0,
        ]
      );
    }

    // ---------------- SAVE DRILL TARGETS ----------------
    for (const dt of drillTargets || []) {
      await db.run(
        `INSERT INTO report_drillthrough
         (parent_report_id, target_report_id, mapping_json)
         VALUES (?, ?, ?)`,
        [reportId, dt.target_report_id, JSON.stringify(dt.mapping_json)]
      );
    }

    await db.run("COMMIT");
    res.json({ success: true, reportId });
  } catch (err) {
    await db.run("ROLLBACK");
    console.error("SAVE REPORT ERROR:", err);
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

    /**
     * IMPORTANT:
     * - Inner query MUST use table.column
     * - Alias only for outer query
     */
    for (const col of visibleColumns) {
      if (!col.table_name || !col.column_name) {
        return res.status(400).json({
          error: "Preview columns must include table_name and column_name",
        });
      }

      const qualifiedCol = `${col.table_name}.${col.column_name}`;
      const alias = safeAlias(`${col.table_name}_${col.column_name}`);

      select.push(`${qualifiedCol} AS ${alias}`);

      if (col.dimensionId) {
        group_by.push(qualifiedCol);
      }
    }

    const fixedFilters = filters
      .filter(f => f.value !== "" && f.value !== null && f.value !== undefined)
      .map(f => ({
        column: `${f.table_name}.${f.column_name}`, // ✅ NO GUESSING
        operator: f.operator,
        value: f.value,
      }));


    const limit = 100;
    // --------------------------------------------------
    // 3️⃣ BUILD INNER SEMANTIC QUERY
    // --------------------------------------------------
    const { sql, params } = await buildSemanticQuery({
      connection_id,
      base_table: resolvedBaseTable,
      select,
      filters: fixedFilters,
      group_by,
      limit,
    });


    // --------------------------------------------------
    // 4️⃣ OUTER QUERY (DISPLAY NAMES)
    // --------------------------------------------------
    const meta = await getPoolForConnection(connection_id);
    const { pool, type } = meta;

    const q = (n) => quoteIdentifier(n, type);

    const outerSelect = visibleColumns
      .map((c) => {
        const innerAlias = safeAlias(`${c.table_name}_${c.column_name}`);
        return `${q(innerAlias)} AS ${q(c.column_name)}`;
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
    columns = [],
    filters = [],
    visualization_config,
    drillTargets = [],
  } = req.body;

  try {
    const report = await db.get(
      `SELECT user_id FROM reports WHERE id = ?`,
      [id]
    );

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    if (user.role !== "admin" && report.user_id !== user.userId) {
      return res.status(403).json({
        error: "Only creator or admin can update this report",
      });
    }

    await db.run("BEGIN TRANSACTION");

    // ---------------- UPDATE REPORT META ----------------
    await db.run(
      `UPDATE reports
       SET name = ?, description = ?, visualization_config = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        description || null,
        JSON.stringify(visualization_config || {}),
        id,
      ]
    );

    // ---------------- REPLACE COLUMNS ----------------
    await db.run(`DELETE FROM report_columns WHERE report_id = ?`, [id]);

    for (const col of columns) {
      await db.run(
        `INSERT INTO report_columns
         (report_id, table_name, column_name, alias, data_type, visible, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          col.table_name || null,     // 🔥 CRITICAL
          col.column_name,
          col.alias || null,
          col.data_type || null,
          col.visible ? 1 : 0,
          col.order_index || 0,
        ]
      );
    }

    // ---------------- REPLACE FILTERS ----------------
    await db.run(`DELETE FROM report_filters WHERE report_id = ?`, [id]);

    for (const f of filters || []) {
      await db.run(
        `INSERT INTO report_filters
         (report_id, table_name, column_name, operator, value, is_user_editable, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          f.table_name || null,       // 🔥 CRITICAL
          f.column_name,
          f.operator || "=",
          JSON.stringify(f.value ?? ""),
          f.is_user_editable ? 1 : 0,
          f.order_index || 0,
        ]
      );
    }

    // ---------------- REPLACE DRILL TARGETS ----------------
    await db.run(
      `DELETE FROM report_drillthrough WHERE parent_report_id = ?`,
      [id]
    );

    for (const dt of drillTargets || []) {
      await db.run(
        `INSERT INTO report_drillthrough
         (parent_report_id, target_report_id, mapping_json)
         VALUES (?, ?, ?)`,
        [id, dt.target_report_id, JSON.stringify(dt.mapping_json)]
      );
    }

    await db.run("COMMIT");
    res.json({ success: true, message: "Report updated successfully" });
  } catch (err) {
    await db.run("ROLLBACK");
    console.error("UPDATE REPORT ERROR:", err);
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

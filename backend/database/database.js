import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";

const router = Router();

router.post("/save", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { name, description, connection_id, charts, layout } = req.body;

  if (!name || !connection_id) {
    return res.status(400).json({
      success: false,
      error: "Dashboard name and connection_id are required",
    });
  }

  try {
    // Start a transaction
    await db.run("BEGIN TRANSACTION");

    // Insert dashboard
    const dashboardResult = await db.run(
      `INSERT INTO dashboards (user_id, connection_id, name, description, layout, created_at, last_modified)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        user.userId,
        connection_id,
        name,
        description || null,
        JSON.stringify(layout || []),
      ]
    );
    const dashboardId = dashboardResult.lastID;

    // Insert charts
    for (const chart of charts || []) {
      const yAxisFacts = chart.yAxisFacts || [];
      await db.run(
        `INSERT INTO charts (
          dashboard_id, x_axis_dimension_id, y_axis_facts, group_by_dimension_id,
          chart_type, aggregation_type, stacked, title, description, created_at, last_modified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          dashboardId,
          chart.xAxisDimension?.id || null,
          JSON.stringify(yAxisFacts.map((fact) => fact.id)),
          chart.groupByDimension?.id || null,
          chart.chartType,
          chart.aggregationType,
          chart.stacked ? 1 : 0,
          chart.title || null,
          chart.description || null,
        ]
      );
    }

    await db.run("COMMIT");
    res.json({
      success: true,
      dashboardId,
      message: "Dashboard saved successfully",
    });
  } catch (error) {
    await db.run("ROLLBACK");
    console.error("Error saving dashboard:", error.message);
    res.status(500).json({
      success: false,
      error: `Failed to save dashboard: ${error.message}`,
    });
  }
});

router.get("/list", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;

  try {
    const dashboards = await db.all(
      `SELECT d.id, d.name, d.description, d.connection_id, d.layout, d.is_public,
              d.created_at, d.last_modified,
              (SELECT COUNT(*) FROM charts c WHERE c.dashboard_id = d.id) as chart_count
       FROM dashboards d
       WHERE d.user_id = ?
       ORDER BY d.last_modified DESC`,
      [user.userId]
    );

    const result = [];
    for (const dashboard of dashboards) {
      const charts = await db.all(
        `SELECT c.id, c.x_axis_dimension_id, c.y_axis_facts, c.group_by_dimension_id,
                c.chart_type, c.aggregation_type, c.stacked, c.title, c.description,
                c.created_at, c.last_modified
         FROM charts c
         WHERE c.dashboard_id = ?`,
        [dashboard.id]
      );

      const enrichedCharts = await Promise.all(
        charts.map(async (chart) => {
          const xAxisDimension = chart.x_axis_dimension_id
            ? await db.get(
                `SELECT id, name, column_name FROM dimensions WHERE id = ?`,
                [chart.x_axis_dimension_id]
              )
            : null;

          const yAxisFactIds = JSON.parse(chart.y_axis_facts || "[]");
          const yAxisFacts =
            yAxisFactIds.length > 0
              ? await db.all(
                  `SELECT id, name, table_name, column_name, aggregate_function
                 FROM facts
                 WHERE id IN (${yAxisFactIds.map(() => "?").join(",")})`,
                  yAxisFactIds
                )
              : [];

          const groupByDimension = chart.group_by_dimension_id
            ? await db.get(
                `SELECT id, name, column_name FROM dimensions WHERE id = ?`,
                [chart.group_by_dimension_id]
              )
            : null;

          return {
            id: chart.id,
            xAxisDimension,
            yAxisFacts,
            groupByDimension,
            chartType: chart.chart_type,
            aggregationType: chart.aggregation_type,
            stacked: !!chart.stacked,
            title: chart.title,
            description: chart.description,
            createdAt: chart.created_at,
            lastModified: chart.last_modified,
          };
        })
      );

      result.push({
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        connectionId: dashboard.connection_id,
        charts: enrichedCharts,
        layout: JSON.parse(dashboard.layout || "[]"),
        isPublic: !!dashboard.is_public,
        createdAt: dashboard.created_at,
        lastModified: dashboard.last_modified,
        chartCount: dashboard.chart_count,
      });
    }

    res.json({ success: true, dashboards: result });
  } catch (error) {
    console.error("Error fetching dashboards:", error.message);
    res.status(500).json({
      success: false,
      error: `Failed to fetch dashboards: ${error.message}`,
    });
  }
});

router.put("/:id", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { id } = req.params;
  const { name, description, charts, layout } = req.body;

  try {
    await db.run("BEGIN TRANSACTION");

    // Update dashboard
    await db.run(
      `UPDATE dashboards
       SET name = ?, description = ?, layout = ?, last_modified = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [name, description || null, JSON.stringify(layout || []), id, user.userId]
    );

    // Delete existing charts
    await db.run(`DELETE FROM charts WHERE dashboard_id = ?`, [id]);

    // Insert updated charts
    for (const chart of charts || []) {
      const yAxisFacts = chart.yAxisFacts || [];
      await db.run(
        `INSERT INTO charts (
          dashboard_id, x_axis_dimension_id, y_axis_facts, group_by_dimension_id,
          chart_type, aggregation_type, stacked, title, description, created_at, last_modified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          id,
          chart.xAxisDimension?.id || null,
          JSON.stringify(yAxisFacts.map((fact) => fact.id)),
          chart.groupByDimension?.id || null,
          chart.chartType,
          chart.aggregationType,
          chart.stacked ? 1 : 0,
          chart.title || null,
          chart.description || null,
        ]
      );
    }

    await db.run("COMMIT");
    res.json({ success: true, message: "Dashboard updated successfully" });
  } catch (error) {
    await db.run("ROLLBACK");
    console.error("Error updating dashboard:", error.message);
    res.status(500).json({
      success: false,
      error: `Failed to update dashboard: ${error.message}`,
    });
  }
});

router.delete("/:id", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { id } = req.params;

  try {
    await db.run("BEGIN TRANSACTION");
    await db.run(`DELETE FROM charts WHERE dashboard_id = ?`, [id]);
    await db.run(`DELETE FROM dashboards WHERE id = ? AND user_id = ?`, [
      id,
      user.userId,
    ]);
    await db.run("COMMIT");
    res.json({ success: true, message: "Dashboard deleted successfully" });
  } catch (error) {
    await db.run("ROLLBACK");
    console.error("Error deleting dashboard:", error.message);
    res.status(500).json({
      success: false,
      error: `Failed to delete dashboard: ${error.message}`,
    });
  }
});

export default router;

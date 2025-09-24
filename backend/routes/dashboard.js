import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";

const router = Router();

// Save a new dashboard
router.post("/save", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { name, description, connection_id, charts, layout } = req.body;

  const canCreate =
    user.role === "designer" ||
    (user.role === "user" && user.accessLevel === "editor");

  if (!canCreate) {
    return res
      .status(403)
      .json({ error: "Permission denied to create dashboards" });
  }

  if (!name || !connection_id) {
    return res
      .status(400)
      .json({ error: "Dashboard name and connection_id are required" });
  }

  // Check if the connection is allowed for the user's designation
  const accessCheck = await db.get(
    `SELECT COUNT(*) as count FROM connection_designations 
     WHERE connection_id = ? AND designation = ?`,
    [connection_id, user.designation]
  );
  if (accessCheck.count === 0) {
    return res.status(403).json({ error: "Access denied to this connection" });
  }

  let transactionActive = false;
  try {
    await db.run("BEGIN TRANSACTION");
    transactionActive = true;

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

    const chartIds = [];
    for (const chart of charts || []) {
      const yAxisFacts = chart.yAxisFacts || [];
      const chartId = chart.id || null;
      await db.run(
        `INSERT INTO charts (id, dashboard_id, x_axis_dimension_id, y_axis_facts, group_by_dimension_id, 
                             chart_type, aggregation_type, stacked, title, description, created_at, last_modified) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          chartId,
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
      chartIds.push(chartId);
    }

    await db.run("COMMIT");
    transactionActive = false;
    res.json({ success: true, data: { dashboardId, chartIds } });
  } catch (error) {
    if (transactionActive) {
      await db.run("ROLLBACK");
    }
    console.error("Error saving dashboard:", error.message);
    res.status(500).json({
      success: false,
      error: `Failed to save dashboard: ${error.message}`,
    });
  }
});

// Update an existing dashboard (including other users' dashboards)
router.put("/:id", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { id } = req.params;
  const { name, description, charts, layout } = req.body;

  const canUpdate =
    user.role === "designer" ||
    (user.role === "user" && user.accessLevel === "editor");

  if (!canUpdate) {
    return res
      .status(403)
      .json({ error: "Permission denied to update dashboards" });
  }

  // Check if dashboard exists (ownership check removed to allow editing others' dashboards)
  const dashboard = await db.get(
    `SELECT connection_id FROM dashboards WHERE id = ?`,
    [id]
  );
  if (!dashboard) {
    return res.status(404).json({ error: "Dashboard not found" });
  }

  const accessCheck = await db.get(
    `SELECT COUNT(*) as count FROM connection_designations 
     WHERE connection_id = ? AND designation = ?`,
    [dashboard.connection_id, user.designation]
  );
  if (accessCheck.count === 0) {
    return res.status(403).json({ error: "Access denied to this connection" });
  }

  let transactionActive = false;
  try {
    await db.run("BEGIN TRANSACTION");
    transactionActive = true;

    // Ownership check removed from WHERE clause
    await db.run(
      `UPDATE dashboards 
       SET name = ?, description = ?, layout = ?, last_modified = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [name, description || null, JSON.stringify(layout || []), id]
    );

    await db.run(`DELETE FROM charts WHERE dashboard_id = ?`, [id]);

    const chartIds = [];
    for (const chart of charts || []) {
      const yAxisFacts = chart.yAxisFacts || [];
      const chartId = chart.id || null;
      await db.run(
        `INSERT INTO charts (id, dashboard_id, x_axis_dimension_id, y_axis_facts, group_by_dimension_id, 
                             chart_type, aggregation_type, stacked, title, description, created_at, last_modified) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          chartId,
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
      chartIds.push(chartId);
    }

    await db.run("COMMIT");
    transactionActive = false;
    res.json({
      success: true,
      message: "Dashboard updated successfully",
      data: { chartIds },
    });
  } catch (error) {
    if (transactionActive) {
      await db.run("ROLLBACK");
    }
    console.error("Error updating dashboard:", error.message);
    res.status(500).json({
      success: false,
      error: `Failed to update dashboard: ${error.message}`,
    });
  }
});

// List all dashboards a user has access to
router.get("/list", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;

  try {
    let dashboards;
    // Admins see an empty list; all other users see dashboards based on designation
    if (user.role === "admin") {
      return res.json([]);
    } else {
      dashboards = await db.all(
        `SELECT d.id, d.name, d.description, d.connection_id, d.layout, d.is_public,
                d.created_at, d.last_modified,
                (SELECT COUNT(*) FROM charts c WHERE c.dashboard_id = d.id) AS chart_count
         FROM dashboards d
         JOIN connections con ON d.connection_id = con.id
         JOIN connection_designations cd ON con.id = cd.connection_id
         WHERE cd.designation = ?
         GROUP BY d.id
         ORDER BY d.last_modified DESC`,
        [user.designation]
      );
    }

    const result = await Promise.all(
      dashboards.map(async (dashboard) => {
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
              id: chart.id.toString(),
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

        return {
          id: dashboard.id.toString(),
          name: dashboard.name,
          description: dashboard.description,
          connectionId: dashboard.connection_id,
          charts: enrichedCharts,
          layout: JSON.parse(dashboard.layout || "[]"),
          isPublic: !!dashboard.is_public,
          createdAt: dashboard.created_at,
          lastModified: dashboard.last_modified,
          chartCount: dashboard.chart_count,
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error("Error fetching dashboards:", error.message);
    res.status(500).json({
      success: false,
      error: `Failed to fetch dashboards: ${error.message}`,
    });
  }
});

// Delete a dashboard (including other users' dashboards)
router.delete("/:id", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { id } = req.params;

  const canDelete =
    user.role === "designer" ||
    (user.role === "user" && user.accessLevel === "editor");

  if (!canDelete) {
    return res
      .status(403)
      .json({ error: "Permission denied to delete dashboards" });
  }

  // Check if dashboard exists (ownership check removed)
  const dashboard = await db.get(
    `SELECT connection_id FROM dashboards WHERE id = ?`,
    [id]
  );
  if (!dashboard) {
    return res.status(404).json({ error: "Dashboard not found" });
  }

  const accessCheck = await db.get(
    `SELECT COUNT(*) as count FROM connection_designations 
     WHERE connection_id = ? AND designation = ?`,
    [dashboard.connection_id, user.designation]
  );
  if (accessCheck.count === 0) {
    return res.status(403).json({ error: "Access denied to this connection" });
  }

  let transactionActive = false;
  try {
    await db.run("BEGIN TRANSACTION");
    transactionActive = true;

    await db.run(`DELETE FROM charts WHERE dashboard_id = ?`, [id]);

    // Ownership check removed from WHERE clause
    await db.run(`DELETE FROM dashboards WHERE id = ?`, [id]);

    await db.run("COMMIT");
    transactionActive = false;
    res.json({
      success: true,
      message: "Dashboard and related charts deleted successfully",
    });
  } catch (error) {
    if (transactionActive) {
      await db.run("ROLLBACK");
    }
    console.error("Error deleting dashboard:", error.message);
    res.status(500).json({
      success: false,
      error: `Failed to delete dashboard: ${error.message}`,
    });
  }
});

// Delete individual chart (including from other users' dashboards)
router.delete("/chart/:chartId", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { chartId } = req.params;

  const canDelete =
    user.role === "designer" ||
    (user.role === "user" && user.accessLevel === "editor");

  if (!canDelete) {
    return res
      .status(403)
      .json({ error: "Permission denied to delete charts" });
  }

  let transactionActive = false;
  try {
    // Ownership check removed from query
    const chart = await db.get(
      `SELECT c.id, d.connection_id 
       FROM charts c 
       JOIN dashboards d ON c.dashboard_id = d.id 
       WHERE c.id = ?`,
      [chartId]
    );
    if (!chart) {
      return res.status(404).json({ success: false, error: "Chart not found" });
    }

    const accessCheck = await db.get(
      `SELECT COUNT(*) as count FROM connection_designations 
       WHERE connection_id = ? AND designation = ?`,
      [chart.connection_id, user.designation]
    );
    if (accessCheck.count === 0) {
      return res
        .status(403)
        .json({ error: "Access denied to this connection" });
    }

    await db.run("BEGIN TRANSACTION");
    transactionActive = true;
    await db.run(`DELETE FROM charts WHERE id = ?`, [chartId]);
    await db.run("COMMIT");
    transactionActive = false;
    res.json({ success: true, message: "Chart deleted successfully" });
  } catch (error) {
    if (transactionActive) {
      await db.run("ROLLBACK");
    }
    console.error("Error deleting chart:", error.message);
    res.status(500).json({
      success: false,
      error: `Failed to delete chart: ${error.message}`,
    });
  }
});

export default router;

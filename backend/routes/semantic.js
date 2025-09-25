// semantic.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";
// Note: getPoolForConnection is a helper function you would need to import
// from your connection management logic to get a live database pool.
 import { getPoolForConnection } from "../database/connection.js";

const router = Router();

// Facts and Dimensions
router.get("/facts", async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }
    const db = await dbPromise;
    const facts = await db.all(
      "SELECT id, name, table_name, column_name, aggregate_function FROM facts WHERE connection_id = ?",
      [connection_id]
    );
    res.json(facts);
  } catch (err) {
    console.error("List facts error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/facts", async (req, res) => {
  try {
    const { connection_id, name, table_name, column_name, aggregate_function } =
      req.body;
    if (
      !connection_id ||
      !name ||
      !table_name ||
      !column_name ||
      !aggregate_function
    ) {
      return res.status(400).json({
        error: "Missing required fact fields",
      });
    }
    if (
      ![
        "SUM",
        "AVG",
        "COUNT",
        "MIN",
        "MAX",
        "MEDIAN",
        "STDDEV",
        "VARIANCE",
      ].includes(aggregate_function)
    ) {
      return res.status(400).json({
        error:
          "Invalid aggregate function. Must be 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'MEDIAN', 'STDDEV', or 'VARIANCE'",
      });
    }
    const db = await dbPromise;
    const result = await db.run(
      `INSERT INTO facts (connection_id, name, table_name, column_name, aggregate_function)
       VALUES (?, ?, ?, ?, ?)`,
      [connection_id, name, table_name, column_name, aggregate_function]
    );
    res.json({
      id: result.lastID,
      connection_id,
      name,
      table_name,
      column_name,
      aggregate_function,
    });
  } catch (err) {
    console.error("Create fact error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put("/facts/:id", async (req, res) => {
  try {
    const { connection_id, name, table_name, column_name, aggregate_function } =
      req.body;
    if (
      !connection_id ||
      !name ||
      !table_name ||
      !column_name ||
      !aggregate_function
    ) {
      return res.status(400).json({
        error: "Missing required fact fields",
      });
    }
    if (
      ![
        "SUM",
        "AVG",
        "COUNT",
        "MIN",
        "MAX",
        "MEDIAN",
        "STDDEV",
        "VARIANCE",
      ].includes(aggregate_function)
    ) {
      return res.status(400).json({
        error:
          "Invalid aggregate function. Must be 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'MEDIAN', 'STDDEV', or 'VARIANCE'",
      });
    }
    const db = await dbPromise;
    await db.run(
      `UPDATE facts SET
        connection_id = ?, name = ?, table_name = ?, column_name = ?, aggregate_function = ?
       WHERE id = ?`,
      [
        connection_id,
        name,
        table_name,
        column_name,
        aggregate_function,
        req.params.id,
      ]
    );
    const updated = await db.get(
      "SELECT * FROM facts WHERE id = ?",
      req.params.id
    );
    res.json(updated);
  } catch (err) {
    console.error("Update fact error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/facts/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM facts WHERE id = ?", req.params.id);
    res.json({});
  } catch (err) {
    console.error("Delete fact error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/dimensions", async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }
    const db = await dbPromise;
    const dimensions = await db.all(
      "SELECT id, name, table_name, column_name FROM dimensions WHERE connection_id = ?",
      [connection_id]
    );
    res.json(dimensions);
  } catch (err) {
    console.error("List dimensions error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/dimensions", async (req, res) => {
  try {
    const { connection_id, name, table_name, column_name } = req.body;
    if (!connection_id || !name || !table_name || !column_name) {
      return res.status(400).json({
        error: "Missing required dimension fields",
      });
    }
    const db = await dbPromise;
    const result = await db.run(
      `INSERT INTO dimensions (connection_id, name, table_name, column_name)
       VALUES (?, ?, ?, ?)`,
      [connection_id, name, table_name, column_name]
    );
    res.json({
      id: result.lastID,
      connection_id,
      name,
      table_name,
      column_name,
    });
  } catch (err) {
    console.error("Create dimension error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put("/dimensions/:id", async (req, res) => {
  try {
    const { connection_id, name, table_name, column_name } = req.body;
    if (!connection_id || !name || !table_name || !column_name) {
      return res.status(400).json({
        error: "Missing required dimension fields",
      });
    }
    const db = await dbPromise;
    await db.run(
      `UPDATE dimensions SET
        connection_id = ?, name = ?, table_name = ?, column_name = ?
       WHERE id = ?`,
      [connection_id, name, table_name, column_name, req.params.id]
    );
    const updated = await db.get(
      "SELECT * FROM dimensions WHERE id = ?",
      req.params.id
    );
    res.json(updated);
  } catch (err) {
    console.error("Update dimension error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/dimensions/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM dimensions WHERE id = ?", req.params.id);
    res.json({});
  } catch (err) {
    console.error("Delete dimension error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/fact-dimensions", async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }
    const db = await dbPromise;
    const factDimensions = await db.all(
      `SELECT fd.id, fd.fact_id, f.name AS fact_name, fd.dimension_id, d.name AS dimension_name,
              fd.join_table, fd.fact_column, fd.dimension_column
       FROM fact_dimensions fd
       JOIN facts f ON fd.fact_id = f.id
       JOIN dimensions d ON fd.dimension_id = d.id
       WHERE f.connection_id = ? AND d.connection_id = ?`,
      [connection_id, connection_id]
    );
    res.json(factDimensions);
  } catch (err) {
    console.error("List fact-dimensions error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/fact-dimensions", async (req, res) => {
  try {
    const { fact_id, dimension_id, join_table, fact_column, dimension_column } =
      req.body;
    if (
      !fact_id ||
      !dimension_id ||
      !join_table ||
      !fact_column ||
      !dimension_column
    ) {
      return res.status(400).json({
        error: "Missing required fact-dimension fields",
      });
    }
    const db = await dbPromise;
    const result = await db.run(
      `INSERT INTO fact_dimensions (fact_id, dimension_id, join_table, fact_column, dimension_column)
       VALUES (?, ?, ?, ?, ?)`,
      [fact_id, dimension_id, join_table, fact_column, dimension_column]
    );
    const fact = await db.get("SELECT name FROM facts WHERE id = ?", [fact_id]);
    const dimension = await db.get("SELECT name FROM dimensions WHERE id = ?", [
      dimension_id,
    ]);
    res.json({
      id: result.lastID,
      fact_id,
      fact_name: fact.name,
      dimension_id,
      dimension_name: dimension.name,
      join_table,
      fact_column,
      dimension_column,
    });
  } catch (err) {
    console.error("Create fact-dimension error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put("/fact-dimensions/:id", async (req, res) => {
  try {
    const { fact_id, dimension_id, join_table, fact_column, dimension_column } =
      req.body;
    if (
      !fact_id ||
      !dimension_id ||
      !join_table ||
      !fact_column ||
      !dimension_column
    ) {
      return res.status(400).json({
        error: "Missing required fact-dimension fields",
      });
    }
    const db = await dbPromise;
    await db.run(
      `UPDATE fact_dimensions SET
        fact_id = ?, dimension_id = ?, join_table = ?, fact_column = ?, dimension_column = ?
       WHERE id = ?`,
      [
        fact_id,
        dimension_id,
        join_table,
        fact_column,
        dimension_column,
        req.params.id,
      ]
    );
    const updated = await db.get(
      `SELECT fd.id, fd.fact_id, f.name AS fact_name, fd.dimension_id, d.name AS dimension_name,
              fd.join_table, fd.fact_column, fd.dimension_column
       FROM fact_dimensions fd
       JOIN facts f ON fd.fact_id = f.id
       JOIN dimensions d ON fd.dimension_id = d.id
       WHERE fd.id = ?`,
      [req.params.id]
    );
    res.json(updated);
  } catch (err) {
    console.error("Update fact-dimension error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/fact-dimensions/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM fact_dimensions WHERE id = ?", req.params.id);
    res.json({});
  } catch (err) {
    console.error("Delete fact-dimension error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Auto-map facts and dimensions
router.post("/auto-map", async (req, res) => {
  try {
    const { connection_id } = req.body;
    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }
    // This function needs to be defined/imported to get a live DB connection pool
    const { pool, type } = await getPoolForConnection(
      connection_id,
      req.user?.userId
    );
    const client = await pool.connect();
    const db = await dbPromise;

    try {
      const facts = await db.all(
        "SELECT * FROM facts WHERE connection_id = ?",
        [connection_id]
      );
      const dimensions = await db.all(
        "SELECT * FROM dimensions WHERE connection_id = ?",
        [connection_id]
      );

      const autoMappings = [];
      const factColumnsByTable = {};

      const columnsQuery =
        type === "postgres"
          ? `SELECT column_name FROM information_schema.columns WHERE table_name = $1`
          : `SELECT column_name FROM information_schema.columns WHERE table_name = ?`;

      for (const fact of facts) {
        const factColumnsResult = await client.query(columnsQuery, [
          fact.table_name,
        ]);
        factColumnsByTable[fact.table_name] = (
          factColumnsResult.rows || factColumnsResult[0]
        ).map((row) => row.column_name);
      }

      for (const dim of dimensions) {
        const dimTableColumnsResult = await client.query(columnsQuery, [
          dim.table_name,
        ]);
        const dimTableColumns = (
          dimTableColumnsResult.rows || dimTableColumnsResult[0]
        ).map((row) => row.column_name);

        if (!dimTableColumns.includes(dim.column_name)) {
          console.warn(
            `Dimension ${dim.name} column ${dim.column_name} not found in table ${dim.table_name}`
          );
          continue;
        }

        for (const fact of facts) {
          const factColumns = factColumnsByTable[fact.table_name];
          const commonColumns = factColumns.filter((col) =>
            dimTableColumns.includes(col)
          );

          for (const commonCol of commonColumns) {
            const existing = await db.get(
              `SELECT id FROM fact_dimensions WHERE fact_id = ? AND dimension_id = ? AND join_table = ? AND fact_column = ? AND dimension_column = ?`,
              [fact.id, dim.id, dim.table_name, commonCol, commonCol]
            );
            if (existing) continue;

            const result = await db.run(
              `INSERT INTO fact_dimensions (fact_id, dimension_id, join_table, fact_column, dimension_column) VALUES (?, ?, ?, ?, ?)`,
              [fact.id, dim.id, dim.table_name, commonCol, commonCol]
            );
            autoMappings.push({
              id: result.lastID,
              fact_id: fact.id,
              fact_name: fact.name,
              dimension_id: dim.id,
              dimension_name: dim.name,
              join_table: dim.table_name,
              fact_column: commonCol,
              dimension_column: commonCol,
            });
          }
        }
      }

      res.json(autoMappings);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Auto-map error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// KPI management
router.get("/kpis", async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }
    const db = await dbPromise;
    const kpis = await db.all("SELECT * FROM kpis WHERE connection_id = ?", [
      connection_id,
    ]);
    res.json(kpis);
  } catch (err) {
    console.error("List KPIs error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/kpis", async (req, res) => {
  try {
    const { connection_id, name, expression, description } = req.body;
    if (!connection_id || !name || !expression) {
      return res.status(400).json({
        error: "connection_id, name, and expression are required",
      });
    }
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO kpis (connection_id, name, expression, description, created_by) VALUES (?, ?, ?, ?, ?)",
      [
        connection_id,
        name,
        expression,
        description || null,
        req.user?.userId || null,
      ]
    );
    res.json({
      id: result.lastID,
      connection_id,
      name,
      expression,
      description,
    });
  } catch (err) {
    console.error("Create KPI error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put("/kpis/:id", async (req, res) => {
  try {
    const { name, expression, description } = req.body;
    if (!name || !expression) {
      return res.status(400).json({
        error: "name and expression are required",
      });
    }
    const db = await dbPromise;
    await db.run(
      "UPDATE kpis SET name = ?, expression = ?, description = ? WHERE id = ?",
      [name, expression, description || null, req.params.id]
    );
    const updated = await db.get(
      "SELECT * FROM kpis WHERE id = ?",
      req.params.id
    );
    res.json(updated);
  } catch (err) {
    console.error("Update KPI error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/kpis/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM kpis WHERE id = ?", req.params.id);
    res.json({});
  } catch (err) {
    console.error("Delete KPI error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

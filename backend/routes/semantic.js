import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbPromise } from "../database/sqliteConnection.js";
import {
  getPoolForConnection,
  quoteIdentifier,
} from "../database/connection.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const SALT_ROUNDS = 10;

// User creation
router.post("/users", async (req, res) => {
  const db = await dbPromise;
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({
      error: "Username, password, and role are required",
    });
  }

  try {
    const existingUser = await db.get(
      "SELECT id FROM users WHERE username = ?",
      username
    );
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.run(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username, hashedPassword, role]
    );

    res.json({
      user: { id: result.lastID, username, role },
    });
  } catch (err) {
    console.error("Create user error:", err.message);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Connection management
router.get("/connections", async (req, res) => {
  try {
    const db = await dbPromise;
    const connections = await db.all(
      "SELECT id, connection_name, description, type, hostname, port, database, command_timeout, max_transport_objects, username, selected_db, created_at FROM connections WHERE user_id = ?",
      [req.user?.userId]
    );
    res.json(connections);
  } catch (err) {
    console.error("List connections error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/connections", async (req, res) => {
  try {
    const {
      connection_name,
      description,
      type,
      hostname,
      port,
      database,
      command_timeout,
      max_transport_objects,
      username,
      password,
      selected_db,
    } = req.body;
    if (
      !connection_name ||
      !type ||
      !hostname ||
      !port ||
      !database ||
      !username ||
      !password ||
      !selected_db
    ) {
      return res.status(400).json({
        error: "Missing required connection fields",
      });
    }
    const db = await dbPromise;
    const result = await db.run(
      `INSERT INTO connections (
        user_id, connection_name, description, type, hostname, port, database,
        command_timeout, max_transport_objects, username, password, selected_db
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user?.userId,
        connection_name,
        description || null,
        type,
        hostname,
        port,
        database,
        command_timeout || null,
        max_transport_objects || null,
        username,
        password,
        selected_db,
      ]
    );
    res.json({
      id: result.lastID,
      connection_name,
      description,
      type,
      hostname,
      port,
      database,
      command_timeout,
      max_transport_objects,
      username,
      selected_db,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Create connection error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/connections/test", async (req, res) => {
  try {
    const {
      connection_name,
      type,
      hostname,
      port,
      database,
      username,
      password,
      selected_db,
    } = req.body;

    if (
      !connection_name ||
      !type ||
      !hostname ||
      !port ||
      !database ||
      !username ||
      !password ||
      !selected_db
    ) {
      return res.status(400).json({
        error: "Missing required connection fields",
      });
    }

    const { pool } = await getPoolForConnection(
      {
        connection_name,
        type,
        hostname,
        port,
        database,
        username,
        password,
        selected_db,
      },
      req.user?.userId
    );

    const client = await pool.connect();
    try {
      // Perform a simple query to test the connection
      const testQuery =
        type === "postgres" ? "SELECT 1 AS test" : "SELECT 1 AS test";
      await client.query(testQuery);
      res.json({ success: true, message: "Connection successful" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Test connection error:", err.message);
    res
      .status(500)
      .json({ success: false, error: `Failed to connect: ${err.message}` });
  }
});

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

// Auto-map facts and dimensions
router.post("/auto-map", async (req, res) => {
  try {
    const { connection_id } = req.body;
    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }
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

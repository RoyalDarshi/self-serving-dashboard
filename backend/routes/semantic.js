import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbPromise } from "../database/sqliteConnection.js";
import {
  getPoolForConnection,
  quoteIdentifier,
  testConnection,
} from "../database/connection.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const SALT_ROUNDS = 10;

// Create user
router.post("/users", async (req, res) => {
  const db = await dbPromise;
  const { username, password, role, designation } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({
      error: "Username, password, and role are required",
    });
  }

  if (!["admin", "user", "designer"].includes(role)) {
    return res
      .status(400)
      .json({ error: "Invalid role. Must be 'admin', 'user', or 'designer'" });
  }

  if (
    designation &&
    ![
      "Business Analyst",
      "Data Scientist",
      "Operations Manager",
      "Finance Manager",
      "Consumer Insights Manager",
      "Store / Regional Manager",
    ].includes(designation)
  ) {
    return res.status(400).json({ error: "Invalid designation" });
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
      "INSERT INTO users (username, password, role, designation) VALUES (?, ?, ?, ?)",
      [username, hashedPassword, role, designation || null]
    );

    res.json({
      user: { id: result.lastID, username, role, designation },
    });
  } catch (err) {
    console.error("Create user error:", err.message);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Get all users (admin only)
router.get("/users", async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required" });
    }
    const db = await dbPromise;
    const users = await db.all(
      "SELECT id, username, role, designation, created_at FROM users"
    );
    res.json(users);
  } catch (err) {
    console.error("List users error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get single user by ID
router.get("/users/:id", async (req, res) => {
  try {
    if (
      req.user?.role !== "admin" &&
      req.user?.userId !== parseInt(req.params.id)
    ) {
      return res
        .status(403)
        .json({ error: "Access denied. Admin or self only" });
    }
    const db = await dbPromise;
    const user = await db.get(
      "SELECT id, username, role, designation, created_at FROM users WHERE id = ?",
      req.params.id
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Get user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update user
router.put("/users/:id", async (req, res) => {
  try {
    if (
      req.user?.role !== "admin" &&
      req.user?.userId !== parseInt(req.params.id)
    ) {
      return res
        .status(403)
        .json({ error: "Access denied. Admin or self only" });
    }
    const { username, password, role, designation } = req.body;

    if (username || role || designation || password) {
      const db = await dbPromise;
      const updates = [];
      const values = [];

      if (username) {
        const existingUser = await db.get(
          "SELECT id FROM users WHERE username = ? AND id != ?",
          [username, req.params.id]
        );
        if (existingUser) {
          return res.status(400).json({ error: "Username already exists" });
        }
        updates.push("username = ?");
        values.push(username);
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        updates.push("password = ?");
        values.push(hashedPassword);
      }

      if (role) {
        if (!["admin", "user", "designer"].includes(role)) {
          return res.status(400).json({
            error: "Invalid role. Must be 'admin', 'user', or 'designer'",
          });
        }
        updates.push("role = ?");
        values.push(role);
      }

      if (designation) {
        if (
          ![
            "Business Analyst",
            "Data Scientist",
            "Operations Manager",
            "Finance Manager",
            "Consumer Insights Manager",
            "Store / Regional Manager",
          ].includes(designation)
        ) {
          return res.status(400).json({ error: "Invalid designation" });
        }
        updates.push("designation = ?");
        values.push(designation);
      } else if (designation === null) {
        updates.push("designation = ?");
        values.push(null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      values.push(req.params.id);
      await db.run(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        values
      );

      const updated = await db.get(
        "SELECT id, username, role, designation, created_at FROM users WHERE id = ?",
        req.params.id
      );
      res.json(updated);
    } else {
      return res.status(400).json({
        error:
          "At least one field (username, password, role, designation) must be provided",
      });
    }
  } catch (err) {
    console.error("Update user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete user (admin only)
router.delete("/users/:id", async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required" });
    }
    const db = await dbPromise;
    const user = await db.get(
      "SELECT id FROM users WHERE id = ?",
      req.params.id
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    await db.run("DELETE FROM users WHERE id = ?", req.params.id);
    res.json({});
  } catch (err) {
    console.error("Delete user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Connection management
router.get("/connections", async (req, res) => {
  try {
    const db = await dbPromise;
    let connections;
    if (req.user.role === "admin") {
      connections = await db.all(
        "SELECT id, connection_name, type, hostname, port, database, username, created_at FROM connections"
      );
    } else {
      connections = await db.all(
        `SELECT DISTINCT c.id, c.connection_name, c.type, c.hostname, c.port, c.database, c.username, c.created_at 
         FROM connections c
         JOIN connection_designations cd ON c.id = cd.connection_id
         WHERE cd.designation = ?`,
        [req.user.designation]
      );
    }
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
      type,
      hostname,
      port,
      database,
      username,
      password,
    } = req.body;
    if (
      !connection_name ||
      !type ||
      !hostname ||
      !port ||
      !database ||
      !username ||
      !password
    ) {
      return res.status(400).json({
        error: "Missing required connection fields",
      });
    }
    const db = await dbPromise;
    const result = await db.run(
      `INSERT INTO connections (
        user_id, connection_name, type, hostname, port, database,
        username, password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user?.userId,
        connection_name,
        type,
        hostname,
        port,
        database,
        username,
        password,
      ]
    );
    res.json({
      id: result.lastID,
      connection_name,
      type,
      hostname,
      port,
      database,
      username,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Create connection error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put("/connections/:id", async (req, res) => {
  try {
    const {
      connection_name,
      type,
      hostname,
      port,
      database,
      username,
      password,
    } = req.body;
    if (
      !connection_name ||
      !type ||
      !hostname ||
      !port ||
      !database ||
      !username ||
      !password
    ) {
      return res.status(400).json({
        error: "Missing required connection fields",
      });
    }
    const db = await dbPromise;
    await db.run(
      `UPDATE connections SET
        connection_name = ?, type = ?, hostname = ?, port = ?,
        database = ?, username = ?, password = ?
      WHERE id = ? AND user_id = ?`,
      [
        connection_name,
        type,
        hostname,
        port,
        database,
        username,
        password,
        req.params.id,
        req.user?.userId,
      ]
    );
    const updated = await db.get(
      "SELECT * FROM connections WHERE id = ?",
      req.params.id
    );
    res.json(updated);
  } catch (err) {
    console.error("Update connection error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/connections/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    const connection = await db.get(
      "SELECT id FROM connections WHERE id = ? AND user_id = ?",
      [req.params.id, req.user?.userId]
    );
    if (!connection) {
      return res
        .status(404)
        .json({ error: "Connection not found or access denied" });
    }

    let transactionActive = false;
    try {
      await db.run("BEGIN TRANSACTION");
      transactionActive = true;

      // Delete related records
      await db.run(
        "DELETE FROM connection_designations WHERE connection_id = ?",
        [req.params.id]
      );
      await db.run("DELETE FROM kpis WHERE connection_id = ?", [req.params.id]);

      // Get all dashboards for this connection
      const dashboards = await db.all(
        "SELECT id FROM dashboards WHERE connection_id = ?",
        [req.params.id]
      );

      // Delete charts for each dashboard
      for (const dashboard of dashboards) {
        await db.run("DELETE FROM charts WHERE dashboard_id = ?", [
          dashboard.id,
        ]);
      }

      // Delete dashboards
      await db.run("DELETE FROM dashboards WHERE connection_id = ?", [
        req.params.id,
      ]);

      // Delete facts and their related fact_dimensions
      const facts = await db.all(
        "SELECT id FROM facts WHERE connection_id = ?",
        [req.params.id]
      );
      for (const fact of facts) {
        await db.run("DELETE FROM fact_dimensions WHERE fact_id = ?", [
          fact.id,
        ]);
      }
      await db.run("DELETE FROM facts WHERE connection_id = ?", [
        req.params.id,
      ]);

      // Delete dimensions
      await db.run("DELETE FROM dimensions WHERE connection_id = ?", [
        req.params.id,
      ]);

      // Delete the connection
      await db.run("DELETE FROM connections WHERE id = ? AND user_id = ?", [
        req.params.id,
        req.user?.userId,
      ]);

      await db.run("COMMIT");
      transactionActive = false;
      res.json({
        success: true,
        message: "Connection and related records deleted successfully",
      });
    } catch (error) {
      if (transactionActive) {
        await db.run("ROLLBACK");
      }
      throw error;
    }
  } catch (err) {
    console.error("Delete connection error:", err.message);
    res
      .status(500)
      .json({ error: `Failed to delete connection: ${err.message}` });
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
    } = req.body;

    if (
      !connection_name ||
      !type ||
      !hostname ||
      !port ||
      !database ||
      !username ||
      !password
    ) {
      return res.status(400).json({
        error: "Missing required connection fields",
      });
    }

    await testConnection({
      type,
      hostname,
      port,
      database,
      username,
      password,
    });

    res.json({
      success: true,
      message: "Connection successful",
    });
  } catch (err) {
    console.error("Test connection error:", err.message);
    res.status(500).json({
      success: false,
      error: `Failed to connect: ${err.message}`,
    });
  }
});

// Get all or per connection designations (admin only)
router.get("/connection-designations", async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin only" });
  }
  try {
    const { connection_id } = req.query;
    const db = await dbPromise;
    let query = "SELECT * FROM connection_designations";
    let params = [];
    if (connection_id) {
      query += " WHERE connection_id = ?";
      params = [connection_id];
    }
    const designations = await db.all(query, params);
    res.json(designations);
  } catch (err) {
    console.error("List connection designations error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create designation link (admin only)
router.post("/connection-designations", async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin only" });
  }
  try {
    const { connection_id, designation } = req.body;
    if (!connection_id || !designation) {
      return res
        .status(400)
        .json({ error: "connection_id and designation required" });
    }
    const db = await dbPromise;
    await db.run(
      "INSERT INTO connection_designations (connection_id, designation) VALUES (?, ?)",
      [connection_id, designation]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Create connection designation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete designation link (admin only)
router.delete("/connection-designations/:id", async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin only" });
  }
  try {
    const db = await dbPromise;
    await db.run(
      "DELETE FROM connection_designations WHERE id = ?",
      req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Delete connection designation error:", err.message);
    res.status(500).json({ error: err.message });
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

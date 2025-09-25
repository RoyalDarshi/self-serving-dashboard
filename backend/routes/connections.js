// connections.js
import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";

const router = Router();

// Connection Management
router.get("/connections", async (req, res) => {
  try {
    const db = await dbPromise;
    let connections;

    if (req.user.role === "admin") {
      connections = await db.all(
        "SELECT id, connection_name, type, hostname, port, database, username, created_at FROM connections ORDER BY created_at DESC"
      );
    } else if (req.user.designation) {
      connections = await db.all(
        `SELECT DISTINCT c.id, c.connection_name, c.type, c.hostname, c.port, c.database, c.username, c.created_at
         FROM connections c
         JOIN connection_designations cd ON c.id = cd.connection_id
         WHERE cd.designation = ?`,
        [req.user.designation]
      );
    } else {
      connections = [];
    }

    res.json(connections);
  } catch (err) {
    console.error("List connections error:", err.message);
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});

router.post("/connections", async (req, res) => {
  const {
    connection_name,
    type,
    hostname,
    port,
    database,
    username,
    password,
  } = req.body;

  const requiredFields = {
    connection_name,
    type,
    hostname,
    port,
    database,
    username,
    password,
  };
  if (Object.values(requiredFields).some((field) => !field)) {
    return res.status(400).json({
      error: "Missing required connection fields",
    });
  }

  if (!["postgres", "mysql"].includes(type)) {
    return res.status(400).json({
      error: "Connection type must be 'postgres' or 'mysql'",
    });
  }

  try {
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

    const newConnection = {
      id: result.lastID,
      connection_name,
      type,
      hostname,
      port,
      database,
      username,
      created_at: new Date().toISOString(),
    };

    res.status(201).json(newConnection);
  } catch (err) {
    console.error("Create connection error:", err.message);
    if (err.message.includes("UNIQUE constraint failed")) {
      res.status(400).json({ error: "Connection name already exists" });
    } else {
      res.status(500).json({ error: "Failed to create connection" });
    }
  }
});

router.put("/connections/:id", async (req, res) => {
  const {
    connection_name,
    type,
    hostname,
    port,
    database,
    username,
    password,
  } = req.body;

  const requiredFields = {
    connection_name,
    type,
    hostname,
    port,
    database,
    username,
    password,
  };
  if (Object.values(requiredFields).some((field) => !field)) {
    return res.status(400).json({
      error: "Missing required connection fields",
    });
  }

  try {
    const db = await dbPromise;
    const result = await db.run(
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

    if (result.changes === 0) {
      return res
        .status(404)
        .json({ error: "Connection not found or access denied" });
    }

    const updated = await db.get(
      "SELECT id, connection_name, type, hostname, port, database, username, created_at FROM connections WHERE id = ?",
      [req.params.id]
    );

    res.json(updated);
  } catch (err) {
    console.error("Update connection error:", err.message);
    if (err.message.includes("UNIQUE constraint failed")) {
      res.status(400).json({ error: "Connection name already exists" });
    } else {
      res.status(500).json({ error: "Failed to update connection" });
    }
  }
});

router.delete("/connections/:id", async (req, res) => {
  const db = await dbPromise;
  let transactionActive = false;

  try {
    // Verify ownership
    const connection = await db.get(
      "SELECT id FROM connections WHERE id = ? AND user_id = ?",
      [req.params.id, req.user?.userId]
    );

    if (!connection) {
      return res
        .status(404)
        .json({ error: "Connection not found or access denied" });
    }

    await db.run("BEGIN TRANSACTION");
    transactionActive = true;

    try {
      // Delete related records in correct order
      await db.run(
        "DELETE FROM connection_designations WHERE connection_id = ?",
        [req.params.id]
      );
      await db.run("DELETE FROM kpis WHERE connection_id = ?", [req.params.id]);

      // Delete dashboards and their charts
      const dashboards = await db.all(
        "SELECT id FROM dashboards WHERE connection_id = ?",
        [req.params.id]
      );
      for (const dashboard of dashboards) {
        await db.run("DELETE FROM charts WHERE dashboard_id = ?", [
          dashboard.id,
        ]);
      }
      await db.run("DELETE FROM dashboards WHERE connection_id = ?", [
        req.params.id,
      ]);

      // Delete facts and their dimensions
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

      await db.run("DELETE FROM dimensions WHERE connection_id = ?", [
        req.params.id,
      ]);
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
    } catch (innerError) {
      if (transactionActive) {
        await db.run("ROLLBACK");
        transactionActive = false;
      }
      throw innerError;
    }
  } catch (err) {
    if (transactionActive) {
      await db.run("ROLLBACK");
    }
    console.error("Delete connection error:", err.message);
    res
      .status(500)
      .json({ error: `Failed to delete connection: ${err.message}` });
  }
});

router.post("/connections/test", async (req, res) => {
  const { type, hostname, port, database, username, password } = req.body;

  const requiredFields = { type, hostname, port, database, username, password };
  if (Object.values(requiredFields).some((field) => !field)) {
    return res.status(400).json({
      error: "Missing required connection fields for testing",
    });
  }

  try {
    const { testConnection } = await import("../database/connection.js");

    const success = await testConnection({
      type,
      hostname,
      port,
      database,
      username,
      password,
    });

    res.json({
      success,
      message: success ? "Connection successful" : "Connection failed",
    });
  } catch (err) {
    console.error("Test connection error:", err.message);
    res.status(500).json({ error: "Failed to test connection" });
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

export default router;

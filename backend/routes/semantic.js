import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbPromise } from "../database/sqliteConnection.js";
import pool from "../database/connection.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const SALT_ROUNDS = 10;

// AUTH
router.post("/login", async (req, res) => {
  const db = await dbPromise;
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Username and password required" });
  }

  try {
    const user = await db.get(
      "SELECT * FROM users WHERE username = ?",
      username
    );
    if (!user)
      return res
        .status(401)
        .json({ success: false, error: "Invalid username or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res
        .status(401)
        .json({ success: false, error: "Invalid username or password" });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ success: true, token, user: { role: user.role } });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ success: false, error: "Failed to login" });
  }
});

// Create a new user
router.post("/users", async (req, res) => {
  const db = await dbPromise;
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({
      success: false,
      error: "Username, password, and role are required",
    });
  }

  try {
    // Check if username already exists
    const existingUser = await db.get(
      "SELECT id FROM users WHERE username = ?",
      username
    );
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "Username already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert the new user
    const result = await db.run(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username, hashedPassword, role]
    );

    res.json({
      success: true,
      user: { id: result.lastID, username, role },
    });
  } catch (err) {
    console.error("Create user error:", err.message);
    res.status(500).json({ success: false, error: "Failed to create user" });
  }
});

router.get("/validate", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, error: "Token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const db = await dbPromise;
    const user = await db.get(
      "SELECT id, username, role FROM users WHERE id = ?",
      decoded.userId
    );

    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid token user" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("Validate token error:", err.message);
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
});

// List all facts
router.get("/facts", async (req, res) => {
  try {
    const db = await dbPromise;
    const facts = await db.all("SELECT * FROM facts");
    res.json(facts);
  } catch (err) {
    console.error("List facts error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// List all dimensions
router.get("/dimensions", async (req, res) => {
  try {
    const db = await dbPromise;
    const dimensions = await db.all("SELECT * FROM dimensions");
    res.json(dimensions);
  } catch (err) {
    console.error("List dimensions error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// List fact-dimension mappings
router.get("/fact-dimensions", async (req, res) => {
  try {
    const db = await dbPromise;
    const mappings = await db.all(`
      SELECT fd.id, f.name AS fact_name, f.table_name AS fact_table, f.column_name AS fact_column,
             d.name AS dimension_name, d.table_name AS dimension_table, d.column_name AS dimension_column,
             fd.join_table, fd.fact_column, fd.dimension_column
      FROM fact_dimensions fd
      JOIN facts f ON fd.fact_id = f.id
      JOIN dimensions d ON fd.dimension_id = d.id
    `);
    res.json(mappings);
  } catch (err) {
    console.error("List fact-dimensions error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add a new fact
router.post("/facts", async (req, res) => {
  try {
    const { name, table_name, column_name, aggregate_function } = req.body;
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO facts (name, table_name, column_name, aggregate_function) VALUES (?, ?, ?, ?)",
      [name, table_name, column_name, aggregate_function]
    );
    res.json({
      id: result.lastID,
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

// Update a fact
router.put("/facts/:id", async (req, res) => {
  try {
    const { name, table_name, column_name, aggregate_function } = req.body;
    const db = await dbPromise;
    await db.run(
      "UPDATE facts SET name = ?, table_name = ?, column_name = ?, aggregate_function = ? WHERE id = ?",
      [name, table_name, column_name, aggregate_function, req.params.id]
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

// Delete a fact
router.delete("/facts/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM facts WHERE id = ?", req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete fact error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add a new dimension (updated to include table_name)
router.post("/dimensions", async (req, res) => {
  try {
    console.log("Create dimension request body:", req.body);
    const { name, table_name, column_name } = req.body;
    if (!table_name) {
      return res.status(400).json({ error: "table_name is required" });
    }
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO dimensions (name, table_name, column_name) VALUES (?, ?, ?)",
      [name, table_name, column_name]
    );
    res.json({ id: result.lastID, name, table_name, column_name });
  } catch (err) {
    console.error("Create dimension error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update a dimension
router.put("/dimensions/:id", async (req, res) => {
  try {
    const { name, table_name, column_name } = req.body;
    const db = await dbPromise;
    await db.run(
      "UPDATE dimensions SET name = ?, table_name = ?, column_name = ? WHERE id = ?",
      [name, table_name, column_name, req.params.id]
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

// Delete a dimension
router.delete("/dimensions/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM dimensions WHERE id = ?", req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete dimension error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add a fact-dimension mapping (manual)
router.post("/fact-dimensions", async (req, res) => {
  try {
    const { fact_id, dimension_id, join_table, fact_column, dimension_column } =
      req.body;
    const db = await dbPromise;
    const result = await db.run(
      `INSERT INTO fact_dimensions 
        (fact_id, dimension_id, join_table, fact_column, dimension_column) 
       VALUES (?, ?, ?, ?, ?)`,
      [fact_id, dimension_id, join_table, fact_column, dimension_column]
    );
    res.json({
      id: result.lastID,
      fact_id,
      dimension_id,
      join_table,
      fact_column,
      dimension_column,
    });
  } catch (err) {
    console.error("Create fact-dimension error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Auto-map facts to dimensions by common columns
router.post("/auto-map", async (req, res) => {
  try {
    const db = await dbPromise;

    // Get all facts and dimensions from metadata
    const facts = await db.all("SELECT * FROM facts");
    const dimensions = await db.all("SELECT * FROM dimensions");

    if (facts.length === 0 || dimensions.length === 0) {
      return res.status(400).json({ error: "No facts or dimensions defined" });
    }

    const autoMappings = [];

    // For each fact
    for (const fact of facts) {
      // Get columns of fact table
      const factColumnsResult = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [fact.table_name]
      );
      const factColumns = factColumnsResult.rows.map((row) => row.column_name);

      // For each dimension
      for (const dim of dimensions) {
        // Use dimension's table_name
        const dimTableColumnsResult = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [dim.table_name]
        );
        const dimTableColumns = dimTableColumnsResult.rows.map(
          (row) => row.column_name
        );

        // Skip if dimension column not in its table
        if (!dimTableColumns.includes(dim.column_name)) {
          console.warn(
            `Dimension ${dim.name} column ${dim.column_name} not found in table ${dim.table_name}`
          );
          continue;
        }

        // Find common columns between fact table and dimension table
        const commonColumns = factColumns.filter((col) =>
          dimTableColumns.includes(col)
        );

        for (const commonCol of commonColumns) {
          // Check if mapping already exists
          const existing = await db.get(
            `SELECT id FROM fact_dimensions WHERE fact_id = ? AND dimension_id = ? AND join_table = ? AND fact_column = ? AND dimension_column = ?`,
            [fact.id, dim.id, dim.table_name, commonCol, commonCol]
          );
          if (existing) continue;

          // Insert auto-mapping
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

    res.json({ success: true, autoMappings });
  } catch (err) {
    console.error("Auto-map error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// List KPIs
router.get("/kpis", async (req, res) => {
  try {
    const db = await dbPromise;
    const kpis = await db.all("SELECT * FROM kpis");
    res.json(kpis);
  } catch (err) {
    console.error("List KPIs error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add KPI
router.post("/kpis", async (req, res) => {
  try {
    const { name, expression, description } = req.body;
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO kpis (name, expression, description, created_by) VALUES (?, ?, ?, ?)",
      [name, expression, description, req.user?.userId || null]
    );
    res.json({ id: result.lastID, name, expression, description });
  } catch (err) {
    console.error("Create KPI error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update KPI
router.put("/kpis/:id", async (req, res) => {
  try {
    const { name, expression, description } = req.body;
    const db = await dbPromise;
    await db.run(
      "UPDATE kpis SET name = ?, expression = ?, description = ? WHERE id = ?",
      [name, expression, description, req.params.id]
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

// Delete KPI
router.delete("/kpis/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM kpis WHERE id = ?", req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete KPI error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

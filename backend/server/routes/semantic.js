// routes/semantic.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbPromise } from "../database/sqliteConnection.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

/**
 * AUTH
 */
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
             d.name AS dimension_name, d.column_name AS dimension_column,
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

// Add a new dimension
router.post("/dimensions", async (req, res) => {
  try {
    const { name, column_name } = req.body;
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO dimensions (name, column_name) VALUES (?, ?)",
      [name, column_name]
    );
    res.json({ id: result.lastID, name, column_name });
  } catch (err) {
    console.error("Create dimension error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add a fact-dimension mapping
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


export default router;

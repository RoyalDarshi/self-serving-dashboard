// routes/semantic.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbPromise } from "../database/sqliteConnection.js";
import { isSafeIdent } from "../utils/sanitize.js";

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

router.get("/validate", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  if (!user)
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token" });

  try {
    const dbUser = await db.get(
      "SELECT id, role FROM users WHERE id = ?",
      user.userId
    );
    if (!dbUser)
      return res.status(401).json({ success: false, error: "User not found" });
    res.json({ success: true, user: { role: dbUser.role } });
  } catch (error) {
    console.error("Token validation error:", error.message);
    res.status(500).json({ success: false, error: "Failed to validate token" });
  }
});

/**
 * USER MANAGEMENT (admin only)
 */
router.post("/users", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { username, password, role } = req.body;

  if (!user || user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, error: "Admin access required" });
  }
  if (!username || !password || !["user", "admin"].includes(role)) {
    return res.status(400).json({ success: false, error: "Invalid input" });
  }

  try {
    const existing = await db.get(
      "SELECT 1 FROM users WHERE username = ?",
      username
    );
    if (existing)
      return res
        .status(400)
        .json({ success: false, error: "Username already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await db.run(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      username,
      hashed,
      role
    );
    res.json({ success: true, message: "User created successfully" });
  } catch (error) {
    console.error("Create user error:", error.message);
    res.status(500).json({ success: false, error: "Failed to create user" });
  }
});

/**
 * FACTS / DIMENSIONS / KPIS METADATA
 * NOTE: We only INSERT metadata now. We DO NOT create SQLite tables.
 */

// Create Fact (admin)
router.post("/facts", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { name, table_name, column_name, aggregation } = req.body;

  if (!user || user.role !== "admin")
    return res
      .status(403)
      .json({ success: false, error: "Admin access required" });

  if (!name || !table_name || !column_name || !aggregation)
    return res.status(400).json({ success: false, error: "Missing inputs" });

  // basic identifier safety
  if (![table_name, column_name, aggregation].every(isSafeIdent)) {
    return res
      .status(400)
      .json({ success: false, error: "Unsafe identifiers" });
  }

  try {
    await db.run(
      `INSERT INTO facts (name, table_name, column_name, aggregation, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      name,
      table_name,
      column_name,
      aggregation,
      user.userId
    );
    res.json({ success: true, message: "Fact metadata stored successfully" });
  } catch (error) {
    console.error("Error storing fact:", error.message);
    res.status(500).json({ success: false, error: "Failed to store fact" });
  }
});

// List Facts
router.get("/facts", async (req, res) => {
  const db = await dbPromise;
  try {
    const rows = await db.all(
      `SELECT id, name, table_name, column_name, aggregation FROM facts ORDER BY id DESC`
    );
    res.json({ success: true, facts: rows });
  } catch (error) {
    console.error("List facts error:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch facts" });
  }
});

// Create Dimension (admin)
router.post("/dimensions", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { name, table_name, column_name } = req.body;

  if (!user || user.role !== "admin")
    return res
      .status(403)
      .json({ success: false, error: "Admin access required" });

  if (!name || !table_name || !column_name)
    return res.status(400).json({ success: false, error: "Missing inputs" });

  if (![table_name, column_name].every(isSafeIdent)) {
    return res
      .status(400)
      .json({ success: false, error: "Unsafe identifiers" });
  }

  try {
    await db.run(
      `INSERT INTO dimensions (name, table_name, column_name, created_by)
       VALUES (?, ?, ?, ?)`,
      name,
      table_name,
      column_name,
      user.userId
    );
    res.json({
      success: true,
      message: "Dimension metadata stored successfully",
    });
  } catch (error) {
    console.error("Error storing dimension:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to store dimension" });
  }
});

// List Dimensions
router.post("/dimensions", async (req, res) => {
  const {
    name,
    fact_table,
    fact_column,
    dimension_table,
    dimension_column,
    display_column,
  } = req.body;
  const user = req.user;
  try {
    await appDb.run(
      `INSERT INTO dimensions 
        (name, fact_table, fact_column, dimension_table, dimension_column, display_column, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        fact_table,
        fact_column,
        dimension_table,
        dimension_column,
        display_column,
        user?.userId || null,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Create dimension error:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to create dimension" });
  }
});


// Create KPI (admin)
router.post("/kpis", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { name, sql_query, fact_id, dimension_id } = req.body;

  if (!user || user.role !== "admin")
    return res
      .status(403)
      .json({ success: false, error: "Admin access required" });

  if (!name || !sql_query) {
    return res.status(400).json({ success: false, error: "Missing inputs" });
  }
  if (!sql_query.trim().toUpperCase().startsWith("SELECT")) {
    return res
      .status(400)
      .json({ success: false, error: "KPI SQL must be a SELECT query" });
  }

  try {
    await db.run(
      `INSERT INTO kpis (name, sql_query, fact_id, dimension_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      name,
      sql_query,
      fact_id || null,
      dimension_id || null,
      user.userId
    );
    res.json({ success: true, message: "KPI metadata stored successfully" });
  } catch (error) {
    console.error("Error storing KPI:", error.message);
    res.status(500).json({ success: false, error: "Failed to store KPI" });
  }
});

// List KPIs
router.get("/kpis", async (req, res) => {
  const db = await dbPromise;
  try {
    const rows = await db.all(
      `SELECT id, name, sql_query, fact_id, dimension_id FROM kpis ORDER BY id DESC`
    );
    res.json({ success: true, kpis: rows });
  } catch (error) {
    console.error("List KPIs error:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch KPIs" });
  }
});

export default router;

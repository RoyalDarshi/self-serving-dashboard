import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbPromise } from "../database/sqliteConnection.js";
import {
  getPoolForConnection,
  quoteIdentifier,
} from "../database/connection.js";
import pg from "pg";
import mysql from "mysql2/promise";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const SALT_ROUNDS = 10;

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
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid username or password" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid username or password" });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ success: true, token, user: { role: user.role } });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ success: false, error: "Failed to login" });
  }
});

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
    const existingUser = await db.get(
      "SELECT id FROM users WHERE username = ?",
      username
    );
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
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

router.get("/connections", async (req, res) => {
  try {
    const db = await dbPromise;
    const connections = await db.all(
      "SELECT id, connection_name, description, type, hostname, port, database, command_timeout, max_transport_objects, username, selected_db, created_at FROM connections WHERE user_id = ?",
      [req.user.userId]
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
      !password
    ) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const db = await dbPromise;
    const result = await db.run(
      `INSERT INTO connections (
        user_id, connection_name, description, type, hostname, port, database,
        command_timeout, max_transport_objects, username, password, selected_db
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.userId,
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
      type,
      hostname,
      port,
      database,
      username,
      password,
      command_timeout,
      max_transport_objects,
      selected_db,
    } = req.body;

    if (!type || !hostname || !port || !database || !username || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Required fields missing" });
    }

    let pool;
    if (type === "postgres") {
      pool = new pg.Pool({
        host: hostname,
        port,
        database,
        user: username,
        password,
        connectionTimeoutMillis: command_timeout || 5000,
        max: max_transport_objects || 20,
      });
      const client = await pool.connect();
      try {
        if (selected_db) {
          await client.query(
            `SET search_path TO ${quoteIdentifier(selected_db, type)}`
          );
        }
        await client.query("SELECT 1");
        res.json({ success: true, message: "Connection test successful" });
      } finally {
        client.release();
        await pool.end();
      }
    } else if (type === "mysql") {
      pool = await mysql.createPool({
        host: hostname,
        port,
        database,
        user: username,
        password,
        connectTimeout: command_timeout || 10000,
        connectionLimit: max_transport_objects || 10,
      });
      try {
        if (selected_db) {
          await pool.query(`USE ${quoteIdentifier(selected_db, type)}`);
        }
        await pool.query("SELECT 1");
        res.json({ success: true, message: "Connection test successful" });
      } finally {
        await pool.end();
      }
    } else {
      return res
        .status(400)
        .json({ success: false, error: `Unsupported database type: ${type}` });
    }
  } catch (err) {
    console.error("Test connection error:", err.message);
    res
      .status(500)
      .json({ success: false, error: `Failed to connect: ${err.message}` });
  }
});

router.delete("/connections/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM connections WHERE id = ? AND user_id = ?", [
      req.params.id,
      req.user.userId,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete connection error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/schemas", async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) {
      return res
        .status(400)
        .json({ success: false, error: "connection_id required" });
    }

    // get connection + pool
    const { pool, type } = await getPoolForConnection(
      connection_id,
      req.user?.userId
    );

    // fetch connection details to know schema/database
    const db = await dbPromise;
    const conn = await db.get(`SELECT * FROM connections WHERE id = ?`, [
      connection_id,
    ]);

    const client = await pool.connect();
    try {
      const schemas = [];
      let tablesQuery, columnsQuery;

      if (type === "postgres") {
        // 🔎 list tables in public schema
        tablesQuery = `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE';
        `;

        columnsQuery = `
          SELECT 
            c.column_name, 
            c.data_type, 
            c.is_nullable,
            COALESCE(
              (SELECT 1
               FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage kcu
                 ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
               WHERE tc.constraint_type = 'PRIMARY KEY'
                 AND tc.table_name = c.table_name
                 AND kcu.column_name = c.column_name
                 AND tc.table_schema = c.table_schema), 0
            ) AS pk
          FROM information_schema.columns c
          WHERE c.table_name = $1
            AND c.table_schema = 'public';
        `;
      } else if (type === "mysql") {
        // 🔎 list tables in selected database
        tablesQuery = `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = ?
            AND table_type = 'BASE TABLE';
        `;

        columnsQuery = `
          SELECT 
            c.column_name, 
            c.data_type, 
            c.is_nullable,
            (CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN 1 ELSE 0 END) AS pk
          FROM information_schema.columns c
          LEFT JOIN information_schema.key_column_usage kcu
            ON c.table_name = kcu.table_name 
            AND c.column_name = kcu.column_name 
            AND c.table_schema = kcu.table_schema
          LEFT JOIN information_schema.table_constraints tc
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema
          WHERE c.table_name = ?
            AND c.table_schema = ?;
        `;
      } else {
        return res.status(400).json({
          success: false,
          error: `Unsupported database type: ${type}`,
        });
      }

      // ✅ Fetch all tables
      let tablesResult;
      if (type === "postgres") {
        tablesResult = await client.query(tablesQuery);
      } else {
        tablesResult = await client.query(tablesQuery, [conn.database]);
      }

      const tables =
        type === "postgres"
          ? tablesResult.rows.map((r) => r.table_name)
          : tablesResult[0].map((r) => r.table_name);

      console.log("Tables found:", tables);

      // ✅ Fetch columns for each table
      for (const tableName of tables) {
        console.log("Fetching columns for table:", tableName);

        let columnsResult;
        if (type === "postgres") {
          columnsResult = await client.query(columnsQuery, [tableName]);
        } else {
          columnsResult = await client.query(columnsQuery, [
            tableName,
            conn.database,
          ]);
        }

        const rows =
          type === "postgres" ? columnsResult.rows : columnsResult[0];

        const columns = rows.map((row) => ({
          name: row.column_name,
          type: row.data_type,
          notnull: row.is_nullable === "NO" ? 1 : 0,
          pk: row.pk ? 1 : 0,
        }));

        schemas.push({ tableName, columns });
      }

      res.json({ success: true, schemas });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error fetching schemas:", err.message, "Stack:", err.stack);
    res.status(500).json({ success: false, error: "Failed to fetch schemas" });
  }
});


router.get("/facts", async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }
    const db = await dbPromise;
    const facts = await db.all("SELECT * FROM facts WHERE connection_id = ?", [
      connection_id,
    ]);
    res.json(facts);
  } catch (err) {
    console.error("List facts error:", err.message);
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
      "SELECT * FROM dimensions WHERE connection_id = ?",
      [connection_id]
    );
    res.json(dimensions);
  } catch (err) {
    console.error("List dimensions error:", err.message);
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
    const mappings = await db.all(
      `
      SELECT fd.id, f.name AS fact_name, f.table_name AS fact_table, f.column_name AS fact_column,
             d.name AS dimension_name, d.table_name AS dimension_table, d.column_name AS dimension_column,
             fd.join_table, fd.fact_column, fd.dimension_column
      FROM fact_dimensions fd
      JOIN facts f ON fd.fact_id = f.id
      JOIN dimensions d ON fd.dimension_id = d.id
      WHERE f.connection_id = ?
    `,
      [connection_id]
    );
    res.json(mappings);
  } catch (err) {
    console.error("List fact-dimensions error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/facts", async (req, res) => {
  try {
    const { connection_id, name, table_name, column_name, aggregate_function } =
      req.body;
    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO facts (connection_id, name, table_name, column_name, aggregate_function) VALUES (?, ?, ?, ?, ?)",
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

router.post("/dimensions", async (req, res) => {
  try {
    const { connection_id, name, table_name, column_name } = req.body;
    if (!connection_id || !table_name) {
      return res
        .status(400)
        .json({ error: "connection_id and table_name are required" });
    }
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO dimensions (connection_id, name, table_name, column_name) VALUES (?, ?, ?, ?)",
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

    const facts = await db.all("SELECT * FROM facts WHERE connection_id = ?", [
      connection_id,
    ]);
    const dimensions = await db.all(
      "SELECT * FROM dimensions WHERE connection_id = ?",
      [connection_id]
    );

    if (facts.length === 0 || dimensions.length === 0) {
      return res.status(400).json({ error: "No facts or dimensions defined" });
    }

    const autoMappings = [];
    let columnsQuery =
      type === "postgres"
        ? `SELECT column_name FROM information_schema.columns WHERE table_name = $1`
        : `SELECT column_name FROM information_schema.columns WHERE table_name = ?`;

    try {
      for (const fact of facts) {
        const factColumnsResult = await client.query(columnsQuery, [
          fact.table_name,
        ]);
        const factColumns = (
          factColumnsResult.rows || factColumnsResult[0]
        ).map((row) => row.column_name);

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

      res.json({ success: true, autoMappings });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Auto-map error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

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
    if (!connection_id) {
      return res.status(400).json({ error: "connection_id required" });
    }
    const db = await dbPromise;
    const result = await db.run(
      "INSERT INTO kpis (connection_id, name, expression, description, created_by) VALUES (?, ?, ?, ?, ?)",
      [connection_id, name, expression, description, req.user?.userId || null]
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

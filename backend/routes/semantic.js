import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbPromise } from "../database/sqliteConnection.js";
import ldap from "ldapjs";
import fs from "fs";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const SALT_ROUNDS = 10;

// LDAP Configuration
const LDAP_CONFIG = {
  url: process.env.LDAP_URL || "ldaps://192.168.29.120:636",
  baseDN: process.env.LDAP_BASE_DN || "dc=ayd",
  bindDN: process.env.LDAP_BIND_DN || "uid=binduser,ou=People,dc=ayd",
  bindPassword: process.env.LDAP_BIND_PASSWORD || "BindPass123!",
  caCert: fs.readFileSync(
    process.env.LDAP_CA_CERT || "C://Users/priya/.ssh/id_rsa"
  ), // Adjust path as needed
  attributes: {
    user: ["uid", "cn", "sn"],
  },
};

console.log(LDAP_CONFIG)
// Constants
const VALID_ROLES = ["admin", "user", "designer"];
const VALID_DESIGNATIONS = [
  "Business Analyst",
  "Data Scientist",
  "Operations Manager",
  "Finance Manager",
  "Consumer Insights Manager",
  "Store / Regional Manager",
];

// Middleware
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Access denied. Admin role required" });
  }
  next();
};

const requireAdminOrSelf = (req, res, next) => {
  const userId = parseInt(req.params.id);
  if (req.user?.role !== "admin" && req.user?.userId !== userId) {
    return res.status(403).json({ error: "Access denied. Admin or self only" });
  }
  next();
};

// LDAP Authentication
router.post("/auth/ldap-login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  let client;
  try {
    client = ldap.createClient({
      url: LDAP_CONFIG.url,
      tlsOptions: {
        ca: [LDAP_CONFIG.caCert],
        rejectUnauthorized: false, // <-- FIX 1: Allow self-signed certs
      },
    });

    // FIX 2: Use error handler for logging only, not for sending responses.
    client.on("error", (err) => {
      console.error("LDAP Client Background Error:", err);
    });

    // Authenticate user
    await new Promise((resolve, reject) => {
      client.bind(`uid=${username},ou=People,dc=ayd`, password, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Fetch user attributes
    let userAttributes = null;
    await new Promise((resolve, reject) => {
      client.search(
        `uid=${username},ou=People,dc=ayd`,
        {
          filter: "(objectClass=inetOrgPerson)",
          scope: "base",
          attributes: LDAP_CONFIG.attributes.user,
        },
        (err, result) => {
          if (err) return reject(err);
          result.on("searchEntry", (entry) => {
            userAttributes = entry.object;
          });
          result.on("end", () => resolve());
          result.on("error", (err) => reject(err));
        }
      );
    });

    if (!userAttributes) {
      return res.status(401).json({ error: "Invalid LDAP credentials" });
    }

    const db = await dbPromise;
    let user = await db.get(
      "SELECT id, username, role, designation FROM users WHERE username = ?",
      [username]
    );

    if (!user) {
      // Create local profile for LDAP user
      const result = await db.run(
        "INSERT INTO users (username, password, role, designation, is_ad_user) VALUES (?, ?, ?, ?, ?)",
        [username, null, "user", null, true]
      );

      user = await db.get(
        "SELECT id, username, role, designation FROM users WHERE id = ?",
        [result.lastID]
      );
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, designation: user.designation },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        designation: user.designation,
      },
    });
  } catch (err) {
    // This single catch block now handles all errors
    console.error("LDAP authentication error:", err.message);
    res
      .status(401)
      .json({ error: "Invalid LDAP credentials or service unavailable" });
  } finally {
    // Ensure the client is always unbound
    if (client) {
      client.unbind();
    }
  }
});

// Import users from LDAP (admin only)
router.post("/import-ldap-users", requireAdmin, async (req, res) => {
  let client;
  try {
    client = ldap.createClient({
      url: LDAP_CONFIG.url,
      tlsOptions: {
        ca: [LDAP_CONFIG.caCert],
        rejectUnauthorized: false, // <-- FIX 1: Allow self-signed certs
      },
    });

    // FIX 2: Use error handler for logging only, not for sending responses.
    client.on("error", (err) => {
      console.error("LDAP Client Background Error:", err);
    });

    // Bind with bind user
    await new Promise((resolve, reject) => {
      client.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Search for users
    const opts = {
      filter: "(objectClass=inetOrgPerson)",
      scope: "sub",
      attributes: LDAP_CONFIG.attributes.user,
    };
    let ldapUsers = [];
    await new Promise((resolve, reject) => {
      client.search("ou=People,dc=ayd", opts, (err, result) => {
        if (err) return reject(err);
        result.on("searchEntry", (entry) => {
          ldapUsers.push(entry.object);
        });
        result.on("end", () => resolve());
        result.on("error", (err) => reject(err));
      });
    });

    if (!ldapUsers || ldapUsers.length === 0) {
      return res.json({ importedCount: 0 });
    }

    const db = await dbPromise;
    let importedCount = 0;

    for (const ldapUser of ldapUsers) {
      const username = ldapUser.uid;
      if (!username) continue;

      try {
        const existing = await db.get(
          "SELECT id FROM users WHERE username = ?",
          [username]
        );

        if (!existing) {
          await db.run(
            "INSERT INTO users (username, password, role, designation, is_ad_user) VALUES (?, ?, ?, ?, ?)",
            [username, null, "user", null, true]
          );
          importedCount++;
        }
      } catch (insertErr) {
        console.error(`Failed to import user ${username}:`, insertErr.message);
      }
    }

    res.json({ importedCount });
  } catch (err) {
    // This single catch block now handles all errors
    console.error("LDAP import error:", err.message);
    res.status(500).json({ error: "Failed to process LDAP import." });
  } finally {
    // Ensure the client is always unbound
    if (client) {
      client.unbind();
    }
  }
});

// User Management
router.post("/users", async (req, res) => {
  const { username, password, role, designation } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({
      error: "Username, password, and role are required",
    });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
    });
  }

  if (designation && !VALID_DESIGNATIONS.includes(designation)) {
    return res.status(400).json({
      error: `Invalid designation. Must be one of: ${VALID_DESIGNATIONS.join(
        ", "
      )}`,
    });
  }

  try {
    const db = await dbPromise;
    const existingUser = await db.get(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.run(
      "INSERT INTO users (username, password, role, designation, is_ad_user) VALUES (?, ?, ?, ?, ?)",
      [username, hashedPassword, role, designation || null, false]
    );

    const newUser = {
      id: result.lastID,
      username,
      role,
      designation: designation || null,
      is_ad_user: false,
    };

    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error("Create user error:", err.message);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const db = await dbPromise;
    const users = await db.all(
      "SELECT id, username, role, designation, created_at, is_ad_user FROM users ORDER BY created_at DESC"
    );
    res.json(users);
  } catch (err) {
    console.error("List users error:", err.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/users/:id", requireAdminOrSelf, async (req, res) => {
  try {
    const db = await dbPromise;
    const user = await db.get(
      "SELECT id, username, role, designation, created_at, is_ad_user FROM users WHERE id = ?",
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Get user error:", err.message);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.put("/users/:id", requireAdminOrSelf, async (req, res) => {
  const { username, password, role, designation } = req.body;
  const updates = new Map();

  if (username) updates.set("username", username);
  if (password) updates.set("password", password);
  if (role) updates.set("role", role);
  if (designation !== undefined) updates.set("designation", designation);

  if (updates.size === 0) {
    return res.status(400).json({
      error:
        "At least one field (username, password, role, designation) must be provided",
    });
  }

  try {
    const db = await dbPromise;
    const currentUser = await db.get(
      "SELECT is_ad_user FROM users WHERE id = ?",
      [req.params.id]
    );

    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (currentUser.is_ad_user && password) {
      return res
        .status(400)
        .json({ error: "Cannot update password for LDAP users" });
    }

    // Validation
    if (username) {
      const existingUser = await db.get(
        "SELECT id FROM users WHERE username = ? AND id != ?",
        [username, req.params.id]
      );
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
      });
    }

    if (designation && !VALID_DESIGNATIONS.includes(designation)) {
      return res.status(400).json({
        error: `Invalid designation. Must be one of: ${VALID_DESIGNATIONS.join(
          ", "
        )}`,
      });
    }

    // Prepare update query
    const updateFields = [];
    const values = [];

    for (const [field, value] of updates) {
      updateFields.push(`${field} = ?`);

      if (field === "password") {
        values.push(await bcrypt.hash(value, SALT_ROUNDS));
      } else {
        values.push(value);
      }
    }

    values.push(req.params.id);

    await db.run(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
      values
    );

    const updatedUser = await db.get(
      "SELECT id, username, role, designation, created_at, is_ad_user FROM users WHERE id = ?",
      [req.params.id]
    );

    res.json(updatedUser);
  } catch (err) {
    console.error("Update user error:", err.message);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const db = await dbPromise;
    const user = await db.get("SELECT id FROM users WHERE id = ?", [
      req.params.id,
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await db.run("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err.message);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

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
    // Import testConnection from your connection module
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

// Export router
export default router;

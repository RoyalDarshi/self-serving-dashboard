// updated: semantic.js
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

console.log(LDAP_CONFIG);
// Constants
const VALID_ROLES = ["admin", "user", "designer"];
const VALID_ACCESS_LEVELS = ["viewer", "editor"]; // Added for validation
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
        rejectUnauthorized: false,
      },
    });

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
    // Updated SELECT to get access_level
    let user = await db.get(
      "SELECT id, username, role, designation, access_level FROM users WHERE username = ?",
      [username]
    );

    if (!user) {
      // Create local profile for LDAP user
      // Defaulting new LDAP users to 'viewer'
      const result = await db.run(
        "INSERT INTO users (username, password, role, designation, access_level, is_ad_user) VALUES (?, ?, ?, ?, ?, ?)",
        [username, null, "user", null, "viewer", true]
      );

      user = await db.get(
        "SELECT id, username, role, designation, access_level FROM users WHERE id = ?",
        [result.lastID]
      );
    }

    // Updated JWT payload
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        designation: user.designation,
        accessLevel: user.access_level, // Added access_level
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Updated response object
    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        designation: user.designation,
        accessLevel: user.access_level, // Added access_level
      },
    });
  } catch (err) {
    console.error("LDAP authentication error:", err.message);
    res
      .status(401)
      .json({ error: "Invalid LDAP credentials or service unavailable" });
  } finally {
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
        rejectUnauthorized: false,
      },
    });

    client.on("error", (err) => {
      console.error("LDAP Client Background Error:", err);
    });

    await new Promise((resolve, reject) => {
      client.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

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
          // Defaulting imported users to 'viewer'
          await db.run(
            "INSERT INTO users (username, password, role, designation, access_level, is_ad_user) VALUES (?, ?, ?, ?, ?, ?)",
            [username, null, "user", null, "viewer", true]
          );
          importedCount++;
        }
      } catch (insertErr) {
        console.error(`Failed to import user ${username}:`, insertErr.message);
      }
    }

    res.json({ importedCount });
  } catch (err) {
    console.error("LDAP import error:", err.message);
    res.status(500).json({ error: "Failed to process LDAP import." });
  } finally {
    if (client) {
      client.unbind();
    }
  }
});

// User Management
router.post("/users", async (req, res) => {
  // Destructure access_level from body
  const { username, password, role, designation, access_level } = req.body;

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

  // --- Start: New Validation Logic for access_level ---
  let finalAccessLevel = null;
  if (role === "user") {
    if (access_level && !VALID_ACCESS_LEVELS.includes(access_level)) {
      return res.status(400).json({
        error: `Invalid access level for user role. Must be one of: ${VALID_ACCESS_LEVELS.join(
          ", "
        )}`,
      });
    }
    // Default to 'viewer' if not provided for a user
    finalAccessLevel = access_level || "viewer";
  }
  // --- End: New Validation Logic ---

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
    // Updated INSERT statement
    const result = await db.run(
      "INSERT INTO users (username, password, role, designation, access_level, is_ad_user) VALUES (?, ?, ?, ?, ?, ?)",
      [
        username,
        hashedPassword,
        role,
        designation || null,
        finalAccessLevel,
        false,
      ]
    );

    const newUser = {
      id: result.lastID,
      username,
      role,
      designation: designation || null,
      accessLevel: finalAccessLevel, // Use consistent naming
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
    // Updated SELECT to get access_level
    const users = await db.all(
      "SELECT id, username, role, designation, access_level, created_at, is_ad_user FROM users ORDER BY created_at DESC"
    );
    // Map to a consistent key like 'accessLevel' for the frontend
    const formattedUsers = users.map((u) => ({
      ...u,
      accessLevel: u.access_level,
    }));
    res.json(formattedUsers);
  } catch (err) {
    console.error("List users error:", err.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/users/:id", requireAdminOrSelf, async (req, res) => {
  try {
    const db = await dbPromise;
    // Updated SELECT to get access_level
    const user = await db.get(
      "SELECT id, username, role, designation, access_level, created_at, is_ad_user FROM users WHERE id = ?",
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Map to a consistent key
    const formattedUser = { ...user, accessLevel: user.access_level };
    res.json(formattedUser);
  } catch (err) {
    console.error("Get user error:", err.message);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.put("/users/:id", requireAdminOrSelf, async (req, res) => {
  const { username, password, role, designation, accessLevel } = req.body;
  const updates = new Map();

  if (username) updates.set("username", username);
  if (password) updates.set("password", password);
  if (role) updates.set("role", role);
  if (designation !== undefined) updates.set("designation", designation);
  if (accessLevel !== undefined) updates.set("access_level", accessLevel);

  if (updates.size === 0) {
    return res.status(400).json({
      error:
        "At least one field (username, password, role, designation, accessLevel) must be provided",
    });
  }

  try {
    const db = await dbPromise;
    const currentUser = await db.get(
      "SELECT role, is_ad_user FROM users WHERE id = ?",
      [req.params.id]
    );

    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // --- Start: Corrected Logic ---
    const newRole = role || currentUser.role;
    if (newRole === "user") {
      // 1. Validate the incoming accessLevel if it exists
      if (accessLevel && !VALID_ACCESS_LEVELS.includes(accessLevel)) {
        return res.status(400).json({
          error: `Invalid access level. Must be one of: ${VALID_ACCESS_LEVELS.join(
            ", "
          )}`,
        });
      }
      // 2. **THE FIX**: If role is being changed TO 'user' and no accessLevel is provided, default it to 'viewer'.
      if (updates.has("role") && accessLevel === undefined) {
        updates.set("access_level", "viewer");
      }
    } else {
      // 3. If role is changing to a non-user role, always nullify the accessLevel
      if (updates.has("role")) {
        updates.set("access_level", null);
      }
    }
    // --- End: Corrected Logic ---

    if (currentUser.is_ad_user && password) {
      return res
        .status(400)
        .json({ error: "Cannot update password for LDAP users" });
    }

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

    const updateFields = [];
    const values = [];

    for (const [field, value] of updates) {
      updateFields.push(`${field} = ?`);
      if (field === "password" && value) {
        // Also check if password is not an empty string
        values.push(await bcrypt.hash(value, SALT_ROUNDS));
      } else {
        values.push(value);
      }
    }

    // Do not update password if it's an empty string
    const passwordIndex = updateFields.findIndex((f) =>
      f.startsWith("password")
    );
    if (passwordIndex > -1 && !updates.get("password")) {
      updateFields.splice(passwordIndex, 1);
      values.splice(passwordIndex, 1);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    values.push(req.params.id);

    await db.run(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
      values
    );

    const updatedUser = await db.get(
      "SELECT id, username, role, designation, access_level, created_at, is_ad_user FROM users WHERE id = ?",
      [req.params.id]
    );

    const formattedUser = {
      ...updatedUser,
      accessLevel: updatedUser.access_level,
    };
    res.json(formattedUser);
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

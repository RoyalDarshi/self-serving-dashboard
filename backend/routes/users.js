// users.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbPromise } from "../database/sqliteConnection.js";
import ldap from "ldapjs";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const SALT_ROUNDS = 10;

// LDAP Configuration
const LDAP_CONFIG = {
  url: process.env.LDAP_URL || "ldaps://192.168.29.120:636",
  baseDN: process.env.LDAP_BASE_DN || "dc=ayd",
  bindDN: process.env.LDAP_BIND_DN || "uid=binduser,ou=People,dc=ayd",
  bindPassword: process.env.LDAP_BIND_PASSWORD || "BindPass123!",
  attributes: {
    user: ["uid", "cn", "sn"],
  },
};

console.log(LDAP_CONFIG);
// Constants
const VALID_ROLES = ["admin", "user", "designer"];
const VALID_ACCESS_LEVELS = ["viewer", "editor"];
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

// Import users from LDAP (admin only)
router.post("/import-ldap-users", requireAdmin, async (req, res) => {
  let client;
  try {
    client = ldap.createClient({
      url: LDAP_CONFIG.url,
      tlsOptions: {
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
            [username, null, "user", "Business Analyst", "viewer", true]
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

  let finalAccessLevel = null;
  if (role === "user") {
    if (access_level && !VALID_ACCESS_LEVELS.includes(access_level)) {
      return res.status(400).json({
        error: `Invalid access level for user role. Must be one of: ${VALID_ACCESS_LEVELS.join(
          ", "
        )}`,
      });
    }
    finalAccessLevel = access_level || "viewer";
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
      accessLevel: finalAccessLevel,
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
      "SELECT id, username, role, designation, access_level, created_at, is_ad_user FROM users ORDER BY created_at DESC"
    );
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
    const user = await db.get(
      "SELECT id, username, role, designation, access_level, created_at, is_ad_user FROM users WHERE id = ?",
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

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

    const newRole = role || currentUser.role;
    if (newRole === "user") {
      if (accessLevel && !VALID_ACCESS_LEVELS.includes(accessLevel)) {
        return res.status(400).json({
          error: `Invalid access level. Must be one of: ${VALID_ACCESS_LEVELS.join(
            ", "
          )}`,
        });
      }
      if (updates.has("role") && accessLevel === undefined) {
        updates.set("access_level", "viewer");
      }
    } else {
      if (updates.has("role")) {
        updates.set("access_level", null);
      }
    }

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
        values.push(await bcrypt.hash(value, SALT_ROUNDS));
      } else {
        values.push(value);
      }
    }

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

export default router;

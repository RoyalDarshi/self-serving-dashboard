// fixed: users.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ldap from "ldapjs";
import { dbPromise } from "../database/sqliteConnection.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const SALT_ROUNDS = 10;

// ✅ Correct LDAP configuration
const LDAP_CONFIG = {
  url: process.env.LDAP_URL || "ldap://192.168.1.15:389",
  baseDN: process.env.LDAP_BASE_DN || "dc=ayd",
  peopleDN: "ou=People,dc=ayd",
  adminDN: process.env.LDAP_BIND_DN || "cn=admin,dc=ayd",
  adminPassword: process.env.LDAP_BIND_PASSWORD || "BindPass123!",
  attributes: ["uid", "cn", "sn", "mail"],
};

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

// 🔒 Middleware
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin required" });
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

//
// ✅ Import LDAP users into SQLite (Admin-only)
//
router.post("/import-ldap-users", requireAdmin, async (req, res) => {
  let client;
  try {
    client = ldap.createClient({
      url: LDAP_CONFIG.url,
      reconnect: true,
      timeout: 10000,
      connectTimeout: 15000,
    });

    client.on("error", (err) => {
      console.error("LDAP client background error:", err);
    });

    // --- Bind as admin ---
    await new Promise((resolve, reject) => {
      client.bind(LDAP_CONFIG.adminDN, LDAP_CONFIG.adminPassword, (err) => {
        if (err) {
          console.error("LDAP admin bind failed:", err.message);
          return reject(new Error("LDAP admin authentication failed"));
        }
        console.log("LDAP admin bind successful");
        resolve();
      });
    });

    // --- Search for all inetOrgPerson users under ou=People ---
    const opts = {
      filter: "(objectClass=inetOrgPerson)",
      scope: "sub",
      attributes: LDAP_CONFIG.attributes,
    };

    const ldapUsers = [];
    await new Promise((resolve, reject) => {
      client.search(LDAP_CONFIG.peopleDN, opts, (err, res) => {
        if (err) return reject(err);

        res.on("searchEntry", (entry) => {
          ldapUsers.push(entry.object);
        });
        res.on("error", reject);
        res.on("end", resolve);
      });
    });

    console.log(`Found ${ldapUsers.length} LDAP users`);

    if (ldapUsers.length === 0)
      return res.json({ importedCount: 0, message: "No LDAP users found" });

    const db = await dbPromise;
    let importedCount = 0;

    // --- Sync LDAP users into SQLite ---
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
            "INSERT INTO users (username, password, role, designation, access_level, is_ad_user) VALUES (?, ?, ?, ?, ?, ?)",
            [username, null, "user", "Business Analyst", "viewer", true]
          );
          importedCount++;
        }
      } catch (insertErr) {
        console.error(`Failed to import user ${username}:`, insertErr.message);
      }
    }

    client.unbind();

    res.json({
      importedCount,
      message: `${importedCount} LDAP users successfully imported.`,
    });
  } catch (err) {
    console.error("LDAP import error:", err.message);
    if (client) client.unbind();
    res.status(500).json({ error: "Failed to import LDAP users." });
  }
});

//
// ✅ Create Local User
//
router.post("/users", async (req, res) => {
  const { username, password, role, designation, access_level } = req.body;

  if (!username || !password || !role)
    return res
      .status(400)
      .json({ error: "Username, password, and role are required" });

  if (!VALID_ROLES.includes(role))
    return res.status(400).json({
      error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
    });

  let finalAccessLevel = null;
  if (role === "user") {
    finalAccessLevel = access_level || "viewer";
    if (!VALID_ACCESS_LEVELS.includes(finalAccessLevel))
      return res.status(400).json({
        error: `Invalid access level. Must be one of: ${VALID_ACCESS_LEVELS.join(
          ", "
        )}`,
      });
  }

  if (designation && !VALID_DESIGNATIONS.includes(designation))
    return res.status(400).json({
      error: `Invalid designation. Must be one of: ${VALID_DESIGNATIONS.join(
        ", "
      )}`,
    });

  try {
    const db = await dbPromise;
    const existingUser = await db.get(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existingUser)
      return res.status(400).json({ error: "Username already exists" });

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

    res.status(201).json({
      user: {
        id: result.lastID,
        username,
        role,
        designation: designation || null,
        accessLevel: finalAccessLevel,
        is_ad_user: false,
      },
    });
  } catch (err) {
    console.error("Create user error:", err.message);
    res.status(500).json({ error: "Failed to create user" });
  }
});

//
// ✅ List Users (Admin only)
//
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const db = await dbPromise;
    const users = await db.all(
      "SELECT id, username, role, designation, access_level, created_at, is_ad_user FROM users ORDER BY created_at DESC"
    );
    res.json(
      users.map((u) => ({
        ...u,
        accessLevel: u.access_level,
      }))
    );
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

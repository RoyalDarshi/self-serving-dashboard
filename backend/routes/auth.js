// updated: auth.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ldap from "ldapjs";
// import fs from "fs"; // Removed
import { dbPromise } from "../database/sqliteConnection.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const SALT_ROUNDS = 10;

// LDAP Configuration
const LDAP_CONFIG = {
  url: process.env.LDAP_URL || "ldaps://192.168.29.120:636",
  baseDN: process.env.LDAP_BASE_DN || "dc=ayd",
  bindDN: process.env.LDAP_BIND_DN || "uid=binduser,ou=People,dc=ayd",
  bindPassword: process.env.LDAP_BIND_PASSWORD || "BindPass123!",
  // caCert line removed
  attributes: {
    user: ["uid", "cn", "sn"],
  },
};

const signJwtForUser = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      designation: user.designation,
      accessLevel: user.access_level,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
};

// Unified Login Endpoint with Automatic Detection
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const db = await dbPromise;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    const localUser = await db.get(
      "SELECT * FROM users WHERE username = ?",
      username
    );

    // Case 1: User exists and is a local user (not LDAP)
    if (localUser && localUser.is_ad_user === 0) {
      console.log("User is Local");
      const match = await bcrypt.compare(password, localUser.password);
      if (match) {
        const token = signJwtForUser(localUser);
        return res.json({
          token,
          user: {
            id: localUser.id,
            role: localUser.role,
            designation: localUser.designation,
            accessLevel: localUser.access_level,
          },
        });
      }
      // If password doesn't match, we'll fall through to the final error
    }
    console.log("User is from AD");

    // Case 2: User is LDAP or does not exist locally. Attempt LDAP bind.
    let ldapClient;
    try {
      ldapClient = ldap.createClient({
        url: LDAP_CONFIG.url,
        tlsOptions: { rejectUnauthorized: false }, // Updated: removed caCert
      });
      ldapClient.on("error", (err) =>
        console.error("LDAP Client Background Error:", err)
      );

      // Attempt to authenticate against LDAP server
      await new Promise((resolve, reject) => {
        ldapClient.bind(`uid=${username},ou=People,dc=ayd`, password, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // LDAP Authentication Successful
      let user = localUser;
      if (!user) {
        // If user was not in DB, create them now
        const result = await db.run(
          "INSERT INTO users (username, password, role, designation, access_level, is_ad_user) VALUES (?, ?, ?, ?, ?, ?)",
          [username, null, "user", null, "viewer", true]
        );
        user = await db.get("SELECT * FROM users WHERE id = ?", result.lastID);
      }

      const token = signJwtForUser(user);
      return res.json({
        token,
        user: {
          id: user.id,
          role: user.role,
          designation: user.designation,
          accessLevel: user.access_level,
        },
      });
    } catch (ldapError) {
      // This catch handles LDAP bind failures
      console.error("LDAP Auth Error:", ldapError.message);
      return res.status(401).json({ error: "Invalid username or password" });
    } finally {
      if (ldapClient) {
        ldapClient.unbind();
      }
    }
  } catch (dbError) {
    // This catch handles database errors
    console.error("Login Process Error:", dbError.message);
    return res.status(500).json({ error: "An internal server error occurred" });
  }
});

// Token validation
router.get("/validate", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await dbPromise;
    const user = await db.get(
      "SELECT id, username, role, designation, access_level FROM users WHERE id = ?",
      decoded.userId
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid token user" });
    }

    const formattedUser = { ...user, accessLevel: user.access_level };
    res.json({ user: formattedUser });
  } catch (err) {
    console.error("Validate token error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;

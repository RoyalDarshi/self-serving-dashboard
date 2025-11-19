// final: auth.js with graceful group handling
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ldap from "ldapjs";
import { dbPromise } from "../database/sqliteConnection.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const SALT_ROUNDS = 10;

// LDAP Configuration
const LDAP_CONFIG = {
  url: process.env.LDAP_URL || "ldap://192.168.1.15:389",
  baseDN: "dc=ayd",
  peopleDN: "ou=People,dc=ayd",
  groupsDN: "ou=Groups,dc=ayd",
  adminDN: "cn=admin,dc=ayd",
  adminPassword: "BindPass123!",
};

// Helper: Sign JWT
const signJwtForUser = (user, groups = []) =>
  jwt.sign(
    {
      userId: user.id,
      role: user.role,
      designation: user.designation,
      accessLevel: user.access_level,
      groups,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

// Main login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  const db = await dbPromise;
  try {
    const localUser = await db.get(
      "SELECT * FROM users WHERE username = ?",
      username
    );

    // 1️⃣ Local user authentication
    if (localUser && localUser.is_ad_user === 0) {
      const match = await bcrypt.compare(password, localUser.password);
      if (!match)
        return res.status(401).json({ error: "Invalid username or password" });

      const token = signJwtForUser(localUser);
      return res.json({
        token,
        user: {
          id: localUser.id,
          role: localUser.role,
          designation: localUser.designation,
          accessLevel: localUser.access_level,
          groups: [],
        },
      });
    }

    // 2️⃣ LDAP user authentication
    const ldapClient = ldap.createClient({
      url: LDAP_CONFIG.url,
      reconnect: true,
      timeout: 10000,
      connectTimeout: 15000,
    });

    const userDN = `uid=${username},${LDAP_CONFIG.peopleDN}`;
    console.log("Attempting LDAP bind:", userDN);

    await new Promise((resolve, reject) => {
      ldapClient.bind(userDN, password, (err) => {
        if (err) return reject(err);
        console.log("LDAP bind successful:", userDN);
        resolve();
      });
    });

    const userGroups = [];

    // Graceful group search
    try {
      await new Promise((resolve) => {
        const opts = {
          scope: "sub",
          filter: `(|(memberUid=${username})(member=${userDN}))`,
          attributes: ["cn"],
        };

        ldapClient.search(LDAP_CONFIG.groupsDN, opts, (err, res) => {
          if (err) {
            console.warn("Group search skipped:", err.message);
            return resolve();
          }

          res.on("searchEntry", (entry) => {
            const cnAttr = entry.attributes.find((a) => a.type === "cn");
            if (cnAttr && cnAttr.values.length > 0)
              userGroups.push(cnAttr.values[0]);
          });

          res.on("error", (e) => {
            console.warn("Group search error:", e.message);
            resolve();
          });

          res.on("end", resolve);
        });
      });
    } catch (e) {
      console.warn("Skipping group search due to error:", e.message);
    }

    console.log(`Groups for ${username}:`, userGroups);

    // Ensure user exists locally
    let user = localUser;
    if (!user) {
      const result = await db.run(
        "INSERT INTO users (username, password, role, designation, access_level, is_ad_user) VALUES (?, ?, ?, ?, ?, ?)",
        [username, null, "user", null, "viewer", true]
      );
      user = await db.get("SELECT * FROM users WHERE id = ?", result.lastID);
    }

    // Update access level based on groups
    let accessLevel = user.access_level;
    if (userGroups.includes("admins")) accessLevel = "admin";
    else if (userGroups.includes("developers")) accessLevel = "developer";

    await db.run("UPDATE users SET access_level = ? WHERE id = ?", [
      accessLevel,
      user.id,
    ]);

    const token = signJwtForUser(user, userGroups);
    ldapClient.unbind();

    return res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        designation: user.designation,
        accessLevel,
        groups: userGroups,
      },
    });
  } catch (err) {
    console.error("LDAP Login Error:", err.message);
    return res.status(401).json({ error: "Invalid username or password" });
  }
});

// Token validation
router.get("/validate", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token required" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await dbPromise;
    const user = await db.get(
      "SELECT id, username, role, designation, access_level FROM users WHERE id = ?",
      decoded.userId
    );
    if (!user)
      return res.status(401).json({ error: "Invalid token or user not found" });

    res.json({
      user: {
        ...user,
        accessLevel: user.access_level,
        groups: decoded.groups || [],
      },
    });
  } catch (err) {
    console.error("Validate token error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;

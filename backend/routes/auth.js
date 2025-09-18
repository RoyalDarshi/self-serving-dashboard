// Updated auth.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbPromise } from "../database/sqliteConnection.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const SALT_ROUNDS = 10;

router.post("/login", async (req, res) => {
  const db = await dbPromise;
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    const user = await db.get(
      "SELECT * FROM users WHERE username = ?",
      username
    );
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, designation: user.designation },
      JWT_SECRET
    );
    res.json({
      token,
      user: { id: user.id, role: user.role, designation: user.designation },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Failed to login" });
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
      "SELECT id, username, role, designation FROM users WHERE id = ?",
      decoded.userId
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid token user" });
    }

    res.json({ user });
  } catch (err) {
    console.error("Validate token error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;

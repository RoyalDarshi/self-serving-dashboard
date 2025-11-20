import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import semanticRouter from "./routes/semantic.js";
import databaseRouter from "./routes/database.js";
import analyticsRouter from "./routes/analytics.js";
import dashboardRouter from "./routes/dashboard.js";
import reportsRouter from "./routes/reports.js";
import userRouter from "./routes/users.js";
import connectionRouter from "./routes/connections.js";
import authRouter from "./routes/auth.js";
import { initializeDatabase } from "./database/setupDatabase.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

app.use(cors());
app.use(express.json());

// JWT middleware for authentication
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch (e) {
      console.error("JWT verification error:", e.message);
    }
  }
  next();
});

// Register routes
app.use("/api/semantic", semanticRouter);
app.use("/api/database", databaseRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/connection", connectionRouter);

(async () => {
  try {
    console.log("Initializing app database...");
    await initializeDatabase();
    console.log("App database initialized successfully");
    app.listen(3001, () => console.log("Server running on port 3001"));
  } catch (error) {
    console.error("Failed to initialize app database:", error.message);
  }
})();

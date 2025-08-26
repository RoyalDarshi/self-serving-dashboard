// database/setupDatabase.js
import { dbPromise } from "./sqliteConnection.js";

export async function initializeDatabase() {
  const db = await dbPromise;

  // Users
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','user')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Facts metadata
  await db.run(`
    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      aggregation TEXT NOT NULL, -- SUM | COUNT | AVG | MIN | MAX
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id)
    )
  `);

  // Dimensions metadata
  await db.run(`
    CREATE TABLE IF NOT EXISTS dimensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,                     -- Display name of dimension
      fact_table TEXT NOT NULL,               -- Fact table name
      fact_column TEXT NOT NULL,              -- Column in fact table used to join
      dimension_table TEXT NOT NULL,          -- Dimension table name
      dimension_column TEXT NOT NULL,         -- Column in dimension table used to join
      display_column TEXT NOT NULL,           -- Column in dimension table to display
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )

  `);

  // KPIs metadata
  await db.run(`
    CREATE TABLE IF NOT EXISTS kpis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sql_query TEXT NOT NULL, -- SELECT ... on source DB
      fact_id INTEGER,
      dimension_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(fact_id) REFERENCES facts(id),
      FOREIGN KEY(dimension_id) REFERENCES dimensions(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    )
  `);

  // Dashboards (you already use this in dashboard.js)
  await db.run(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      layout TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Seed an admin if none exists
  const admin = await db.get(`SELECT id FROM users WHERE username = 'admin'`);
  if (!admin) {
    // password: admin (bcrypt hash recommended; for demo only)
    const bcrypt = (await import("bcrypt")).default;
    const hash = await bcrypt.hash("admin", 10);
    await db.run(
      `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
      "admin",
      hash,
      "admin"
    );
    console.log("Seeded default admin user: admin / admin");
  }
}

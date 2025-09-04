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
      aggregate_function TEXT NOT NULL CHECK (aggregate_function IN ('SUM', 'AVG', 'COUNT', 'MIN', 'MAX'))
    )
  `);

  // Dimensions metadata (updated to include table_name)
  await db.run(`
    CREATE TABLE IF NOT EXISTS dimensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      table_name TEXT NOT NULL,  -- Added table_name
      column_name TEXT NOT NULL
    )
  `);

  // Fact-Dimensions mapping
  await db.run(`
    CREATE TABLE IF NOT EXISTS fact_dimensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_id INTEGER NOT NULL,
      dimension_id INTEGER NOT NULL,
      join_table TEXT NOT NULL,
      fact_column TEXT NOT NULL,
      dimension_column TEXT NOT NULL,
      FOREIGN KEY (fact_id) REFERENCES facts(id),
      FOREIGN KEY (dimension_id) REFERENCES dimensions(id)
    )
  `);

  // KPIs metadata
  await db.run(`
    CREATE TABLE IF NOT EXISTS kpis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,          
      expression TEXT NOT NULL,
      description TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Dashboards
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
    const bcrypt = (await import("bcrypt")).default;
    const hash = await bcrypt.hash("admin", 10);
    await db.run(
      `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
      ["admin", hash, "admin"]
    );
    console.log("Seeded default admin user: admin / admin");
  }
}

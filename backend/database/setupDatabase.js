// database/setupDatabase.js
import { dbPromise } from "./sqliteConnection.js";

export async function initializeDatabase() {
  const db = await dbPromise;

  // Users table
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Connections table with specified fields
  await db.run(`
    CREATE TABLE IF NOT EXISTS connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      connection_name TEXT NOT NULL UNIQUE,
      description TEXT,
      type TEXT NOT NULL CHECK (type IN ('postgres', 'mysql')),
      hostname TEXT NOT NULL,
      port INTEGER NOT NULL,
      database TEXT NOT NULL,
      command_timeout INTEGER,
      max_transport_objects INTEGER,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      selected_db TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Facts table
  await db.run(`
    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      aggregate_function TEXT NOT NULL CHECK (aggregate_function IN ('SUM', 'AVG', 'COUNT', 'MIN', 'MAX')),
      FOREIGN KEY (connection_id) REFERENCES connections(id)
    )
  `);

  // Dimensions table
  await db.run(`
    CREATE TABLE IF NOT EXISTS dimensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      FOREIGN KEY (connection_id) REFERENCES connections(id)
    )
  `);

  // Fact-Dimensions mapping table
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

  // KPIs table
  await db.run(`
    CREATE TABLE IF NOT EXISTS kpis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      expression TEXT NOT NULL,
      description TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (connection_id) REFERENCES connections(id)
    )
  `);

  // Dashboards table
  await db.run(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      connection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      layout TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(connection_id) REFERENCES connections(id)
    )
  `);

  // Seed default admin user
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

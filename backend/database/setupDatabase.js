// updated: setupDatabase.js
import { dbPromise } from "./sqliteConnection.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// Database Schema - Tables only (no inline indexes)
const SCHEMAS = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password TEXT,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user', 'designer')),
      access_level TEXT CHECK (access_level IN ('viewer', 'editor')), -- Added this line
      designation TEXT CHECK (designation IN (
        'Business Analyst',
        'Data Scientist',
        'Operations Manager',
        'Finance Manager',
        'Consumer Insights Manager',
        'Store / Regional Manager',
        NULL
      )),
      is_ad_user BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  connections: `
    CREATE TABLE IF NOT EXISTS connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      connection_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      type TEXT NOT NULL CHECK (type IN ('postgres', 'mysql')),
      hostname TEXT NOT NULL,
      port INTEGER NOT NULL CHECK (port > 0),
      database TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  facts: `
    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      aggregate_function TEXT NOT NULL CHECK (aggregate_function IN (
        'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'MEDIAN', 'STDDEV', 'VARIANCE'
      )),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
      UNIQUE (connection_id, name)
    )
  `,

  dimensions: `
    CREATE TABLE IF NOT EXISTS dimensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
      UNIQUE (connection_id, name)
    )
  `,

  fact_dimensions: `
    CREATE TABLE IF NOT EXISTS fact_dimensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_id INTEGER NOT NULL,
      dimension_id INTEGER NOT NULL,
      join_table TEXT NOT NULL,
      fact_column TEXT NOT NULL,
      dimension_column TEXT NOT NULL,
      FOREIGN KEY (fact_id) REFERENCES facts(id) ON DELETE CASCADE,
      FOREIGN KEY (dimension_id) REFERENCES dimensions(id) ON DELETE CASCADE,
      UNIQUE (fact_id, dimension_id)
    )
  `,

  kpis: `
    CREATE TABLE IF NOT EXISTS kpis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      expression TEXT NOT NULL,
      description TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
      UNIQUE (connection_id, name)
    )
  `,

  dashboards: `
    CREATE TABLE IF NOT EXISTS dashboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      connection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      layout TEXT,
      is_public BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    )
  `,

  charts: `
    CREATE TABLE IF NOT EXISTS charts (
      id TEXT PRIMARY KEY,
      dashboard_id INTEGER NOT NULL,
      x_axis_dimension_id INTEGER,
      y_axis_facts TEXT NOT NULL,
      group_by_dimension_id INTEGER,
      chart_type TEXT NOT NULL CHECK (chart_type IN ('bar', 'line', 'pie')),
      aggregation_type TEXT NOT NULL CHECK (aggregation_type IN (
        'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'MEDIAN', 'STDDEV', 'VARIANCE'
      )),
      stacked BOOLEAN DEFAULT FALSE,
      title TEXT,
      description TEXT,
      is_drill_enabled BOOLEAN DEFAULT FALSE,
      drill_target_dashboard_id INTEGER,
      drill_mapping_json TEXT, -- e.g. {"region": "region"}
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
      FOREIGN KEY (x_axis_dimension_id) REFERENCES dimensions(id),
      FOREIGN KEY (group_by_dimension_id) REFERENCES dimensions(id),
      FOREIGN KEY (drill_target_dashboard_id) REFERENCES dashboards(id)
    )
  `,

  connection_designations: `
    CREATE TABLE IF NOT EXISTS connection_designations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      designation TEXT NOT NULL CHECK (designation IN (
        'Business Analyst',
        'Data Scientist',
        'Operations Manager',
        'Finance Manager',
        'Consumer Insights Manager',
        'Store / Regional Manager'
      )),
      UNIQUE (connection_id, designation),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    )
  `,

  reports: `
    CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    connection_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    base_table TEXT NOT NULL,
    visualization_config TEXT, -- JSON: { type: 'bar', xAxis: 'col1', yAxis: ['col2'] }
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (connection_id) REFERENCES connections(id)
  )
  `,

  report_columns: `
    CREATE TABLE IF NOT EXISTS report_columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      column_name TEXT NOT NULL,
      alias TEXT,
      data_type TEXT,
      visible BOOLEAN DEFAULT TRUE,
      order_index INTEGER,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `,

  report_filters: `
    CREATE TABLE IF NOT EXISTS report_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      column_name TEXT NOT NULL,
      operator TEXT NOT NULL,
      value TEXT,
      is_user_editable BOOLEAN DEFAULT TRUE,
      order_index INTEGER,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `,

  report_drillthrough: `
    CREATE TABLE IF NOT EXISTS report_drillthrough (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_report_id INTEGER NOT NULL,
      target_report_id INTEGER NOT NULL,
      mapping_json TEXT NOT NULL, -- e.g. {"region": "region"}
      label TEXT,
      FOREIGN KEY (parent_report_id) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY (target_report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `,
};

// Indexes to be created after tables
const INDEXES = [
  // users indexes
  "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
  "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
  "CREATE INDEX IF NOT EXISTS idx_users_is_ad_user ON users(is_ad_user)",

  // connections indexes
  "CREATE INDEX IF NOT EXISTS idx_connections_user ON connections(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_connections_name ON connections(connection_name)",

  // facts indexes
  "CREATE INDEX IF NOT EXISTS idx_facts_connection ON facts(connection_id)",
  "CREATE INDEX IF NOT EXISTS idx_facts_name ON facts(name)",

  // dimensions indexes
  "CREATE INDEX IF NOT EXISTS idx_dimensions_connection ON dimensions(connection_id)",
  "CREATE INDEX IF NOT EXISTS idx_dimensions_name ON dimensions(name)",

  // fact_dimensions indexes
  "CREATE INDEX IF NOT EXISTS idx_fact_dimensions_fact ON fact_dimensions(fact_id)",
  "CREATE INDEX IF NOT EXISTS idx_fact_dimensions_dimension ON fact_dimensions(dimension_id)",

  // kpis indexes
  "CREATE INDEX IF NOT EXISTS idx_kpis_connection ON kpis(connection_id)",
  "CREATE INDEX IF NOT EXISTS idx_kpis_created_by ON kpis(created_by)",

  // dashboards indexes
  "CREATE INDEX IF NOT EXISTS idx_dashboards_user ON dashboards(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_dashboards_connection ON dashboards(connection_id)",

  // charts indexes
  "CREATE INDEX IF NOT EXISTS idx_charts_dashboard ON charts(dashboard_id)",

  // reports indexes
  "CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_reports_connection ON reports(connection_id)",
  "CREATE INDEX IF NOT EXISTS idx_report_columns_report ON report_columns(report_id)",
  "CREATE INDEX IF NOT EXISTS idx_report_filters_report ON report_filters(report_id)",
  "CREATE INDEX IF NOT EXISTS idx_report_drill_parent ON report_drillthrough(parent_report_id)",
  "CREATE INDEX IF NOT EXISTS idx_report_drill_target ON report_drillthrough(target_report_id)",

  // connection_designations indexes
  "CREATE INDEX IF NOT EXISTS idx_connection_designations_connection ON connection_designations(connection_id)",
  "CREATE INDEX IF NOT EXISTS idx_connection_designations_designation ON connection_designations(designation)",
];

// Seed Data
const SEED_ADMIN = async (db) => {
  const adminExists = await db.get(
    "SELECT id FROM users WHERE username = 'admin'"
  );

  if (!adminExists) {
    const hash = await bcrypt.hash("admin", SALT_ROUNDS);
    // Updated INSERT to include access_level as NULL for admin
    await db.run(
      `INSERT INTO users (username, password, role, designation, access_level, is_ad_user) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["admin", hash, "admin", "Business Analyst", null, false]
    );
    console.log(
      "✅ Seeded default admin user: username 'admin' / password 'admin'"
    );
    console.log("   Role: admin, Designation: Business Analyst");
  } else {
    console.log("ℹ️  Admin user already exists, skipping seed");
  }
};

// Main initialization function
export const initializeDatabase = async () => {
  const db = await dbPromise;

  try {
    console.log("🔄 Initializing database schema...");

    // Create all tables
    for (const [tableName, schema] of Object.entries(SCHEMAS)) {
      await db.run(schema);
      console.log(`✅ Created/verified table: ${tableName}`);
    }

    // Create all indexes
    console.log("🔄 Creating indexes...");
    for (const [i, indexStatement] of INDEXES.entries()) {
      try {
        await db.run(indexStatement);
        if (i % 3 === 0 || i === INDEXES.length - 1) {
          console.log(
            `✅ Created ${Math.min(i + 1, INDEXES.length)}/${
              INDEXES.length
            } indexes`
          );
        }
      } catch (indexError) {
        // Ignore index creation errors (index might already exist)
        if (!indexError.message.includes("already exists")) {
          console.warn(`⚠️  Warning creating index: ${indexError.message}`);
        }
      }
    }

    // Seed admin user
    await SEED_ADMIN(db);

    // Verify schema integrity
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    console.log(`📊 Database initialized with ${tables.length} tables`);

    console.log("🎉 Database initialization complete!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    throw error;
  }
};

// Export for testing
export default { initializeDatabase, SCHEMAS, SEED_ADMIN };

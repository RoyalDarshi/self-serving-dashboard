import sqlite3 from "sqlite3";
import { open } from "sqlite";
import pkg from "pg";

const { Pool } = pkg;

// --- App DB (SQLite) ---
export const appDb = await open({
  filename: "./app.db",
  driver: sqlite3.Database,
});

// --- Source DB (Postgres) ---
const sourceDbPromise = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

export default sourceDbPromise;

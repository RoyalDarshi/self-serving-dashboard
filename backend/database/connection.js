// database/connections.js
import { dbPromise } from "./sqliteConnection.js";
import pg from "pg";
import mysql from "mysql2/promise";

const pools = new Map();

export async function getPoolForConnection(connection_id, user_id) {
  if (pools.has(connection_id)) {
    return pools.get(connection_id);
  }

  const db = await dbPromise;
  const conn = await db.get(
    `SELECT * FROM connections WHERE id = ? AND user_id = ?`,
    [connection_id, user_id]
  );
  if (!conn) {
    throw new Error("Invalid connection or unauthorized");
  }

  let pool;
  if (conn.type === "postgres") {
    pool = new pg.Pool({
      host: conn.hostname,
      port: conn.port,
      database: conn.database,
      user: conn.username,
      password: conn.password,
      connectionTimeoutMillis: conn.command_timeout || 5000,
      max: conn.max_transport_objects || 20,
    });
    const client = await pool.connect();
    try {
      // ✅ only set search_path if selected_db is provided
      if (conn.selected_db) {
        await client.query(`SET search_path TO "${conn.selected_db}"`);
      }
    } finally {
      client.release();
    }
  } else if (conn.type === "mysql") {
    pool = await mysql.createPool({
      host: conn.hostname,
      port: conn.port,
      database: conn.database,
      user: conn.username,
      password: conn.password,
      connectTimeout: conn.command_timeout || 10000,
      connectionLimit: conn.max_transport_objects || 10,
    });
    // ✅ only USE if selected_db is provided
    if (conn.selected_db) {
      await pool.query(`USE \`${conn.selected_db}\``);
    }
  } else {
    throw new Error(`Unsupported database type: ${conn.type}`);
  }

  pools.set(connection_id, { pool, type: conn.type });
  return pools.get(connection_id);
}

export function quoteIdentifier(name, type) {
  if (type === "postgres") return `"${name}"`;
  if (type === "mysql") return `\`${name}\``;
  return name;
}

export async function testConnection({
  type,
  hostname,
  port,
  database,
  username,
  password,
  selected_db,
}) {
  let pool;
  if (type === "postgres") {
    pool = new pg.Pool({
      host: hostname,
      port,
      database,
      user: username,
      password,
      connectionTimeoutMillis: 5000,
      max: 5,
    });
    const client = await pool.connect();
    try {
      if (selected_db) {
        await client.query(`SET search_path TO "${selected_db}"`);
      }
      await client.query("SELECT 1");
    } finally {
      client.release();
      await pool.end(); // cleanup
    }
    return { success: true };
  } else if (type === "mysql") {
    const conn = await mysql.createConnection({
      host: hostname,
      port,
      database,
      user: username,
      password,
      connectTimeout: 5000,
    });
    if (selected_db) {
      await conn.query(`USE \`${selected_db}\``);
    }
    await conn.query("SELECT 1");
    await conn.end();
    return { success: true };
  } else {
    throw new Error(`Unsupported database type: ${type}`);
  }
}


// utils/sanitize.js
// Ensure table/column/aggregation identifiers are safe to interpolate
const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function isSafeIdent(v) {
  return typeof v === "string" && IDENT_RE.test(v);
}

// Quote identifier for Postgres
export function qIdent(ident) {
  if (!isSafeIdent(ident)) throw new Error(`Unsafe identifier: ${ident}`);
  return `"${ident}"`;
}

export function safeAlias(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_") // spaces → _
    .replace(/[^a-z0-9_]/g, ""); // remove symbols
}

const FORBIDDEN = /(insert|update|delete|drop|alter|truncate|;)/i;

export function validateSelectSQL(sql) {
  if (!sql || typeof sql !== "string") {
    throw new Error("SQL is empty");
  }

  const cleaned = sql.trim();

  if (!cleaned.toLowerCase().startsWith("select")) {
    throw new Error("Only SELECT queries are allowed");
  }

  if (FORBIDDEN.test(cleaned)) {
    throw new Error("Unsafe SQL detected");
  }

  return true;
}

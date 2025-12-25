export function extractSqlParams(sql) {
  const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const params = new Set();
  let match;

  while ((match = regex.exec(sql)) !== null) {
    params.add(match[1]);
  }

  return Array.from(params);
}

// utils/schemaUtils.ts
import { Schema } from "../components/SchemaVisualizer"; // Assume SchemaVisualizer.tsx is where Schema interface lives

/**
 * Extracts a unique list of schema names from the loaded data.
 * The output structure mimics the 'Connection' interface for reusability.
 */
export const getUniqueSchemaList = (schemas: Schema[]) => {
  const uniqueNames = Array.from(new Set(schemas.map(s => s.schema)));
  
  return uniqueNames.map((name, index) => ({
    id: index + 1, // Use a generated index as ID, since schema names are unique strings
    connection_name: name,
    description: `Database schema: ${name}`
  }));
};
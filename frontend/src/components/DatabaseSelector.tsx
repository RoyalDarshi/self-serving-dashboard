import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";

interface Schema {
  tableName: string;
  columns: { name: string; type: string; notnull: number; pk: number }[];
}

const DatabaseSelector: React.FC = () => {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchSchemas = async () => {
      try {
        const response = await apiService.getSchemas();
        if (response.success) {
          setSchemas(response.schemas);
        } else {
          setError("Failed to fetch schemas");
        }
      } catch (err) {
        console.error("Fetch schemas error:", err);
        setError("Failed to fetch schemas");
      } finally {
        setLoading(false);
      }
    };

    fetchSchemas();
  }, []);

  if (loading) return <div className="text-center">Loading schemas...</div>;
  if (error)
    return <div className="text-red-500 text-center">Error: {error}</div>;
  if (schemas.length === 0)
    return <div className="text-center">No tables available</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Database Schemas</h2>
      {schemas.map((schema) => (
        <div key={schema.tableName} className="mb-6">
          <h3 className="text-xl font-semibold mb-2">{schema.tableName}</h3>
          <ul className="list-disc pl-6">
            {schema.columns.map((column) => (
              <li key={column.name} className="text-gray-700">
                {column.name} ({column.type})
                {column.notnull ? ", Not Null" : ""}
                {column.pk ? ", Primary Key" : ""}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default DatabaseSelector;

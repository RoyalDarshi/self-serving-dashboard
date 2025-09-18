// components/ConnectionDesignationManager.tsx
import React, { useState, useEffect } from "react";
import { apiService, Connection } from "../services/api"; // Adjust path if necessary

interface ConnectionDesignation {
  id: number;
  connection_id: number;
  designation: string;
}

const designationsList = [
  "Business Analyst",
  "Data Scientist",
  "Operations Manager",
  "Finance Manager",
  "Consumer Insights Manager",
  "Store / Regional Manager",
];

const ConnectionDesignationManager: React.FC<{ connections: Connection[] }> = ({
  connections,
}) => {
  const [mappings, setMappings] = useState<ConnectionDesignation[]>([]);

  useEffect(() => {
    // Fetch all mappings
    apiService.getConnectionDesignations().then(setMappings);
  }, []);

  const handleAdd = async (connectionId: number, designation: string) => {
    if (!designation) return;
    const response = await apiService.addConnectionDesignation(
      connectionId,
      designation
    );
    if (response.success) {
      // Refetch or add locally (refetch for simplicity, or add with temp id and refetch)
      const updatedMappings = await apiService.getConnectionDesignations();
      setMappings(updatedMappings);
    }
  };

  const handleDelete = async (id: number) => {
    const response = await apiService.deleteConnectionDesignation(id);
    if (response.success) {
      const updatedMappings = await apiService.getConnectionDesignations();
      setMappings(updatedMappings);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Manage Connection Designations</h2>
      {connections.map((conn) => (
        <div key={conn.id} className="mb-6 border p-4 rounded-md">
          <h3 className="text-lg font-semibold">
            {conn.connection_name} (ID: {conn.id})
          </h3>
          <ul className="list-disc pl-5 mb-4">
            {mappings
              .filter((m) => m.connection_id === conn.id)
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between">
                  {m.designation}
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="ml-4 text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
          <select
            onChange={(e) => handleAdd(conn.id, e.target.value)}
            className="border p-2 rounded"
            defaultValue=""
          >
            <option value="" disabled>
              Add designation
            </option>
            {designationsList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
};

export default ConnectionDesignationManager;

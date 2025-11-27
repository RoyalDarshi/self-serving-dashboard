// components/TableNode.tsx (FULLY FIXED & CLEAN)
import React from "react";
import { Handle, Position } from "react-flow-renderer";
import { Key, Link, Asterisk, Zap } from "lucide-react";

// -----------------------------------------------------------
// 1. INTERFACES
// -----------------------------------------------------------

interface Column {
  name: string;
  type: string;
  isNullable: boolean;
  isPk: boolean;
  fk: {
    schema: string;
    table: string;
    column: string;
  } | null;
}

interface TableNodeData {
  schema: string;
  tableName: string;
  columns: Column[];
  groupColor: string;
  isConnected: boolean;
}

// -----------------------------------------------------------
// 2. UTILITY
// -----------------------------------------------------------

const getDataTypeColor = (type: string): string => {
  if (type.includes("INT") || type.includes("NUMERIC")) return "text-red-500";
  if (type.includes("CHAR") || type.includes("TEXT")) return "text-green-500";
  if (type.includes("DATE") || type.includes("TIME")) return "text-yellow-700";
  return "text-gray-500";
};

// -----------------------------------------------------------
// 3. COMPONENT
// -----------------------------------------------------------

const TableNode: React.FC<{ data: TableNodeData }> = ({ data }) => {
  const { schema, tableName, columns, groupColor, isConnected } = data;

  const borderColor = isConnected ? "#10b981" : "#6366f1";

  return (
    <div
      className="rounded-lg shadow-xl overflow-hidden border transition-shadow hover:shadow-2xl"
      style={{
        background: groupColor,
        borderColor,
        minWidth: 300,
      }}
    >
      {/* Header */}
      <div
        className="p-3 border-b flex items-center justify-between"
        style={{ backgroundColor: "#4f46e5", color: "white" }}
      >
        <h3 className="text-lg font-bold">
          {schema}.{tableName}
        </h3>

        {isConnected && (
          <Zap
            size={18}
            className="text-yellow-300 ml-2"
            title="This table is connected to others (Source or Target FK)"
          />
        )}
      </div>

      {/* Columns List */}
      <ul className="divide-y divide-gray-200">
        {columns.map((col, index) => {
          const columnId = `${schema}.${tableName}.${col.name}`;

          return (
            <li
              key={`${schema}-${tableName}-${col.name}-${index}`} // fully unique key
              className={`p-2 flex items-center justify-between text-sm ${
                col.isPk ? "bg-indigo-100/70 font-medium" : ""
              }`}
              data-column-id={columnId}
            >
              {/* Left */}
              <div className="flex items-center space-x-2">
                {col.isPk ? (
                  <Key
                    size={14}
                    className="text-purple-600 flex-shrink-0"
                    title="Primary Key"
                  />
                ) : col.fk ? (
                  <Link
                    size={14}
                    className="text-blue-600 flex-shrink-0"
                    title={`Foreign Key to ${col.fk.schema}.${col.fk.table}.${col.fk.column}`}
                  />
                ) : (
                  <div className="w-3" />
                )}

                <span className="text-gray-800">{col.name}</span>
              </div>

              {/* Right */}
              <div className="flex items-center space-x-3">
                {!col.isNullable && (
                  <Asterisk
                    size={10}
                    className="text-red-600"
                    title="NOT NULL"
                  />
                )}

                <span
                  className={`text-xs font-mono ${getDataTypeColor(col.type)}`}
                >
                  {col.type}
                </span>

                {/* Handles only for the first row */}
                {index === 0 && [
                  <Handle
                    key={`handle-target-${schema}-${tableName}`}
                    type="target"
                    position={Position.Left}
                    id={`target-${schema}-${tableName}`}
                    style={{ background: "#6366f1" }}
                  />,
                  <Handle
                    key={`handle-source-${schema}-${tableName}`}
                    type="source"
                    position={Position.Right}
                    id={`source-${schema}-${tableName}`}
                    style={{ background: "#4f46e5" }}
                  />,
                ]}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default TableNode;

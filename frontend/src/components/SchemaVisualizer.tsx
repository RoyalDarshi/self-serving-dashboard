import React, { useState, useEffect } from "react";
import { Key, Database, Search, Table } from "lucide-react";

interface Schema {
  tableName: string;
  columns: {
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }[];
}

interface SchemaVisualizerProps {
  schemas: Schema[];
  connectionName?: string;
}

interface TablePosition {
  x: number;
  y: number;
}

const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({
  schemas,
  connectionName,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tablePositions, setTablePositions] = useState<
    Record<string, TablePosition>
  >({});

  // Filter schemas based on search
  const filteredSchemas = schemas.filter(
    (schema) =>
      schema.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schema.columns.some(
        (col) =>
          col.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          col.type.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  // Calculate positions for tables in a grid layout
  useEffect(() => {
    const positions: Record<string, TablePosition> = {};
    const cols = Math.ceil(Math.sqrt(filteredSchemas.length));
    const tableWidth = 280;
    const tableHeight = 200;
    const padding = 60;

    filteredSchemas.forEach((schema, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      positions[schema.tableName] = {
        x: col * (tableWidth + padding) + padding,
        y: row * (tableHeight + padding) + padding,
      };
    });

    setTablePositions(positions);
  }, [filteredSchemas]);

  const getColumnTypeColor = (type: string) => {
    const lowerType = type.toLowerCase();
    if (
      lowerType.includes("int") ||
      lowerType.includes("number") ||
      lowerType.includes("decimal")
    ) {
      return "text-blue-600 bg-blue-50";
    }
    if (
      lowerType.includes("text") ||
      lowerType.includes("string") ||
      lowerType.includes("varchar") ||
      lowerType.includes("char")
    ) {
      return "text-emerald-600 bg-emerald-50";
    }
    if (
      lowerType.includes("date") ||
      lowerType.includes("time") ||
      lowerType.includes("timestamp")
    ) {
      return "text-purple-600 bg-purple-50";
    }
    if (lowerType.includes("bool")) {
      return "text-orange-600 bg-orange-50";
    }
    return "text-gray-600 bg-gray-50";
  };

  const maxWidth =
    Math.max(...Object.values(tablePositions).map((pos) => pos.x)) + 300;
  const maxHeight =
    Math.max(...Object.values(tablePositions).map((pos) => pos.y)) + 250;

  if (schemas.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
        <div className="text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No Schema Data
          </h3>
          <p className="text-gray-500">
            {connectionName
              ? `No schema information available for "${connectionName}". Please ensure the connection is active.`
              : "Select a connection to view its database schema."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Table className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Database Schema
              </h2>
              {connectionName && (
                <p className="text-sm text-gray-600">
                  Connection: {connectionName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{schemas.length}</span> tables
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">
                {schemas.reduce(
                  (acc, schema) => acc + schema.columns.length,
                  0
                )}
              </span>{" "}
              columns
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tables and columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Schema Visualization */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="relative overflow-auto" style={{ maxHeight: "70vh" }}>
          <svg
            width={maxWidth || 800}
            height={maxHeight || 600}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {/* Grid pattern background */}
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Tables */}
          <div className="relative" style={{ zIndex: 2 }}>
            {filteredSchemas.map((schema) => {
              const position = tablePositions[schema.tableName];
              if (!position) return null;

              return (
                <div
                  key={schema.tableName}
                  className={`absolute bg-white rounded-lg border-2 shadow-lg transition-all duration-300 hover:shadow-xl cursor-pointer ${
                    selectedTable === schema.tableName
                      ? "border-indigo-500 ring-2 ring-indigo-200"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  style={{
                    left: position.x,
                    top: position.y,
                    width: "260px",
                    minHeight: "120px",
                  }}
                  onClick={() =>
                    setSelectedTable(
                      selectedTable === schema.tableName
                        ? null
                        : schema.tableName
                    )
                  }
                >
                  {/* Table Header */}
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm truncate">
                        {schema.tableName}
                      </h3>
                      <div className="text-xs bg-white/20 px-2 py-1 rounded-full">
                        {schema.columns.length} cols
                      </div>
                    </div>
                  </div>

                  {/* Columns */}
                  <div className="p-2 space-y-1 max-h-40 overflow-y-auto">
                    
                    {schema.columns.map((column, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-md text-xs transition-colors hover:bg-gray-50 ${
                          column.pk
                            ? "bg-yellow-50 border border-yellow-200"
                            : column.notnull
                            ? "bg-gray-50"
                            : "bg-white"
                        }`}
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          {column.pk && (
                            <Key className="w-3 h-3 text-yellow-600 flex-shrink-0" />
                          )}
                          <span
                            className={`font-medium truncate ${
                              column.pk ? "text-yellow-800" : "text-gray-900"
                            }`}
                          >
                            {column.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getColumnTypeColor(
                              column.type
                            )}`}
                          >
                            {column.type.toUpperCase()}
                          </span>
                          {column.notnull === 1 && !column.pk && (
                            <span className="text-red-500 font-bold text-xs">
                              *
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Legend</h4>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center space-x-2">
              <Key className="w-3 h-3 text-yellow-600" />
              <span>Primary Key</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-red-500 font-bold">*</span>
              <span>Not Null</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
              <span>Numeric Types</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded"></div>
              <span>Text Types</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
              <span>Date Types</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded"></div>
              <span>Boolean Types</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table Details (when selected) */}
      {selectedTable && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Table Details: {selectedTable}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                    Column
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                    Constraints
                  </th>
                </tr>
              </thead>
              <tbody>
                {schemas
                  .find((s) => s.tableName === selectedTable)
                  ?.columns.map((column, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center space-x-2">
                          {column.pk && (
                            <Key className="w-4 h-4 text-yellow-600" />
                          )}
                          <span
                            className={
                              column.pk
                                ? "font-semibold text-yellow-800"
                                : "text-gray-900"
                            }
                          >
                            {column.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getColumnTypeColor(
                            column.type
                          )}`}
                        >
                          {column.type}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex space-x-2">
                          {column.pk && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                              PRIMARY KEY
                            </span>
                          )}
                          {column.notnull === 1 && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                              NOT NULL
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchemaVisualizer;

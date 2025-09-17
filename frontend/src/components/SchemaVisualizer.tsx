import React, { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from "react-flow-renderer";

import { Search } from "lucide-react";

interface Schema {
  tableName: string;
  columns: {
    name: string;
    type: string;
    notnull: number;
    pk: number;
    fk?: string; // Optional foreign key reference (table.column)
  }[];
}

interface SchemaVisualizerProps {
  schemas: Schema[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({
  schemas,
  searchTerm,
  setSearchTerm,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);
  const [flowHeight, setFlowHeight] = useState("500px");

  const onConnect = useCallback(
    (params: any) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            style: { stroke: "#4f46e5" },
          },
          eds
        )
      ),
    []
  );

  // Set height based on screen height
  useEffect(() => {
    const updateHeight = () => {
      const screenHeight = window.innerHeight || 500; // Fallback to 500px
      const calculatedHeight = Math.max(screenHeight * 0.7, 400); // 70% of screen height, min 400px
      setFlowHeight(`${calculatedHeight}px`);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Transform schemas into nodes and edges
  React.useEffect(() => {
    const filteredSchemas = schemas.filter((schema) =>
      schema.tableName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const newNodes = filteredSchemas.map((schema, index) => ({
      id: schema.tableName,
      type: "default",
      position: { x: (index % 3) * 450, y: Math.floor(index / 3) * 300 },
      data: {
        label: (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg shadow-lg border border-indigo-100 w-80">
            <h3 className="text-lg font-bold text-indigo-800 mb-3">
              {schema.tableName}
            </h3>
            <ul className="space-y-2">
              {schema.columns.map((col) => (
                <li
                  key={col.name}
                  className={`text-sm py-1 px-2 rounded ${
                    col.pk
                      ? "text-purple-600 font-semibold bg-purple-50"
                      : col.fk
                      ? "text-blue-600 bg-blue-50"
                      : col.notnull
                      ? "text-green-600 bg-green-50"
                      : "text-gray-600"
                  }`}
                  data-column-id={`${schema.tableName}.${col.name}`}
                >
                  {col.name} ({col.type})
                  {col.pk
                    ? " [PK]"
                    : col.fk
                    ? ` [FK → ${col.fk}]`
                    : col.notnull
                    ? " [NN]"
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        ),
      },
    }));

    // Create edges based on PK/FK relationships and same column names
    const newEdges = [];
    const columnNameMap: {
      [key: string]: { table: string; column: string }[];
    } = {};

    // Build column name map for finding matching columns
    filteredSchemas.forEach((schema) => {
      schema.columns.forEach((col) => {
        if (!columnNameMap[col.name]) {
          columnNameMap[col.name] = [];
        }
        columnNameMap[col.name].push({
          table: schema.tableName,
          column: col.name,
        });
      });
    });

    filteredSchemas.forEach((source, i) => {
      source.columns.forEach((col) => {
        // FK-based connections
        if (col.fk) {
          const [targetTable, targetColumn] = col.fk.split(".");
          if (
            filteredSchemas.some((s) => s.tableName === targetTable) &&
            source.tableName !== targetTable
          ) {
            newEdges.push({
              id: `${source.tableName}.${col.name}-${targetTable}.${targetColumn}`,
              source: source.tableName,
              target: targetTable,
              sourceHandle: `${source.tableName}.${col.name}`,
              targetHandle: `${targetTable}.${targetColumn}`,
              animated: true,
              label: `${col.name} → ${targetColumn}`,
              labelBgStyle: { fill: "#e0e7ff", stroke: "#4f46e5" },
              style: { stroke: "#4f46e5" },
              markerEnd: { type: "arrowclosed", color: "#4f46e5" },
            });
          }
        }

        // Same column name connections
        if (columnNameMap[col.name]?.length > 1) {
          columnNameMap[col.name].forEach((target) => {
            if (target.table !== source.tableName && !col.fk) {
              // Avoid duplicate edges
              const existingEdge = newEdges.find(
                (e) =>
                  (e.source === source.tableName &&
                    e.target === target.table &&
                    e.sourceHandle === `${source.tableName}.${col.name}` &&
                    e.targetHandle === `${target.table}.${target.column}`) ||
                  (e.source === target.table &&
                    e.target === source.tableName &&
                    e.sourceHandle === `${target.table}.${target.column}` &&
                    e.targetHandle === `${source.tableName}.${col.name}`)
              );
              if (!existingEdge) {
                newEdges.push({
                  id: `${source.tableName}.${col.name}-${target.table}.${target.column}`,
                  source: source.tableName,
                  target: target.table,
                  sourceHandle: `${source.tableName}.${col.name}`,
                  targetHandle: `${target.table}.${target.column}`,
                  animated: false,
                  label: `Shared: ${col.name}`,
                  labelBgStyle: { fill: "#fef3c7", stroke: "#d97706" },
                  style: { stroke: "#d97706" },
                  markerEnd: { type: "arrow", color: "#d97706" },
                });
              }
            }
          });
        }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [schemas, searchTerm, setNodes, setEdges]);

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-xl border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        style={{
          background: "#f1f5f9",
          height: flowHeight,
          borderRadius: "1rem",
        }}
      >
        <MiniMap
          nodeColor={(node) => "#4f46e5"}
          nodeStrokeColor={(node) => "#312e81"}
          maskColor="#e0e7ff"
        />
        <Controls />
        <Background color="#94a3b8" gap={16} variant="dots" />
      </ReactFlow>
    </div>
  );
};

export default SchemaVisualizer;

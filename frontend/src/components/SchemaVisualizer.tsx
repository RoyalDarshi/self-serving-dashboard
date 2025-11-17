// SchemaVisualizer.tsx (Schema display removed everywhere in UI)
import React, { useCallback, useEffect, useState, useMemo } from "react";
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Node,
  Edge,
} from "react-flow-renderer";

import TableNode from "./TableNode";
import { SchemaSelector } from "./SchemaSelector";
import { getUniqueSchemaList } from "../components/schemaUtils";
import { Search } from "lucide-react";

/* Schema interface definition */
interface Schema {
  schema: string;
  tableName: string;
  columns: {
    name: string;
    type: string;
    isNullable: boolean;
    isPk: boolean;
    fk?: {
      schema: string;
      table: string;
      column: string;
    } | null;
  }[];
}

interface SchemaVisualizerProps {
  schemas: Schema[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

// Colors kept to prevent crash — but no longer displayed in UI
const SCHEMA_COLORS: Record<string, string> = {
  staging: "#fef3c7",
  tx: "#dbeafe",
  dw: "#ede9fe",
  public: "#f3f4f6",
};

const nodeTypes = {
  tableNode: TableNode,
};

const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({
  schemas,
  searchTerm,
  setSearchTerm,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const { fitView } = useReactFlow();

  const [flowHeight] = useState("500px");

  const [selectedSchemaIds, setSelectedSchemaIds] = useState<number[]>([]);

  const availableSchemas = useMemo(
    () => getUniqueSchemaList(schemas),
    [schemas]
  );

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  // Auto-select all schemas
  useEffect(() => {
    if (availableSchemas.length > 0 && selectedSchemaIds.length === 0) {
      setSelectedSchemaIds(availableSchemas.map((s) => s.id));
    }
  }, [availableSchemas, selectedSchemaIds.length]);

  /* BUILD NODES + EDGES */
  useEffect(() => {
    const selectedSchemaNames = availableSchemas
      .filter((s) => selectedSchemaIds.includes(s.id))
      .map((s) => s.connection_name);

    if (selectedSchemaNames.length === 0 && schemas.length > 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Filter tables by schema selection + search
    const filtered = schemas.filter((s) => {
      const passesSchemaFilter = selectedSchemaNames.includes(s.schema);
      const passesSearchFilter = s.tableName
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      return passesSchemaFilter && passesSearchFilter;
    });

    const schemaGroups: Record<string, Schema[]> = {};
    filtered.forEach((s) => {
      if (!schemaGroups[s.schema]) schemaGroups[s.schema] = [];
      schemaGroups[s.schema].push(s);
    });

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    let yOffset = 80;

    Object.entries(schemaGroups).forEach(([schemaName, tables]) => {
      const groupColor = SCHEMA_COLORS[schemaName] ?? "#e5e7eb";

      // ❌ REMOVED SCHEMA LABEL NODE (this removes background schema names)

      tables.forEach((schema, index) => {
        const nodeId = schema.tableName; // ❗ schema removed visually

        newNodes.push({
          id: nodeId,
          type: "tableNode",
          position: {
            x: 40 + (index % 3) * 400,
            y: yOffset + Math.floor(index / 3) * 280,
          },
          data: {
            ...schema,
            groupColor,
          },
        });

        // Build FK edges
        schema.columns.forEach((col) => {
          if (col.fk) {
            const targetId = col.fk.table; // ❗ schema removed visually

            const isTargetSelected = selectedSchemaNames.includes(
              col.fk.schema
            );

            if (
              filtered.some((s) => s.tableName === col.fk.table) &&
              isTargetSelected
            ) {
              newEdges.push({
                id: `${nodeId}.${col.name}→${targetId}.${col.fk.column}`,
                source: nodeId,
                target: targetId,
                sourceHandle: "s",
                targetHandle: "t",
                animated: true,
                type: "smoothstep",
                label: col.name,
                style: { stroke: "#4f46e5", strokeWidth: 2 },
                markerEnd: { type: "arrowclosed" },
              });
            }
          }
        });
      });

      yOffset += Math.ceil(tables.length / 3) * 300 + 100;
    });

    setNodes(newNodes);
    setEdges(newEdges);

    setTimeout(() => fitView({ padding: 40, duration: 400 }), 200);
  }, [
    schemas,
    searchTerm,
    selectedSchemaIds,
    availableSchemas,
    setNodes,
    setEdges,
    fitView,
  ]);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-300 p-2">
      <div className="p-4 flex gap-4 items-center border-b border-gray-200">
        <SchemaSelector
          connections={availableSchemas}
          selectedIds={selectedSchemaIds}
          onChange={setSelectedSchemaIds}
          placeholder="Select Schemas to display"
          className="w-80"
        />

        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Search tables (e.g., users)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div
        style={{
          background: "#f8fafc",
          height: flowHeight,
          borderRadius: "1rem",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          nodeTypes={nodeTypes}
        >
          {/* Minimap now uses DEFAULT COLOR */}
          <MiniMap maskColor="#e0e7ff" />

          <Controls position="top-right" />
          <Background color="#cbd5e1" gap={18} variant="dots" />
        </ReactFlow>
      </div>
    </div>
  );
};

export default SchemaVisualizer;

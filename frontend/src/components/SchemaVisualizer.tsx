// SchemaVisualizer.tsx (Updated with Schema Selector Integration)
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
// Import the custom node and selector
import TableNode from "./TableNode";
import { SchemaSelector } from "./SchemaSelector";
import { getUniqueSchemaList } from "../components/schemaUtils";
import { Search } from "lucide-react";

/* Schema interface definition (kept for context) */
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
  const [flowHeight, setFlowHeight] = useState("500px");

  // NEW STATE: State to hold the IDs of selected schemas
  const [selectedSchemaIds, setSelectedSchemaIds] = useState<number[]>([]);

  // Memoize the list of available schemas for the selector
  const availableSchemas = useMemo(
    () => getUniqueSchemaList(schemas),
    [schemas]
  );

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  /* Auto-select all schemas when data first loads */
  useEffect(() => {
    // Only run if schemas are available and nothing is currently selected
    if (availableSchemas.length > 0 && selectedSchemaIds.length === 0) {
      setSelectedSchemaIds(availableSchemas.map((s) => s.id));
    }
  }, [availableSchemas, selectedSchemaIds.length]);

  /* MAIN ENGINE: Build nodes + edges */
  useEffect(() => {
    // 1. Get the names of the selected schemas from their IDs
    const selectedSchemaNames = availableSchemas
      .filter((s) => selectedSchemaIds.includes(s.id))
      .map((s) => s.connection_name);

    // Optimization: If no schemas are selected, show nothing.
    if (selectedSchemaNames.length === 0 && schemas.length > 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // 2. Apply both search term and schema filter
    const filtered = schemas.filter((s) => {
      const passesSchemaFilter = selectedSchemaNames.includes(s.schema);
      const passesSearchFilter = `${s.schema}.${s.tableName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      return passesSchemaFilter && passesSearchFilter;
    });

    // --- (Layout & Node/Edge Creation Logic) ---

    const schemaGroups: Record<string, Schema[]> = {};
    filtered.forEach((s) => {
      if (!schemaGroups[s.schema]) schemaGroups[s.schema] = [];
      schemaGroups[s.schema].push(s);
    });

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    let yOffset = 80;

    Object.entries(schemaGroups).forEach(([schemaName, tables], groupIndex) => {
      const groupColor = SCHEMA_COLORS[schemaName] ?? "#e5e7eb";

      // Schema label node
      newNodes.push({
        id: `label-${schemaName}`,
        type: "default",
        position: { x: 20, y: yOffset - 50 },
        selectable: false,
        draggable: false,
        style: { border: "none", padding: 0 },
        data: {
          label: (
            <div className="font-extrabold text-2xl text-indigo-700">
              {schemaName.toUpperCase()} SCHEMA
            </div>
          ),
        },
      });

      tables.forEach((schema, index) => {
        const nodeId = `${schema.schema}.${schema.tableName}`;

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

        /* FK-based edges */
        schema.columns.forEach((col) => {
          if (col.fk) {
            const targetId = `${col.fk.schema}.${col.fk.table}`;

            // Only draw edges to tables that are currently displayed/filtered AND selected
            const isTargetSelected = selectedSchemaNames.includes(
              col.fk.schema
            );

            if (
              filtered.some((s) => `${s.schema}.${s.tableName}` === targetId) &&
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
        {/* Schema Selector */}
        <SchemaSelector
          connections={availableSchemas}
          selectedIds={selectedSchemaIds}
          onChange={setSelectedSchemaIds}
          placeholder="Select Schemas to display"
          className="w-80"
        />

        {/* Table Search Input (Optional: Integrate here for better UX) */}
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Search tables (e.g., public.users)"
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
          <MiniMap
            nodeColor={(n) => {
              const schemaName = n.id.split(".")[0];
              return SCHEMA_COLORS[schemaName] ?? "#ddd";
            }}
            maskColor="#e0e7ff"
          />
          <Controls position="top-right" />
          <Background color="#cbd5e1" gap={18} variant="dots" />
        </ReactFlow>
      </div>
    </div>
  );
};

export default SchemaVisualizer;

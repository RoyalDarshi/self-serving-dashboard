import React, { useCallback } from "react";
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
  }[];
}

interface SchemaVisualizerProps {
  schemas: Schema[];
  searchTerm: string;
}

const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({
  schemas,
  searchTerm,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  // Transform schemas into nodes and edges
  React.useEffect(() => {
    const filteredSchemas = schemas.filter((schema) =>
      schema.tableName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const newNodes = filteredSchemas.flatMap((schema, index) => [
      {
        id: schema.tableName,
        type: "default",
        position: { x: index * 300, y: 100 },
        data: {
          label: (
            <div className="bg-white p-2 rounded shadow">
              <h3 className="font-bold">{schema.tableName}</h3>
              <ul>
                {schema.columns.map((col) => (
                  <li key={col.name} className="text-sm">
                    {col.name} ({col.type})
                    {col.pk ? " [PK]" : col.notnull ? " [NN]" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ),
        },
      },
    ]);

    // Simple relationships (for demo, assume join based on PK/FK relationships)
    const newEdges = [];
    for (let i = 0; i < filteredSchemas.length - 1; i++) {
      for (let j = i + 1; j < filteredSchemas.length; j++) {
        const source = filteredSchemas[i];
        const target = filteredSchemas[j];
        if (
          source.tableName === "Employee" &&
          target.tableName === "JobTitle"
        ) {
          newEdges.push({
            id: `${source.tableName}-${target.tableName}`,
            source: source.tableName,
            target: target.tableName,
            animated: true,
            label: "job_title",
          });
        }
        if (
          source.tableName === "CoffeeShop" &&
          target.tableName === "CoffeeShopEmployee"
        ) {
          newEdges.push({
            id: `${source.tableName}-${target.tableName}`,
            source: source.tableName,
            target: target.tableName,
            animated: true,
            label: "franchise",
          });
        }
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [schemas, searchTerm, setNodes, setEdges]);

  return (
    <div className="lg:col-span-2 h-[600px] bg-white p-4 rounded-xl shadow-md border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Schema Visualization</h2>
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        style={{ background: "#1a1a1a", height: "500px" }}
      >
        <MiniMap />
        <Controls />
        <Background color="#333" gap={16} />
      </ReactFlow>
    </div>
  );
};

export default SchemaVisualizer;

import React from "react";
import { Database, Trash2 } from "lucide-react";

interface Connection {
  id: number;
  connection_name: string;
  type: string;
  hostname: string;
  port: number;
  database: string;
}

interface ConnectionsListProps {
  connections: Connection[];
  selectedConnectionId: number | null;
  setSelectedConnectionId: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}

const ConnectionsList: React.FC<ConnectionsListProps> = ({
  connections,
  selectedConnectionId,
  setSelectedConnectionId,
  onDelete,
}) => {
  if (connections.length === 0) {
    return (
      <div className="text-center py-8">
        <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No connections found</p>
        <p className="text-gray-400 text-xs">
          Create your first connection above
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-600 mb-3">
        {connections.length} connection{connections.length !== 1 ? "s" : ""}
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {connections.map((conn) => (
          <div
            key={conn.id}
            className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <button
              onClick={() => setSelectedConnectionId(conn.id)}
              className={`flex-1 text-left ${
                selectedConnectionId === conn.id ? "opacity-100" : "opacity-80"
              }`}
            >
              <div className="font-medium text-gray-900 text-sm mb-1">
                {conn.connection_name}
              </div>
              <div className="text-xs text-gray-500">
                {conn.type} • {conn.hostname}:{conn.port}/{conn.database}
              </div>
            </button>
            <button
              onClick={() => onDelete(conn.id, conn.connection_name)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title={`Delete ${conn.connection_name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectionsList;

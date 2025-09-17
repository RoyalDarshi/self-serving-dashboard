import React from "react";
import { Database, Server, Trash2 } from "lucide-react";
import Card from "./ui/Card";

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
}) => (
  <Card className="p-6">
    <div className="flex items-center space-x-3 mb-6">
      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
        <Server className="w-5 h-5 text-indigo-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          Connections ({connections.length})
        </h3>
        <p className="text-sm text-gray-500">Select a connection to manage</p>
      </div>
    </div>
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {connections.map((conn) => (
        <div key={conn.id} className="flex items-center justify-between w-full">
          <button
            onClick={() => setSelectedConnectionId(conn.id)}
            className={`flex-1 text-left p-4 rounded-xl transition-colors ${
              selectedConnectionId === conn.id
                ? "bg-blue-50 border border-blue-200"
                : "bg-gray-50 hover:bg-gray-100"
            }`}
          >
            <h4 className="font-medium text-gray-900">
              {conn.connection_name}
            </h4>
            <p className="text-sm text-gray-600">
              {conn.type}://{conn.hostname}:{conn.port}/{conn.database}
            </p>
          </button>
          <button
            onClick={() => onDelete(conn.id, conn.connection_name)}
            className="ml-2 p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full transition-colors"
            title={`Delete ${conn.connection_name}`}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ))}
      {connections.length === 0 && (
        <div className="text-center py-12">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No connections found. Create one to get started.
          </p>
        </div>
      )}
    </div>
  </Card>
);

export default ConnectionsList;

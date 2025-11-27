import React, { useState, useEffect } from "react";
import {
  Database,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Settings,
  Edit3,
} from "lucide-react";
import { apiService } from "../../services/api";
import ConnectionForm from "./ConnectionForm";
import ConnectionsList from "./ConnectionsList";
import ErrorBoundary from "../common/ErrorBoundary";

interface Connection {
  id: number;
  connection_name: string;
  description?: string;
  type: string;
  hostname: string;
  port: number;
  database: string;
  command_timeout?: number;
  max_transport_objects?: number;
  username: string;
  selected_db: string;
  created_at: string;
  password?: string;
}

interface ConnectionManagerProps {
  onConnectionsUpdate: (connections: Connection[]) => void;
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  onConnectionsUpdate,
}) => {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(
    null
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchConnections();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const conns = await apiService.getConnections();
      setConnections(conns);
      onConnectionsUpdate(conns);
      setError("");
    } catch (err) {
      setError(`Failed to fetch connections: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Loading Admin Panel
          </h3>
          <p className="text-gray-600">Initializing database connections...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Settings className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Connection Manager
                  </h1>
                  <p className="text-sm text-gray-600">
                    Database Connection Management
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-6 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Create/Edit Connection Card */}
            <div
              className={`bg-white rounded-lg border p-6 ${editingConnection
                ? "border-blue-300 ring-1 ring-blue-100"
                : "border-gray-200"
                }`}
            >
              <div className="flex items-center space-x-3 mb-6">
                <div
                  className={`p-2 rounded-lg ${editingConnection ? "bg-orange-100" : "bg-blue-100"
                    }`}
                >
                  {editingConnection ? (
                    <Edit3 className="w-5 h-5 text-orange-600" />
                  ) : (
                    <Plus className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {editingConnection ? "Edit Connection" : "New Connection"}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {editingConnection
                      ? `Editing ${editingConnection.connection_name}`
                      : "Configure database connection"}
                  </p>
                </div>
              </div>

              <ConnectionForm
                editingConnection={editingConnection}
                onSuccess={(message) => {
                  setSuccess(message);
                  // FIXED: Do NOT close the form here. Only close on Update/Create/Cancel.
                }}
                onError={setError}
                onCreate={(newConn) => {
                  const updatedConnections = [...connections, newConn];
                  setConnections(updatedConnections);
                  onConnectionsUpdate(updatedConnections);
                }}
                onUpdate={(updatedConn) => {
                  const updatedConnections = connections.map((c) =>
                    c.id === updatedConn.id ? updatedConn : c
                  );
                  setConnections(updatedConnections);
                  onConnectionsUpdate(updatedConnections);
                  setEditingConnection(null); // Close form on successful update
                }}
                onCancelEdit={() => {
                  setEditingConnection(null);
                }}
              />
            </div>

            {/* Existing Connections Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Database className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Connections
                  </h2>
                  <p className="text-sm text-gray-600">
                    {connections.length} configured
                  </p>
                </div>
              </div>

              <ConnectionsList
                connections={connections}
                selectedConnectionId={editingConnection?.id || null}
                setSelectedConnectionId={() => { }}
                onEdit={(conn) => {
                  setEditingConnection(conn);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onDelete={(id, name) =>
                  apiService.deleteConnection(id).then((response) => {
                    if (response.success) {
                      const updatedConnections = connections.filter(
                        (c) => c.id !== id
                      );
                      setConnections(updatedConnections);
                      onConnectionsUpdate(updatedConnections);
                      setSuccess(`Connection "${name}" deleted successfully`);
                      if (editingConnection?.id === id) {
                        setEditingConnection(null);
                      }
                    } else {
                      setError(response.error || "Failed to delete connection");
                    }
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Toast Notifications */}
        {(error || success) && (
          <div className="fixed bottom-6 right-6 z-50 space-y-3">
            {error && (
              <div className="bg-white border border-red-200 text-gray-800 p-4 rounded-lg shadow-lg max-w-sm">
                <div className="flex items-start space-x-3">
                  <div className="p-1 bg-red-100 rounded">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-red-700 text-sm">Error</h4>
                    <p className="text-sm text-gray-600 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
            {success && (
              <div className="bg-white border border-green-200 text-gray-800 p-4 rounded-lg shadow-lg max-w-sm">
                <div className="flex items-start space-x-3">
                  <div className="p-1 bg-green-100 rounded">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-green-700 text-sm">
                      Success
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">{success}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <style jsx>{`
          .animate-spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </ErrorBoundary>
  );
};

export default ConnectionManager;

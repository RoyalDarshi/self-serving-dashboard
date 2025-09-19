// AdminPanel.tsx
import React, { useState, useEffect } from "react";
import { Database, Plus } from "lucide-react";
import { apiService } from "../services/api";
import ConnectionForm from "./ConnectionForm";
import ConnectionsList from "./ConnectionsList";
import ErrorBoundary from "./ErrorBoundary";

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
}

interface AdminPanelProps {
  onConnectionsUpdate: (connections: Connection[]) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onConnectionsUpdate }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch connections on mount if authenticated
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

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const handleRefresh = () => {
    fetchConnections();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Database className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
          <p className="mt-4 text-gray-600">Loading connections...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto p-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
                <Database className="w-8 h-8 text-blue-600" />
                <span>Connections Management</span>
              </h1>
              <p className="text-gray-600 mt-1">
                Manage database connections for the team
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <span>Refresh</span>
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Connections
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {connections.length}
                  </p>
                </div>
                <div classConnectionType="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Database className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Connections Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <span>Create New Connection</span>
              </h2>
              <ConnectionForm
                onSuccess={(message) => {
                  setSuccess(message);
                  fetchConnections(); // Refresh list after success
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
                }}
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Existing Connections
              </h2>
              <ConnectionsList
                connections={connections}
                selectedConnectionId={null}
                setSelectedConnectionId={() => {}} // Disabled for admin
                onDelete={(id, name) =>
                  apiService.deleteConnection(id).then((response) => {
                    if (response.success) {
                      const updatedConnections = connections.filter(
                        (c) => c.id !== id
                      );
                      setConnections(updatedConnections);
                      onConnectionsUpdate(updatedConnections);
                      setSuccess(`Connection "${name}" deleted successfully`);
                    } else {
                      setError(response.error || "Failed to delete connection");
                    }
                  })
                }
              />
            </div>
          </div>

          {/* Notifications */}
          {(error || success) && (
            <div className="fixed bottom-4 right-4 z-50 space-y-2">
              {error && (
                <div className="bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center space-x-3 animate-slide-up">
                  <Database className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center space-x-3 animate-slide-up">
                  <Database className="w-5 h-5" />
                  <span>{success}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AdminPanel;

// components/ConnectionDesignationManager.tsx
import React, { useState, useEffect } from "react";
import { apiService, Connection } from "../services/api";
import {
  Plus,
  X,
  Users,
  Building,
  Zap,
  Shield,
  Target,
  Sparkles,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

interface ConnectionDesignation {
  id: number;
  connection_id: number;
  designation: string;
}

const designationsList = [
  "Business Analyst",
  "Data Scientist",
  "Operations Manager",
  "Finance Manager",
  "Consumer Insights Manager",
  "Store / Regional Manager",
];

const designationColors = {
  "Business Analyst": "from-purple-400 to-pink-400",
  "Data Scientist": "from-blue-400 to-cyan-400",
  "Operations Manager": "from-green-400 to-emerald-400",
  "Finance Manager": "from-yellow-400 to-orange-400",
  "Consumer Insights Manager": "from-indigo-400 to-purple-400",
  "Store / Regional Manager": "from-red-400 to-rose-400",
};

const ConnectionDesignationManager: React.FC<{ connections: Connection[] }> = ({
  connections,
}) => {
  const [mappings, setMappings] = useState<ConnectionDesignation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<number | null>(
    null
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchMappings();
  }, []);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const mappings = await apiService.getConnectionDesignations();
      setMappings(mappings);
    } catch (error) {
      console.error("Failed to fetch mappings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (connectionId: number, designation: string) => {
    if (!designation) return;

    setLoading(true);
    try {
      const response = await apiService.addConnectionDesignation(
        connectionId,
        designation
      );
      if (response.success) {
        await fetchMappings();
        setShowAddModal(false);
        setSelectedConnection(null);
      }
    } catch (error) {
      console.error("Failed to add designation:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setLoading(true);
    try {
      const response = await apiService.deleteConnectionDesignation(id);
      if (response.success) {
        await fetchMappings();
      }
    } catch (error) {
      console.error("Failed to delete designation:", error);
    } finally {
      setLoading(false);
    }
  };

  const getConnectionMappings = (connectionId: number) => {
    return mappings.filter((m) => m.connection_id === connectionId);
  };

  const getAvailableDesignations = (connectionId: number) => {
    const existingDesignations = getConnectionMappings(connectionId).map(
      (m) => m.designation
    );
    return designationsList.filter((d) => !existingDesignations.includes(d));
  };

  const filteredConnections = connections.filter((conn) =>
    conn.connection_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDesignations = mappings.length;
  const activeConnections = connections.filter(
    (conn) => getConnectionMappings(conn.id).length > 0
  ).length;

  if (loading && mappings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 animate-pulse border border-gray-100 shadow-lg"
              >
                <div className="h-6 bg-gray-200 rounded-full mb-4 w-3/4"></div>
                <div className="h-4 bg-gray-100 rounded-full mb-2 w-full"></div>
                <div className="h-4 bg-gray-100 rounded-full w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden">
      <div className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Futuristic Header */}
          <div className="text-center mb-12">
            {/* <div className="inline-flex items-center gap-3 mb-6 px-6 py-3 bg-white/80 backdrop-blur-xl rounded-full border border-gray-200 shadow-lg">
              <Sparkles className="h-6 w-6 text-blue-500 animate-pulse" />
              <span className="text-gray-700 font-medium">
                Smart Access Control
              </span>
            </div> */}

            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 mb-4 tracking-tight">
              Connection Hub
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Advanced designation management with intelligent access control
            </p>

            {/* Stats Dashboard */}
            {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 backdrop-blur-xl rounded-2xl p-6 border border-blue-200 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <Building className="h-8 w-8 text-blue-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {connections.length}
                  </span>
                </div>
                <p className="text-blue-700 text-sm font-medium">
                  Total Connections
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 backdrop-blur-xl rounded-2xl p-6 border border-purple-200 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <Shield className="h-8 w-8 text-purple-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {activeConnections}
                  </span>
                </div>
                <p className="text-purple-700 text-sm font-medium">
                  Active Connections
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-xl rounded-2xl p-6 border border-green-200 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <Target className="h-8 w-8 text-green-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {totalDesignations}
                  </span>
                </div>
                <p className="text-green-700 text-sm font-medium">
                  Total Designations
                </p>
              </div>
            </div> */}

            {/* Search Bar */}
            {/* <div className="relative max-w-md mx-auto m-4">
              <input
                type="text"
                placeholder="Search connections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-6 py-4 bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 shadow-lg"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            </div> */}
          </div>

          {/* Connection Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredConnections.map((conn, index) => {
              const connectionMappings = getConnectionMappings(conn.id);
              const availableDesignations = getAvailableDesignations(conn.id);
              const completionPercentage =
                (connectionMappings.length / designationsList.length) * 100;

              return (
                <div
                  key={conn.id}
                  className="group relative bg-white/80 backdrop-blur-xl rounded-3xl p-4 border border-gray-200 hover:border-gray-300 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/10 shadow-lg"
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  {/* Connection Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <Building className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-300">
                            {conn.connection_name}
                          </h3>
                          {/* <p className="text-gray-500 text-sm">ID: {conn.id}</p> */}
                        </div>
                      </div>

                      {/* Progress Ring */}
                      <div className="relative w-20 h-20 mx-auto mb-3">
                        <svg
                          className="w-20 h-20 transform -rotate-90"
                          viewBox="0 0 36 36"
                        >
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="2"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="url(#gradient)"
                            strokeWidth="2"
                            strokeDasharray={`${completionPercentage}, 100`}
                            className="transition-all duration-1000 ease-out"
                          />
                          <defs>
                            <linearGradient
                              id="gradient"
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="100%"
                            >
                              <stop offset="0%" stopColor="#3b82f6" />
                              <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-gray-800">
                            {Math.round(completionPercentage)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Designations */}
                  <div className="space-y-3 mb-4">
                    {connectionMappings.length > 0 ? (
                      connectionMappings.map((mapping) => (
                        <div
                          key={mapping.id}
                          className={`group/item relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r ${
                            designationColors[mapping.designation] ||
                            "from-gray-400 to-gray-500"
                          } shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-102`}
                        >
                          <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center">
                                <Zap className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-white font-medium text-sm">
                                {mapping.designation}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDelete(mapping.id)}
                              disabled={loading}
                              className="w-8 h-8 bg-white/20 hover:bg-red-500/80 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover/item:opacity-100 disabled:opacity-30"
                            >
                              <X className="h-4 w-4 text-white" />
                            </button>
                          </div>
                          <div className="absolute inset-0 bg-white/20 transform translate-x-full group-hover/item:translate-x-0 transition-transform duration-300"></div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Users className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">
                          No designations assigned
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Add Button */}
                  {availableDesignations.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedConnection(conn.id);
                        setShowAddModal(true);
                      }}
                      disabled={loading}
                      className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white rounded-2xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 group/btn flex items-center justify-center gap-2"
                    >
                      <Plus className="h-5 w-5 group-hover/btn:rotate-90 transition-transform duration-300" />
                      Add Designation
                      <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
                    </button>
                  )}

                  {availableDesignations.length === 0 &&
                    connectionMappings.length > 0 && (
                      <div className="text-center py-4 bg-green-50 rounded-2xl border border-green-200">
                        <span className="text-green-700 text-sm font-medium">
                          ✨ All designations assigned
                        </span>
                      </div>
                    )}
                </div>
              );
            })}
          </div>

          {/* Add Designation Modal */}
          {showAddModal && selectedConnection && (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-2">
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 max-w-md w-full border border-gray-200 relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50"></div>
                <div className="relative z-10">
                  <div className="text-center mb-4">
                    {/* <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <Plus className="h-8 w-8 text-white" />
                    </div> */}
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Add Designation
                    </h3>
                    <p className="text-gray-600">
                      Choose a designation to assign
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {getAvailableDesignations(selectedConnection).map(
                      (designation) => (
                        <button
                          key={designation}
                          onClick={() =>
                            handleAdd(selectedConnection, designation)
                          }
                          disabled={loading}
                          className={`w-full p-4 text-left rounded-2xl bg-gradient-to-r ${designationColors[designation]} hover:scale-105 transition-all duration-200 disabled:opacity-50 group shadow-lg`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">
                              {designation}
                            </span>
                            <ArrowRight className="h-5 w-5 text-white group-hover:translate-x-1 transition-transform duration-200" />
                          </div>
                        </button>
                      )
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedConnection(null);
                    }}
                    className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-medium transition-all duration-200 border border-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredConnections.length === 0 && searchTerm && (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Building className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                No connections found
              </h3>
              <p className="text-gray-600">Try adjusting your search terms</p>
            </div>
          )}

          {connections.length === 0 && (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Building className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                Welcome to Connection Hub
              </h3>
              <p className="text-gray-600 text-lg">
                Add your first connection to get started
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Global Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 border border-gray-200 shadow-xl">
            <div className="w-16 h-16 relative mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
            </div>
            <p className="text-gray-800 font-medium text-center">
              Processing...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionDesignationManager;

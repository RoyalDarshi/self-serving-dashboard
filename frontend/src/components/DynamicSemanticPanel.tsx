import React, { useState, useEffect, useMemo } from "react";
import { apiService } from "../services/api";
import DraggableFact from "./DraggableFact";
import DraggableDimension from "./DraggableDimension";
import { Search, Database, ChevronDown, ChevronUp } from "lucide-react";

interface Fact {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
  aggregate_function: string;
}

interface Dimension {
  id: number;
  name: string;
  column_name: string;
}

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

interface DynamicSemanticPanelProps {
  connections: Connection[];
  selectedConnectionId: number | null;
  setSelectedConnectionId: (id: number | null) => void;
}

const DynamicSemanticPanel: React.FC<DynamicSemanticPanelProps> = ({
  connections,
  selectedConnectionId,
  setSelectedConnectionId,
}) => {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedConnectionId) {
        setFacts([]);
        setDimensions([]);
        return;
      }

      try {
        const [factsRes, dimensionsRes] = await Promise.all([
          apiService.getFacts(selectedConnectionId),
          apiService.getDimensions(selectedConnectionId),
        ]);
        setFacts(factsRes);
        setDimensions(dimensionsRes);
      } catch (err) {
        console.error("Failed to fetch facts and dimensions:", err);
      }
    };

    fetchData();
  }, [selectedConnectionId]);

  const sortedAndFilteredFacts = useMemo(() => {
    return facts
      .filter(
        (fact) =>
          fact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fact.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fact.column_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [facts, searchTerm]);

  const sortedAndFilteredDimensions = useMemo(() => {
    return dimensions
      .filter(
        (dimension) =>
          dimension.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          dimension.column_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dimensions, searchTerm]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className="flex cursor-pointer items-center justify-between border-b border-slate-200 p-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-lg font-medium text-slate-700">
          Facts & Dimensions
        </h2>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5" />
        ) : (
          <ChevronDown className="h-5 w-5" />
        )}
      </div>
      {isExpanded && (
        <>
          <div className="border-b border-slate-200 p-4">
            {connections.length > 0 ? (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Select Connection
                </label>
                <select
                  value={selectedConnectionId || ""}
                  onChange={(e) =>
                    setSelectedConnectionId(parseInt(e.target.value) || null)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Select a connection
                  </option>
                  {connections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.connection_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="py-4 text-center text-sm text-slate-500">
                No connections available. Create one in the Admin Panel.
              </div>
            )}
            <div className="relative">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Search Facts & Dimensions
              </label>
              <input
                type="text"
                placeholder="Search..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pl-10 text-sm shadow-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-9 h-4 w-4 text-slate-400" />
            </div>
          </div>
          <div className="max-h-[calc(100vh-350px)] overflow-y-auto p-2">
            {facts.length > 0 || dimensions.length > 0 ? (
              <>
                <h3 className="sticky top-0 z-10 rounded-md bg-slate-100 px-2 py-1 text-md font-semibold text-slate-800">
                  Facts
                </h3>
                {sortedAndFilteredFacts.length > 0 ? (
                  <div className="space-y-2 p-2">
                    {sortedAndFilteredFacts.map((fact) => (
                      <DraggableFact key={fact.id} fact={fact} />
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-sm text-slate-500">
                    No facts found matching search.
                  </div>
                )}
                <h3 className="sticky top-0 z-10 mt-4 rounded-md bg-slate-100 px-2 py-1 text-md font-semibold text-slate-800">
                  Dimensions
                </h3>
                {sortedAndFilteredDimensions.length > 0 ? (
                  <div className="space-y-2 p-2">
                    {sortedAndFilteredDimensions.map((dimension) => (
                      <DraggableDimension
                        key={dimension.id}
                        dimension={dimension}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-sm text-slate-500">
                    No dimensions found matching search.
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center text-slate-500">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-100 to-indigo-100">
                  <Database className="h-8 w-8 text-blue-500" />
                </div>
                <p>No facts or dimensions available</p>
                <p className="mt-1 text-sm">Create some in the Admin Panel</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DynamicSemanticPanel;

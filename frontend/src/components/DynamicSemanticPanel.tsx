import React, { useState, useEffect, useMemo } from "react";
import { apiService } from "../services/api";
import DraggableFact from "./DraggableFact";
import DraggableDimension from "./DraggableDimension";
import { Search, Database, ChevronDown, ChevronUp } from "lucide-react";

// Types
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

const DynamicSemanticPanel: React.FC = () => {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch facts and dimensions
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [factsRes, dimensionsRes] = await Promise.all([
          apiService.getFacts(),
          apiService.getDimensions(),
        ]);
        setFacts(factsRes);
        setDimensions(dimensionsRes);
      } catch (err) {
        console.error("Failed to fetch facts and dimensions:", err);
      }
    };
    fetchData();
  }, []);

  // Memoize filtered and sorted facts
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

  // Memoize filtered and sorted dimensions
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div
        className="flex items-center justify-between p-4 border-b border-slate-200 cursor-pointer"
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
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Search Facts & Dimensions
              </label>
              <input
                type="text"
                placeholder="Search..."
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 pl-10 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-9" />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-350px)] p-2">
            {facts.length > 0 || dimensions.length > 0 ? (
              <>
                {/* Facts Section */}
                <h3 className="text-md font-semibold text-slate-800 px-2 py-1 bg-slate-100 rounded-md sticky top-0 z-10">
                  Facts
                </h3>
                {sortedAndFilteredFacts.length > 0 ? (
                  <div className="space-y-2 p-2">
                    {sortedAndFilteredFacts.map((fact) => (
                      <DraggableFact key={fact.id} fact={fact} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    No facts found matching search.
                  </div>
                )}
                {/* Dimensions Section */}
                <h3 className="text-md font-semibold text-slate-800 px-2 py-1 bg-slate-100 rounded-md sticky top-0 z-10 mt-4">
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
                  <div className="text-center py-4 text-slate-500 text-sm">
                    No dimensions found matching search.
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <div className="bg-gradient-to-r from-blue-100 to-indigo-100 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
                  <Database className="h-8 w-8 text-blue-500" />
                </div>
                <p>No facts or dimensions available</p>
                <p className="text-sm mt-1">Create some in the Admin Panel</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DynamicSemanticPanel;

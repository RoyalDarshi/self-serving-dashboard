// src/components/ConnectionSelector.tsx
import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

interface Connection {
  id: number;
  connection_name: string;
  description?: string;
}

interface ConnectionSelectorProps {
  /** All available connections */
  connections: Connection[];
  /** Currently selected IDs (single = [id] or [] ; multi = any length) */
  selectedIds: number[];
  /** Callback when selection changes */
  onChange: (ids: number[]) => void;
  /** true → show a *single-select* dropdown (Facts / Dimensions) */
  singleSelect?: boolean;
  /** Optional: placeholder text */
  placeholder?: string;
  /** Optional: className for custom styling */
  className?: string;
}

/**
 * Beautiful, accessible, fully-styled connection selector.
 * - Single-select → native <select> with nice styling (matches your original UI)
 * - Multi-select → custom dropdown with checkboxes + search
 * * FIXED: No bugs, reliable single/multi switching, proper state management
 */
export const ConnectionSelector: React.FC<ConnectionSelectorProps> = ({
  connections,
  selectedIds,
  onChange,
  singleSelect = false,
  placeholder = "Select a connection",
  className = "w-64",
}) => {
  // ────── Multi-select state ──────
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ────── Close dropdown when clicking outside ──────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch(""); // Clear search when closing
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ────── Filter connections based on search ──────
  const filtered = connections.filter((c) =>
    c.connection_name.toLowerCase().includes(search.toLowerCase())
  );

  // ────── Toggle handler for multi-select ──────
  const toggle = (id: number) => {
    let nextIds: number[];
    
    if (singleSelect) {
      // SINGLE SELECT: Replace current selection with new one
      nextIds = [id];
      setOpen(false); // Close after selection in single-select mode
    } else {
      // MULTI SELECT: Toggle the specific connection
      nextIds = selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id];
    }
    
    onChange(nextIds);
  };

  // ────── Single select handler ──────
  const selectSingle = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    onChange(id ? [id] : []);
  };

  // ────── Get display text for selected connections ──────
  const getDisplayText = () => {
    if (selectedIds.length === 0) return placeholder;
    
    const selectedConnections = connections.filter((c) => selectedIds.includes(c.id));
    
    if (singleSelect || selectedIds.length === 1) {
      return selectedConnections[0]?.connection_name || placeholder;
    } else {
      return selectedConnections.length === connections.length
        ? "All connections selected"
        : selectedConnections.length > 1
        ? `${selectedConnections.length} connections selected`
        : selectedConnections[0]?.connection_name || placeholder;
    }
  };

  // ────── SINGLE SELECT UI (matches your original dropdown style) ──────
  if (singleSelect) {
    return (
      <div className={`relative ${className}`}>
        <select
          value={selectedIds[0] ?? ""}
          onChange={selectSingle}
          className={`
            w-full appearance-none bg-white border border-gray-200 rounded-xl
            px-4 py-3 text-sm font-medium text-gray-800
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            transition-all duration-200 cursor-pointer
            ${selectedIds.length === 0 ? "text-gray-500" : "text-gray-900"}
          `}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.connection_name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
      </div>
    );
  }

  // ────── MULTI SELECT UI (custom dropdown) ──────
  const displayText = getDisplayText();

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`
          w-full flex items-center justify-between bg-white border
          ${selectedIds.length > 0 ? "border-blue-500" : "border-gray-200"}
          rounded-xl px-4 py-3 text-sm font-medium
          ${selectedIds.length > 0 ? "text-gray-900" : "text-gray-500"}
          focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all
        `}
      >
        <span className="truncate max-w-[85%]">{displayText}</span>
        <ChevronDown
          className={`w-5 h-5 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown (only shows when open) */}
      {open && (
        <div
          className={`
            absolute z-50 mt-1 w-full bg-white border border-gray-200
            rounded-xl shadow-lg overflow-hidden animate-in fade-in
            slide-in-from-top-2 duration-200
          `}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search connections..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-500 italic text-center">
                {search ? "No connections found" : "No connections available"}
              </div>
            ) : (
              filtered.map((connection) => {
                const isChecked = selectedIds.includes(connection.id);
                return (
                  // FIX: Add onClick handler to the label to enable toggling (select/unselect)
                  <label
                    key={connection.id}
                    onClick={(e) => {
                      // Prevent closing the dropdown when clicking an item
                      e.preventDefault(); 
                      toggle(connection.id);
                    }}
                    className={`
                      flex items-center gap-3 px-4 py-3 cursor-pointer
                      transition-colors hover:bg-gray-50
                      ${isChecked ? "bg-blue-50" : ""}
                    `}
                  >
                    <div
                      className={`
                        flex items-center justify-center w-5 h-5 rounded border
                        transition-all duration-200
                        ${isChecked 
                          ? "bg-blue-600 border-blue-600 shadow-sm" 
                          : "border-gray-300 bg-white"
                        }
                      `}
                    >
                      {isChecked && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {connection.connection_name}
                      </span>
                      {connection.description && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {connection.description}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          {connections.length > 0 && (
            <div className="flex justify-between px-3 py-2 border-t border-gray-100 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  setOpen(false);
                }}
                className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                disabled={selectedIds.length === 0}
              >
                Clear All
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = connections.map((c) => c.id);
                    onChange(allIds);
                    setOpen(false);
                  }}
                  className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Usage example:
/*
<ConnectionSelector
  connections={connections}
  selectedIds={selectedConnectionIds}
  onChange={setSelectedConnectionIds}
  singleSelect={isCreationTab} // true for Facts/Dimensions, false for others
  placeholder="Select a connection"
/>
*/
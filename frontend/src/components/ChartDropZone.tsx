import React from "react";
import { useDrop } from "react-dnd";
import { X } from "lucide-react";

// Types
interface Column {
  key: string;
  label: string;
  type: string;
  id?: number; // Add id to Column interface
}

interface ChartDropZoneProps {
  axis: "x" | "y" | "group";
  onDrop: (item: { column?: Column; fact?: any; dimension?: any }) => void;
  onRemove: (id?: number) => void; // Update to accept id
  selectedColumns: Column[];
  label: string;
  accept?: string[];
  allowMultiple?: boolean;
}

const ChartDropZone: React.FC<ChartDropZoneProps> = ({
  axis,
  onDrop,
  onRemove,
  selectedColumns,
  label,
  accept = ["column", "fact", "dimension"],
  allowMultiple = false,
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept,
    drop: (item) => onDrop(item),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      className={`min-h-[100px] border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
        isOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
      }`}
    >
      {selectedColumns.length === 0 ? (
        <p className="text-sm text-slate-500">{label}</p>
      ) : (
        selectedColumns.map((col, index) => (
          <div
            key={col.key}
            className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg mb-2"
          >
            <span className="text-sm font-medium text-slate-700">
              {col.label}
            </span>
            {(allowMultiple || index === 0) && (
              <button
                onClick={() => onRemove(col.id)} // Pass col.id to onRemove
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default ChartDropZone;

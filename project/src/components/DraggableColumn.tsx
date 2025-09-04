import React from "react";
import { useDrag } from "react-dnd";
import { Fact, Dimension } from "../services/api";
import { GripVertical } from "lucide-react";

interface DraggableColumnProps {
  column: Fact | Dimension;
}

const DraggableColumn: React.FC<DraggableColumnProps> = ({ column }) => {
  const isFact = "table_name" in column;
  const type = isFact ? "fact" : "dimension";
  const label = column.name;
  const typeDisplay = isFact
    ? (column as Fact).aggregate_function || "number"
    : "string";

  const [{ isDragging }, drag] = useDrag(() => ({
    type,
    item: { [type]: column },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`flex mb-2 items-center space-x-2 p-2 bg-white border border-slate-200 rounded-lg cursor-move hover:border-blue-300 hover:shadow-sm transition-all ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <GripVertical className="h-4 w-4 text-slate-400" />
      <div>
        <div className="font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500 capitalize">{typeDisplay}</div>
      </div>
    </div>
  );
};

export default DraggableColumn;

import React from "react";
import { useDrag } from "react-dnd";
import { GripVertical } from "lucide-react";

// Types
interface Fact {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
  aggregate_function: string;
}

interface DraggableFactProps {
  fact: Fact;
}

const DraggableFact: React.FC<DraggableFactProps> = ({ fact }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "fact",
    item: { fact },
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
        <div className="font-medium text-slate-900">{fact.name}</div>
        <div className="text-xs text-slate-500">
          {fact.aggregate_function}({fact.table_name}.{fact.column_name})
        </div>
      </div>
    </div>
  );
};

export default DraggableFact;

import React from "react";
import { GripVertical, Sigma, Layers } from "lucide-react";
import { Fact, Dimension } from "../../../services/api";
import { DragItem } from "../types";

export const DraggableSemanticItem = ({
  item,
  type,
}: {
  item: Fact | Dimension;
  type: "fact" | "dimension";
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    const dragData: DragItem = {
      name: item.name,
      type: type === "fact" ? "number" : "string",
      factId: type === "fact" ? (item as Fact).id : undefined,
      dimensionId: type === "dimension" ? (item as Dimension).id : undefined,
      aggregation:
        type === "fact" ? (item as Fact).aggregate_function : undefined,
    };
    e.dataTransfer.setData("field", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`flex items-center gap-2.5 px-3 py-2.5 text-sm border rounded-lg cursor-grab active:cursor-grabbing group transition-all select-none shadow-sm hover:shadow ${
        type === "fact"
          ? "bg-emerald-50/50 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50"
          : "bg-blue-50/50 border-blue-100 hover:border-blue-300 hover:bg-blue-50"
      }`}
    >
      <GripVertical
        className={`w-3.5 h-3.5 transition-colors ${
          type === "fact"
            ? "text-emerald-300 group-hover:text-emerald-500"
            : "text-blue-300 group-hover:text-blue-500"
        }`}
      />
      {type === "fact" ? (
        <Sigma className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Layers className="w-3.5 h-3.5 text-blue-600" />
      )}
      <div className="flex flex-col overflow-hidden">
        <span
          className={`truncate font-medium ${
            type === "fact"
              ? "text-emerald-900 group-hover:text-emerald-950"
              : "text-blue-900 group-hover:text-blue-950"
          }`}
        >
          {item.name}
        </span>
        <span className="text-[10px] text-slate-400 truncate">
          {type === "fact"
            ? `${(item as Fact).aggregate_function}(${item.column_name})`
            : item.column_name}
        </span>
      </div>
    </div>
  );
};

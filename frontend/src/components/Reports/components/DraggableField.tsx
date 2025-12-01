import React from "react";
import { GripVertical } from "lucide-react";
import { FieldIcon } from "./FieldIcon";

export const DraggableField = ({ name, type }: { name: string; type: string }) => {
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData("field", JSON.stringify({ name, type }));
        e.dataTransfer.effectAllowed = "copy";
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm bg-gradient-to-r from-white to-slate-50 hover:from-indigo-50 hover:to-blue-50 border border-slate-200 hover:border-indigo-300 rounded-lg cursor-grab active:cursor-grabbing group transition-all select-none shadow-sm hover:shadow"
        >
            <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
            <FieldIcon type={type} />
            <span className="truncate text-slate-700 font-medium group-hover:text-indigo-900">
                {name}
            </span>
        </div>
    );
};

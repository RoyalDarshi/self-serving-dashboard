import React from "react";
import { Hash, Type, Calendar } from "lucide-react";

export const FieldIcon = ({ type }: { type: string }) => {
    const t = type.toLowerCase();
    if (t.includes("int") || t.includes("number") || t.includes("float"))
        return <Hash className="w-3.5 h-3.5 text-blue-500" />;
    if (t.includes("date") || t.includes("time"))
        return <Calendar className="w-3.5 h-3.5 text-orange-500" />;
    return <Type className="w-3.5 h-3.5 text-slate-400" />;
};

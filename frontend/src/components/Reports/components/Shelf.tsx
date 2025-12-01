import React, { useState, useRef, useEffect } from "react";
import { Plus, Settings2, Trash2, ChevronDown, Sigma, Layers } from "lucide-react";
import { ConfigItem, DragItem } from "../types";
import { FieldIcon } from "./FieldIcon";

/** Pill Component */
const ShelfPill = ({
    item,
    onRemove,
    onUpdate,
}: {
    item: ConfigItem;
    onRemove: () => void;
    onUpdate: (u: Partial<ConfigItem>) => void;
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const isAgg = !!item.aggregation;

    return (
        <div className="relative group">
            <div
                onClick={() => setShowMenu(!showMenu)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border shadow-sm cursor-pointer select-none transition-all ${isAgg
                    ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 text-emerald-800 hover:shadow-md"
                    : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:shadow-md"
                    }`}
            >
                {item.factId ? (
                    <Sigma className="w-3.5 h-3.5 text-emerald-600" />
                ) : item.dimensionId ? (
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                    <FieldIcon type={item.type} />
                )}
                <span className="font-semibold">{item.alias || item.name}</span>
                {isAgg && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 rounded font-bold">
                        {item.aggregation}
                    </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-40 ml-0.5" />
            </div>

            {showMenu && (
                <div
                    ref={menuRef}
                    className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-3 animate-in fade-in zoom-in-95 duration-150"
                >
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Settings2 className="w-3 h-3" />
                        Column Settings
                    </div>

                    <div className="space-y-3 px-2 pb-1">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1.5 block">
                                Display Label
                            </label>
                            <input
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                value={item.alias || item.name}
                                onChange={(e) => onUpdate({ alias: e.target.value })}
                                placeholder={item.name}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1.5 block">
                                Aggregation
                            </label>
                            <select
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={item.aggregation || ""}
                                onChange={(e) =>
                                    onUpdate({ aggregation: e.target.value || undefined })
                                }
                                disabled={!!item.factId}
                            >
                                <option value="">None (Dimension)</option>
                                <option value="SUM">Sum</option>
                                <option value="AVG">Average</option>
                                <option value="COUNT">Count</option>
                                <option value="MAX">Max</option>
                                <option value="MIN">Min</option>
                            </select>
                        </div>

                        <hr className="border-slate-100 my-2" />

                        <button
                            onClick={onRemove}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Remove Column
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

/** Configurable Shelf */
export const Shelf = ({
    title,
    icon: Icon,
    items,
    onDrop,
    onRemove,
    onUpdate,
    placeholder,
    accepts,
    className = "",
}: {
    title: string;
    icon: any;
    items: ConfigItem[];
    onDrop: (item: DragItem) => void;
    onRemove: (index: number) => void;
    onUpdate: (index: number, updates: Partial<ConfigItem>) => void;
    placeholder: string;
    accepts: string[];
    className?: string;
}) => {
    const [isOver, setIsOver] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOver(true);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOver(false);
        const data = e.dataTransfer.getData("field");
        if (data) {
            const item = JSON.parse(data);
            onDrop(item);
        }
    };

    return (
        <div className={`flex flex-col gap-2.5 ${className}`}>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <Icon className="w-3.5 h-3.5" /> {title}
            </div>
            <div
                onDragOver={handleDragOver}
                onDragLeave={() => setIsOver(false)}
                onDrop={handleDrop}
                className={`min-h-[70px] p-3 rounded-xl border-2 border-dashed transition-all flex flex-wrap gap-2 content-start ${isOver
                    ? "border-indigo-400 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-inner"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                    }`}
            >
                {items.length === 0 && (
                    <div className="w-full h-full py-4 flex flex-col items-center justify-center text-xs text-slate-400 italic pointer-events-none">
                        <Plus className="w-5 h-5 mb-1 opacity-30" />
                        {placeholder}
                    </div>
                )}
                {items.map((item, idx) => (
                    <ShelfPill
                        key={item.id}
                        item={item}
                        onRemove={() => onRemove(idx)}
                        onUpdate={(u) => onUpdate(idx, u)}
                    />
                ))}
            </div>
        </div>
    );
};

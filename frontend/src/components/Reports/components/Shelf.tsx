import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Settings2,
  Trash2,
  ChevronDown,
  Sigma,
  Layers,
} from "lucide-react";
import { ConfigItem, DragItem } from "../types";
import { FieldIcon } from "./FieldIcon";

/** Modern Pill Component */
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
    <div className="relative group animate-in zoom-in-95 duration-200">
      <div
        onClick={() => setShowMenu(!showMenu)}
        className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer select-none transition-all shadow-sm ${
          isAgg
            ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-300 hover:shadow-md"
            : "bg-white border-zinc-200 text-zinc-700 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md"
        }`}
      >
        <div className={`p-1 rounded ${isAgg ? 'bg-emerald-100' : 'bg-zinc-100'}`}>
            {item.factId ? (
            <Sigma className="w-3 h-3 text-emerald-600" />
            ) : item.dimensionId ? (
            <Layers className="w-3 h-3 text-blue-600" />
            ) : (
            <FieldIcon type={item.type} />
            )}
        </div>
        
        <span className="font-semibold">{item.alias || item.name}</span>
        
        {isAgg && (
          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100/50 rounded-md font-bold uppercase tracking-wider">
            {item.aggregation}
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity ml-1" />
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-zinc-100 z-50 p-1 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-black/5"
        >
          <div className="bg-zinc-50 px-3 py-2 rounded-lg mb-1 border-b border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="w-3 h-3" /> Configuration
              </span>
          </div>

          <div className="p-2 space-y-3">
            <div>
              <label className="text-[10px] text-zinc-500 font-bold mb-1.5 block ml-1">
                Display Alias
              </label>
              <input
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                value={item.alias || item.name}
                onChange={(e) => onUpdate({ alias: e.target.value })}
                placeholder={item.name}
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 font-bold mb-1.5 block ml-1">
                Aggregation Function
              </label>
              <select
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={item.aggregation || ""}
                onChange={(e) =>
                  onUpdate({ aggregation: e.target.value || undefined })
                }
                disabled={!!item.factId}
              >
                <option value="">None (Raw Value)</option>
                <option value="SUM">Sum</option>
                <option value="AVG">Average</option>
                <option value="COUNT">Count</option>
                <option value="MAX">Max</option>
                <option value="MIN">Min</option>
              </select>
            </div>

            <div className="h-px bg-zinc-100 my-1" />

            <button
              onClick={onRemove}
              className="w-full text-left px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove Field
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
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2">
         <div className="bg-indigo-50 p-1.5 rounded-md">
            <Icon className="w-3.5 h-3.5 text-indigo-600" />
         </div>
         <span className="text-xs font-bold text-zinc-700 uppercase tracking-wide">
            {title}
         </span>
      </div>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={`min-h-[80px] p-3 rounded-xl border-2 border-dashed transition-all duration-200 flex flex-wrap gap-2 content-start ${
          isOver
            ? "border-indigo-400 bg-indigo-50/30 scale-[1.01]"
            : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-zinc-50"
        }`}
      >
        {items.length === 0 && (
          <div className="w-full h-full py-5 flex flex-col items-center justify-center text-center pointer-events-none">
            <div className="bg-zinc-100 p-2 rounded-full mb-2">
                <Plus className="w-4 h-4 text-zinc-300" />
            </div>
            <span className="text-xs text-zinc-400 font-medium">{placeholder}</span>
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
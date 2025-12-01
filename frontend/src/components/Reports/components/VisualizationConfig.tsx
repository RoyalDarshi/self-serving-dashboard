import React from "react";
import { BarChart2, BarChart3, LineChart, PieChart, ArrowRightLeft } from "lucide-react";
import { ConfigItem, DragItem } from "../types";
import { Shelf } from "./Shelf";

interface VisualizationConfigProps {
    showChart: boolean;
    setShowChart: (show: boolean) => void;
    chartType: "bar" | "line" | "pie";
    setChartType: (type: "bar" | "line" | "pie") => void;
    chartX: ConfigItem | null;
    setChartX: (item: ConfigItem | null) => void;
    chartY: ConfigItem[];
    setChartY: (items: ConfigItem[]) => void;
    handleDropChartX: (item: DragItem) => void;
    handleDropChartY: (item: DragItem) => void;
}

export const VisualizationConfig: React.FC<VisualizationConfigProps> = ({
    showChart,
    setShowChart,
    chartType,
    setChartType,
    chartX,
    setChartX,
    chartY,
    setChartY,
    handleDropChartX,
    handleDropChartY,
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-white to-purple-50/30 round-t-xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <BarChart2 className="w-4 h-4 text-purple-600" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                        Visualization
                    </h3>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={showChart}
                        onChange={(e) => setShowChart(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
            </div>

            {showChart && (
                <div className="p-6 space-y-6 animate-in slide-in-from-top-2 fade-in duration-200">
                    {/* Chart Type Selector */}
                    <div className="flex gap-2">
                        {[
                            { id: "bar", icon: BarChart3, label: "Bar Chart" },
                            { id: "line", icon: LineChart, label: "Line Chart" },
                            { id: "pie", icon: PieChart, label: "Pie Chart" },
                        ].map((type) => (
                            <button
                                key={type.id}
                                onClick={() => setChartType(type.id as any)}
                                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${chartType === type.id
                                    ? "border-purple-500 bg-purple-50 text-purple-700"
                                    : "border-slate-100 hover:border-slate-200 text-slate-500 hover:bg-slate-50"
                                    }`}
                            >
                                <type.icon className="w-6 h-6" />
                                <span className="text-xs font-bold">{type.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <Shelf
                            title="X-Axis (Dimension)"
                            icon={ArrowRightLeft}
                            placeholder="Drag a dimension here"
                            items={chartX ? [chartX] : []}
                            accepts={["string", "date"]}
                            onDrop={handleDropChartX}
                            onRemove={() => setChartX(null)}
                            onUpdate={(i, u) => {
                                if (chartX) setChartX({ ...chartX, ...u });
                            }}
                        />
                        <Shelf
                            title="Y-Axis (Metrics)"
                            icon={BarChart3}
                            placeholder="Drag metrics here"
                            items={chartY}
                            accepts={["number"]}
                            onDrop={handleDropChartY}
                            onRemove={(i) =>
                                setChartY(chartY.filter((_, idx) => idx !== i))
                            }
                            onUpdate={(i, u) => {
                                const n = [...chartY];
                                n[i] = { ...n[i], ...u };
                                setChartY(n);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

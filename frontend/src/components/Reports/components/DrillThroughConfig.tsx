import React from "react";
import { MousePointerClick, Link as LinkIcon, ArrowRightLeft } from "lucide-react";
import { ReportDefinition } from "../../../services/api";
import { ConfigItem, DrillConfig } from "../types";

interface DrillThroughConfigProps {
    drillConfig: DrillConfig;
    setDrillConfig: (config: DrillConfig) => void;
    availableReports: ReportDefinition[];
    tableColumns: ConfigItem[];
}

export const DrillThroughConfig: React.FC<DrillThroughConfigProps> = ({
    drillConfig,
    setDrillConfig,
    availableReports,
    tableColumns,
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-white to-orange-50/30">
                <div className="p-2 bg-orange-100 rounded-lg">
                    <MousePointerClick className="w-4 h-4 text-orange-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                    Drill Through
                </h3>
            </div>
            <div className="p-6 space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">
                        Target Report
                    </label>
                    <select
                        className="w-full text-sm border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        value={drillConfig.targetReportId}
                        onChange={(e) =>
                            setDrillConfig({
                                ...drillConfig,
                                targetReportId: Number(e.target.value),
                            })
                        }
                    >
                        <option value={0}>None (Disabled)</option>
                        {availableReports.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                </div>

                {drillConfig.targetReportId !== 0 && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <LinkIcon className="w-3 h-3" /> Column Mapping
                        </h4>
                        <div className="space-y-2">
                            {tableColumns.map((col) => (
                                <div
                                    key={col.id}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span className="text-slate-600 font-medium">
                                        {col.alias || col.name}
                                    </span>
                                    <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                                    <input
                                        className="w-40 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Target Column Name"
                                        value={drillConfig.mapping[col.name] || ""}
                                        onChange={(e) =>
                                            setDrillConfig({
                                                ...drillConfig,
                                                mapping: {
                                                    ...drillConfig.mapping,
                                                    [col.name]: e.target.value,
                                                },
                                            })
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-3 italic">
                            Map columns from this report to filter columns in the target
                            report.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

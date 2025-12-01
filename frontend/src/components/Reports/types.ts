export type FieldType = "string" | "number" | "date" | "boolean";

export type DragItem = {
    name: string;
    type: FieldType;
    factId?: number;
    dimensionId?: number;
    aggregation?: string;
};

export interface ConfigItem extends DragItem {
    id: string;
    alias?: string;
    aggregation?: string;
    visible?: boolean;
}

export interface DrillConfig {
    targetReportId: number;
    mapping: Record<string, string>;
}

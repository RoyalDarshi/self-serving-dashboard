// src/components/ReportTypes.ts
import { ReportDefinition, ReportColumn, ReportFilter } from "../services/api";

export interface UIReport extends ReportDefinition {
  columns: ReportColumn[];
  filters: ReportFilter[];
}

export type FilterOperator =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "LIKE"
  | "IN"
  | "BETWEEN";

export interface RuntimeFilterState {
  [columnName: string]: any;
}

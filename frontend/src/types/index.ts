export interface DataRow {
  id: number;
  name: string;
  category: string;
  revenue: number;
  customers: number;
  orders: number;
  rating: number;
  date: string;
  region: string;
  status: string;
}

export interface Column {
  key: keyof DataRow;
  label: string;
  type: 'string' | 'number' | 'date';
}

export interface ChartConfig {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'area';
  xAxis?: Column;
  yAxis?: Column[];
  groupBy?: Column;
  title: string;
  data: any[];
}

export interface DragItem {
  name: string;              // column_name
  label?: string;            // display name
  table_name?: string;       // 🔥 REQUIRED
  type: string;
  factId?: number;
  dimensionId?: number;
  aggregation?: string;
}

export interface ConfigItem extends DragItem {
  id: string;
  alias?: string;
  visible?: boolean;
}

export interface MultiColumnChart {
  xAxis: Column | null;
  yAxes: Column[];
  groupBy: Column | null;
  chartType: 'bar' | 'line' | 'pie' | 'area';
}
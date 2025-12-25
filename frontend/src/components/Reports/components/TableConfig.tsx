import React from "react";
import { Table as TableIcon, Layout } from "lucide-react";
import { ConfigItem, DragItem } from "../types";
import { Shelf } from "./Shelf";

interface TableConfigProps {
  tableColumns: ConfigItem[];
  setTableColumns: (cols: ConfigItem[]) => void;
  handleDropTable: (item: DragItem) => void;
}

export const TableConfig: React.FC<TableConfigProps> = ({
  tableColumns,
  setTableColumns,
  handleDropTable,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-white to-blue-50/30 round-t-xl">
        <div className="p-2 bg-blue-100 rounded-lg">
          <TableIcon className="w-4 h-4 text-blue-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">
          Table Configuration
        </h3>
        <span className="text-xs text-slate-500 ml-auto font-medium">
          {tableColumns.length} columns
        </span>
      </div>
      <div className="p-6">
        <Shelf
          title="Visible Columns"
          icon={Layout}
          placeholder="Drag fields here to display in your report table"
          items={tableColumns}
          accepts={["any"]}
          onDrop={handleDropTable}
          onRemove={(i) =>
            setTableColumns(tableColumns.filter((_, idx) => idx !== i))
          }
          onUpdate={(i, u) => {
            const n = [...tableColumns];
            n[i] = { ...n[i], ...u };
            setTableColumns(n);
          }}
        />
      </div>
    </div>
  );
};

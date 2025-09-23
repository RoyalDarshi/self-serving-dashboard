import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  Search,
  MoveVertical,
  Table,
} from "lucide-react";

// Assuming DatabaseColumn and other types are defined in '../services/api'
import { DatabaseColumn } from "../services/api";

interface ChartDataTableProps {
  chartData: any[];
  xAxisColumn: DatabaseColumn | null;
  yAxisColumns: DatabaseColumn[];
  groupByColumn: DatabaseColumn | null;
  aggregationType: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
  valueFormatter?: (value: any) => string | number;
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

interface ColumnVisibility {
  [key: string]: boolean;
}

const ChartDataTable: React.FC<ChartDataTableProps> = ({
  chartData,
  xAxisColumn,
  yAxisColumns,
  groupByColumn,
  aggregationType,
  valueFormatter,
}) => {
  // State management
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(
    {}
  );
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Normalize column type
  const normalizeType = (type: string): "string" | "number" => {
    const lower = type.toLowerCase();
    if (lower.includes("char") || lower === "text") return "string";
    if (
      lower.includes("int") ||
      lower === "float" ||
      lower === "double" ||
      lower === "decimal" ||
      lower === "number"
    )
      return "number";
    return "string";
  };

  // Color schemes for different column types
  const getColumnColor = (type: string, index: number) => {
    const colors = [
      {
        bg: "bg-purple-50",
        border: "border-purple-200",
        text: "text-purple-700",
      },
      { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
      { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
      {
        bg: "bg-orange-50",
        border: "border-orange-200",
        text: "text-orange-700",
      },
      { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700" },
      {
        bg: "bg-indigo-50",
        border: "border-indigo-200",
        text: "text-indigo-700",
      },
    ];

    if (type === "category") return colors[0];
    if (type === "group") return colors[1];
    return colors[(index + 2) % colors.length];
  };

  // Table columns configuration - INCLUDING S.No
  const tableColumns = useMemo(() => {
    const columns: {
      key: string;
      label: string;
      isNumeric: boolean;
      type: string;
      colorScheme: any;
    }[] = [];

    // Always add S.No as the first column
    columns.push({
      key: "serial",
      label: "S.No",
      isNumeric: true,
      type: "serial",
      colorScheme: getColumnColor("serial", 0),
    });

    // Check if the data is grouped based on the `groupByColumn`
    if (groupByColumn || chartData.some((row) => "name" in row)) {
      // Create the main 'Name' column from xAxisColumn
      if (xAxisColumn) {
        columns.push({
          key: "name",
          label: xAxisColumn.label,
          isNumeric: false,
          type: "category",
          colorScheme: getColumnColor("category", 1),
        });
      }

      // Dynamically get unique keys from the grouped data for column headers
      const uniqueGroupKeys = new Set<string>();
      chartData.forEach((row) => {
        Object.keys(row).forEach((key) => {
          if (key !== "name") {
            uniqueGroupKeys.add(key);
          }
        });
      });

      // Sort the dynamic keys alphabetically for consistent column order
      const sortedGroupKeys = Array.from(uniqueGroupKeys).sort();

      // Create a column for each unique group key
      let colorIndex = 2; // Start from index 2 (after S.No and Name)
      sortedGroupKeys.forEach((key) => {
        columns.push({
          key: key,
          label: key,
          isNumeric: true,
          type: "metric",
          colorScheme: getColumnColor("metric", colorIndex++),
        });
      });
    } else {
      // This is the original logic for non-grouped data
      let colorIndex = 1; // Start from 1 (after S.No)

      if (xAxisColumn) {
        columns.push({
          key: xAxisColumn.key,
          label: xAxisColumn.label,
          isNumeric: normalizeType(xAxisColumn.type) === "number",
          type: "category",
          colorScheme: getColumnColor("category", colorIndex++),
        });
      }
      yAxisColumns.forEach((col) => {
        const isNumeric = normalizeType(col.type) === "number";
        columns.push({
          key: col.key,
          label: `${col.label} (${
            isNumeric && aggregationType !== "COUNT"
              ? aggregationType
              : normalizeType(col.type) === "string"
              ? "COUNT"
              : ""
          })`,
          isNumeric: isNumeric,
          type: "metric",
          colorScheme: getColumnColor("metric", colorIndex++),
        });
      });
    }

    return columns;
  }, [chartData, xAxisColumn, yAxisColumns, groupByColumn, aggregationType]);

  // Initialize column visibility
  useEffect(() => {
    const initialVisibility: ColumnVisibility = {};
    tableColumns.forEach((col) => {
      initialVisibility[col.key] = true;
    });
    setColumnVisibility(initialVisibility);
  }, [tableColumns]);

  // Filtered and sorted data
  const processedData = useMemo(() => {
    let filtered = chartData.filter((row) =>
      Object.values(row).some((value) =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortConfig.direction === "asc" ? 1 : -1;
        if (bVal == null) return sortConfig.direction === "asc" ? -1 : 1;

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [chartData, searchTerm, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize]);

  // Handlers
  const handleSort = (key: string) => {
    // Don't allow sorting on S.No column
    if (key === "serial") return;

    setSortConfig((current) => ({
      key,
      direction:
        current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleColumnVisibility = (key: string) => {
    // Don't allow hiding S.No column
    if (key === "serial") return;

    setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getCellStyle = (value: any, column: any) => {
    return {
      backgroundColor: column.colorScheme?.bg,
      color: column.colorScheme?.text,
      borderColor: column.colorScheme?.border,
    };
  };

  if (chartData.length === 0 && !xAxisColumn && yAxisColumns.length === 0) {
    return (
      <div className="h-96 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-dashed border-blue-200">
        <div className="text-center">
          <Table className="mx-auto h-16 w-16 text-indigo-400" />
          <h3 className="mt-4 text-xl font-semibold text-indigo-900">
            Ready for Data Analysis
          </h3>
          <p className="mt-2 text-indigo-600">
            Drag and drop columns to generate your colorful data table and start
            exploring insights.
          </p>
        </div>
      </div>
    );
  }

  const visibleColumns = tableColumns.filter(
    (col) => columnVisibility[col.key]
  );

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gradient-to-r from-slate-100 to-gray-100 border-b border-gray-200 w-full">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search your data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Page Size */}
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all min-w-[80px]"
        >
          <option value={5} className="text-slate-700">
            5 rows
          </option>
          <option value={10} className="text-slate-700">
            10 rows
          </option>
          <option value={25} className="text-slate-700">
            25 rows
          </option>
          <option value={50} className="text-slate-700">
            50 rows
          </option>
        </select>

        {/* Column Visibility */}
        <div className="relative min-w-[150px]">
          <select
            onChange={(e) => toggleColumnVisibility(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value=""
          >
            <option value="" className="text-slate-700">
              Show/Hide Columns
            </option>
            {tableColumns.map((col) => (
              <option key={col.key} value={col.key} className="text-slate-700">
                {col.key === "serial"
                  ? "✓"
                  : columnVisibility[col.key]
                  ? "✓"
                  : "○"}{" "}
                {col.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container - FIXED HORIZONTAL SCROLL */}
      <div className="w-full relative">
        {/* Table Scroll Container */}
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto border-b border-gray-200">
          <table className="min-w-full w-max">
            <thead className="sticky top-0 z-20 bg-white shadow-sm">
              <tr className="bg-gradient-to-r from-slate-100 to-gray-100">
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-6 py-3 text-left text-sm font-bold uppercase tracking-wider cursor-pointer transition-colors hover:bg-slate-200 border-b border-gray-200 sticky left-0 z-30 ${
                      col.key === "serial"
                        ? "bg-white shadow-sm border-r border-gray-200"
                        : ""
                    }`}
                    onClick={() => handleSort(col.key)}
                    style={{
                      backgroundColor: col.colorScheme?.bg || "white",
                      color: col.colorScheme?.text || "slate-700",
                      borderColor: col.colorScheme?.border || "gray-200",
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="truncate max-w-[150px]">
                        {col.label}
                      </span>
                      <div className="flex flex-col ml-auto text-slate-400">
                        {sortConfig?.key === col.key ? (
                          sortConfig.direction === "asc" ? (
                            <ChevronUp className="h-4 w-4 text-current" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-current" />
                          )
                        ) : (
                          <MoveVertical className="h-4 w-4 text-current opacity-50" />
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-blue-50 transition-colors"
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={`${rowIndex}-${col.key}`}
                      className={`px-6 py-4 text-sm min-w-[120px] max-w-[200px] border-r border-gray-100 ${
                        col.key === "serial"
                          ? "sticky left-0 z-10 shadow-sm"
                          : ""
                      }`}
                      style={{
                        ...getCellStyle(row[col.key], col),
                        backgroundColor:
                          rowIndex % 2 === 0
                            ? col.colorScheme?.bg || "white"
                            : col.key === "serial"
                            ? col.colorScheme?.bg || "white"
                            : `color-mix(in srgb, ${
                                col.colorScheme?.bg || "white"
                              } 90%, slate-50 10%)`,
                        color: col.colorScheme?.text || "slate-900",
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`${
                            col.isNumeric ? "font-bold" : "font-medium"
                          } truncate`}
                        >
                          {col.key === "serial"
                            ? (currentPage - 1) * pageSize + rowIndex + 1
                            : col.isNumeric && valueFormatter
                            ? valueFormatter(row[col.key])
                            : row[col.key] || ""}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Scrollbar Shadow Effect */}
        <div className="absolute top-0 right-0 h-full w-2 bg-gradient-to-r from-transparent to-white pointer-events-none z-30"></div>
      </div>

      {/* Footer with Pagination */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-100 to-gray-50 border-t border-gray-200 w-full">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-700">
            Showing{" "}
            <span className="text-blue-600 font-bold">
              {(currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="text-blue-600 font-bold">
              {Math.min(currentPage * pageSize, processedData.length)}
            </span>{" "}
            of{" "}
            <span className="text-blue-600 font-bold">
              {processedData.length}
            </span>{" "}
            results
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <span className="px-4 py-2 text-sm font-bold text-slate-700 bg-white rounded-lg shadow-sm border border-slate-200">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Empty State for No Data After Filtering */}
      {processedData.length === 0 && searchTerm && (
        <div className="flex items-center justify-center py-12 text-center">
          <div className="text-slate-500">
            <Search className="mx-auto h-12 w-12 mb-4 text-slate-400" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No results found
            </h3>
            <p className="text-sm">Try adjusting your search terms</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartDataTable;

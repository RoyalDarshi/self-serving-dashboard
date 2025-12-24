// src/components/MappingForm.tsx
import React, { useMemo } from "react";
import { Zap, Target, Lightbulb, Save, X } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Select from "../ui/Select";

/* ================= TYPES ================= */

interface Schema {
  tableName: string;
  columns: {
    name: string;
    type: string;
    isPk?: boolean;
    fk?: { table: string; column: string } | null;
  }[];
  connection_id: number;
  connection_name: string;
}

interface TableRelationship {
  id?: number;
  left_table: string;
  left_column: string;
  right_table: string;
  right_column: string;
  join_type: "LEFT" | "INNER" | "RIGHT";
}

interface MappingFormProps {
  schemas: Schema[];
  editingRelationship: TableRelationship | null;

  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
  joinType: "LEFT" | "INNER" | "RIGHT";

  setLeftTable: (v: string) => void;
  setLeftColumn: (v: string) => void;
  setRightTable: (v: string) => void;
  setRightColumn: (v: string) => void;
  setJoinType: (v: "LEFT" | "INNER" | "RIGHT") => void;

  onCreate: () => void;
  onUpdate: () => void;
  onCancel: () => void;
  onAutoMap: () => void;

  selectedConnectionIds: number[];
}

/* ================= COMPONENT ================= */

const MappingForm: React.FC<MappingFormProps> = ({
  schemas,
  editingRelationship,

  leftTable,
  leftColumn,
  rightTable,
  rightColumn,
  joinType,

  setLeftTable,
  setLeftColumn,
  setRightTable,
  setRightColumn,
  setJoinType,

  onCreate,
  onUpdate,
  onCancel,
  onAutoMap,

  selectedConnectionIds,
}) => {
  /* ================= FK AUTO-SUGGESTIONS ================= */

  const fkSuggestions = useMemo(() => {
    const suggestions: {
      left_table: string;
      left_column: string;
      right_table: string;
      right_column: string;
    }[] = [];

    schemas.forEach((table) => {
      table.columns.forEach((col) => {
        if (col.fk) {
          suggestions.push({
            left_table: table.tableName,
            left_column: col.name,
            right_table: col.fk.table,
            right_column: col.fk.column,
          });
        }
      });
    });

    return suggestions;
  }, [schemas]);

  const leftTableColumns =
    schemas.find((s) => s.tableName === leftTable)?.columns ?? [];

  const rightTableColumns =
    schemas.find((s) => s.tableName === rightTable)?.columns ?? [];

  /* ================= UI ================= */

  return (
    <>
      {/* ================= AUTO MAP ================= */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Auto Detect Relationships</h3>
            <p className="text-sm text-gray-500">
              Detect joins using foreign keys
            </p>
          </div>
        </div>

        <Button
          onClick={onAutoMap}
          className="w-full"
          variant="warning"
          disabled={selectedConnectionIds.length === 0}
        >
          <Zap className="w-4 h-4 mr-1" />
          Run Auto Map
        </Button>
      </Card>

      {/* ================= MANUAL MAPPING ================= */}
      <Card className="p-6 mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {editingRelationship
                ? "Edit Table Relationship"
                : "Create Table Relationship"}
            </h3>
            <p className="text-sm text-gray-500">
              Define how tables are joined
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* LEFT TABLE */}
          <Select
            value={leftTable}
            onChange={(e) => {
              setLeftTable(e.target.value);
              setLeftColumn("");
            }}
          >
            <option value="">Select Left Table</option>
            {schemas.map((s) => (
              <option key={s.tableName} value={s.tableName}>
                {s.tableName} ({s.connection_name})
              </option>
            ))}
          </Select>

          {/* LEFT COLUMN */}
          <Select
            value={leftColumn}
            onChange={(e) => setLeftColumn(e.target.value)}
            disabled={!leftTable}
          >
            <option value="">Select Left Column</option>
            {leftTableColumns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>

          {/* RIGHT TABLE */}
          <Select
            value={rightTable}
            onChange={(e) => {
              setRightTable(e.target.value);
              setRightColumn("");
            }}
          >
            <option value="">Select Right Table</option>
            {schemas.map((s) => (
              <option key={s.tableName} value={s.tableName}>
                {s.tableName} ({s.connection_name})
              </option>
            ))}
          </Select>

          {/* RIGHT COLUMN */}
          <Select
            value={rightColumn}
            onChange={(e) => setRightColumn(e.target.value)}
            disabled={!rightTable}
          >
            <option value="">Select Right Column</option>
            {rightTableColumns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>

          {/* JOIN TYPE */}
          <Select
            value={joinType}
            onChange={(e) => setJoinType(e.target.value as any)}
          >
            <option value="LEFT">LEFT JOIN</option>
            <option value="INNER">INNER JOIN</option>
            <option value="RIGHT">RIGHT JOIN</option>
          </Select>

          {/* FK SUGGESTIONS */}
          {fkSuggestions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">
                  Foreign Key Suggestions
                </span>
              </div>

              <ul className="text-xs space-y-2">
                {fkSuggestions.map((s, i) => (
                  <li
                    key={i}
                    className="bg-white border rounded p-2 cursor-pointer hover:bg-blue-100"
                    onClick={() => {
                      setLeftTable(s.left_table);
                      setLeftColumn(s.left_column);
                      setRightTable(s.right_table);
                      setRightColumn(s.right_column);
                      setJoinType("LEFT");
                    }}
                  >
                    {s.left_table}.{s.left_column} → {s.right_table}.
                    {s.right_column}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={editingRelationship ? onUpdate : onCreate}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-1" />
              {editingRelationship ? "Update" : "Create"}
            </Button>

            <Button variant="secondary" onClick={onCancel}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
};

export default MappingForm;

// src/components/MappingForm.tsx
import React, { useMemo } from "react";
import { Zap, Target, Plus, Lightbulb, Save, X } from "lucide-react"; // Import Save and X
import Card from "./ui/Card";
import Button from "./ui/Button";
import Select from "./ui/Select";

interface Schema {
  tableName: string;
  columns: {
    name: string;
    type: string;
    isPk?: boolean;
    fk?: { table: string; column: string } | null;
  }[];
}

interface Fact {
  id: number;
  name: string;
  table_name: string;
}

interface Dimension {
  id: number;
  name: string;
  table_name: string;
}

interface FactDimension {
  id: number;
  fact_id: number;
  fact_name: string;
  dimension_id: number;
  dimension_name: string;
  join_table: string;
  fact_column: string;
  dimension_column: string;
}

interface MappingFormProps {
  schemas: Schema[];
  facts: Fact[];
  dimensions: Dimension[];
  editingFactDimension: FactDimension | null; // Added
  mappingFactId: string;
  mappingDimensionId: string;
  mappingJoinTable: string;
  mappingFactColumn: string;
  mappingDimensionColumn: string;
  setMappingFactId: (value: string) => void;
  setMappingDimensionId: (value: string) => void;
  setMappingJoinTable: (value: string) => void;
  setMappingFactColumn: (value: string) => void;
  setMappingDimensionColumn: (value: string) => void;
  onCreate: () => void;
  onUpdate: () => void; // Added
  onCancel: () => void; // Added
  onAutoMap: () => void;
  selectedConnectionIds: number[];
}

const MappingForm: React.FC<MappingFormProps> = ({
  schemas,
  facts,
  dimensions,
  editingFactDimension, // Used here
  mappingFactId,
  mappingDimensionId,
  mappingJoinTable,
  mappingFactColumn,
  mappingDimensionColumn,
  setMappingFactId,
  setMappingDimensionId,
  setMappingJoinTable,
  setMappingFactColumn,
  setMappingDimensionColumn,
  onCreate,
  onUpdate, // Used here
  onCancel, // Used here
  onAutoMap,
  selectedConnectionIds,
}) => {
  /* ---------------------------------------------------------
        1. RELATIONSHIP GRAPH (ONLY FOREIGN KEYS)
  ----------------------------------------------------------*/
  const relationships = useMemo(() => {
    const rel: any[] = [];

    schemas.forEach((table) => {
      table.columns.forEach((col) => {
        if (col.fk) {
          rel.push({
            fromTable: table.tableName,
            fromColumn: col.name,
            toTable: col.fk.table,
            toColumn: col.fk.column,
          });
        }
      });
    });

    return rel;
  }, [schemas]);

  /* ---------------------------------------------------------
      2. VALID SUGGESTIONS (FK ONLY, DEDUPED)
  ----------------------------------------------------------*/
  const suggestions = useMemo(() => {
    if (!mappingFactId || !mappingDimensionId) return [];

    const fact = facts.find((f) => f.id === Number(mappingFactId));
    const dim = dimensions.find((d) => d.id === Number(mappingDimensionId));
    if (!fact || !dim) return [];

    const factTable = fact.table_name;
    const dimTable = dim.table_name;

    const results: any[] = [];
    const seen = new Set<string>();

    const getType = (table: string, col: string) => {
      return schemas
        .find((s) => s.tableName === table)
        ?.columns.find((c) => c.name === col)?.type;
    };

    /* -------------------- DIRECT FK JOINS -------------------- */
    relationships.forEach((r) => {
      const isMatch =
        (r.fromTable === factTable && r.toTable === dimTable) ||
        (r.fromTable === dimTable && r.toTable === factTable);

      if (isMatch) {
        const key = [r.fromTable, r.fromColumn, r.toTable, r.toColumn]
          .sort()
          .join("|");

        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            type: "direct",
            label: `${r.fromTable}.${r.fromColumn} → ${r.toTable}.${r.toColumn}`,
            fromColumn: r.fromColumn,
            toColumn: r.toColumn,
            dataType: getType(r.fromTable, r.fromColumn),
          });
        }
      }
    });

    /* ----------------------- TWO-HOP FK JOINS ----------------------- */
    schemas.forEach((via) => {
      if (via.tableName === factTable || via.tableName === dimTable) return;

      const step1 = relationships.find(
        (r) =>
          (r.fromTable === factTable && r.toTable === via.tableName) ||
          (r.toTable === factTable && r.fromTable === via.tableName)
      );

      const step2 = relationships.find(
        (r) =>
          (r.fromTable === via.tableName && r.toTable === dimTable) ||
          (r.toTable === via.tableName && r.fromTable === dimTable)
      );

      if (step1 && step2) {
        const key = [
          factTable,
          via.tableName,
          dimTable,
          step1.fromColumn,
          step1.toColumn,
          step2.fromColumn,
          step2.toColumn,
        ]
          .sort()
          .join("|");

        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            type: "twohop",
            label: `${factTable} → ${via.tableName} → ${dimTable}`,
            viaTable: via.tableName,
            step1,
            step2,
          });
        }
      }
    });

    return results;
  }, [
    mappingFactId,
    mappingDimensionId,
    facts,
    dimensions,
    schemas,
    relationships,
  ]);

  /* ---------------------------------------------------------
        UI COMPONENT
  ----------------------------------------------------------*/
  return (
    <>
      {/* Auto-map */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Auto-Map</h3>
            <p className="text-sm text-gray-500">
              Automatically detect relationships
            </p>
          </div>
        </div>

        <Button
          onClick={onAutoMap}
          className="w-full"
          variant="warning"
          disabled={selectedConnectionIds.length === 0}
        >
          <Zap className="w-4 h-4" /> Run Auto-Map
        </Button>
      </Card>

      {/* Mapping UI */}
      <Card className="p-6 mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {editingFactDimension ? "Edit Mapping" : "Create Mapping"}
            </h3>
            <p className="text-sm text-gray-500">Link facts with dimensions</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* FACT */}
          <Select
            value={mappingFactId}
            onChange={(e) => setMappingFactId(e.target.value)}
            disabled={!!editingFactDimension} // Disable editing fact in update mode
          >
            <option value="">Select Fact</option>
            {facts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>

          {/* DIMENSION */}
          <Select
            value={mappingDimensionId}
            onChange={(e) => setMappingDimensionId(e.target.value)}
            disabled={!!editingFactDimension} // Disable editing dimension in update mode
          >
            <option value="">Select Dimension</option>
            {dimensions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>

          {/* VALID SUGGESTIONS (Only show in creation mode for simplicity) */}
          {!editingFactDimension && mappingFactId && mappingDimensionId && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">
                  Valid Join Suggestions
                </span>
              </div>

              {suggestions.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No valid FK relationships found.
                </p>
              ) : (
                <ul className="text-xs space-y-2">
                  {suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="bg-white border rounded p-2 shadow-sm"
                    >
                      <div className="font-medium text-gray-900">{s.label}</div>

                      {s.type === "direct" && (
                        <div className="text-[11px] mt-1">
                          • {s.fromColumn} ↔ {s.toColumn} (type: {s.dataType})
                        </div>
                      )}

                      {s.type === "twohop" && (
                        <div className="text-[11px] mt-1">
                          • {s.step1.fromColumn} ↔ {s.step1.toColumn},{" "}
                          {s.step2.fromColumn} ↔ {s.step2.toColumn}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* JOIN TABLE */}
          <Select
            value={mappingJoinTable}
            onChange={(e) => setMappingJoinTable(e.target.value)}
          >
            <option value="">Select Join Table</option>
            {schemas.map((s) => (
              <option key={s.tableName} value={s.tableName}>
                {s.tableName}
              </option>
            ))}
          </Select>

          {/* FACT COLUMN */}
          {mappingFactId && (
            <Select
              value={mappingFactColumn}
              onChange={(e) => setMappingFactColumn(e.target.value)}
            >
              <option value="">Select Fact Column</option>
              {schemas
                .find(
                  (s) =>
                    s.tableName ===
                    facts.find((f) => f.id === Number(mappingFactId))
                      ?.table_name
                )
                ?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </Select>
          )}

          {/* DIM COLUMN */}
          {mappingJoinTable && (
            <Select
              value={mappingDimensionColumn}
              onChange={(e) => setMappingDimensionColumn(e.target.value)}
            >
              <option value="">Select Dimension Column</option>
              {schemas
                .find((s) => s.tableName === mappingJoinTable)
                ?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </Select>
          )}

          <div className="flex space-x-2">
            <Button
              onClick={editingFactDimension ? onUpdate : onCreate}
              className="flex-1"
              variant="warning"
            >
              {editingFactDimension ? (
                <>
                  <Save className="w-4 h-4" /> Update Mapping
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Create Mapping
                </>
              )}
            </Button>
            {editingFactDimension && (
              <Button onClick={onCancel} variant="secondary">
                <X className="w-4 h-4" /> Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  );
};

export default MappingForm;
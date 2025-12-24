import React from "react";
import { Layers, Save, X } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

interface Schema {
  tableName: string;
  columns: {
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }[];
}

interface Dimension {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
  display_column?: string;
}

interface DimensionFormProps {
  schemas: Schema[];
  editingDimension: Dimension | null;

  dimensionName: string;
  dimensionTable: string;
  dimensionColumn: string;
  dimensionDisplayColumn: string;

  setDimensionName: (value: string) => void;
  setDimensionTable: (value: string) => void;
  setDimensionColumn: (value: string) => void;
  setDimensionDisplayColumn: (value: string) => void;

  onCreate: () => void;
  onUpdate: () => void;
  onCancel: () => void;
}

const DimensionForm: React.FC<DimensionFormProps> = ({
  schemas,
  editingDimension,

  dimensionName,
  dimensionTable,
  dimensionColumn,
  dimensionDisplayColumn,

  setDimensionName,
  setDimensionTable,
  setDimensionColumn,
  setDimensionDisplayColumn,

  onCreate,
  onUpdate,
  onCancel,
}) => {
  return (
    <Card className="p-6">
      {/* HEADER */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
          <Layers className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {editingDimension ? "Edit Dimension" : "Create Dimension"}
          </h3>
          <p className="text-sm text-gray-500">
            Define data categorization attributes
          </p>
        </div>
      </div>

      {/* FORM */}
      <div className="space-y-4">
        <Input
          placeholder="Dimension Name (e.g., Customer)"
          value={dimensionName}
          onChange={(e) => setDimensionName(e.target.value)}
        />

        <Select
          value={dimensionTable}
          onChange={(e) => {
            setDimensionTable(e.target.value);
            setDimensionColumn("");
            setDimensionDisplayColumn("");
          }}
        >
          <option value="">Select Table</option>
          {schemas.map((t) => (
            <option key={t.tableName} value={t.tableName}>
              {t.tableName}
            </option>
          ))}
        </Select>

        {dimensionTable && (
          <Select
            value={dimensionColumn}
            onChange={(e) => setDimensionColumn(e.target.value)}
          >
            <option value="">Select Key Column</option>
            {schemas
              .find((t) => t.tableName === dimensionTable)
              ?.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
          </Select>
        )}

        {dimensionTable && (
          <Select
            value={dimensionDisplayColumn}
            onChange={(e) => setDimensionDisplayColumn(e.target.value)}
          >
            <option value="">Select Display Column (optional)</option>
            {schemas
              .find((t) => t.tableName === dimensionTable)
              ?.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
          </Select>
        )}

        {/* ACTIONS */}
        <div className="flex space-x-2">
          <Button
            onClick={editingDimension ? onUpdate : onCreate}
            variant="success"
            className="flex-1"
          >
            <Save className="w-4 h-4 mr-1" />
            {editingDimension ? "Update" : "Create"} Dimension
          </Button>

          {editingDimension && (
            <Button onClick={onCancel} variant="secondary">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default DimensionForm;

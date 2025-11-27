import React from "react";
import { BarChart3, Save, X } from "lucide-react";
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

interface Fact {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
  aggregate_function: string;
}

interface FactFormProps {
  schemas: Schema[];
  editingFact: Fact | null;
  factName: string;
  factTable: string;
  factColumn: string;
  factAggregation: string;
  setFactName: (value: string) => void;
  setFactTable: (value: string) => void;
  setFactColumn: (value: string) => void;
  setFactAggregation: (value: string) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onCancel: () => void;
}

const FactForm: React.FC<FactFormProps> = ({
  schemas,
  editingFact,
  factName,
  factTable,
  factColumn,
  factAggregation,
  setFactName,
  setFactTable,
  setFactColumn,
  setFactAggregation,
  onCreate,
  onUpdate,
  onCancel,
}) => (
  <Card className="p-6">
    <div className="flex items-center space-x-3 mb-6">
      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {editingFact ? "Edit Fact" : "Create Fact"}
        </h3>
        <p className="text-sm text-gray-500">
          Define measurable business metrics
        </p>
      </div>
    </div>
    <div className="space-y-4">
      <Input
        placeholder="Fact Name (e.g., Revenue)"
        value={factName}
        onChange={(e) => setFactName(e.target.value)}
      />
      <Select
        value={factTable}
        onChange={(e) => {
          setFactTable(e.target.value);
          setFactColumn("");
        }}
      >
        <option value="">Select Table</option>
        {schemas.map((t) => (
          <option key={t.tableName} value={t.tableName}>
            {t.tableName}
          </option>
        ))}
      </Select>
      {factTable && (
        <Select
          value={factColumn}
          onChange={(e) => setFactColumn(e.target.value)}
        >
          <option value="">Select Column</option>
          {schemas
            .find((t) => t.tableName === factTable)
            ?.columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.type})
              </option>
            ))}
        </Select>
      )}
      <Select
        value={factAggregation}
        onChange={(e) => setFactAggregation(e.target.value)}
      >
        <option value="SUM">SUM</option>
        <option value="AVG">AVG</option>
        <option value="COUNT">COUNT</option>
        <option value="MIN">MIN</option>
        <option value="MAX">MAX</option>
        <option value="MEDIAN">MEDIAN</option>
        <option value="STDDEV">STDDEV</option>
        <option value="VARIANCE">VARIANCE</option>
      </Select>
      <div className="flex space-x-2">
        <Button onClick={editingFact ? onUpdate : onCreate} className="flex-1">
          <Save className="w-4 h-4" />
          {editingFact ? "Update" : "Create"} Fact
        </Button>
        {editingFact && (
          <Button onClick={onCancel} variant="secondary">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  </Card>
);

export default FactForm;

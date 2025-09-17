import React from "react";
import { Zap, Save, X, Plus } from "lucide-react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Textarea from "./ui/Textarea";
import Select from "./ui/Select";
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

interface KPI {
  id: number;
  name: string;
  expression: string;
  description?: string;
}

interface KPIFormProps {
  schemas: Schema[];
  facts: Fact[];
  editingKPI: KPI | null;
  kpiName: string;
  kpiExpression: string;
  kpiDescription: string;
  kpiInsertType: "fact" | "column" | "";
  kpiInsertFactId: string;
  kpiInsertTable: string;
  kpiInsertColumn: string;
  setKpiName: (value: string) => void;
  setKpiExpression: (value: string) => void;
  setKpiDescription: (value: string) => void;
  setKpiInsertType: (value: "fact" | "column" | "") => void;
  setKpiInsertFactId: (value: string) => void;
  setKpiInsertTable: (value: string) => void;
  setKpiInsertColumn: (value: string) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onCancel: () => void;
  onInsert: () => void;
}

const KPIForm: React.FC<KPIFormProps> = ({
  schemas,
  facts,
  editingKPI,
  kpiName,
  kpiExpression,
  kpiDescription,
  kpiInsertType,
  kpiInsertFactId,
  kpiInsertTable,
  kpiInsertColumn,
  setKpiName,
  setKpiExpression,
  setKpiDescription,
  setKpiInsertType,
  setKpiInsertFactId,
  setKpiInsertTable,
  setKpiInsertColumn,
  onCreate,
  onUpdate,
  onCancel,
  onInsert,
}) => (
  <Card className="p-6">
    <div className="flex items-center space-x-3 mb-6">
      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
        <Zap className="w-5 h-5 text-purple-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {editingKPI ? "Edit KPI" : "Create KPI"}
        </h3>
        <p className="text-sm text-gray-500">
          Define key performance indicators
        </p>
      </div>
    </div>
    <div className="space-y-4">
      <Input
        placeholder="KPI Name (e.g., Profit Margin)"
        value={kpiName}
        onChange={(e) => setKpiName(e.target.value)}
      />
      <div className="flex space-x-2">
        <Input
          placeholder="Expression (e.g., Revenue - Cost)"
          value={kpiExpression}
          onChange={(e) => setKpiExpression(e.target.value)}
          className="flex-1"
        />
        <Select
          value={kpiInsertType}
          onChange={(e) => {
            setKpiInsertType(e.target.value as "fact" | "column" | "");
            setKpiInsertFactId("");
            setKpiInsertTable("");
            setKpiInsertColumn("");
          }}
          className="w-32"
        >
          <option value="">Insert...</option>
          <option value="fact">Fact</option>
          <option value="column">Column</option>
        </Select>
      </div>
      {kpiInsertType === "fact" && (
        <Select
          value={kpiInsertFactId}
          onChange={(e) => setKpiInsertFactId(e.target.value)}
        >
          <option value="">Select Fact</option>
          {facts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      )}
      {kpiInsertType === "column" && (
        <>
          <Select
            value={kpiInsertTable}
            onChange={(e) => {
              setKpiInsertTable(e.target.value);
              setKpiInsertColumn("");
            }}
          >
            <option value="">Select Table</option>
            {schemas.map((t) => (
              <option key={t.tableName} value={t.tableName}>
                {t.tableName}
              </option>
            ))}
          </Select>
          {kpiInsertTable && (
            <Select
              value={kpiInsertColumn}
              onChange={(e) => setKpiInsertColumn(e.target.value)}
            >
              <option value="">Select Column</option>
              {schemas
                .find((t) => t.tableName === kpiInsertTable)
                ?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.type})
                  </option>
                ))}
            </Select>
          )}
        </>
      )}
      {((kpiInsertType === "fact" && kpiInsertFactId) ||
        (kpiInsertType === "column" && kpiInsertTable && kpiInsertColumn)) && (
        <Button onClick={onInsert} variant="secondary" size="sm">
          <Plus className="w-4 h-4" />
          Insert
        </Button>
      )}
      {kpiExpression && (
        <div className="p-3 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Preview:</p>
          <code className="text-sm font-mono text-gray-800">
            {kpiExpression}
          </code>
        </div>
      )}
      <Textarea
        placeholder="Description (optional)"
        value={kpiDescription}
        onChange={(e) => setKpiDescription(e.target.value)}
      />
      <div className="flex space-x-2">
        <Button
          onClick={editingKPI ? onUpdate : onCreate}
          variant="warning"
          className="flex-1"
        >
          <Save className="w-4 h-4" />
          {editingKPI ? "Update" : "Create"} KPI
        </Button>
        {editingKPI && (
          <Button onClick={onCancel} variant="secondary">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  </Card>
);

export default KPIForm;

import React from "react";
import { Zap, Target, Plus } from "lucide-react";
import Card from "./ui/Card";
import Button from "./ui/Button";
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

interface Dimension {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
}

interface MappingFormProps {
  schemas: Schema[];
  facts: Fact[];
  dimensions: Dimension[];
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
  onAutoMap: () => void;
}

const MappingForm: React.FC<MappingFormProps> = ({
  schemas,
  facts,
  dimensions,
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
  onAutoMap,
}) => (
  <>
    <Card className="p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Zap className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Auto-Map</h3>
          <p className="text-sm text-gray-500">
            Automatically detect relationships
          </p>
        </div>
      </div>
      <Button onClick={onAutoMap} variant="warning" className="w-full">
        <Zap className="w-4 h-4" />
        Run Auto-Map
      </Button>
    </Card>
    <Card className="p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
          <Target className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Create Mapping
          </h3>
          <p className="text-sm text-gray-500">Link facts with dimensions</p>
        </div>
      </div>
      <div className="space-y-4">
        <Select
          value={mappingFactId}
          onChange={(e) => setMappingFactId(e.target.value)}
        >
          <option value="">Select Fact</option>
          {facts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        <Select
          value={mappingDimensionId}
          onChange={(e) => setMappingDimensionId(e.target.value)}
        >
          <option value="">Select Dimension</option>
          {dimensions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          value={mappingJoinTable}
          onChange={(e) => setMappingJoinTable(e.target.value)}
        >
          <option value="">Select Join Table</option>
          {schemas.map((t) => (
            <option key={t.tableName} value={t.tableName}>
              {t.tableName}
            </option>
          ))}
        </Select>
        {mappingFactId && (
          <Select
            value={mappingFactColumn}
            onChange={(e) => setMappingFactColumn(e.target.value)}
          >
            <option value="">Select Fact Column</option>
            {schemas
              .find(
                (t) =>
                  t.tableName ===
                  facts.find((f) => f.id === Number(mappingFactId))?.table_name
              )
              ?.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
          </Select>
        )}
        {mappingJoinTable && (
          <Select
            value={mappingDimensionColumn}
            onChange={(e) => setMappingDimensionColumn(e.target.value)}
          >
            <option value="">Select Dimension Column</option>
            {schemas
              .find((t) => t.tableName === mappingJoinTable)
              ?.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
          </Select>
        )}
        <Button onClick={onCreate} variant="warning" className="w-full">
          <Plus className="w-4 h-4" />
          Create Mapping
        </Button>
      </div>
    </Card>
  </>
);

export default MappingForm;

import React from "react";
import {
  BarChart3,
  Layers,
  Target,
  Zap,
  Edit2,
  Trash2,
  Filter,
} from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";

/* ================= TYPES ================= */

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

interface TableRelationship {
  id: number;
  left_table: string;
  left_column: string;
  right_table: string;
  right_column: string;
  join_type: "LEFT" | "INNER" | "RIGHT";
  connection_name?: string;
}

interface KPI {
  id: number;
  name: string;
  expression: string;
  description?: string;
}

interface DataListProps {
  activeTab: string;

  facts: Fact[];
  dimensions: Dimension[];
  tableRelationships: TableRelationship[];
  kpis: KPI[];

  filteredFacts: Fact[];
  filteredDimensions: Dimension[];
  filteredTableRelationships: TableRelationship[];
  filteredKpis: KPI[];

  onEditFact: (fact: Fact) => void;
  onDeleteFact: (id: number, name: string) => void;

  onEditDimension: (dimension: Dimension) => void;
  onDeleteDimension: (id: number, name: string) => void;

  onEditTableRelationship: (mapping: TableRelationship) => void;
  onDeleteTableRelationship: (id: number) => void;

  onEditKPI: (kpi: KPI) => void;
  onDeleteKPI: (id: number, name: string) => void;
}

/* ================= COMPONENT ================= */

const DataList: React.FC<DataListProps> = ({
  activeTab,

  facts,
  dimensions,
  tableRelationships,
  kpis,

  filteredFacts,
  filteredDimensions,
  filteredTableRelationships,
  filteredKpis,

  onEditFact,
  onDeleteFact,

  onEditDimension,
  onDeleteDimension,

  onEditTableRelationship,
  onDeleteTableRelationship,

  onEditKPI,
  onDeleteKPI,
}) => (
  <div className="lg:col-span-2">
    <Card className="p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {activeTab === "facts" && `Facts (${filteredFacts.length})`}
          {activeTab === "dimensions" &&
            `Dimensions (${filteredDimensions.length})`}
          {activeTab === "mappings" &&
            `Table Relationships (${filteredTableRelationships.length})`}
          {activeTab === "kpis" && `KPIs (${filteredKpis.length})`}
        </h3>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
          <span>Filtered by search</span>
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {/* FACTS */}
        {activeTab === "facts" &&
          filteredFacts.map((fact) => (
            <div
              key={fact.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
            >
              <div>
                <h4 className="font-medium">{fact.name}</h4>
                <p className="text-sm text-gray-600">
                  {fact.aggregate_function}({fact.table_name}.{fact.column_name}
                  )
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => onEditFact(fact)} size="sm">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => onDeleteFact(fact.id, fact.name)}
                  variant="danger"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

        {/* DIMENSIONS */}
        {activeTab === "dimensions" &&
          filteredDimensions.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
            >
              <div>
                <h4 className="font-medium">{d.name}</h4>
                <p className="text-sm text-gray-600">
                  {d.table_name}.{d.column_name}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => onEditDimension(d)} size="sm">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => onDeleteDimension(d.id, d.name)}
                  variant="danger"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

        {/* TABLE RELATIONSHIPS */}
        {activeTab === "mappings" &&
          filteredTableRelationships.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
            >
              <div>
                <h4 className="font-medium text-gray-900">
                  {m.left_table}.{m.left_column} → {m.right_table}.
                  {m.right_column}
                </h4>

                <p className="text-sm text-gray-600 mt-1">{m.join_type} JOIN</p>

                {/* {m.connection_name && (
                  <p className="text-xs text-blue-600 font-semibold mt-0.5">
                    Connection: {m.connection_name}
                  </p>
                )} */}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => onEditTableRelationship(m)} size="sm">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => onDeleteTableRelationship(m.id)}
                  variant="danger"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

        {/* KPIS */}
        {activeTab === "kpis" &&
          filteredKpis.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
            >
              <div>
                <h4 className="font-medium">{k.name}</h4>
                <p className="text-sm font-mono text-gray-600">
                  {k.expression}
                </p>
                {k.description && (
                  <p className="text-xs text-gray-500 mt-1">{k.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => onEditKPI(k)} size="sm">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => onDeleteKPI(k.id, k.name)}
                  variant="danger"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
      </div>

      {/* EMPTY STATES */}
      {activeTab === "mappings" && filteredTableRelationships.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No table relationships found. Create your first one.
          </p>
        </div>
      )}
    </Card>
  </div>
);

export default DataList;

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
import Card from "./ui/Card";
import Button from "./ui/Button";

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

interface FactDimension {
  id: number;
  fact_id: number;
  dimension_id: number;
  join_table: string;
  fact_column: string;
  dimension_column: string;
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
  factDimensions: FactDimension[];
  kpis: KPI[];
  filteredFacts: Fact[];
  filteredDimensions: Dimension[];
  filteredKpis: KPI[];
  onEditFact: (fact: Fact) => void;
  onDeleteFact: (id: number, name: string) => void;
  onEditDimension: (dimension: Dimension) => void;
  onDeleteDimension: (id: number, name: string) => void;
  onEditKPI: (kpi: KPI) => void;
  onDeleteKPI: (id: number, name: string) => void;
}

const DataList: React.FC<DataListProps> = ({
  activeTab,
  facts,
  dimensions,
  factDimensions,
  kpis,
  filteredFacts,
  filteredDimensions,
  filteredKpis,
  onEditFact,
  onDeleteFact,
  onEditDimension,
  onDeleteDimension,
  onEditKPI,
  onDeleteKPI,
}) => (
  <div className="lg:col-span-2">
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {activeTab === "facts" && `Facts (${filteredFacts.length})`}
          {activeTab === "dimensions" &&
            `Dimensions (${filteredDimensions.length})`}
          {activeTab === "mappings" && `Mappings (${factDimensions.length})`}
          {activeTab === "kpis" && `KPIs (${filteredKpis.length})`}
        </h3>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
          <span>Filtered by search</span>
        </div>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activeTab === "facts" &&
          filteredFacts.map((fact) => (
            <div
              key={fact.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{fact.name}</h4>
                <p className="text-sm text-gray-600">
                  {fact.aggregate_function}({fact.table_name}.{fact.column_name}
                  )
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => onEditFact(fact)}
                  variant="secondary"
                  size="sm"
                >
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
        {activeTab === "dimensions" &&
          filteredDimensions.map((dimension) => (
            <div
              key={dimension.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{dimension.name}</h4>
                <p className="text-sm text-gray-600">
                  {dimension.table_name}.{dimension.column_name}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => onEditDimension(dimension)}
                  variant="secondary"
                  size="sm"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() =>
                    onDeleteDimension(dimension.id, dimension.name)
                  }
                  variant="danger"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        {activeTab === "mappings" &&
          factDimensions.map((mapping) => (
            <div key={mapping.id} className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {facts.find((f) => f.id === mapping.fact_id)?.name ||
                      "Unknown Fact"}{" "}
                    →{" "}
                    {dimensions.find((d) => d.id === mapping.dimension_id)
                      ?.name || "Unknown Dimension"}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {mapping.join_table}.{mapping.dimension_column} ={" "}
                    {facts.find((f) => f.id === mapping.fact_id)?.table_name ||
                      "Unknown Table"}
                    .{mapping.fact_column}
                  </p>
                </div>
              </div>
            </div>
          ))}
        {activeTab === "kpis" &&
          filteredKpis.map((kpi) => (
            <div
              key={kpi.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{kpi.name}</h4>
                <p className="text-sm text-gray-600 font-mono">
                  {kpi.expression}
                </p>
                {kpi.description && (
                  <p className="text-xs text-gray-500 mt-1">
                    {kpi.description}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => onEditKPI(kpi)}
                  variant="secondary"
                  size="sm"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => onDeleteKPI(kpi.id, kpi.name)}
                  variant="danger"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
      </div>
      {activeTab === "facts" && filteredFacts.length === 0 && (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No facts found. Create your first fact to get started.
          </p>
        </div>
      )}
      {activeTab === "dimensions" && filteredDimensions.length === 0 && (
        <div className="text-center py-12">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No dimensions found. Create your first dimension to get started.
          </p>
        </div>
      )}
      {activeTab === "mappings" && factDimensions.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No mappings found. Create relationships between facts and
            dimensions.
          </p>
        </div>
      )}
      {activeTab === "kpis" && filteredKpis.length === 0 && (
        <div className="text-center py-12">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No KPIs found. Create your first KPI to get started.
          </p>
        </div>
      )}
    </Card>
  </div>
);

export default DataList;

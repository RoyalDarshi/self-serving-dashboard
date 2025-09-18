import React from "react";
import { useDrop } from "react-dnd";
import { X } from "lucide-react";

// Types (copied/adapted from DynamicSemanticChartBuilder for completeness)
interface Column {
  key: string;
  label: string;
  type: string;
  id?: number;
}

interface Dimension {
  id: number;
  name: string;
  column_name: string;
}

interface Fact {
  id: number;
  name: string;
  table_name: string;
  column_name: string;
  aggregate_function: string;
}

interface SingleDropZoneProps {
  onDrop: (item: {
    column?: Column;
    fact?: Fact;
    dimension?: Dimension;
  }) => void;
  onRemove: (id?: number) => void;
  selectedColumns: Column[];
  label: string;
  accept: string[];
  allowMultiple: boolean;
}

const SingleDropZone: React.FC<SingleDropZoneProps> = ({
  onDrop,
  onRemove,
  selectedColumns,
  label,
  accept,
  allowMultiple,
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept,
    drop: (item) => onDrop(item),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      className={`min-h-[100px] border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
        isOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
      }`}
    >
      {selectedColumns.length === 0 ? (
        <p className="text-sm text-slate-500">{label}</p>
      ) : (
        selectedColumns.map((col, index) => (
          <div
            key={col.key}
            className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg mb-2"
          >
            <span className="text-sm font-medium text-slate-700">
              {col.label}
            </span>
            {(allowMultiple || index === 0) && (
              <button
                onClick={() => onRemove(col.id)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
};

interface ChartDropZoneProps {
  setXAxisDimension: React.Dispatch<React.SetStateAction<Dimension | null>>;
  setYAxisFacts: React.Dispatch<React.SetStateAction<Fact[]>>;
  setGroupByDimension: React.Dispatch<React.SetStateAction<Dimension | null>>;
  xAxisDimension: Dimension | null;
  yAxisFacts: Fact[];
  groupByDimension: Dimension | null;
}

const ChartDropZone: React.FC<ChartDropZoneProps> = ({
  setXAxisDimension,
  setYAxisFacts,
  setGroupByDimension,
  xAxisDimension,
  yAxisFacts,
  groupByDimension,
}) => {
  const handleDropX = (item: { dimension?: Dimension }) => {
    if (item.dimension) {
      setXAxisDimension(item.dimension);
    }
  };

  const handleRemoveX = () => setXAxisDimension(null);

  const handleDropY = (item: { fact?: Fact }) => {
    if (item.fact) {
      // Prevent adding duplicate facts by checking IDs
      if (!yAxisFacts.some((f) => f.id === item.fact!.id)) {
        setYAxisFacts((prev) => [...prev, item.fact!]);
      }
    }
  };

  const handleRemoveY = (id?: number) => {
    if (id !== undefined) {
      setYAxisFacts((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const handleDropGroup = (item: { dimension?: Dimension }) => {
    if (item.dimension) {
      setGroupByDimension(item.dimension);
    }
  };

  const handleRemoveGroup = () => setGroupByDimension(null);

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          X-Axis (Dimension)
        </label>
        <SingleDropZone
          onDrop={handleDropX}
          onRemove={handleRemoveX}
          selectedColumns={
            xAxisDimension
              ? [
                  {
                    id: xAxisDimension.id,
                    key: xAxisDimension.name,
                    label: xAxisDimension.name,
                    type: "string",
                  },
                ]
              : []
          }
          label="Drop dimension here"
          accept={["dimension"]}
          allowMultiple={false}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Y-Axis (Facts)
        </label>
        <SingleDropZone
          onDrop={handleDropY}
          onRemove={handleRemoveY}
          selectedColumns={yAxisFacts.map((f) => ({
            id: f.id,
            key: f.name,
            label: `${f.name} (${f.aggregate_function})`,
            type: "number",
          }))}
          label="Drop facts here (multiple allowed)"
          accept={["fact"]}
          allowMultiple={true}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Group By (Optional Dimension)
        </label>
        <SingleDropZone
          onDrop={handleDropGroup}
          onRemove={handleRemoveGroup}
          selectedColumns={
            groupByDimension
              ? [
                  {
                    id: groupByDimension.id,
                    key: groupByDimension.name,
                    label: groupByDimension.name,
                    type: "string",
                  },
                ]
              : []
          }
          label="Drop dimension here"
          accept={["dimension"]}
          allowMultiple={false}
        />
      </div>
    </div>
  );
};

export default ChartDropZone;

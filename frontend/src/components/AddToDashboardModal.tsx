// New file: src/components/AddToDashboardModal.tsx
import React from "react";

interface AddToDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDashboards: {
    id: string;
    name: string;
    description?: string;
  }[];
  selectedDashboard: string;
  onSelectDashboard: (id: string) => void;
  newDashboardName: string;
  onNewDashboardNameChange: (name: string) => void;
  newDashboardDescription: string;
  onNewDashboardDescriptionChange: (desc: string) => void;
  isSaving: boolean;
  onSaveToExisting: () => void;
  onCreateNew: () => void;
}

const AddToDashboardModal: React.FC<AddToDashboardModalProps> = ({
  isOpen,
  onClose,
  availableDashboards,
  selectedDashboard,
  onSelectDashboard,
  newDashboardName,
  onNewDashboardNameChange,
  newDashboardDescription,
  onNewDashboardDescriptionChange,
  isSaving,
  onSaveToExisting,
  onCreateNew,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Add Chart to Dashboard
          </h2>
          <div className="space-y-4">
            {availableDashboards.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Dashboard
                </label>
                <select
                  value={selectedDashboard}
                  onChange={(e) => onSelectDashboard(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a dashboard</option>
                  {availableDashboards.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm text-slate-600 mb-2">
                No dashboards found for this connection. Create a new one below.
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {availableDashboards.length > 0
                  ? "Or New Dashboard Name"
                  : "New Dashboard Name"}
              </label>
              <input
                type="text"
                value={newDashboardName}
                onChange={(e) => onNewDashboardNameChange(e.target.value)}
                placeholder="Enter new dashboard name..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={newDashboardDescription}
                onChange={(e) =>
                  onNewDashboardDescriptionChange(e.target.value)
                }
                placeholder="Describe the dashboard..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            {availableDashboards.length > 0 && (
              <button
                onClick={onSaveToExisting}
                disabled={!selectedDashboard || isSaving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add to Selected
              </button>
            )}
            <button
              onClick={onCreateNew}
              disabled={!newDashboardName.trim() || isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? "Creating..." : "Create and Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddToDashboardModal;

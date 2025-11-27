// DashboardSelectionModal.tsx
import React, { useState } from "react";

interface Dashboard {
  id: string;
  name: string;
}

interface DashboardSelectionModalProps {
  dashboards: Dashboard[];
  onClose: () => void;
  onDashboardSelect: (dashboardId: string) => void;
  onNewDashboard: () => void;
}

const DashboardSelectionModal: React.FC<DashboardSelectionModalProps> = ({
  dashboards,
  onClose,
  onDashboardSelect,
  onNewDashboard,
}) => {
  const [selectedDashboard, setSelectedDashboard] = useState<string>("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-bold mb-4">Add Chart to Dashboard</h2>
        <>
          <div className="mb-4">
            <label
              htmlFor="dashboard-select"
              className="block text-sm font-medium text-gray-700"
            >
              Select a Dashboard:
            </label>
            <select
              id="dashboard-select"
              value={selectedDashboard}
              onChange={(e) => setSelectedDashboard(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="" disabled>
                Select a dashboard
              </option>
              {dashboards.map((dashboard) => (
                <option key={dashboard.id} value={dashboard.id}>
                  {dashboard.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-500 border rounded-md hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => onDashboardSelect(selectedDashboard)}
              disabled={!selectedDashboard}
              className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-blue-300"
            >
              Add Chart
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={onNewDashboard}
              className="w-full px-4 py-2 text-center text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
            >
              Create New Dashboard
            </button>
          </div>
        </>
      </div>
    </div>
  );
};

export default DashboardSelectionModal;

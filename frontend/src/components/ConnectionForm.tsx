import React, { useState } from "react";
import {
  Database,
  Server,
  Globe,
  Settings,
  Key,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import { apiService } from "../services/api";

interface Connection {
  id: number;
  connection_name: string;
  description?: string;
  type: string;
  hostname: string;
  port: number;
  database: string;
  command_timeout?: number;
  max_transport_objects?: number;
  username: string;
  selected_db: string;
  created_at: string;
}

interface ConnectionFormProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onCreate: (conn: Connection) => void;
}

const ConnectionForm: React.FC<ConnectionFormProps> = ({
  onSuccess,
  onError,
  onCreate,
}) => {
  const [connName, setConnName] = useState("");
  const [connDescription, setConnDescription] = useState("");
  const [connType, setConnType] = useState("");
  const [connHostname, setConnHostname] = useState("");
  const [connPort, setConnPort] = useState("");
  const [connDatabase, setConnDatabase] = useState("");
  const [connUsername, setConnUsername] = useState("");
  const [connPassword, setConnPassword] = useState("");
  const [connSelectedDb, setConnSelectedDb] = useState("");
  const [connCommandTimeout, setConnCommandTimeout] = useState("");
  const [connMaxTransportObjects, setConnMaxTransportObjects] = useState("");
  const [showConnPassword, setShowConnPassword] = useState(false);

  const clearForm = () => {
    setConnName("");
    setConnDescription("");
    setConnType("");
    setConnHostname("");
    setConnPort("");
    setConnDatabase("");
    setConnUsername("");
    setConnPassword("");
    setConnSelectedDb("");
    setConnCommandTimeout("");
    setConnMaxTransportObjects("");
    setShowConnPassword(false);
  };

  const handleTestConnection = async () => {
    if (
      !connType ||
      !connHostname ||
      !connPort ||
      !connDatabase ||
      !connUsername ||
      !connPassword
    ) {
      onError("All required fields must be filled for testing.");
      return;
    }
    try {
      const body = {
        connection_name: connName,
        type: connType,
        hostname: connHostname,
        port: Number(connPort),
        database: connDatabase,
        username: connUsername,
        password: connPassword,
        selected_db: connSelectedDb,
        ...(connCommandTimeout && {
          command_timeout: Number(connCommandTimeout),
        }),
        ...(connMaxTransportObjects && {
          max_transport_objects: Number(connMaxTransportObjects),
        }),
      };
      const res = await apiService.testConnection(body);
      if (res.success) {
        onSuccess(res.data?.message || "Connection test successful!");
      } else {
        onError(res.error || "Connection test failed.");
      }
    } catch (err) {
      onError(`Failed to test connection: ${(err as Error).message}`);
    }
  };

  const handleCreateConnection = async () => {
    if (
      !connName ||
      !connType ||
      !connHostname ||
      !connPort ||
      !connDatabase ||
      !connUsername ||
      !connPassword
    ) {
      onError("All required fields must be filled.");
      return;
    }
    try {
      const body = {
        connection_name: connName,
        description: connDescription,
        type: connType,
        hostname: connHostname,
        port: Number(connPort),
        database: connDatabase,
        username: connUsername,
        password: connPassword,
        selected_db: connSelectedDb,
        ...(connCommandTimeout && {
          command_timeout: Number(connCommandTimeout),
        }),
        ...(connMaxTransportObjects && {
          max_transport_objects: Number(connMaxTransportObjects),
        }),
      };
      const res = await apiService.createConnection(body);
      if (res.success) {
        const newConn: Connection = {
          id: res.data.id!,
          connection_name: res.data.connection_name!,
          description: res.data.description,
          type: res.data.type!,
          hostname: res.data.hostname!,
          port: res.data.port!,
          database: res.data.database!,
          command_timeout: res.data.command_timeout,
          max_transport_objects: res.data.max_transport_objects,
          username: res.data.username!,
          selected_db: res.data.selected_db!,
          created_at: new Date().toISOString(),
        };
        onCreate(newConn);
        clearForm();
        onSuccess(
          `Connection "${newConn.connection_name}" created successfully`
        );
      } else {
        onError(res.error || "Failed to create connection");
      }
    } catch (err) {
      onError(`Failed to create connection: ${(err as Error).message}`);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Database className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Create Connection
          </h3>
          <p className="text-sm text-gray-500">Add a new database connection</p>
        </div>
      </div>
      <div className="space-y-4">
        <Input
          placeholder="Connection Name (required)"
          value={connName}
          onChange={(e) => setConnName(e.target.value)}
          icon={<Database className="w-4 h-4" />}
        />
        <Textarea
          placeholder="Description (optional)"
          value={connDescription}
          onChange={(e) => setConnDescription(e.target.value)}
        />
        <Input
          placeholder="Database Type (e.g., postgres, required)"
          value={connType}
          onChange={(e) => setConnType(e.target.value)}
          icon={<Server className="w-4 h-4" />}
        />
        <Input
          placeholder="Hostname (required)"
          value={connHostname}
          onChange={(e) => setConnHostname(e.target.value)}
          icon={<Globe className="w-4 h-4" />}
        />
        <Input
          type="number"
          placeholder="Port (required)"
          value={connPort}
          onChange={(e) => setConnPort(e.target.value)}
        />
        <Input
          placeholder="Database Name (required)"
          value={connDatabase}
          onChange={(e) => setConnDatabase(e.target.value)}
        />
        <Input
          placeholder="Username (required)"
          value={connUsername}
          onChange={(e) => setConnUsername(e.target.value)}
          icon={<Settings className="w-4 h-4" />}
        />
        <div className="relative">
          <Input
            type={showConnPassword ? "text" : "password"}
            placeholder="Password (required)"
            value={connPassword}
            onChange={(e) => setConnPassword(e.target.value)}
            icon={<Key className="w-4 h-4" />}
          />
          <button
            type="button"
            onClick={() => setShowConnPassword(!showConnPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showConnPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
        <Input
          placeholder="Selected DB (optional)"
          value={connSelectedDb}
          onChange={(e) => setConnSelectedDb(e.target.value)}
        />
        <Input
          type="number"
          placeholder="Command Timeout (optional)"
          value={connCommandTimeout}
          onChange={(e) => setConnCommandTimeout(e.target.value)}
        />
        <Input
          type="number"
          placeholder="Max Transport Objects (optional)"
          value={connMaxTransportObjects}
          onChange={(e) => setConnMaxTransportObjects(e.target.value)}
        />
        <div className="flex space-x-2">
          <Button
            onClick={handleTestConnection}
            variant="secondary"
            className="flex-1"
          >
            Test Connection
          </Button>
          <Button onClick={handleCreateConnection} className="flex-1">
            <Plus className="w-4 h-4" />
            Create Connection
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ConnectionForm;

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { debounce } from "lodash";
import {
  Database,
  Server,
  ChevronDown,
  Lock,
  Globe,
  User,
  Key,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";
import Card from "./ui/Card";
import { apiService } from "../services/api";
import Loader from "./Loader";

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

interface FormData {
  connectionName: string;
  hostname: string;
  port: string;
  database: string;
  username: string;
  password: string;
  selectedDB: string;
}

interface Errors {
  [key: string]: string;
}

interface DatabaseOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface FieldConfig {
  label: string;
  name: keyof FormData;
  type: string;
  required?: boolean;
  icon: React.ReactNode;
  placeholder?: string;
}

interface ConnectionFormProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onCreate: (conn: Connection) => void;
}

const databaseOptions: DatabaseOption[] = [
  {
    value: "db2",
    label: "IBM DB2",
    icon: <Server className="w-4 h-4" />,
    description: "Enterprise database management system",
  },
  {
    value: "postgres",
    label: "PostgreSQL",
    icon: <Database className="w-4 h-4" />,
    description: "Open source relational database",
  },
  {
    value: "mysql",
    label: "MySQL",
    icon: <Database className="w-4 h-4" />,
    description: "Popular open source database",
  },
  {
    value: "oracle",
    label: "Oracle",
    icon: <Database className="w-4 h-4" />,
    description: "Enterprise database solution",
  },
  {
    value: "sqlserver",
    label: "SQL Server",
    icon: <Server className="w-4 h-4" />,
    description: "Microsoft database platform",
  },
  {
    value: "mongodb",
    label: "MongoDB",
    icon: <Database className="w-4 h-4" />,
    description: "NoSQL document database",
  },
];

const fieldConfigs: FieldConfig[] = [
  {
    label: "Connection Name",
    name: "connectionName",
    type: "text",
    required: true,
    icon: <FileText className="w-4 h-4" />,
    placeholder: "Enter connection name",
  },
  {
    label: "Hostname",
    name: "hostname",
    type: "text",
    required: true,
    icon: <Globe className="w-4 h-4" />,
    placeholder: "db.example.com",
  },
  {
    label: "Port",
    name: "port",
    type: "text",
    required: true,
    icon: <Lock className="w-4 h-4" />,
    placeholder: "5432",
  },
  {
    label: "Database",
    name: "database",
    type: "text",
    required: true,
    icon: <Database className="w-4 h-4" />,
    placeholder: "database_name",
  },
  {
    label: "Username",
    name: "username",
    type: "text",
    required: true,
    icon: <User className="w-4 h-4" />,
    placeholder: "username",
  },
  {
    label: "Password",
    name: "password",
    type: "password",
    required: true,
    icon: <Key className="w-4 h-4" />,
    placeholder: "password",
  },
];

const ConnectionForm: React.FC<ConnectionFormProps> = ({
  onSuccess,
  onError,
  onCreate,
}) => {
  const [formData, setFormData] = useState<FormData>({
    connectionName: "",
    hostname: "",
    port: "",
    database: "",
    username: "",
    password: "",
    selectedDB: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [isTestButtonEnabled, setIsTestButtonEnabled] = useState(false);
  const [isSubmitButtonEnabled, setIsSubmitButtonEnabled] = useState(false);
  const [isFormModified, setIsFormModified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Loading...");
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [isTestSuccessful, setIsTestSuccessful] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const isFormValid = useMemo(() => {
    const {
      connectionName,
      hostname,
      port,
      database,
      username,
      password,
      selectedDB,
    } = formData;
    return Boolean(
      connectionName &&
        hostname &&
        port &&
        database &&
        username &&
        password &&
        selectedDB &&
        !Object.values(errors).some((error) => error)
    );
  }, [formData, errors]);

  useEffect(() => {
    setIsTestButtonEnabled(isFormValid);
    if (!isFormValid) {
      setIsTestSuccessful(false);
    }
  }, [isFormValid]);

  useEffect(() => {
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    timeoutIdRef.current = setTimeout(() => {
      const isModified = Object.entries(formData).some(
        ([key, value]) => key !== "selectedDB" && !!value
      );
      setIsFormModified(isModified);
      if (isModified) {
        setIsTestSuccessful(false);
      }
    }, 500);
    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    };
  }, [formData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".custom-select-container")) setIsSelectOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const debouncedValidateField = useCallback(
    debounce((name: keyof FormData, value: string) => {
      let error = "";
      switch (name) {
        case "connectionName":
          error = !value ? "Connection name is required" : "";
          break;
        case "hostname":
          error = !value
            ? "Hostname is required"
            : !/^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}$/.test(
                value
              ) && !/^(\d{1,3}\.){3}\d{1,3}$/.test(value)
            ? "Invalid hostname or IP"
            : "";
          break;
        case "port":
          error = !value
            ? "Port is required"
            : !/^\d+$/.test(value) ||
              parseInt(value, 10) < 1024 ||
              parseInt(value, 10) > 65535
            ? "Port must be between 1024-65535"
            : "";
          break;
        case "database":
          error = !value
            ? "Database is required"
            : !/^\w+$/.test(value)
            ? "Only letters, numbers, and underscores"
            : "";
          break;
        case "username":
          error = !value
            ? "Username is required"
            : /\s/.test(value)
            ? "No spaces allowed"
            : "";
          break;
        case "password":
          error = !value ? "Password is required" : "";
          break;
        default:
          break;
      }
      setErrors((prev) => ({ ...prev, [name]: error }));
    }, 300),
    []
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    debouncedValidateField(name as keyof FormData, value);
    setIsTestSuccessful(false);
  };

  const handleSelectDB = (value: string) => {
    setFormData((prev) => ({ ...prev, selectedDB: value }));
    setIsSelectOpen(false);
    setIsTestSuccessful(false);
  };

  const clearForm = () => {
    setFormData({
      connectionName: "",
      hostname: "",
      port: "",
      database: "",
      username: "",
      password: "",
      selectedDB: formData.selectedDB,
    });
    setErrors({});
    setIsTestButtonEnabled(false);
    setIsSubmitButtonEnabled(false);
    setIsFormModified(false);
    setIsTestSuccessful(false);
    setShowPassword(false);
  };

  const handleTestConnection = async () => {
    if (!isFormValid) {
      toast.error("Please fill all required fields correctly");
      return;
    }
    try {
      setLoading(true);
      setLoadingText("Testing connection...");
      setIsTestSuccessful(false);
      const body = {
        connection_name: formData.connectionName,
        type: formData.selectedDB,
        hostname: formData.hostname,
        port: Number(formData.port),
        database: formData.database,
        username: formData.username,
        password: formData.password,
      };
      const res = await apiService.testConnection(body);
      setLoading(false);
      if (res.success) {
        toast.success(res.data?.message || "Connection test successful!");
        setIsTestSuccessful(true);
        onSuccess(res.data?.message || "Connection test successful!");
        setIsSubmitButtonEnabled(true);
      } else {
        toast.error(res.error || "Connection test failed");
        setIsTestSuccessful(false);
        onError(res.error || "Connection test failed");
      }
    } catch (err) {
      setLoading(false);
      toast.error(`Failed to test connection: ${(err as Error).message}`);
      setIsTestSuccessful(false);
      onError(`Failed to test connection: ${(err as Error).message}`);
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      toast.error("Please fill all required fields correctly");
      return;
    }
    try {
      setLoading(true);
      setLoadingText("Creating connection...");
      const body = {
        connection_name: formData.connectionName,
        type: formData.selectedDB,
        hostname: formData.hostname,
        port: Number(formData.port),
        database: formData.database,
        username: formData.username,
        password: formData.password,
      };
      const res = await apiService.createConnection(body);
      setLoading(false);
      if (res.success) {
        const newConn: Connection = {
          id: res.data.id!,
          connection_name: res.data.connection_name!,
          type: res.data.type!,
          hostname: res.data.hostname!,
          port: res.data.port!,
          database: res.data.database!,
          username: res.data.username!,
          created_at: new Date().toISOString(),
        };
        onCreate(newConn);
        clearForm();
        toast.success(
          `Connection "${newConn.connection_name}" created successfully`
        );
        onSuccess(
          `Connection "${newConn.connection_name}" created successfully`
        );
      } else {
        toast.error(res.error || "Failed to create connection");
        onError(res.error || "Failed to create connection");
      }
    } catch (err) {
      setLoading(false);
      toast.error(`Failed to create connection: ${(err as Error).message}`);
      onError(`Failed to create connection: ${(err as Error).message}`);
    }
  };

  const renderInputField = ({
    label,
    name,
    type,
    required,
    icon,
    placeholder,
  }: FieldConfig) => (
    <div key={name} className="space-y-1">
      <label className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          {icon}
        </div>
        <div className="relative">
          <input
            type={name === "password" && showPassword ? "text" : type}
            name={name}
            autoComplete="off"
            value={formData[name]}
            onChange={handleChange}
            required={required}
            placeholder={placeholder}
            className={`pl-10 w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors[name] ? "border-red-300" : "border-gray-300"
            }`}
          />
          {name === "password" && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
      {errors[name] && <p className="text-red-500 text-xs">{errors[name]}</p>}
    </div>
  );

  const selectedOption = databaseOptions.find(
    (option) => option.value === formData.selectedDB
  );

  return (
    <div className="space-y-6">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />

      {/* Database Selection */}
      <div className="custom-select-container space-y-1">
        <label className="text-sm font-medium text-gray-700">
          Database Engine <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSelectOpen(!isSelectOpen)}
            className="w-full px-3 py-2 text-left border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {selectedOption ? (
              <div className="flex items-center space-x-2">
                {selectedOption.icon}
                <span className="text-sm">{selectedOption.label}</span>
              </div>
            ) : (
              <span className="text-gray-500 text-sm">
                Select database engine
              </span>
            )}
            <ChevronDown
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${
                isSelectOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {isSelectOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
              {databaseOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelectDB(option.value)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 ${
                    formData.selectedDB === option.value ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {option.icon}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {option.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Connection Form */}
      {formData.selectedDB && (
        <form onSubmit={handleCreateConnection} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fieldConfigs.map((config) => renderInputField(config))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={clearForm}
              disabled={!isFormModified && !isTestSuccessful}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isFormModified || isTestSuccessful
                  ? "bg-gray-600 text-white hover:bg-gray-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={!isTestButtonEnabled || isTestSuccessful}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isTestButtonEnabled && !isTestSuccessful
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {isTestSuccessful ? "✓ Tested" : "Test Connection"}
            </button>
            <button
              type="submit"
              disabled={!isSubmitButtonEnabled}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isSubmitButtonEnabled
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Create Connection
            </button>
          </div>

          {loading && (
            <div className="pt-4">
              <Loader text={loadingText} />
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default ConnectionForm;

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
    icon: <Server className="h-5 w-5" />,
    description: "Enterprise-class relational database management system",
  },
  {
    value: "postgres",
    label: "PostgreSQL",
    icon: <Database className="h-5 w-5" />,
    description: "Powerful, open source object-relational database system",
  },
  {
    value: "mysql",
    label: "MySQL",
    icon: <Database className="h-5 w-5" />,
    description: "Open-source relational database management system",
  },
  {
    value: "oracle",
    label: "Oracle",
    icon: <Database className="h-5 w-5" />,
    description: "Multi-model database management system",
  },
  {
    value: "sqlserver",
    label: "SQL Server",
    icon: <Server className="h-5 w-5" />,
    description: "Microsoft's relational database management system",
  },
  {
    value: "mongodb",
    label: "MongoDB",
    icon: <Database className="h-5 w-5" />,
    description: "NoSQL document-oriented database",
  },
];

const fieldConfigs: FieldConfig[] = [
  {
    label: "Connection Name",
    name: "connectionName",
    type: "text",
    required: true,
    icon: <FileText />,
    placeholder: "Enter a unique name",
  },
  {
    label: "Hostname or IP",
    name: "hostname",
    type: "text",
    required: true,
    icon: <Globe />,
    placeholder: "e.g., db.example.com",
  },
  {
    label: "Port",
    name: "port",
    type: "text",
    required: true,
    icon: <Lock />,
    placeholder: "e.g., 5432",
  },
  {
    label: "Database",
    name: "database",
    type: "text",
    required: true,
    icon: <Database />,
    placeholder: "Enter database name",
  },
  {
    label: "Username",
    name: "username",
    type: "text",
    required: true,
    icon: <User />,
    placeholder: "Database username",
  },
  {
    label: "Password",
    name: "password",
    type: "password",
    required: true,
    icon: <Key />,
    placeholder: "Database password",
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
  const [loadingText, setLoadingText] = useState("Loading, please wait...");
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
          error = !value ? "Connection Name is required." : "";
          break;
        case "hostname":
          error = !value
            ? "Hostname is required."
            : !/^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}$/.test(
                value
              ) && !/^(\d{1,3}\.){3}\d{1,3}$/.test(value)
            ? "Invalid hostname or IP."
            : "";
          break;
        case "port":
          error = !value
            ? "Port is required."
            : !/^\d+$/.test(value) ||
              parseInt(value, 10) < 1024 ||
              parseInt(value, 10) > 65535
            ? "Port must be 1024-65535."
            : "";
          break;
        case "database":
          error = !value
            ? "Database is required."
            : !/^\w+$/.test(value)
            ? "Letters, numbers, and underscores only."
            : "";
          break;
        case "username":
          error = !value
            ? "Username is required."
            : /\s/.test(value)
            ? "No spaces allowed."
            : "";
          break;
        case "password":
          error = !value ? "Password is required." : "";
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
      toast.error("Please fill all required fields correctly.", {
        theme: "light",
      });
      return;
    }
    try {
      setLoading(true);
      setLoadingText("Testing connection, please wait...");
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
        toast.success(res.data?.message || "Connection test successful!", {
          theme: "light",
        });
        setIsTestSuccessful(true);
        onSuccess(res.data?.message || "Connection test successful!");
        setIsSubmitButtonEnabled(true);
      } else {
        toast.error(res.error || "Connection test failed.", { theme: "light" });
        setIsTestSuccessful(false);
        onError(res.error || "Connection test failed.");
      }
    } catch (err) {
      setLoading(false);
      toast.error(`Failed to test connection: ${(err as Error).message}`, {
        theme: "light",
      });
      setIsTestSuccessful(false);
      onError(`Failed to test connection: ${(err as Error).message}`);
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      toast.error("Please fill all required fields correctly.", {
        theme: "light",
      });
      return;
    }
    try {
      setLoading(true);
      setLoadingText("Submitting connection, please wait...");
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
          `Connection "${newConn.connection_name}" created successfully`,
          {
            theme: "light",
          }
        );
        onSuccess(
          `Connection "${newConn.connection_name}" created successfully`
        );
      } else {
        toast.error(res.error || "Failed to create connection", {
          theme: "light",
        });
        onError(res.error || "Failed to create connection");
      }
    } catch (err) {
      setLoading(false);
      toast.error(`Failed to create connection: ${(err as Error).message}`, {
        theme: "light",
      });
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
    <div key={name} className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {React.cloneElement(icon as React.ReactElement, {
            className: "h-5 w-5 text-gray-400",
          })}
        </div>
        {type === "textarea" ? (
          <textarea
            name={name}
            autoComplete="off"
            value={formData[name]}
            onChange={handleChange}
            placeholder={placeholder}
            className={`pl-10 w-full p-3 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
              errors[name] ? "border-red-500" : "border-gray-300"
            } bg-white text-gray-900`}
          />
        ) : (
          <div className="relative">
            <input
              type={name === "password" && showPassword ? "text" : type}
              name={name}
              autoComplete="off"
              value={formData[name]}
              onChange={handleChange}
              required={required}
              placeholder={placeholder}
              className={`pl-10 w-full p-3 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                errors[name] ? "border-red-500" : "border-gray-300"
              } bg-white text-gray-900`}
            />
            {name === "password" && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        )}
      </div>
      {errors[name] && (
        <p className="text-red-500 text-sm mt-1">{errors[name]}</p>
      )}
    </div>
  );

  const selectedOption = databaseOptions.find(
    (option) => option.value === formData.selectedDB
  );

  return (
    <Card className="p-6 h-full overflow-y-auto bg-gray-50">
      <ToastContainer
        toastStyle={{
          backgroundColor: "white",
          color: "#111827",
          border: "1px solid #e5e7eb",
        }}
      />
      <div className="flex items-center mb-6">
        <Database className="h-8 w-8 mr-3 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">
          Create Database Connection
        </h2>
      </div>

      <div className="mb-8 custom-select-container">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Database Engine <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSelectOpen(!isSelectOpen)}
            className="w-full p-3 rounded-md flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 bg-white border border-gray-300 text-gray-900"
          >
            {selectedOption ? (
              <div className="flex items-center">
                {React.cloneElement(selectedOption.icon as React.ReactElement, {
                  className: "text-blue-600",
                })}
                <span className="ml-3 font-medium">{selectedOption.label}</span>
              </div>
            ) : (
              <span className="text-gray-500">Select a database engine</span>
            )}
            <ChevronDown
              className={`h-5 w-5 transition-transform duration-200 ${
                isSelectOpen ? "rotate-180" : ""
              } text-gray-400`}
            />
          </button>
          {isSelectOpen && (
            <div className="absolute z-10 mt-2 w-full rounded-md shadow-lg max-h-72 overflow-auto bg-white border border-gray-300">
              {databaseOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelectDB(option.value)}
                  className={`p-3 flex flex-col cursor-pointer transition-colors duration-150 ${
                    formData.selectedDB === option.value ? "bg-blue-50" : ""
                  } hover:bg-gray-100`}
                >
                  <div className="flex items-center">
                    {React.cloneElement(option.icon as React.ReactElement, {
                      className: "text-blue-600",
                    })}
                    <span className="ml-3 font-medium text-gray-900">
                      {option.label}
                    </span>
                  </div>
                  <p className="text-xs mt-1 ml-8 text-gray-500">
                    {option.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {formData.selectedDB && (
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center mb-6">
            {React.cloneElement(selectedOption!.icon as React.ReactElement, {
              className: "text-blue-600",
            })}
            <h3 className="ml-3 text-xl font-semibold text-gray-900">
              {selectedOption?.label} Connection Details
            </h3>
          </div>
          <form
            onSubmit={handleCreateConnection}
            className="grid grid-cols-1 md:grid-cols-2 gap-2"
          >
            {fieldConfigs.map((config) => renderInputField(config))}
            <div className="md:col-span-2 flex flex-wrap justify-end gap-4 mt-2">
              <button
                type="button"
                onClick={clearForm}
                disabled={!isFormModified && !isTestSuccessful}
                className={`px-6 py-2 w-full md:w-auto rounded-md font-medium shadow-md transition-all duration-200 ${
                  isFormModified || isTestSuccessful
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Clear Form
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={!isTestButtonEnabled || isTestSuccessful}
                className={`px-6 py-2 w-full md:w-auto rounded-md font-medium shadow-md transition-all duration-200 ${
                  isTestButtonEnabled && !isTestSuccessful
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isTestSuccessful ? "Tested" : "Test Connection"}
              </button>
              <button
                type="submit"
                disabled={!isSubmitButtonEnabled}
                className={`px-6 py-2 w-full md:w-auto rounded-md font-medium shadow-md transition-all duration-200 ${
                  isSubmitButtonEnabled
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Create Connection
              </button>
            </div>
            {loading && (
              <div className="md:col-span-2 mt-4">
                <Loader text={loadingText} />
              </div>
            )}
          </form>
        </div>
      )}
    </Card>
  );
};

export default ConnectionForm;

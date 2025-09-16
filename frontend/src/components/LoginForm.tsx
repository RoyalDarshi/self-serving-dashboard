import React, { useState } from "react";
import { Settings, Key, Eye, EyeOff } from "lucide-react";
import { apiService } from "../services/api";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";

interface LoginFormProps {
  onLogin: (token: string) => void;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({
  onLogin,
  setError,
  setSuccess,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    try {
      const res = await apiService.login(username, password);
      if (res.success) {
        onLogin(res.data?.token || "");
        localStorage.setItem("token", res.data?.token || "");
        setSuccess("Welcome back! Login successful");
      } else {
        setError(res.error || "Login failed");
      }
    } catch (err) {
      setError(`Login failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="p-8 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Admin Login
        </h2>
        <div className="space-y-4">
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            icon={<Settings className="w-4 h-4" />}
          />
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Key className="w-4 h-4" />}
            />
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
          </div>
          <Button onClick={handleLogin} className="w-full">
            Login
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default LoginForm;

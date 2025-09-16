import React from "react";

interface SelectProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  className?: string;
}

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  children,
  className = "",
}) => (
  <select
    value={value}
    onChange={onChange}
    className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${className}`}
  >
    {children}
  </select>
);

export default Select;

import React from "react";

interface LoaderProps {
  text: string;
}

const Loader: React.FC<LoaderProps> = ({ text }) => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-60 backdrop-blur-md z-50">
      <div className="relative w-20 h-20 flex items-center justify-center">
        {/* Outer Ring */}
        <div className="absolute w-16 h-16 rounded-full animate-[spin_1.2s_linear_infinite] border-4 border-gray-300 border-t-blue-600"></div>
        {/* Inner Ring */}
        <div className="absolute w-10 h-10 rounded-full animate-[spin_0.8s_linear_infinite_reverse] border-2 border-blue-500 border-b-gray-300"></div>
        {/* Center Pulse */}
        <div className="w-4 h-4 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
      </div>
      {text && (
        <p className="mt-6 text-base font-medium text-gray-100 tracking-wide animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};

export default Loader;

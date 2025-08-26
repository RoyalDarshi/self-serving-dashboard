import React, { Component, ReactNode } from "react";
import { toast } from "react-toastify";

// Props interface for type safety
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode; // Optional custom fallback UI
}

// State interface for error handling
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  // Catch errors in child components
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  // Log error details
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    toast.error("An unexpected error occurred. Please try again.");
  }

  // Reset error state when children change
  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise render default UI
      return (
        this.props.fallback || (
          <div
            className="p-6 bg-red-100 border border-red-400 text-red-700 rounded"
            role="alert"
            aria-live="assertive"
          >
            <h2 className="text-xl font-bold">Something went wrong</h2>
            <p>
              An error occurred: {this.state.error?.message || "Unknown error"}
            </p>
            <button
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

import React, { useState } from "react";
import { Copy } from "lucide-react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneLight } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { format } from "sql-formatter";

interface SqlQueryDisplayProps {
  generatedQuery: string;
}

const SqlQueryDisplay: React.FC<SqlQueryDisplayProps> = ({
  generatedQuery,
}) => {
  const [copySuccess, setCopySuccess] = useState<string>("");

  const handleCopyQuery = () => {
    const queryToCopy = generatedQuery.trim();
    if (queryToCopy) {
      const textArea = document.createElement("textarea");
      textArea.value = queryToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopySuccess("Copied!");
      } catch (err) {
        setCopySuccess("Failed to copy.");
        console.error("Failed to copy query: ", err);
      }
      document.body.removeChild(textArea);

      setTimeout(() => setCopySuccess(""), 2000);
    }
  };

  let formattedQuery = "";
  if (generatedQuery) {
    try {
      formattedQuery = format(generatedQuery, { language: "sql" });
    } catch (error) {
      console.error("Error formatting query: ", error);
      formattedQuery = generatedQuery;
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="w-full h-full rounded-lg text-slate-700 font-mono text-sm relative">
        <div className="p-3">
          <h3 className="text-lg font-semibold mb-3 text-slate-800">
            Generated SQL Query
          </h3>
          {generatedQuery ? (
            <div className="relative rounded-lg overflow-hidden border border-slate-200">
              <SyntaxHighlighter
                language="sql"
                style={atomOneLight}
                showLineNumbers={true}
                wrapLines={true}
                customStyle={{
                  padding: "1rem",
                  margin: 0,
                  backgroundColor: "#f8fafc",
                  fontSize: "0.875rem",
                }}
              >
                {formattedQuery}
              </SyntaxHighlighter>
              <button
                onClick={handleCopyQuery}
                className="absolute top-2 right-2 flex items-center px-3 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                title="Copy to clipboard"
              >
                <Copy className="h-4 w-4 mr-1 text-blue-500" />
                <span>Copy</span>
              </button>
              {copySuccess && (
                <span className="absolute top-2 right-20 text-xs text-green-500 font-medium">
                  {copySuccess}
                </span>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">
              Select X-axis and Y-axis columns to generate the SQL query.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlQueryDisplay;

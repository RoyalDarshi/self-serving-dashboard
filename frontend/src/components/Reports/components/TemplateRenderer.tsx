import React from "react";

interface Props {
  rows: any[];
  template: any;
}

const TemplateRenderer: React.FC<Props> = ({ rows, template }) => {
  if (!template || !template.sections || rows.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center py-10">
        No data to display
      </div>
    );
  }

  const firstRow = rows[0];

  const resolveValue = (row: any, column: string) => {
    if (!column) return "";
    return row[column] ?? "—";
  };

  return (
    <div
      className="max-w-[210mm] mx-auto bg-white shadow-md p-8 md:p-12 space-y-6 print:shadow-none print:p-0 print:max-w-full"
      style={{
        minHeight: "297mm", // A4 Height
        fontFamily: "'Times New Roman', serif", // Classic marksheet font
        ...template.styles, // Apply custom global styles (border, bg, etc.)
      }}
    >
      {template.sections.map((section: any, sIdx: number) => {
        /* ================= IMAGE / LOGO BLOCK ================= */
        if (section.type === "image") {
          return (
            <div
              key={sIdx}
              className="mb-4"
              style={{ textAlign: section.align || "center" }}
            >
              <img
                src={section.src}
                alt="Logo"
                style={{
                  height: section.height || "80px",
                  width: "auto",
                  display: "inline-block",
                  ...section.style,
                }}
              />
            </div>
          );
        }

        /* ================= TEXT / TITLE BLOCK ================= */
        if (section.type === "text") {
          return (
            <div
              key={sIdx}
              className="mb-4 whitespace-pre-wrap"
              style={{
                textAlign: section.align || "center",
                fontSize: section.fontSize || "16px",
                fontWeight: section.bold ? "bold" : "normal",
                ...section.style,
              }}
            >
              {section.content}
            </div>
          );
        }

        /* ================= HEADER FIELDS (GRID) ================= */
        if (section.type === "header") {
          return (
            <div
              key={sIdx}
              className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-6 border-b-2 border-slate-800 pb-4"
            >
              {section.fields.map((f: any, idx: number) => (
                <div key={idx} className="text-sm flex justify-between">
                  <span className="font-bold text-slate-800">{f.label}:</span>
                  <span className="font-mono text-slate-900 border-b border-dotted border-slate-400 min-w-[100px] text-right">
                    {resolveValue(firstRow, f.column)}
                  </span>
                </div>
              ))}
            </div>
          );
        }

        /* ================= DYNAMIC TABLE ================= */
        if (section.type === "table") {
          return (
            <div key={sIdx} className="mb-8">
              {section.title && (
                <h3 className="font-bold text-lg mb-2 uppercase border-b-2 border-black inline-block">
                  {section.title}
                </h3>
              )}
              <table className="w-full border-collapse border border-slate-900 text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    {section.columns.map((c: any, idx: number) => (
                      <th
                        key={idx}
                        className="border border-slate-900 px-3 py-2 text-left font-bold"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, rIdx: number) => (
                    <tr key={rIdx}>
                      {section.columns.map((c: any, cIdx: number) => (
                        <td
                          key={cIdx}
                          className="border border-slate-900 px-3 py-2"
                        >
                          {resolveValue(r, c.column)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        /* ================= SIGNATURE BLOCK ================= */
        if (section.type === "signature") {
          return (
            <div key={sIdx} className="flex justify-end mt-12 pt-8">
              <div className="text-center">
                {section.src ? (
                  <img
                    src={section.src}
                    alt="Sign"
                    className="h-12 mx-auto mb-2"
                  />
                ) : (
                  <div className="h-12 w-32 mx-auto" /> // Spacer
                )}
                <div className="font-bold border-t border-slate-800 pt-1 px-4 min-w-[150px]">
                  {section.label || "Examiner Signature"}
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

export default TemplateRenderer;

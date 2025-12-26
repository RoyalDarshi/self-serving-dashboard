import React from "react";

interface Props {
  rows: any[];
  template: any;
}

const TemplateRenderer: React.FC<Props> = ({ rows, template }) => {
  if (!template || !template.sections || rows.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center">
        No data to display
      </div>
    );
  }

  const firstRow = rows[0];

  const resolveValue = (row: any, column: string) => {
    return row[column] ?? "—";
  };

  return (
    <div className="max-w-4xl mx-auto bg-white border rounded-xl shadow p-6 space-y-6">
      {template.sections.map((section: any, sIdx: number) => {
        /* ================= HEADER SECTION ================= */
        if (section.type === "header") {
          return (
            <div key={sIdx} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {section.fields.map((f: any, idx: number) => (
                <div key={idx} className="text-sm">
                  <span className="font-semibold">{f.label}:</span>{" "}
                  {resolveValue(firstRow, f.column)}
                </div>
              ))}
            </div>
          );
        }

        /* ================= TABLE SECTION ================= */
        if (section.type === "table") {
          return (
            <div key={sIdx}>
              {section.title && (
                <h3 className="font-semibold mb-2">{section.title}</h3>
              )}

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border">
                  <thead>
                    <tr>
                      {section.columns.map((c: any, idx: number) => (
                        <th
                          key={idx}
                          className="border px-3 py-2 text-sm bg-slate-50"
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
                            className="border px-3 py-2 text-sm text-center"
                          >
                            {resolveValue(r, c.column)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
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

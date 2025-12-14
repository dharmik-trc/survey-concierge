import type { Question } from "@/lib/api";
import { ErrorMessage } from "./ErrorMessage";

interface QuestionFormFieldsProps {
  question: Question;
  value: { [subfield: string]: number | null | string } | null;
  error?: string;
  onChange: (value: { [subfield: string]: any }) => void;
  onBlur: (value: { [subfield: string]: number | null }) => void;
}

export const QuestionFormFields = ({
  question,
  value,
  error,
  onChange,
  onBlur,
}: QuestionFormFieldsProps) => {
  if (!question.subfields) return null;

  const subfields = question.subfields;
  const hasAutoCalculate = subfields.some(
    sf => question.subfield_validations?.[sf]?.type === "auto_calculate"
  );

  const inputClasses = `w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 text-black transition-colors duration-200 text-xs sm:text-base ${
    error
      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
      : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
  }`;

  const handleChange = (subfield: string, inputValue: string, validation: any) => {
    let processedValue: any;
    if (inputValue === "") {
      processedValue = null;
    } else if (validation?.type?.includes("number")) {
      processedValue = parseFloat(inputValue);
      if (isNaN(processedValue)) processedValue = null;
    } else {
      processedValue = inputValue;
    }

    const prev = typeof value === "object" && !Array.isArray(value) && value ? value : {};
    const filteredPrev: { [sub: string]: any } = Object.fromEntries(
      Object.entries(prev).filter(([, v]) => v !== null && v !== "")
    );
    const next: { [sub: string]: any } = {
      ...filteredPrev,
      [subfield]: processedValue,
    };

    if (hasAutoCalculate) {
      const totalField = subfields.find(
        sf => question.subfield_validations?.[sf]?.type === "auto_calculate"
      );
      if (totalField) {
        const totalFieldIndex = subfields.indexOf(totalField);
        const total = subfields.slice(0, totalFieldIndex).reduce((sum, sf) => {
          const v = next[sf];
          return sum + (typeof v === "number" && v !== null ? v : 0);
        }, 0);
        next[totalField] = total;
      }
    }

    onChange(next);
  };

  const handleBlurChange = (subfield: string, inputValue: string) => {
    const numValue = inputValue === "" ? null : parseFloat(inputValue);
    const prev = typeof value === "object" && !Array.isArray(value) && value ? value : {};
    const filteredPrev: { [sub: string]: number | null } = Object.fromEntries(
      Object.entries(prev).filter(([, v]) => v !== null && v !== "")
    );
    const next: { [sub: string]: number | null } = {
      ...filteredPrev,
      [subfield]: numValue,
    };

    if (hasAutoCalculate) {
      const totalField = subfields.find(
        sf => question.subfield_validations?.[sf]?.type === "auto_calculate"
      );
      if (totalField) {
        const totalFieldIndex = subfields.indexOf(totalField);
        const total = subfields.slice(0, totalFieldIndex).reduce((sum, sf) => {
          const v = next[sf];
          return sum + (typeof v === "number" && v !== null ? v : 0);
        }, 0);
        next[totalField] = total;
      }
    }

    onBlur(next);
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-200 rounded-lg">
          <thead>{/* No header row */}</thead>
          <tbody>
            {subfields.map((subfield, idx) => {
              const validation = question.subfield_validations?.[subfield];
              const isAutoCalculated = validation?.type === "auto_calculate";

              if (isAutoCalculated) {
                const formula = validation?.formula || "sum_all_previous";
                let calculatedValue = 0;

                if (formula === "sum_all_previous") {
                  calculatedValue = subfields.slice(0, idx).reduce((sum, sf) => {
                    const v =
                      value &&
                      typeof value === "object" &&
                      !Array.isArray(value) &&
                      value[sf] !== undefined
                        ? value[sf]
                        : 0;
                    return sum + (typeof v === "number" ? v : 0);
                  }, 0);
                }

                return (
                  <tr key={subfield}>
                    <td className="px-2 sm:px-4 py-2 text-gray-800 text-xs sm:text-base font-medium w-1/2">
                      {subfield}
                    </td>
                    <td className="px-2 sm:px-4 py-2 w-1/2">
                      <input
                        type="number"
                        className={inputClasses + " bg-gray-100"}
                        value={calculatedValue}
                        readOnly
                        tabIndex={-1}
                      />
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={subfield}>
                  <td className="px-2 sm:px-4 py-2 text-gray-800 text-xs sm:text-base font-medium w-1/2">
                    {subfield}
                  </td>
                  <td className="px-2 sm:px-4 py-2 w-1/2">
                    <input
                      type={
                        validation?.type === "email"
                          ? "email"
                          : validation?.type?.includes("number")
                            ? "number"
                            : "text"
                      }
                      className={inputClasses}
                      placeholder={
                        validation?.type === "email"
                          ? `Enter email for ${subfield}`
                          : validation?.type?.includes("number")
                            ? `Enter Response`
                            : `Enter ${subfield}`
                      }
                      value={
                        value &&
                        typeof value === "object" &&
                        !Array.isArray(value) &&
                        subfield in value &&
                        value[subfield] !== null
                          ? String(value[subfield])
                          : ""
                      }
                      onChange={e => handleChange(subfield, e.target.value, validation)}
                      onBlur={e => handleBlurChange(subfield, e.target.value)}
                      onWheel={e => e.currentTarget.blur()}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ErrorMessage error={error || ""} />
    </div>
  );
};

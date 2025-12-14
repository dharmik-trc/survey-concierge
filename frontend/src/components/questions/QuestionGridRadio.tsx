import type { Question } from "@/lib/api";
import { shuffleArrayWithSeed } from "@/utils/questionHelpers";
import { ErrorMessage } from "./ErrorMessage";

interface QuestionGridRadioProps {
  question: Question;
  value: { [row: string]: string } | null;
  error?: string;
  surveyId: string;
  onChange: (value: { [row: string]: string }) => void;
}

export const QuestionGridRadio = ({
  question,
  value,
  error,
  surveyId,
  onChange,
}: QuestionGridRadioProps) => {
  if (!question.rows || !question.columns) return null;

  const matrixValue: { [row: string]: string } =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  const displayRows = question.randomize_rows
    ? shuffleArrayWithSeed(question.rows, `${surveyId}-${question.id}-rows`)
    : question.rows;
  const displayColumns = question.randomize_columns
    ? shuffleArrayWithSeed(question.columns, `${surveyId}-${question.id}-columns`)
    : question.columns;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 rounded-lg">
          <thead>
            <tr>
              <th className="px-4 py-2"></th>
              {displayColumns?.map(col => (
                <th
                  key={col}
                  className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 text-center whitespace-normal"
                  style={{ minWidth: 120, maxWidth: 140, width: 130 }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map(row => (
              <tr key={row}>
                <td className="px-2 sm:px-4 py-2 text-gray-800 text-xs sm:text-sm font-medium">
                  {row}
                </td>
                {displayColumns?.map(col => (
                  <td
                    key={col}
                    className="px-2 sm:px-4 py-2 text-center"
                    style={{ minWidth: 120, maxWidth: 140, width: 130 }}
                  >
                    <input
                      type="radio"
                      name={`matrix-radio-${question.id}-${row}`}
                      value={col}
                      checked={matrixValue[row] === col}
                      onChange={() => {
                        const next = { ...matrixValue, [row]: col };
                        onChange(next);
                      }}
                      className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorMessage error={error || ""} />
    </div>
  );
};

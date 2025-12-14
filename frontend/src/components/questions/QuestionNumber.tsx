import type { Question } from "@/lib/api";
import { ErrorMessage } from "./ErrorMessage";

interface QuestionNumberProps {
  question: Question;
  value: number | string;
  error?: string;
  onChange: (value: number | string) => void;
  onBlur: (value: string) => void;
  questionType: "number" | "positive_number" | "negative_number";
}

export const QuestionNumber = ({
  question,
  value,
  error,
  onChange,
  onBlur,
  questionType,
}: QuestionNumberProps) => {
  const inputClasses = `w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 text-black transition-colors duration-200 text-xs sm:text-base ${
    error
      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
      : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
  }`;

  const getPlaceholder = () => {
    if (questionType === "positive_number") {
      return "Enter a positive number or zero...";
    } else if (questionType === "negative_number") {
      return "Enter a negative number or zero...";
    }
    return "Enter a number (positive or negative)...";
  };

  return (
    <div>
      <input
        type="number"
        step="any"
        className={inputClasses}
        placeholder={getPlaceholder()}
        value={value || ""}
        onChange={e => {
          const inputValue = e.target.value;
          if (inputValue === "") {
            onChange("");
          } else {
            const numValue = parseFloat(inputValue);
            if (!isNaN(numValue)) {
              onChange(numValue);
            }
          }
        }}
        onBlur={e => onBlur(e.target.value)}
        onWheel={e => e.currentTarget.blur()}
      />
      <ErrorMessage error={error || ""} />
    </div>
  );
};

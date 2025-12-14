import type { Question } from "@/lib/api";
import { ErrorMessage } from "./ErrorMessage";

interface QuestionDateProps {
  question: Question;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
}

export const QuestionDate = ({ question, value, error, onChange, onBlur }: QuestionDateProps) => {
  const inputClasses = `w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 text-black transition-colors duration-200 text-xs sm:text-base ${
    error
      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
      : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
  }`;

  return (
    <div>
      <input
        type="date"
        className={inputClasses}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onBlur(e.target.value)}
      />
      <ErrorMessage error={error || ""} />
    </div>
  );
};

import type { Question } from "@/lib/api";
import { OTHER_OPTION, DEFAULT_NONE_OPTION } from "@/lib/api";
import { chunkArray } from "@/utils/questionHelpers";
import { ErrorMessage } from "./ErrorMessage";
import { OptionInput } from "./shared/OptionInput";

interface QuestionFieldsProps {
  question: Question;
  value: string[];
  error?: string;
  otherText: string;
  randomizedOptions: string[];
  onChange: (value: string[]) => void;
  onBlur: () => void;
  onOtherTextChange: (text: string) => void;
}

export const QuestionFields = ({
  question,
  value,
  error,
  otherText,
  randomizedOptions,
  onChange,
  onBlur,
  onOtherTextChange,
}: QuestionFieldsProps) => {
  const noneOption = question.none_option_text || DEFAULT_NONE_OPTION;
  const selectedValues = Array.isArray(value) ? value : [];
  const isOtherChecked =
    selectedValues.includes(OTHER_OPTION) ||
    selectedValues.some(v => typeof v === "string" && v.startsWith("Other:"));
  const optionPairs = chunkArray(randomizedOptions, 2);

  return (
    <div>
      <div className="space-y-3">
        {optionPairs.map((pair, rowIdx) => (
          <div key={rowIdx} className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            {pair.map(option => (
              <label
                key={option}
                className="flex items-center flex-1 p-2 sm:p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
              >
                <input
                  type="checkbox"
                  value={option}
                  checked={selectedValues.includes(option)}
                  onChange={e => {
                    let newValues = Array.isArray(value) ? value : [];
                    const isNoneOfTheAbove = option === noneOption;

                    if (e.target.checked) {
                      if (isNoneOfTheAbove) {
                        newValues = [option];
                        onOtherTextChange("");
                      } else {
                        newValues = [...newValues.filter(v => v !== noneOption), option];
                      }
                    } else {
                      newValues = newValues.filter(v => v !== option);
                    }

                    if (option === OTHER_OPTION && !e.target.checked) {
                      onOtherTextChange("");
                    }

                    const safeValues: string[] = newValues.map(v =>
                      typeof v === "object" && v !== null && "other" in v
                        ? `Other: ${(v as { other: string }).other}`
                        : v
                    );
                    onChange(safeValues);
                  }}
                  onBlur={onBlur}
                  className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-gray-700 font-medium text-xs sm:text-base">
                  {option}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
      {OTHER_OPTION && isOtherChecked && (
        <div className="ml-8 mt-2">
          <OptionInput
            value={otherText}
            onChange={onOtherTextChange}
            onBlur={() => {
              if (otherText.trim()) {
                onChange([
                  ...selectedValues.filter(v => v !== OTHER_OPTION),
                  `Other: ${otherText.trim()}`,
                ]);
              }
            }}
          />
        </div>
      )}
      <ErrorMessage error={error || ""} />
    </div>
  );
};

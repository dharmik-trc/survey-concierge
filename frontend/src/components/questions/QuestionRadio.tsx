import type { Question } from "@/lib/api";
import { optionUtils, OTHER_OPTION, DEFAULT_NONE_OPTION } from "@/lib/api";
import SearchableDropdown from "@/components/SearchableDropdown";
import { ErrorMessage } from "./ErrorMessage";
import { OptionInput } from "./shared/OptionInput";

interface QuestionRadioProps {
  question: Question;
  value: string;
  error?: string;
  otherText: string;
  surveyId: string;
  randomizedOptions: string[];
  questionType: "radio" | "dropdown" | "yes_no";
  onChange: (value: string) => void;
  onBlur: () => void;
  onOtherTextChange: (text: string) => void;
}

export const QuestionRadio = ({
  question,
  value,
  error,
  otherText,
  surveyId,
  randomizedOptions,
  questionType,
  onChange,
  onBlur,
  onOtherTextChange,
}: QuestionRadioProps) => {
  const { hasOtherOption } = optionUtils.getOptionsWithSpecialHandling(question, surveyId);
  const exclusiveOption = question.exclusive_column;
  const isOtherSelected =
    value === OTHER_OPTION || (typeof value === "string" && value.startsWith("Other:"));

  const handleOptionChange = (selectedOption: string) => {
    const isExclusiveOption = exclusiveOption && selectedOption === exclusiveOption;
    onChange(selectedOption);
    if (isExclusiveOption) {
      onOtherTextChange("");
    } else {
      onOtherTextChange("");
    }
  };

  if (questionType === "dropdown") {
    return (
      <div>
        <SearchableDropdown
          value={typeof value === "string" ? value : ""}
          onChange={handleOptionChange}
          onBlur={onBlur}
          options={randomizedOptions}
          placeholder="Start typing..."
          className="w-full"
        />
        {hasOtherOption && isOtherSelected && (
          <OptionInput
            value={otherText}
            onChange={onOtherTextChange}
            onBlur={() => {
              if (otherText.trim()) {
                onChange(`Other: ${otherText.trim()}`);
              }
            }}
          />
        )}
        <ErrorMessage error={error || ""} />
      </div>
    );
  }

  const columns = optionUtils.organizeOptionsIntoColumns(randomizedOptions);

  if (columns.length === 1) {
    return (
      <div>
        <div className="space-y-3">
          {columns[0].map(option => (
            <label
              key={option}
              className="flex items-center px-3 sm:px-4 py-2 sm:py-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={
                  value === option ||
                  (option === OTHER_OPTION &&
                    typeof value === "string" &&
                    value.startsWith("Other:"))
                }
                onChange={() => handleOptionChange(option)}
                onBlur={onBlur}
                className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <span className="ml-2 sm:ml-3 text-gray-700 font-medium text-xs sm:text-base">
                {option}
              </span>
            </label>
          ))}
        </div>
        {hasOtherOption && isOtherSelected && (
          <OptionInput
            value={otherText}
            onChange={onOtherTextChange}
            onBlur={() => {
              if (otherText.trim()) {
                onChange(`Other: ${otherText.trim()}`);
              }
            }}
          />
        )}
        <ErrorMessage error={error || ""} />
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {columns.map((column, colIndex) => (
          <div key={colIndex} className="space-y-2 sm:space-y-3">
            {column.map(option => (
              <label
                key={option}
                className="flex items-center px-3 sm:px-4 py-2 sm:py-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option}
                  checked={
                    value === option ||
                    (option === OTHER_OPTION &&
                      typeof value === "string" &&
                      value.startsWith("Other:"))
                  }
                  onChange={() => handleOptionChange(option)}
                  onBlur={onBlur}
                  className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <span className="ml-3 text-gray-700 font-medium text-xs sm:text-base">
                  {option}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
      {hasOtherOption && isOtherSelected && (
        <OptionInput
          value={otherText}
          onChange={onOtherTextChange}
          onBlur={() => {
            if (otherText.trim()) {
              onChange(`Other: ${otherText.trim()}`);
            }
          }}
        />
      )}
      <ErrorMessage error={error || ""} />
    </div>
  );
};

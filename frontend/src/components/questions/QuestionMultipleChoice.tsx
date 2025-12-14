import type { Question } from "@/lib/api";
import { optionUtils, OTHER_OPTION, DEFAULT_NONE_OPTION } from "@/lib/api";
import { ErrorMessage } from "./ErrorMessage";
import { OptionInput } from "./shared/OptionInput";

interface QuestionMultipleChoiceProps {
  question: Question;
  value: string[];
  error?: string;
  otherText: string;
  surveyId: string;
  randomizedOptions: string[];
  onChange: (value: string[]) => void;
  onBlur: () => void;
  onOtherTextChange: (text: string) => void;
}

export const QuestionMultipleChoice = ({
  question,
  value,
  error,
  otherText,
  surveyId,
  randomizedOptions,
  onChange,
  onBlur,
  onOtherTextChange,
}: QuestionMultipleChoiceProps) => {
  const { hasOtherOption } = optionUtils.getOptionsWithSpecialHandling(question, surveyId);
  const noneOption = question.none_option_text || DEFAULT_NONE_OPTION;
  const exclusiveOption = question.exclusive_column;
  const selectedValues = Array.isArray(value) ? value : [];
  const isOtherSelected =
    selectedValues.includes(OTHER_OPTION) ||
    selectedValues.some(v => typeof v === "string" && v.startsWith("Other:"));
  const isNoneSelected = selectedValues.includes(noneOption);
  const isExclusiveSelected = exclusiveOption ? selectedValues.includes(exclusiveOption) : false;

  const handleCheckboxChange = (selectedOption: string, isChecked: boolean) => {
    let newValues = [...selectedValues];
    const isNoneOfTheAbove = selectedOption === noneOption;
    const isCustomExclusive = exclusiveOption && selectedOption === exclusiveOption;
    const isExclusiveOption = isNoneOfTheAbove || isCustomExclusive;

    if (isExclusiveOption) {
      if (isChecked) {
        newValues = [selectedOption];
        onOtherTextChange("");
      } else {
        newValues = [];
      }
    } else {
      if (isNoneSelected) {
        newValues = newValues.filter(v => v !== noneOption);
      }
      if (isExclusiveSelected && exclusiveOption) {
        newValues = newValues.filter(v => v !== exclusiveOption);
      }

      if (isChecked) {
        if (!newValues.includes(selectedOption)) {
          newValues.push(selectedOption);
        }
      } else {
        if (selectedOption === OTHER_OPTION) {
          newValues = newValues.filter(
            v => v !== OTHER_OPTION && !(typeof v === "string" && v.startsWith("Other:"))
          );
          onOtherTextChange("");
        } else {
          newValues = newValues.filter(v => v !== selectedOption);
        }
      }
    }

    onChange(newValues);
  };

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
                type="checkbox"
                name={`question-${question.id}`}
                value={option}
                checked={
                  selectedValues.includes(option) ||
                  (option === OTHER_OPTION &&
                    selectedValues.some(v => typeof v === "string" && v.startsWith("Other:")))
                }
                onChange={e => handleCheckboxChange(option, e.target.checked)}
                onBlur={onBlur}
                className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
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
                const newValues = selectedValues.filter(v => v !== OTHER_OPTION);
                newValues.push(`Other: ${otherText.trim()}`);
                onChange(newValues);
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
                  type="checkbox"
                  name={`question-${question.id}`}
                  value={option}
                  checked={
                    selectedValues.includes(option) ||
                    (option === OTHER_OPTION &&
                      selectedValues.some(v => typeof v === "string" && v.startsWith("Other:")))
                  }
                  onChange={e => handleCheckboxChange(option, e.target.checked)}
                  onBlur={onBlur}
                  className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 sm:ml-3 text-gray-700 font-medium text-xs sm:text-base">
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
              const newValues = selectedValues.filter(v => v !== OTHER_OPTION);
              newValues.push(`Other: ${otherText.trim()}`);
              onChange(newValues);
            }
          }}
        />
      )}
      <ErrorMessage error={error || ""} />
    </div>
  );
};

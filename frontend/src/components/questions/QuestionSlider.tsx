import type { Question } from "@/lib/api";
import { ErrorMessage } from "./ErrorMessage";

interface QuestionSliderProps {
  question: Question;
  value: number;
  error?: string;
  onChange: (value: number) => void;
  onBlur: (value: number) => void;
}

export const QuestionSlider = ({
  question,
  value,
  error,
  onChange,
  onBlur,
}: QuestionSliderProps) => {
  const scaleMin = question.scale_min ?? 0;
  const scaleMax = question.scale_max ?? 10;
  const scaleStep = question.scale_step ?? 1;
  const scaleMinLabel = question.scale_min_label || "";
  const scaleMaxLabel = question.scale_max_label || "";
  // Default to median (middle) of the range to avoid bias
  const median = Math.round((scaleMin + scaleMax) / 2);
  const currentValue = typeof value === "number" ? value : median;

  return (
    <div className="space-y-4">
      <div className="px-2">
        <input
          type="range"
          min={scaleMin}
          max={scaleMax}
          step={scaleStep}
          value={currentValue}
          onChange={e => onChange(parseInt(e.target.value))}
          onBlur={() => onBlur(currentValue)}
          className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
          style={{
            background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${
              ((currentValue - scaleMin) / (scaleMax - scaleMin)) * 100
            }%, #e5e7eb ${
              ((currentValue - scaleMin) / (scaleMax - scaleMin)) * 100
            }%, #e5e7eb 100%)`,
          }}
        />
        <style jsx>{`
          .slider-thumb {
            outline: none !important;
            border: none !important;
          }
          .slider-thumb:focus {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
          }
          .slider-thumb::-webkit-slider-thumb {
            appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #6366f1;
            cursor: pointer;
            border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          .slider-thumb::-webkit-slider-thumb:focus {
            outline: none;
          }
          .slider-thumb::-moz-range-thumb {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #6366f1;
            cursor: pointer;
            border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          .slider-thumb::-moz-range-thumb:focus {
            outline: none;
          }
        `}</style>
      </div>

      <div className="flex justify-between items-center px-2">
        <div className="flex flex-col items-start">
          <span className="text-2xl font-bold text-indigo-600">{currentValue}</span>
          {scaleMinLabel && <span className="text-xs text-gray-500 mt-1">{scaleMinLabel}</span>}
        </div>
        {scaleMaxLabel && (
          <span className="text-xs text-gray-500 text-right max-w-[150px]">{scaleMaxLabel}</span>
        )}
      </div>

      <div className="flex justify-between text-xs text-gray-400 px-2">
        <span>{scaleMin}</span>
        <span>{scaleMax}</span>
      </div>

      <ErrorMessage error={error || ""} />
    </div>
  );
};

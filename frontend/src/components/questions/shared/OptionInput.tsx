interface OptionInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder?: string;
  maxLength?: number;
}

export const OptionInput = ({
  value,
  onChange,
  onBlur,
  placeholder = "Please specify...",
  maxLength = 99999,
}: OptionInputProps) => {
  return (
    <div className="mt-4">
      <input
        type="text"
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-black border-gray-300 focus:ring-indigo-500"
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
};

"use client";

type MultiSelectQuestionProps = {
  questionId: string;
  questionText: string;
  options: string[];
  value: string[] | null;
  onChange: (value: string[]) => void;
  required: boolean;
};

export default function MultiSelectQuestion({
  questionId,
  questionText,
  options,
  value,
  onChange,
  required,
}: MultiSelectQuestionProps) {
  const selected = value || [];

  const handleToggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {questionText}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="space-y-2">
        {options.map((option, idx) => (
          <label
            key={idx}
            className="flex items-center gap-3 p-3 rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => handleToggle(option)}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="flex-1">{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}


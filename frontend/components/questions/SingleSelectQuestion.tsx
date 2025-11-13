"use client";

type SingleSelectQuestionProps = {
  questionId: string;
  questionText: string;
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  required: boolean;
};

export default function SingleSelectQuestion({
  questionId,
  questionText,
  options,
  value,
  onChange,
  required,
}: SingleSelectQuestionProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {questionText}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-3 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
        required={required}
      >
        <option value="">Select an option</option>
        {options.map((option, idx) => (
          <option key={idx} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}


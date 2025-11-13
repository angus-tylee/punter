"use client";

type LikertQuestionProps = {
  questionId: string;
  questionText: string;
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  required: boolean;
};

export default function LikertQuestion({
  questionId,
  questionText,
  options,
  value,
  onChange,
  required,
}: LikertQuestionProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {questionText}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex flex-wrap gap-3 items-center justify-center py-4">
        {options.map((option, idx) => (
          <label
            key={idx}
            className="flex flex-col items-center gap-2 cursor-pointer p-3 rounded-md border-2 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white transition-colors"
            style={{
              borderColor: value === option ? "currentColor" : undefined,
            }}
          >
            <input
              type="radio"
              name={`question-${questionId}`}
              value={option}
              checked={value === option}
              onChange={(e) => onChange(e.target.value)}
              className="w-5 h-5"
              required={required}
            />
            <span className="text-xs text-center max-w-[100px]">{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}


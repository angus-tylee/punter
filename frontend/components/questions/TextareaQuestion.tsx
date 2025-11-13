"use client";

type TextareaQuestionProps = {
  questionId: string;
  questionText: string;
  value: string | null;
  onChange: (value: string) => void;
  required: boolean;
};

export default function TextareaQuestion({
  questionId,
  questionText,
  value,
  onChange,
  required,
}: TextareaQuestionProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {questionText}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-3 outline-none min-h-[120px] focus:ring-2 focus:ring-black dark:focus:ring-white"
        required={required}
      />
    </div>
  );
}


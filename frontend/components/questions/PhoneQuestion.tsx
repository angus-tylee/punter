"use client";

import { useState } from "react";

type PhoneQuestionProps = {
  questionId: string;
  questionText: string;
  value: string | null;
  onChange: (value: string) => void;
  required: boolean;
};

// E.164 format: +[country code][number] (e.g., +14155552671)
// Simplified validation - allows + followed by 1-15 digits
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

export default function PhoneQuestion({
  questionId,
  questionText,
  value,
  onChange,
  required,
}: PhoneQuestionProps) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let phone = e.target.value.trim();
    
    // Auto-format: add + if user starts typing numbers without +
    if (phone && !phone.startsWith("+") && /^[0-9]/.test(phone)) {
      phone = "+" + phone;
    }
    
    onChange(phone);
    
    // Validate on change (but only show error after blur or if required and empty)
    if (phone && !PHONE_REGEX.test(phone)) {
      setError("Please enter a valid phone number in international format (e.g., +14155552671)");
    } else {
      setError(null);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const phone = e.target.value.trim();
    if (phone && !PHONE_REGEX.test(phone)) {
      setError("Please enter a valid phone number in international format (e.g., +14155552671)");
    } else {
      setError(null);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {questionText}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="tel"
        id={questionId}
        value={value || ""}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-full rounded-md border ${
          error ? "border-red-500" : "border-gray-300 dark:border-gray-700"
        } bg-transparent p-3 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white`}
        required={required}
        placeholder="+14155552671"
      />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Format: +[country code][number] (e.g., +14155552671)
      </p>
    </div>
  );
}


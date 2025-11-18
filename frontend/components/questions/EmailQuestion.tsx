"use client";

import { useState } from "react";

type EmailQuestionProps = {
  questionId: string;
  questionText: string;
  value: string | null;
  onChange: (value: string) => void;
  required: boolean;
};

// RFC 5322 compliant email regex (simplified but covers most cases)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export default function EmailQuestion({
  questionId,
  questionText,
  value,
  onChange,
  required,
}: EmailQuestionProps) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    onChange(email);
    
    // Validate on change (but only show error after blur or if required and empty)
    if (email && !EMAIL_REGEX.test(email)) {
      setError("Please enter a valid email address");
    } else {
      setError(null);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const email = e.target.value;
    if (email && !EMAIL_REGEX.test(email)) {
      setError("Please enter a valid email address");
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
        type="email"
        id={questionId}
        value={value || ""}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-full rounded-md border ${
          error ? "border-red-500" : "border-gray-300 dark:border-gray-700"
        } bg-transparent p-3 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white`}
        required={required}
        placeholder="example@email.com"
      />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}


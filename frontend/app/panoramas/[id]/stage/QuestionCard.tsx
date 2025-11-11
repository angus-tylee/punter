"use client";

import { useState } from "react";
import { StagingQuestion, categorizeQuestion, QuestionCategory } from "./utils";

type QuestionCardProps = {
  question: StagingQuestion;
  isSuggested: boolean; // Kept for compatibility but not used
  onEdit?: (question: StagingQuestion, newText: string) => void;
  onDelete?: (question: StagingQuestion) => void;
};

export default function QuestionCard({
  question,
  isSuggested,
  onEdit,
  onDelete
}: QuestionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(question.question_text);
  const category = categorizeQuestion(question.question_text);

  const handleSaveEdit = () => {
    if (onEdit && editText.trim()) {
      onEdit(question, editText.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditText(question.question_text);
    setIsEditing(false);
  };

  const cardClasses = `
    relative p-4 rounded-lg border transition-all duration-200
    bg-white/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-700
    hover:border-gray-300 dark:hover:border-gray-600 hover:bg-white dark:hover:bg-gray-800
    hover:shadow-sm
  `;

  return (
    <div className={cardClasses}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full rounded-md border border-blue-300 dark:border-blue-600 bg-transparent p-2 outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                rows={2}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="text-xs px-3 py-1.5 rounded text-white bg-blue-700 dark:bg-blue-600 hover:bg-blue-800 dark:hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                {question.question_text}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                  {category}
                </span>
                <span className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                  {question.question_type}
                </span>
                {question.required && (
                  <span className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                    Required
                  </span>
                )}
              </div>
              {question.options && question.options.length > 0 && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Options:</span> {question.options.slice(0, 3).join(", ")}
                  {question.options.length > 3 && ` +${question.options.length - 3} more`}
                </div>
              )}
            </>
          )}
        </div>
        
        {!isEditing && (
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setEditText(question.question_text);
                }}
                className="text-xs px-2.5 py-1.5 rounded text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="Edit"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(question)}
                className="text-xs px-2.5 py-1.5 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Remove"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


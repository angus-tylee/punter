"use client";

import { useMemo } from "react";
import { StagingQuestion, QuestionCategory, categorizeQuestion } from "./utils";

type CategoryStatusBarProps = {
  questions: StagingQuestion[];
};

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  "Experience": "Experience",
  "Music/Lineup": "Artists",
  "Venue/Logistics": "Operations",
  "Communication": "Audience",
  "Sustainability": "Logistics",
  "Post-Event": "Post-Event",
  "Other": "Other"
};

const CATEGORY_COLORS: Record<QuestionCategory, string> = {
  "Experience": "bg-slate-200 dark:bg-slate-700",
  "Music/Lineup": "bg-slate-300 dark:bg-slate-600",
  "Venue/Logistics": "bg-slate-400 dark:bg-slate-500",
  "Communication": "bg-slate-500 dark:bg-slate-400",
  "Sustainability": "bg-slate-600 dark:bg-slate-300",
  "Post-Event": "bg-slate-700 dark:bg-slate-200",
  "Other": "bg-slate-100 dark:bg-slate-800"
};

export default function CategoryStatusBar({ questions }: CategoryStatusBarProps) {
  const categoryData = useMemo(() => {
    const categoryCounts: Record<QuestionCategory, number> = {
      "Experience": 0,
      "Music/Lineup": 0,
      "Venue/Logistics": 0,
      "Communication": 0,
      "Sustainability": 0,
      "Post-Event": 0,
      "Other": 0
    };

    questions.forEach(q => {
      const category = categorizeQuestion(q.question_text);
      categoryCounts[category]++;
    });

    const total = questions.length;
    if (total === 0) return [];

    return Object.entries(categoryCounts)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => ({
        name: name as QuestionCategory,
        count,
        percentage: (count / total) * 100,
        label: CATEGORY_LABELS[name as QuestionCategory],
        color: CATEGORY_COLORS[name as QuestionCategory]
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Max 4-5 categories
  }, [questions]);

  if (categoryData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
        Category Balance
      </div>
      <div className="flex items-center gap-1 h-8 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
        {categoryData.map((item, index) => (
          <div
            key={item.name}
            className={`${item.color} transition-all duration-300 flex items-center justify-center group relative`}
            style={{ width: `${item.percentage}%` }}
            title={`${item.label}: ${item.count} question${item.count === 1 ? '' : 's'}`}
          >
            {item.percentage > 8 && (
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.label}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {categoryData.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded ${item.color}`} />
            <span>{item.label}: {item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


"use client";

import { QuickWin } from "@/lib/analytics/dashboardConfig";

type QuickWinsProps = {
  positives: QuickWin[];
  negatives: QuickWin[];
};

export default function QuickWins({ positives, negatives }: QuickWinsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* What Worked Best */}
      <div className="rounded-lg border border-green-200 dark:border-green-800 p-5 bg-green-50 dark:bg-green-900/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">✅</span>
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
            What Worked Best
          </h3>
        </div>
        {positives.length === 0 ? (
          <p className="text-sm text-green-700 dark:text-green-300">
            No strongly positive areas identified yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {positives.map((win, idx) => (
              <li key={win.question_id} className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-semibold mt-0.5">
                  {idx + 1}.
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    {win.question_text}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    {win.metric}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Needs Attention */}
      <div className="rounded-lg border border-orange-200 dark:border-orange-800 p-5 bg-orange-50 dark:bg-orange-900/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">⚠️</span>
          <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
            Needs Attention
          </h3>
        </div>
        {negatives.length === 0 ? (
          <p className="text-sm text-orange-700 dark:text-orange-300">
            No major concerns identified.
          </p>
        ) : (
          <ul className="space-y-3">
            {negatives.map((concern, idx) => (
              <li key={concern.question_id} className="flex items-start gap-2">
                <span className="text-orange-600 dark:text-orange-400 font-semibold mt-0.5">
                  {idx + 1}.
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                    {concern.question_text}
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    {concern.metric}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


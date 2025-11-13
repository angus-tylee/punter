"use client";

import { OverallStats } from "@/lib/analytics/aggregators";

type KeyMetricsProps = {
  overall: OverallStats;
};

export default function KeyMetrics({ overall }: KeyMetricsProps) {
  const satisfactionPercent = Math.round(overall.overall_satisfaction * 100);
  const satisfactionColor =
    overall.overall_satisfaction >= 0.7
      ? "text-green-600 dark:text-green-400"
      : overall.overall_satisfaction >= 0.5
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";

  const metrics = [
    {
      label: "Overall Satisfaction",
      value: `${satisfactionPercent}%`,
      color: satisfactionColor,
      icon: "⭐",
    },
    {
      label: "Total Responses",
      value: overall.total_responses.toString(),
      color: "text-blue-600 dark:text-blue-400",
      icon: "💬",
    },
    {
      label: "Unique Submissions",
      value: overall.unique_submissions.toString(),
      color: "text-purple-600 dark:text-purple-400",
      icon: "👥",
    },
  ];

  // Add "Would Attend Again" if we can calculate it
  // This would come from a specific question if it exists

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {metrics.map((metric, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {metric.label}
            </span>
            <span className="text-xl">{metric.icon}</span>
          </div>
          <div className={`text-2xl font-semibold ${metric.color}`}>
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}


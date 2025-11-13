"use client";

import { useEffect, useState } from "react";
import { fetchSummaryById, SummaryResponse } from "@/lib/analytics/llmClient";

type ExecutiveSummaryProps = {
  panoramaId: string;
  panoramaName: string;
  summaryRequest: {
    panorama: { name: string; description?: string };
    questions: Array<{ id: string; question_text: string; question_type: string }>;
    aggregated_stats: any;
    text_samples: { [questionId: string]: string[] };
    response_count: number;
  };
};

export default function ExecutiveSummary({
  panoramaId,
  panoramaName,
  summaryRequest,
}: ExecutiveSummaryProps) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadSummary = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await fetchSummaryById(panoramaId, summaryRequest);
        if (mounted) {
          setSummary(result);
        }
      } catch (err) {
        console.error("Failed to load summary:", err);
        if (mounted) {
          setError("Failed to generate summary");
          // Fallback summary
          setSummary({
            summary: `Analysis of ${panoramaName} feedback. Review the detailed insights below.`,
            keyMetrics: []
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (summaryRequest.response_count > 0) {
      loadSummary();
    } else {
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [panoramaId, summaryRequest]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 p-6 bg-red-50 dark:bg-red-900/20">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
          {panoramaName}
        </h2>
        {summary && (
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {summary.summary}
          </p>
        )}
      </div>
      
      {summary && summary.keyMetrics && summary.keyMetrics.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
          <div className="flex flex-wrap gap-3">
            {summary.keyMetrics.map((metric, idx) => (
              <div
                key={idx}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                  metric.type === "positive"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : metric.type === "negative"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {metric.label}: {metric.value}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


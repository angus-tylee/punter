"use client";

import { WordFrequency } from "@/lib/analytics/textAnalyzer";

type WordCloudProps = {
  wordFrequencies: WordFrequency[];
  maxWords?: number;
};

export default function WordCloud({
  wordFrequencies,
  maxWords = 30,
}: WordCloudProps) {
  if (wordFrequencies.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No words to display
      </div>
    );
  }

  // Get top words
  const topWords = wordFrequencies.slice(0, maxWords);

  // Calculate size range (min 0.75rem to max 1.5rem)
  const maxCount = topWords[0]?.count || 1;
  const minCount = topWords[topWords.length - 1]?.count || 1;

  const getFontSize = (count: number) => {
    if (maxCount === minCount) return "text-base";
    const ratio = (count - minCount) / (maxCount - minCount);
    const size = 0.75 + ratio * 0.75; // 0.75rem to 1.5rem
    if (size >= 1.25) return "text-xl";
    if (size >= 1.0) return "text-lg";
    if (size >= 0.875) return "text-base";
    return "text-sm";
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Most Common Words
      </h4>
      <div className="flex flex-wrap gap-2">
        {topWords.map((word, idx) => (
          <span
            key={idx}
            className={`px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 ${getFontSize(
              word.count
            )} font-medium`}
            title={`${word.word}: ${word.count} occurrences`}
          >
            {word.word} ({word.count})
          </span>
        ))}
      </div>
    </div>
  );
}


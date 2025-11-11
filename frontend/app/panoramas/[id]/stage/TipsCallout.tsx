"use client";

import { useState } from "react";

export default function TipsCallout() {
  const [isExpanded, setIsExpanded] = useState(true);

  const tips = [
    "Capture the vibe, not just the facts",
    "Avoid industry jargon - speak like a fan",
    "Keep it concise - festival-goers are on the move",
    "Ask about atmosphere, not just logistics",
    "Make it feel like a conversation, not an audit"
  ];

  return (
    <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="text-lg">🎸</span>
          Backstage Tips
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>
      {isExpanded && (
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {tips.map((tip, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-0.5">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { StagingQuestion, QuestionCategory, categorizeQuestion } from "./utils";

type CategoryChartProps = {
  questions: StagingQuestion[];
};

const COLORS: Record<QuestionCategory, string> = {
  "Experience": "#f97316",
  "Music/Lineup": "#a855f7",
  "Venue/Logistics": "#3b82f6",
  "Communication": "#ec4899",
  "Sustainability": "#22c55e",
  "Post-Event": "#eab308",
  "Other": "#6b7280"
};

export default function CategoryChart({ questions }: CategoryChartProps) {
  const chartData = useMemo(() => {
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

    return Object.entries(categoryCounts)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({
        name,
        value,
        color: COLORS[name as QuestionCategory]
      }));
  }, [questions]);

  if (chartData.length === 0) {
    return (
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
        No questions to display
      </div>
    );
  }

  return (
    <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
        Category Mix
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={60}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend 
            wrapperStyle={{ fontSize: '11px' }}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}


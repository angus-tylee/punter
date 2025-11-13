"use client";

import { Question } from "@/lib/analytics/aggregators";
import { AggregatedData } from "@/lib/analytics/aggregators";
import { QuestionInsight as InsightType } from "@/lib/analytics/insightsGenerator";
import { getChartData } from "@/lib/analytics/aggregators";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
];

type QuestionInsightProps = {
  question: Question;
  aggregated: AggregatedData;
  insight: InsightType;
};

export default function QuestionInsight({
  question,
  aggregated,
  insight,
}: QuestionInsightProps) {
  const chartData = getChartData(question, aggregated);
  const responseCount = aggregated.total;

  // Determine chart type
  const getChart = () => {
    if (question.question_type === "Likert") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              fontSize={12}
            />
            <YAxis />
            <Tooltip />
            <Bar
              dataKey="value"
              fill={
                insight.sentiment === "positive"
                  ? "#10b981"
                  : insight.sentiment === "negative"
                  ? "#ef4444"
                  : "#6b7280"
              }
            />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (
      question.question_type === "Single-select" &&
      chartData.length <= 5
    ) {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    } else if (question.question_type === "Multi-select") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              fontSize={12}
            />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (question.question_type === "budget-allocation") {
      const budgetData = aggregated as AggregatedData & {
        averages?: { [key: string]: number };
      };
      return (
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Total Allocated per Artist:
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `$${value}`}
                  labelFormatter={(label) => `Artist: ${label}`}
                />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {budgetData.averages && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Average Allocation per Artist:
              </div>
              <div className="space-y-2">
                {Object.entries(budgetData.averages)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([artistId, average], idx) => {
                    const artistName =
                      chartData.find((d) => d.name === artistId)?.name ||
                      artistId;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{artistName}</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          ${average.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const sentimentColors = {
    positive: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20",
    negative: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20",
    neutral: "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20",
    mixed: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20",
  };

  const priorityBadges = {
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <div
      className={`rounded-lg border p-5 ${sentimentColors[insight.sentiment]}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            {question.question_text}
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {responseCount} {responseCount === 1 ? "response" : "responses"}
          </span>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded font-medium ${priorityBadges[insight.priority]}`}
        >
          {insight.priority.toUpperCase()}
        </span>
      </div>

      {/* Insight */}
      <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
          💡 Insight
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {insight.insight}
        </p>
      </div>

      {/* Explanation */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          What this means:
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {insight.explanation}
        </p>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="mt-4">{getChart()}</div>
      )}
    </div>
  );
}


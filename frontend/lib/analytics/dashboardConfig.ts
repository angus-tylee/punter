/**
 * Dashboard configuration generator
 * Organizes questions and creates Quick Wins sections
 */

import { Question } from "./aggregators";
import { AggregatedData, OverallStats } from "./aggregators";
import { QuestionInsight } from "./insightsGenerator";
import { QuestionWithPriority, rankQuestionsByPriority } from "./priorityRanker";

export type QuickWin = {
  question_id: string;
  question_text: string;
  metric: string;
  sentiment: "positive" | "negative";
};

export type DashboardConfig = {
  quickWins: {
    positives: QuickWin[];
    negatives: QuickWin[];
  };
  questions: QuestionWithPriority[];
};

/**
 * Generate dashboard configuration
 */
export function generateDashboardConfig(
  questions: Question[],
  aggregatedStats: { [questionId: string]: AggregatedData },
  insights: { [questionId: string]: QuestionInsight },
  overall: OverallStats,
  totalSubmissions: number
): DashboardConfig {
  // Rank questions by priority
  const rankedQuestions = rankQuestionsByPriority(
    questions,
    aggregatedStats,
    insights,
    totalSubmissions
  );
  
  // Find top 3 positives and negatives
  const positives: QuickWin[] = [];
  const negatives: QuickWin[] = [];
  
  rankedQuestions.forEach(({ question, aggregated, insight }) => {
    if (insight.sentiment === "positive" && aggregated.sentiment_score !== undefined) {
      positives.push({
        question_id: question.id,
        question_text: question.question_text,
        metric: `${Math.round((aggregated.sentiment_score || 0) * 100)}% positive`,
        sentiment: "positive"
      });
    } else if (insight.sentiment === "negative" && aggregated.sentiment_score !== undefined) {
      negatives.push({
        question_id: question.id,
        question_text: question.question_text,
        metric: `${Math.round((1 - (aggregated.sentiment_score || 0)) * 100)}% negative`,
        sentiment: "negative"
      });
    }
  });
  
  // Sort and take top 3
  positives.sort((a, b) => {
    const aScore = aggregatedStats[a.question_id]?.sentiment_score || 0;
    const bScore = aggregatedStats[b.question_id]?.sentiment_score || 0;
    return bScore - aScore;
  });
  
  negatives.sort((a, b) => {
    const aScore = aggregatedStats[a.question_id]?.sentiment_score || 0;
    const bScore = aggregatedStats[b.question_id]?.sentiment_score || 0;
    return aScore - bScore; // Lower is worse
  });
  
  return {
    quickWins: {
      positives: positives.slice(0, 3),
      negatives: negatives.slice(0, 3)
    },
    questions: rankedQuestions
  };
}


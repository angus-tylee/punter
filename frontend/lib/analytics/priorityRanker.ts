/**
 * Priority ranking system for questions
 * Determines which questions are most important to display first
 */

import { Question } from "./aggregators";
import { AggregatedData } from "./aggregators";
import { QuestionInsight } from "./insightsGenerator";

export type QuestionWithPriority = {
  question: Question;
  aggregated: AggregatedData;
  insight: QuestionInsight;
  priorityScore: number;
};

/**
 * Calculate priority score for a question
 * Higher score = more important to display first
 */
export function calculatePriorityScore(
  question: Question,
  aggregated: AggregatedData,
  insight: QuestionInsight,
  totalSubmissions: number
): number {
  let score = 0;
  
  // Factor 1: Response variance (high variance = more interesting)
  const variance = calculateVariance(aggregated);
  score += variance * 30; // 0-30 points
  
  // Factor 2: Sentiment strength (very positive or very negative = important)
  if (aggregated.sentiment_score !== undefined) {
    const sentimentStrength = Math.abs(aggregated.sentiment_score - 0.5) * 2; // 0-1 scale
    score += sentimentStrength * 25; // 0-25 points
  }
  
  // Factor 3: Response count (more responses = more reliable)
  const responseRate = totalSubmissions > 0 ? aggregated.total / totalSubmissions : 0;
  score += responseRate * 20; // 0-20 points
  
  // Factor 4: Insight priority (high/medium/low)
  const priorityMultiplier = {
    high: 1.0,
    medium: 0.6,
    low: 0.3
  };
  score *= priorityMultiplier[insight.priority];
  
  // Factor 5: Question type importance
  const typeMultiplier: { [key: string]: number } = {
    "Likert": 1.0,
    "Single-select": 0.9,
    "Multi-select": 0.8,
    "budget-allocation": 0.9,
    "textarea": 0.7,
    "text": 0.6
  };
  score *= typeMultiplier[question.question_type] || 0.5;
  
  // Factor 6: Required questions get slight boost
  if (question.required) {
    score *= 1.1;
  }
  
  return score;
}

/**
 * Calculate variance in responses (how spread out the data is)
 */
function calculateVariance(aggregated: AggregatedData): number {
  if (Object.keys(aggregated.counts).length === 0) {
    return 0;
  }
  
  const values = Object.values(aggregated.counts);
  const total = aggregated.total;
  
  if (total === 0) {
    return 0;
  }
  
  // Calculate entropy (measure of distribution)
  let entropy = 0;
  values.forEach(count => {
    const probability = count / total;
    if (probability > 0) {
      entropy -= probability * Math.log2(probability);
    }
  });
  
  // Normalize to 0-1 scale (max entropy is log2(n) where n is number of options)
  const maxEntropy = Math.log2(values.length || 1);
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
  
  return normalizedEntropy;
}

/**
 * Rank questions by priority
 */
export function rankQuestionsByPriority(
  questions: Question[],
  aggregatedStats: { [questionId: string]: AggregatedData },
  insights: { [questionId: string]: QuestionInsight },
  totalSubmissions: number
): QuestionWithPriority[] {
  const questionsWithPriority: QuestionWithPriority[] = questions.map(question => {
    const aggregated = aggregatedStats[question.id] || {
      counts: {},
      total: 0,
      percentage: {}
    };
    const insight = insights[question.id] || {
      insight: "",
      explanation: "",
      sentiment: "neutral" as const,
      priority: "low" as const
    };
    
    const priorityScore = calculatePriorityScore(
      question,
      aggregated,
      insight,
      totalSubmissions
    );
    
    return {
      question,
      aggregated,
      insight,
      priorityScore
    };
  });
  
  // Sort by priority score (descending)
  return questionsWithPriority.sort((a, b) => b.priorityScore - a.priorityScore);
}


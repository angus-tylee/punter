/**
 * Rules-based insight generation for individual questions
 * Converts quantitative data into natural language insights
 */

import { Question } from "./aggregators";
import { AggregatedData } from "./aggregators";

export type QuestionInsight = {
  insight: string; // 1-2 sentence insight
  explanation: string; // "What this means" explanation
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  priority: "high" | "medium" | "low";
};

/**
 * Generate insight for a question based on aggregated data
 */
export function generateInsight(
  question: Question,
  aggregated: AggregatedData,
  totalSubmissions: number
): QuestionInsight {
  const responseRate = totalSubmissions > 0 ? aggregated.total / totalSubmissions : 0;
  
  // Handle different question types
  switch (question.question_type) {
    case "Likert":
      return generateLikertInsight(question, aggregated, responseRate);
    case "Single-select":
      return generateSingleSelectInsight(question, aggregated, responseRate);
    case "Multi-select":
      return generateMultiSelectInsight(question, aggregated, responseRate);
    case "budget-allocation":
      return generateBudgetInsight(question, aggregated, responseRate);
    case "text":
    case "textarea":
      return generateTextInsight(question, aggregated, responseRate);
    default:
      return {
        insight: `${aggregated.total} responses collected.`,
        explanation: "Review individual responses for detailed feedback.",
        sentiment: "neutral",
        priority: "low"
      };
  }
}

function generateLikertInsight(
  question: Question,
  aggregated: AggregatedData,
  responseRate: number
): QuestionInsight {
  const sentimentScore = aggregated.sentiment_score ?? 0.5;
  const options = question.options as string[] | null;
  
  if (!options || options.length === 0) {
    return defaultInsight(aggregated, responseRate);
  }

  // Count positive vs negative responses
  const positiveOptions = ["Agree", "Strongly Agree"];
  const negativeOptions = ["Disagree", "Strongly Disagree"];
  
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  
  Object.entries(aggregated.counts).forEach(([value, count]) => {
    if (positiveOptions.includes(value)) {
      positiveCount += count;
    } else if (negativeOptions.includes(value)) {
      negativeCount += count;
    } else {
      neutralCount += count;
    }
  });
  
  const total = aggregated.total;
  const positivePercent = total > 0 ? positiveCount / total : 0;
  const negativePercent = total > 0 ? negativeCount / total : 0;
  
  let insight: string;
  let explanation: string;
  let sentiment: QuestionInsight["sentiment"];
  let priority: QuestionInsight["priority"];
  
  if (sentimentScore >= 0.75) {
    insight = `${Math.round(positivePercent * 100)}% of respondents agreed or strongly agreed. This indicates strong positive sentiment.`;
    explanation = "This is a clear strength area. Consider highlighting this in future events.";
    sentiment = "positive";
    priority = "low";
  } else if (sentimentScore >= 0.6) {
    insight = `Most respondents (${Math.round(positivePercent * 100)}%) had a positive response, with overall sentiment leaning favorable.`;
    explanation = "This area is performing well, though there may be room for improvement.";
    sentiment = "positive";
    priority = "low";
  } else if (sentimentScore <= 0.4) {
    insight = `${Math.round(negativePercent * 100)}% of respondents disagreed or strongly disagreed. This is a significant concern.`;
    explanation = "This area needs immediate attention. Consider gathering more detailed feedback to understand the issues.";
    sentiment = "negative";
    priority = "high";
  } else if (sentimentScore <= 0.5) {
    insight = `Responses are mixed, with ${Math.round(negativePercent * 100)}% expressing negative sentiment.`;
    explanation = "This area requires attention. Review individual responses to identify specific concerns.";
    sentiment = "negative";
    priority = "high";
  } else {
    insight = `Responses are fairly balanced, with ${Math.round(neutralCount / total * 100)}% neutral responses.`;
    explanation = "This area shows mixed feedback. Consider ways to improve the experience.";
    sentiment = "mixed";
    priority = sentimentScore < 0.55 ? "high" : "medium";
  }
  
  return { insight, explanation, sentiment, priority };
}

function generateSingleSelectInsight(
  question: Question,
  aggregated: AggregatedData,
  responseRate: number
): QuestionInsight {
  const sentimentScore = aggregated.sentiment_score ?? 0.5;
  const options = question.options as string[] | null;
  
  if (!options || Object.keys(aggregated.counts).length === 0) {
    return defaultInsight(aggregated, responseRate);
  }
  
  // Find most common response
  const sortedResponses = Object.entries(aggregated.counts)
    .sort(([, a], [, b]) => b - a);
  
  if (sortedResponses.length === 0) {
    return defaultInsight(aggregated, responseRate);
  }
  
  const [topResponse, topCount] = sortedResponses[0];
  const topPercent = aggregated.total > 0 ? topCount / aggregated.total : 0;
  
  let insight: string;
  let explanation: string;
  let sentiment: QuestionInsight["sentiment"];
  let priority: QuestionInsight["priority"];
  
  if (sentimentScore >= 0.7) {
    insight = `${Math.round(topPercent * 100)}% selected "${topResponse}", indicating strong positive feedback.`;
    explanation = "This is a clear strength. Continue focusing on this aspect in future events.";
    sentiment = "positive";
    priority = "low";
  } else if (sentimentScore <= 0.4) {
    insight = `The most common response was "${topResponse}" (${Math.round(topPercent * 100)}%), indicating concerns in this area.`;
    explanation = "This area needs attention. Review feedback to identify specific improvement opportunities.";
    sentiment = "negative";
    priority = "high";
  } else {
    insight = `Responses are distributed, with "${topResponse}" being the most common (${Math.round(topPercent * 100)}%).`;
    explanation = "Feedback is mixed. Consider ways to improve the experience for all respondents.";
    sentiment = "mixed";
    priority = sentimentScore < 0.55 ? "high" : "medium";
  }
  
  return { insight, explanation, sentiment, priority };
}

function generateMultiSelectInsight(
  question: Question,
  aggregated: AggregatedData,
  responseRate: number
): QuestionInsight {
  const options = question.options as string[] | null;
  
  if (!options || Object.keys(aggregated.counts).length === 0) {
    return defaultInsight(aggregated, responseRate);
  }
  
  // Find top selections
  const sortedSelections = Object.entries(aggregated.counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  
  if (sortedSelections.length === 0) {
    return defaultInsight(aggregated, responseRate);
  }
  
  const topSelections = sortedSelections.map(([option]) => option).join(", ");
  const topCount = sortedSelections[0][1];
  const topPercent = aggregated.total > 0 ? topCount / aggregated.total : 0;
  
  const insight = `The most selected options were: ${topSelections}. ${Math.round(topPercent * 100)}% selected the top choice.`;
  const explanation = "These are the aspects that resonated most with respondents. Consider emphasizing these in future events.";
  
  return {
    insight,
    explanation,
    sentiment: "positive",
    priority: "medium"
  };
}

function generateBudgetInsight(
  question: Question,
  aggregated: AggregatedData,
  responseRate: number
): QuestionInsight {
  const budgetData = aggregated as AggregatedData & { averages?: { [key: string]: number } };
  const budgetOptions = question.options as { budget: number; artists: Array<{ id: string; name: string; imageUrl: string }> } | null;
  
  if (!budgetOptions?.artists || !budgetData.averages) {
    return defaultInsight(aggregated, responseRate);
  }
  
  // Find top allocated artist
  const sortedArtists = Object.entries(budgetData.averages)
    .sort(([, a], [, b]) => b - a);
  
  if (sortedArtists.length === 0) {
    return defaultInsight(aggregated, responseRate);
  }
  
  const [topArtistId, topAverage] = sortedArtists[0];
  const topArtist = budgetOptions.artists.find(a => a.id === topArtistId);
  const artistName = topArtist?.name || "Unknown";
  
  const insight = `On average, respondents allocated $${topAverage.toFixed(2)} to ${artistName}, indicating strong preference.`;
  const explanation = "This shows which artists or options respondents value most. Use this data to inform future planning.";
  
  return {
    insight,
    explanation,
    sentiment: "positive",
    priority: "medium"
  };
}

function generateTextInsight(
  question: Question,
  aggregated: AggregatedData,
  responseRate: number
): QuestionInsight {
  if (aggregated.total === 0) {
    return {
      insight: "No text responses collected for this question.",
      explanation: "Consider making this question required or more prominent to gather feedback.",
      sentiment: "neutral",
      priority: "low"
    };
  }
  
  const insight = `${aggregated.total} text responses collected. Review individual responses to identify common themes and patterns.`;
  const explanation = "Text responses provide qualitative insights. Look for recurring themes, specific suggestions, or emotional language.";
  
  return {
    insight,
    explanation,
    sentiment: "neutral",
    priority: "medium"
  };
}

function defaultInsight(
  aggregated: AggregatedData,
  responseRate: number
): QuestionInsight {
  return {
    insight: `${aggregated.total} responses collected (${Math.round(responseRate * 100)}% response rate).`,
    explanation: "Review the data to identify patterns and insights.",
    sentiment: "neutral",
    priority: "low"
  };
}


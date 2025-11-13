/**
 * Enhanced quantitative aggregation functions
 * Handles all question types with comprehensive statistics
 */

export type Question = {
  id: string;
  question_text: string;
  question_type: "text" | "textarea" | "Single-select" | "Multi-select" | "Likert" | "budget-allocation";
  options: string[] | any | null;
  required: boolean;
  order: number;
};

export type Response = {
  id: string;
  question_id: string;
  submission_id: string;
  response_text: string;
  created_at: string;
};

export type AggregatedData = {
  counts: { [key: string]: number };
  total: number;
  percentage: { [key: string]: number };
  average?: number;
  sentiment_score?: number; // 0-1 scale
};

export type AggregatedStats = {
  [questionId: string]: AggregatedData;
};

export type OverallStats = {
  total_responses: number;
  unique_submissions: number;
  overall_satisfaction: number; // 0-1 scale
  response_rate: number; // 0-1 scale
  top_positive_question?: {
    question_id: string;
    question_text: string;
    sentiment_score: number;
  };
  top_negative_question?: {
    question_id: string;
    question_text: string;
    sentiment_score: number;
  };
};

/**
 * Map Likert scale to numeric value (0-1 scale)
 */
function likertToScore(value: string): number {
  const mapping: { [key: string]: number } = {
    "Strongly Disagree": 0.0,
    "Disagree": 0.25,
    "Neutral": 0.5,
    "Agree": 0.75,
    "Strongly Agree": 1.0,
  };
  return mapping[value] ?? 0.5;
}

/**
 * Map single-select options to sentiment score (heuristic)
 */
function singleSelectToScore(value: string, options: string[]): number {
  const lower = value.toLowerCase();
  const positiveWords = ["excellent", "very good", "good", "satisfied", "love", "amazing", "great"];
  const negativeWords = ["poor", "bad", "terrible", "unsatisfied", "hate", "awful", "worst"];
  
  if (positiveWords.some(word => lower.includes(word))) return 0.8;
  if (negativeWords.some(word => lower.includes(word))) return 0.2;
  
  // If options are ordered, assume first is best, last is worst
  if (options.length > 0) {
    const index = options.findIndex(opt => opt.toLowerCase() === lower);
    if (index >= 0) {
      return 1 - (index / (options.length - 1)) * 0.6; // Scale from 1.0 to 0.4
    }
  }
  
  return 0.5; // Default neutral
}

/**
 * Aggregate single-select responses
 */
export function aggregateSingleSelect(
  question: Question,
  responses: Response[]
): AggregatedData {
  const questionResponses = responses.filter(r => r.question_id === question.id);
  const counts: { [key: string]: number } = {};
  
  questionResponses.forEach(r => {
    counts[r.response_text] = (counts[r.response_text] || 0) + 1;
  });

  const total = questionResponses.length;
  const percentage: { [key: string]: number } = {};
  Object.keys(counts).forEach(key => {
    percentage[key] = total > 0 ? counts[key] / total : 0;
  });

  // Calculate sentiment score
  let sentiment_score: number | undefined;
  if (question.question_type === "Likert" && question.options) {
    // For Likert, calculate weighted average
    const scores = Object.entries(counts).map(([value, count]) => ({
      score: likertToScore(value),
      weight: count
    }));
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight > 0) {
      sentiment_score = scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;
    }
  } else if (question.options && Array.isArray(question.options)) {
    // For other single-select, use heuristic
    const scores = Object.entries(counts).map(([value, count]) => ({
      score: singleSelectToScore(value, question.options as string[]),
      weight: count
    }));
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight > 0) {
      sentiment_score = scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;
    }
  }

  return {
    counts,
    total,
    percentage,
    sentiment_score
  };
}

/**
 * Aggregate multi-select responses
 */
export function aggregateMultiSelect(
  question: Question,
  responses: Response[]
): AggregatedData {
  const questionResponses = responses.filter(r => r.question_id === question.id);
  const counts: { [key: string]: number } = {};
  
  questionResponses.forEach(r => {
    counts[r.response_text] = (counts[r.response_text] || 0) + 1;
  });

  const total = questionResponses.length;
  const percentage: { [key: string]: number } = {};
  Object.keys(counts).forEach(key => {
    percentage[key] = total > 0 ? counts[key] / total : 0;
  });

  return {
    counts,
    total,
    percentage
  };
}

/**
 * Aggregate budget allocation responses
 */
export function aggregateBudgetAllocation(
  question: Question,
  responses: Response[]
): AggregatedData & { averages: { [key: string]: number } } {
  const questionResponses = responses.filter(r => r.question_id === question.id);
  const totals: { [artistId: string]: number } = {};
  const counts: { [artistId: string]: number } = {};
  
  questionResponses.forEach(r => {
    try {
      const allocation = JSON.parse(r.response_text) as { [artistId: string]: number };
      Object.entries(allocation).forEach(([artistId, amount]) => {
        totals[artistId] = (totals[artistId] || 0) + amount;
        counts[artistId] = (counts[artistId] || 0) + 1;
      });
    } catch (e) {
      // Invalid JSON, skip
    }
  });

  const averages: { [key: string]: number } = {};
  Object.keys(totals).forEach(artistId => {
    averages[artistId] = counts[artistId] > 0 ? totals[artistId] / counts[artistId] : 0;
  });

  return {
    counts: totals, // Use totals as counts for budget
    total: questionResponses.length,
    percentage: {},
    average: Object.values(averages).reduce((sum, avg) => sum + avg, 0) / (Object.keys(averages).length || 1),
    averages
  } as AggregatedData & { averages: { [key: string]: number } };
}

/**
 * Aggregate all questions and compute overall statistics
 */
export function aggregateAll(
  questions: Question[],
  responses: Response[]
): { stats: AggregatedStats; overall: OverallStats } {
  const stats: AggregatedStats = {};
  const uniqueSubmissions = new Set(responses.map(r => r.submission_id));
  
  // Aggregate each question
  questions.forEach(question => {
    let aggregated: AggregatedData;
    
    switch (question.question_type) {
      case "Single-select":
      case "Likert":
        aggregated = aggregateSingleSelect(question, responses);
        break;
      case "Multi-select":
        aggregated = aggregateMultiSelect(question, responses);
        break;
      case "budget-allocation":
        aggregated = aggregateBudgetAllocation(question, responses);
        break;
      default:
        // Text/textarea - just count
        const textResponses = responses.filter(r => r.question_id === question.id);
        aggregated = {
          counts: {},
          total: textResponses.length,
          percentage: {}
        };
        break;
    }
    
    stats[question.id] = aggregated;
  });

  // Calculate overall satisfaction (average of all Likert/single-select sentiment scores)
  const sentimentScores: number[] = [];
  Object.entries(stats).forEach(([questionId, data]) => {
    if (data.sentiment_score !== undefined) {
      sentimentScores.push(data.sentiment_score);
    }
  });
  
  const overall_satisfaction = sentimentScores.length > 0
    ? sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length
    : 0.5; // Default neutral if no sentiment data

  // Find top positive and negative questions
  let top_positive: OverallStats["top_positive_question"] | undefined;
  let top_negative: OverallStats["top_negative_question"] | undefined;
  
  Object.entries(stats).forEach(([questionId, data]) => {
    if (data.sentiment_score !== undefined) {
      const question = questions.find(q => q.id === questionId);
      if (question) {
        if (!top_positive || data.sentiment_score > top_positive.sentiment_score) {
          top_positive = {
            question_id: questionId,
            question_text: question.question_text,
            sentiment_score: data.sentiment_score
          };
        }
        if (!top_negative || data.sentiment_score < top_negative.sentiment_score) {
          top_negative = {
            question_id: questionId,
            question_text: question.question_text,
            sentiment_score: data.sentiment_score
          };
        }
      }
    }
  });

  const overall: OverallStats = {
    total_responses: responses.length,
    unique_submissions: uniqueSubmissions.size,
    overall_satisfaction,
    response_rate: 1.0, // TODO: Calculate based on expected vs actual responses
    top_positive_question: top_positive,
    top_negative_question: top_negative
  };

  return { stats, overall };
}

/**
 * Get chart data for a question (for recharts)
 */
export function getChartData(question: Question, aggregated: AggregatedData): Array<{ name: string; value: number }> {
  if (question.question_type === "budget-allocation") {
    const budgetData = aggregated as AggregatedData & { averages?: { [key: string]: number } };
    const budgetOptions = question.options as { budget: number; artists: Array<{ id: string; name: string; imageUrl: string }> } | null;
    
    if (budgetOptions?.artists) {
      return budgetOptions.artists.map(artist => ({
        name: artist.name,
        value: aggregated.counts[artist.id] || 0
      }));
    }
    return [];
  }
  
  if (question.options && Array.isArray(question.options)) {
    return question.options.map(option => ({
      name: option,
      value: aggregated.counts[option] || 0
    }));
  }
  
  return Object.entries(aggregated.counts).map(([name, value]) => ({
    name,
    value
  }));
}


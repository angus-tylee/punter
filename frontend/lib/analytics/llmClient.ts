/**
 * API client for fetching LLM summary from backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type SummaryRequest = {
  panorama: {
    name: string;
    description?: string;
  };
  questions: Array<{
    id: string;
    question_text: string;
    question_type: string;
  }>;
  aggregated_stats: {
    overall_satisfaction: number;
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
    [key: string]: any;
  };
  text_samples: { [questionId: string]: string[] };
  response_count: number;
};

export type SummaryResponse = {
  summary: string;
  keyMetrics: Array<{
    label: string;
    value: string;
    type: "positive" | "negative" | "neutral";
  }>;
};

/**
 * Fetch LLM-generated summary from backend
 */
export async function fetchSummary(request: SummaryRequest): Promise<SummaryResponse> {
  try {
    // Extract panorama_id from request (we'll need to pass it separately)
    // For now, we'll need to get it from the URL or pass it as a parameter
    const response = await fetch(`${API_URL}/api/panoramas/${request.panorama.name}/analytics/summary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch summary: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching summary:", error);
    throw error;
  }
}

/**
 * Fetch summary with panorama ID
 */
export async function fetchSummaryById(
  panoramaId: string,
  request: Omit<SummaryRequest, "panorama"> & { panorama: SummaryRequest["panorama"] }
): Promise<SummaryResponse> {
  try {
    const response = await fetch(`${API_URL}/api/panoramas/${panoramaId}/analytics/summary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch summary: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching summary:", error);
    throw error;
  }
}


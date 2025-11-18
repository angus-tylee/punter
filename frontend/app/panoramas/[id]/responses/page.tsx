"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { aggregateAll, Question, Response as AnalyticsResponse, OverallStats } from "@/lib/analytics/aggregators";
import { generateInsight } from "@/lib/analytics/insightsGenerator";
import { generateDashboardConfig } from "@/lib/analytics/dashboardConfig";
import { analyzeWordFrequency } from "@/lib/analytics/textAnalyzer";
import ExecutiveSummary from "@/components/analytics/ExecutiveSummary";
import KeyMetrics from "@/components/analytics/KeyMetrics";
import QuickWins from "@/components/analytics/QuickWins";
import QuestionInsight from "@/components/analytics/QuestionInsight";
import WordCloud from "@/components/analytics/WordCloud";
import Toast from "@/components/ui/Toast";

type Response = {
  id: string;
  question_id: string;
  submission_id: string;
  response_text: string;
  created_at: string;
};

type ResponseGroup = {
  submission_id: string;
  created_at: string;
  responses: Response[];
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ResponsesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [panoramaName, setPanoramaName] = useState("");
  const [panoramaDescription, setPanoramaDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"insights" | "responses">("insights");
  const [viewMode, setViewMode] = useState<"by-question" | "by-submission">("by-submission");
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      // Load panorama data
      const { data: panoramaData } = await supabase
        .from("panoramas")
        .select("name, description")
        .eq("id", id)
        .maybeSingle();
      if (panoramaData) {
        setPanoramaName(panoramaData.name);
        setPanoramaDescription(panoramaData.description || "");
      }

      // Load questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("id,question_text,question_type,options,required,order")
        .eq("panorama_id", id)
        .order("order", { ascending: true });
      if (questionsError) console.error(questionsError);
      if (questionsData) {
        setQuestions((questionsData as Question[]) ?? []);
      }

      // Load responses
      const { data: responsesData, error: responsesError } = await supabase
        .from("responses")
        .select("id,question_id,submission_id,response_text,created_at")
        .eq("panorama_id", id)
        .order("created_at", { ascending: false });
      if (responsesError) console.error(responsesError);
      if (responsesData) {
        setResponses((responsesData as Response[]) ?? []);
      }

      if (!mounted) return;
      setLoading(false);
    };
    if (id) void load();
    return () => {
      mounted = false;
    };
  }, [id, router]);

  // Compute analytics
  const analytics = useMemo(() => {
    if (questions.length === 0 || responses.length === 0) {
      return null;
    }

    // Aggregate all data
    const { stats, overall } = aggregateAll(questions, responses);

    // Generate insights for each question
    const insights: { [questionId: string]: ReturnType<typeof generateInsight> } = {};
    const uniqueSubmissions = new Set(responses.map(r => r.submission_id));
    
    questions.forEach(question => {
      const aggregated = stats[question.id];
      if (aggregated) {
        insights[question.id] = generateInsight(
          question,
          aggregated,
          uniqueSubmissions.size
        );
      }
    });

    // Generate dashboard config
    const dashboardConfig = generateDashboardConfig(
      questions,
      stats,
      insights,
      overall,
      uniqueSubmissions.size
    );

    // Sample text responses for LLM (max 30 per question)
    const textSamples: { [questionId: string]: string[] } = {};
    questions.forEach(question => {
      if (question.question_type === "text" || question.question_type === "textarea") {
        const questionResponses = responses
          .filter(r => r.question_id === question.id)
          .slice(0, 30)
          .map(r => r.response_text);
        if (questionResponses.length > 0) {
          textSamples[question.id] = questionResponses;
        }
      }
    });

    return {
      stats,
      overall,
      insights,
      dashboardConfig,
      textSamples,
      uniqueSubmissions: uniqueSubmissions.size
    };
  }, [questions, responses]);

  // Get responses by question for responses tab
  const getResponsesByQuestion = () => {
    const questionMap: { [key: string]: { question: Question; responses: Response[] } } = {};
    questions.forEach((q) => {
      questionMap[q.id] = { question: q, responses: [] };
    });
    responses.forEach((r) => {
      if (questionMap[r.question_id]) {
        questionMap[r.question_id].responses.push(r);
      }
    });
    return Object.values(questionMap).sort(
      (a, b) => a.question.order - b.question.order
    );
  };

  const getResponsesBySubmission = (): ResponseGroup[] => {
    const groups: { [key: string]: ResponseGroup } = {};
    responses.forEach((r) => {
      if (!groups[r.submission_id]) {
        groups[r.submission_id] = {
          submission_id: r.submission_id,
          created_at: r.created_at,
          responses: [],
        };
      }
      groups[r.submission_id].responses.push(r);
    });
    return Object.values(groups).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const getQuestionText = (questionId: string) => {
    const q = questions.find((q) => q.id === questionId);
    return q?.question_text || "Unknown question";
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <Link className="underline text-sm" href={`/panoramas/${id}`}>Back</Link>
      </div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Responses: {panoramaName}</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-4 mb-6 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab("insights")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "insights"
              ? "border-black dark:border-white text-black dark:text-white"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Insights
        </button>
        <button
          onClick={() => setActiveTab("responses")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "responses"
              ? "border-black dark:border-white text-black dark:text-white"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Responses
        </button>
      </div>

      {activeTab === "insights" ? (
        <div className="space-y-8">
          {responses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No responses yet. The analytics dashboard will appear here once responses are collected.
              </p>
            </div>
          ) : analytics ? (
            <>
              {/* Executive Summary */}
              <ExecutiveSummary
                panoramaId={id}
                panoramaName={panoramaName}
                summaryRequest={{
                  panorama: {
                    name: panoramaName,
                    description: panoramaDescription,
                  },
                  questions: questions.map(q => ({
                    id: q.id,
                    question_text: q.question_text,
                    question_type: q.question_type,
                  })),
                  aggregated_stats: {
                    overall_satisfaction: analytics.overall.overall_satisfaction,
                    top_positive_question: analytics.overall.top_positive_question,
                    top_negative_question: analytics.overall.top_negative_question,
                  },
                  text_samples: analytics.textSamples,
                  response_count: analytics.overall.total_responses,
                }}
              />

              {/* Key Metrics */}
              <KeyMetrics overall={analytics.overall} />

              {/* Quick Wins */}
              <QuickWins
                positives={analytics.dashboardConfig.quickWins.positives}
                negatives={analytics.dashboardConfig.quickWins.negatives}
              />

              {/* Question Insights (Priority Ordered) */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Detailed Insights
                </h2>
                {analytics.dashboardConfig.questions.map(({ question, aggregated, insight }) => {
                  // For text questions, add word cloud
                  if (
                    (question.question_type === "text" ||
                      question.question_type === "textarea") &&
                    aggregated.total > 0
                  ) {
                    const textResponses = responses
                      .filter(r => r.question_id === question.id)
                      .map(r => r.response_text);
                    const wordAnalysis = analyzeWordFrequency(textResponses);

                    return (
                      <div key={question.id} className="space-y-4">
                        <QuestionInsight
                          question={question}
                          aggregated={aggregated}
                          insight={insight}
                        />
                        <WordCloud wordFrequencies={wordAnalysis.wordFrequencies} />
                      </div>
                    );
                  }

                  return (
                    <QuestionInsight
                      key={question.id}
                      question={question}
                      aggregated={aggregated}
                      insight={insight}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Loading analytics...</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode("by-submission")}
                className={`text-sm underline ${viewMode === "by-submission" ? "font-semibold" : ""}`}
              >
                By Submission
              </button>
              <button
                onClick={() => setViewMode("by-question")}
                className={`text-sm underline ${viewMode === "by-question" ? "font-semibold" : ""}`}
              >
                By Question
              </button>
            </div>
          </div>

          {responses.length === 0 ? (
            <p className="text-sm text-gray-500">No responses yet.</p>
          ) : viewMode === "by-submission" ? (
            <div className="space-y-4">
              {getResponsesBySubmission().map((group) => (
                <div key={group.submission_id} className="rounded border border-gray-200 dark:border-gray-800 p-4">
                  <div className="text-xs text-gray-500 mb-3">
                    Submitted: {new Date(group.created_at).toLocaleString()}
                  </div>
                  <div className="space-y-2">
                    {group.responses.map((r) => {
                      const question = questions.find(q => q.id === r.question_id);
                      let displayText = r.response_text;
                      
                      // Format budget allocation responses
                      if (question?.question_type === "budget-allocation") {
                        try {
                          const allocation = JSON.parse(r.response_text) as { [artistId: string]: number };
                          const budgetOptions = question.options as { budget: number; artists: Array<{ id: string; name: string; imageUrl: string }> } | null;
                          if (budgetOptions?.artists) {
                            const artistNames = Object.entries(allocation)
                              .map(([artistId, amount]) => {
                                const artist = budgetOptions.artists.find(a => a.id === artistId);
                                return artist ? `${artist.name}: $${amount}` : null;
                              })
                              .filter(Boolean);
                            displayText = artistNames.join(", ") || r.response_text;
                          }
                        } catch (e) {
                          // Invalid JSON, use raw text
                        }
                      }
                      
                      return (
                        <div key={r.id} className="text-sm">
                          <span className="font-medium">{getQuestionText(r.question_id)}: </span>
                          <span>{displayText}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {getResponsesByQuestion().map(({ question, responses: questionResponses }) => (
                <div key={question.id} className="rounded border border-gray-200 dark:border-gray-800 p-4">
                  <div className="font-medium mb-2">
                    {question.question_text}
                    <span className="text-xs text-gray-500 ml-2">
                      ({questionResponses.length} {questionResponses.length === 1 ? "response" : "responses"})
                    </span>
                  </div>
                  <div className="space-y-2 mt-3">
                    {questionResponses.map((r) => (
                      <div key={r.id} className="text-sm pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                        {r.response_text}
                        <span className="text-xs text-gray-500 ml-2">
                          ({new Date(r.created_at).toLocaleString()})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type Question = {
  id: string;
  question_text: string;
  question_type: "text" | "textarea" | "Single-select" | "Multi-select";
  options: string[] | null;
  required: boolean;
  order: number;
};

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

export default function ResponsesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [panoramaName, setPanoramaName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"insights" | "responses">("insights");
  const [viewMode, setViewMode] = useState<"by-question" | "by-submission">("by-submission");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      // Load panorama name
      const { data: panoramaData } = await supabase
        .from("panoramas")
        .select("name")
        .eq("id", id)
        .maybeSingle();
      if (panoramaData) {
        setPanoramaName(panoramaData.name);
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

  // Summary statistics
  const summaryStats = useMemo(() => {
    const uniqueSubmissions = new Set(responses.map(r => r.submission_id));
    return {
      totalResponses: responses.length,
      uniqueSubmissions: uniqueSubmissions.size,
    };
  }, [responses]);

  // Aggregate single-select responses
  const aggregateSingleSelect = (question: Question) => {
    const questionResponses = responses.filter(r => r.question_id === question.id);
    const counts: { [key: string]: number } = {};
    
    questionResponses.forEach(r => {
      counts[r.response_text] = (counts[r.response_text] || 0) + 1;
    });

    return question.options?.map(option => ({
      name: option,
      value: counts[option] || 0,
    })) || [];
  };

  // Aggregate multi-select responses
  const aggregateMultiSelect = (question: Question) => {
    const questionResponses = responses.filter(r => r.question_id === question.id);
    const counts: { [key: string]: number } = {};
    
    questionResponses.forEach(r => {
      counts[r.response_text] = (counts[r.response_text] || 0) + 1;
    });

    return question.options?.map(option => ({
      name: option,
      value: counts[option] || 0,
    })) || [];
  };

  // Get responses by question for insights
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
        <div className="space-y-6">
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Responses</div>
              <div className="text-2xl font-semibold">{summaryStats.totalResponses}</div>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Unique Submissions</div>
              <div className="text-2xl font-semibold">{summaryStats.uniqueSubmissions}</div>
            </div>
          </div>

          {responses.length === 0 ? (
            <p className="text-sm text-gray-500">No responses yet. Charts will appear here once responses are collected.</p>
          ) : (
            <div className="space-y-6">
              {getResponsesByQuestion().map(({ question, responses: questionResponses }) => (
                <div key={question.id} className="rounded border border-gray-200 dark:border-gray-800 p-4">
                  <div className="font-medium mb-4">
                    {question.question_text}
                    <span className="text-xs text-gray-500 ml-2 font-normal">
                      ({questionResponses.length} {questionResponses.length === 1 ? "response" : "responses"})
                    </span>
                  </div>

                  {question.question_type === "Single-select" && question.options && (
                    <div className="mt-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={aggregateSingleSelect(question)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {aggregateSingleSelect(question).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {question.question_type === "Multi-select" && question.options && (
                    <div className="mt-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={aggregateMultiSelect(question)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {(question.question_type === "text" || question.question_type === "textarea") && (
                    <div className="mt-4 space-y-2">
                      <div className="text-sm text-gray-500 mb-2">Top Responses:</div>
                      {questionResponses.slice(0, 5).map((r) => (
                        <div key={r.id} className="text-sm pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                          {r.response_text}
                        </div>
                      ))}
                      {questionResponses.length > 5 && (
                        <div className="text-xs text-gray-500 mt-2">
                          ... and {questionResponses.length - 5} more responses
                        </div>
                      )}
                      {/* Fake word frequency for MVP */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <div className="text-sm text-gray-500 mb-2">Word Frequency (Sample):</div>
                        <div className="flex flex-wrap gap-2">
                          {["excellent", "good", "satisfactory", "needs improvement"].map((word, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                              {word} ({Math.floor(Math.random() * 20) + 5})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
                    {group.responses.map((r) => (
                      <div key={r.id} className="text-sm">
                        <span className="font-medium">{getQuestionText(r.question_id)}: </span>
                        <span>{r.response_text}</span>
                      </div>
                    ))}
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

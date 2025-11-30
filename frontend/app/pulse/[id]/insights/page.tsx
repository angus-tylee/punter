// PULSE FEATURE - HIBERNATED
// This feature is currently hibernated due to Meta App Review requirements.
// See PULSE_HIBERNATION.md for re-enablement instructions.

"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type PulseQuestion = {
  id: string;
  question_text: string;
  question_type: "text" | "Single-select";
  options: string[] | null;
  order: number;
};

type PulseResponse = {
  id: string;
  question_id: string;
  submission_id: string;
  instagram_user_id: string;
  instagram_username: string | null;
  response_text: string;
  created_at: string;
};

type PulseConversation = {
  id: string;
  instagram_user_id: string;
  instagram_username: string | null;
  status: "invited" | "in_progress" | "completed" | "abandoned";
  current_question_index: number;
  submission_id: string;
  created_at: string;
  last_interaction_at: string;
};

export default function PulseInsightsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [pulseName, setPulseName] = useState("");
  const [questions, setQuestions] = useState<PulseQuestion[]>([]);
  const [responses, setResponses] = useState<PulseResponse[]>([]);
  const [conversations, setConversations] = useState<PulseConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      try {
        // Load pulse data
        const { data: pulseData } = await supabase
          .from("pulses")
          .select("name")
          .eq("id", id)
          .maybeSingle();
        if (pulseData) {
          setPulseName(pulseData.name);
        }

        // Load responses from API
        const response = await fetch(`${API_URL}/api/pulse/${id}/responses`);
        if (!response.ok) {
          throw new Error("Failed to load responses");
        }

        const data = await response.json();
        if (!mounted) return;

        setQuestions(data.questions || []);
        setResponses(data.responses || []);
        setConversations(data.conversations || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load insights");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (id) void load();
    return () => {
      mounted = false;
    };
  }, [id, router]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalResponses = responses.length;
    const uniqueSubmissions = new Set(responses.map(r => r.submission_id)).size;
    const completedConversations = conversations.filter(c => c.status === "completed").length;
    const totalConversations = conversations.length;
    const completionRate = totalConversations > 0 
      ? Math.round((completedConversations / totalConversations) * 100) 
      : 0;

    // Group responses by question
    const responsesByQuestion: Record<string, PulseResponse[]> = {};
    responses.forEach(response => {
      if (!responsesByQuestion[response.question_id]) {
        responsesByQuestion[response.question_id] = [];
      }
      responsesByQuestion[response.question_id].push(response);
    });

    // Count responses for single-select questions
    const questionCounts: Record<string, Record<string, number>> = {};
    questions.forEach(question => {
      if (question.question_type === "Single-select" && question.options) {
        const counts: Record<string, number> = {};
        question.options.forEach(option => {
          counts[option] = 0;
        });
        if (responsesByQuestion[question.id]) {
          responsesByQuestion[question.id].forEach(response => {
            const option = response.response_text.trim();
            if (counts.hasOwnProperty(option)) {
              counts[option]++;
            }
          });
        }
        questionCounts[question.id] = counts;
      }
    });

    return {
      totalResponses,
      uniqueSubmissions,
      completedConversations,
      totalConversations,
      completionRate,
      responsesByQuestion,
      questionCounts
    };
  }, [responses, questions, conversations]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p>Loading insights...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-red-500">{error}</p>
        <Link href={`/pulse/${id}`} className="underline text-sm mt-4 inline-block">Back to Pulse</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-4">
        <Link href={`/pulse/${id}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          ← Back to Pulse
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Pulse Insights: {pulseName}</h1>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Responses</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.totalResponses}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Unique Submissions</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.uniqueSubmissions}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.completedConversations}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Completion Rate</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.completionRate}%</div>
        </div>
      </div>

      {/* Question-by-Question Breakdown */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Question Breakdown</h2>
        <div className="space-y-4">
          {questions.map((question, index) => {
            const questionResponses = summary.responsesByQuestion[question.id] || [];
            const questionCounts = summary.questionCounts[question.id];

            return (
              <div key={question.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Question {index + 1}
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {question.question_type}
                    </span>
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">{question.question_text}</p>
                </div>

                {question.question_type === "Single-select" && questionCounts ? (
                  <div className="space-y-2">
                    {Object.entries(questionCounts).map(([option, count]) => (
                      <div key={option} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                              style={{
                                width: `${questionResponses.length > 0 ? (count / questionResponses.length) * 100 : 0}%`
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-8 text-right">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Total responses: {questionResponses.length}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {questionResponses.slice(0, 10).map((response) => (
                      <div key={response.id} className="text-sm text-gray-700 dark:text-gray-300 border-l-2 border-gray-200 dark:border-gray-700 pl-3 py-1">
                        {response.response_text}
                      </div>
                    ))}
                    {questionResponses.length > 10 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        ... and {questionResponses.length - 10} more responses
                      </div>
                    )}
                    {questionResponses.length === 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">No responses yet</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversations List */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Conversations</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No conversations yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Progress</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Interaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {conversations.map((conv) => (
                    <tr key={conv.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {conv.instagram_username || conv.instagram_user_id}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          conv.status === "completed" ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" :
                          conv.status === "in_progress" ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200" :
                          conv.status === "invited" ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200" :
                          "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        }`}>
                          {conv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {conv.current_question_index + 1} / {questions.length}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(conv.last_interaction_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}


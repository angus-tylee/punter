// PULSE FEATURE - HIBERNATED
// This feature is currently hibernated due to Meta App Review requirements.
// See PULSE_HIBERNATION.md for re-enablement instructions.

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type StagingPulseQuestion = {
  id: string;
  question_text: string;
  question_type: "text" | "Single-select";
  options?: string[] | null;
  required: boolean;
  order: number;
  isEditing?: boolean;
};

export default function PulseStagingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const pulseId = params?.id as string;

  const [questions, setQuestions] = useState<StagingPulseQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulseName, setPulseName] = useState("");

  // Load questions from query params
  useEffect(() => {
    const questionsParam = searchParams.get("questions");
    if (questionsParam) {
      try {
        const loadedQuestions = JSON.parse(decodeURIComponent(questionsParam)) as StagingPulseQuestion[];
        const questionsWithIds = loadedQuestions.map((q, i) => ({
          ...q,
          id: `temp-${i}-${Date.now()}`,
          order: i
        }));
        setQuestions(questionsWithIds);
        setLoading(false);
      } catch (e) {
        setError("Failed to load questions");
        setLoading(false);
      }
    } else {
      setError("No questions provided");
      setLoading(false);
    }
  }, [searchParams]);

  // Load pulse name
  useEffect(() => {
    setPulseName("Your Pulse Survey");
  }, [pulseId]);

  const handleEdit = (question: StagingPulseQuestion, newText: string) => {
    setQuestions(prev =>
      prev.map(q => q.id === question.id ? { ...q, question_text: newText } : q)
    );
  };

  const handleDelete = (question: StagingPulseQuestion) => {
    setQuestions(prev => prev.filter(q => q.id !== question.id));
  };

  const handleSave = async () => {
    if (questions.length === 0) {
      setError("Please keep at least one question before saving");
      return;
    }

    const confirmed = window.confirm(
      `Save ${questions.length} question${questions.length === 1 ? '' : 's'} to your Pulse survey?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/pulse/${pulseId}/save-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          questions: questions.map(({ id, isEditing, ...q }) => q)
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to save questions" }));
        throw new Error(errorData.detail || "Failed to save questions");
      }

      // Redirect to pulse detail page
      router.push(`/pulse/${pulseId}`);
    } catch (err: any) {
      setError(err.message || "Failed to save Pulse survey. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p>Loading...</p>
      </main>
    );
  }

  if (error && questions.length === 0) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-red-500">{error}</p>
        <Link href="/pulse" className="underline text-sm mt-4 inline-block">Back to Pulse Surveys</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mb-8">
        <Link href="/pulse" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          ← Back to Pulse Surveys
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
          Review Your Pulse Survey
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Review and adjust your questions before saving. These will be delivered via Instagram DMs.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {questions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-sm">No questions remaining</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Question {index + 1}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {question.question_type}
                      </span>
                    </div>
                    {question.isEditing ? (
                      <input
                        type="text"
                        value={question.question_text}
                        onChange={(e) => handleEdit(question, e.target.value)}
                        onBlur={() => setQuestions(prev =>
                          prev.map(q => q.id === question.id ? { ...q, isEditing: false } : q)
                        )}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                        autoFocus
                      />
                    ) : (
                      <p
                        className="text-gray-900 dark:text-gray-100 cursor-pointer"
                        onClick={() => setQuestions(prev =>
                          prev.map(q => q.id === question.id ? { ...q, isEditing: true } : q)
                        )}
                      >
                        {question.question_text}
                      </p>
                    )}
                    {question.question_type === "Single-select" && question.options && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Options:</span> {question.options.join(", ")}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(question)}
                    className="ml-4 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-gray-100">{questions.length}</span> question{questions.length === 1 ? '' : 's'}
        </div>
        <div className="flex gap-3">
          <Link
            href={`/pulse/${pulseId}`}
            className="px-4 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || questions.length === 0}
            className="px-6 py-2 rounded-md text-sm font-medium text-white bg-blue-700 dark:bg-blue-600 hover:bg-blue-800 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Pulse Survey"}
          </button>
        </div>
      </div>
    </main>
  );
}


"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StagingQuestion } from "./utils";
import QuestionCard from "./QuestionCard";
import CategoryStatusBar from "./CategoryStatusBar";
import TipsCallout from "./TipsCallout";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function StagingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const panoramaId = params?.id as string;

  const [questions, setQuestions] = useState<StagingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panoramaName, setPanoramaName] = useState("");

  // Load questions from query params - all questions are accepted by default
  useEffect(() => {
    const questionsParam = searchParams.get("questions");
    if (questionsParam) {
      try {
        const loadedQuestions = JSON.parse(decodeURIComponent(questionsParam)) as StagingQuestion[];
        // Add temporary IDs for tracking and set all as accepted
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

  // Load panorama name
  useEffect(() => {
    // Could fetch from API if needed, but for now we'll use a placeholder
    setPanoramaName("Your Survey");
  }, [panoramaId]);

  const handleEdit = (question: StagingQuestion, newText: string) => {
    setQuestions(prev =>
      prev.map(q => q.id === question.id ? { ...q, question_text: newText } : q)
    );
  };

  const handleDelete = (question: StagingQuestion) => {
    setQuestions(prev => prev.filter(q => q.id !== question.id));
  };

  const handleSave = async () => {
    if (questions.length === 0) {
      setError("Please keep at least one question before saving");
      return;
    }

    const confirmed = window.confirm(
      `Save ${questions.length} question${questions.length === 1 ? '' : 's'} to your survey?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/panoramas/${panoramaId}/save-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          questions: questions.map(({ id, isEditing, category, ...q }) => q)
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to save questions" }));
        throw new Error(errorData.detail || "Failed to save questions");
      }

      // Redirect to panorama detail page
      router.push(`/panoramas/${panoramaId}`);
    } catch (err: any) {
      setError(err.message || "Failed to save survey. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p>Loading...</p>
      </main>
    );
  }

  if (error && questions.length === 0) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-red-500">{error}</p>
        <Link href="/" className="underline text-sm mt-4 inline-block">Back to Panoramas</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          ← Back to Panoramas
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
          Review Your Survey
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Make any final adjustments before saving
        </p>
      </div>

      <TipsCallout />

      <div className="mb-6">
        <CategoryStatusBar questions={questions} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {questions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-sm">No questions remaining</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
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
            href={`/panoramas/${panoramaId}`}
            className="px-4 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || questions.length === 0}
            className="px-6 py-2 rounded-md text-sm font-medium text-white bg-blue-700 dark:bg-blue-600 hover:bg-blue-800 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Survey"}
          </button>
        </div>
      </div>
    </main>
  );
}


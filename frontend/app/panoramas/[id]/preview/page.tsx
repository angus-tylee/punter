"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SurveyLayout from "@/components/survey/SurveyLayout";
import PreviewBanner from "@/components/survey/PreviewBanner";

type Question = {
  id: string;
  question_text: string;
  question_type: "text" | "textarea" | "Single-select" | "Multi-select" | "Likert" | "budget-allocation";
  options: string[] | any | null;
  required: boolean;
  order: number;
};

type Panorama = {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
};

export default function PreviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [panorama, setPanorama] = useState<Panorama | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<{ [questionId: string]: string | string[] | { [key: string]: number } }>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // Check authentication
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        if (!mounted) return;
        setError("You must be logged in to preview surveys");
        setLoading(false);
        return;
      }

      // Load panorama
      const { data: panoramaData, error: panoramaError } = await supabase
        .from("panoramas")
        .select("id,name,description,status")
        .eq("id", id)
        .maybeSingle();
      
      if (panoramaError || !panoramaData) {
        if (!mounted) return;
        setError("Panorama not found");
        setLoading(false);
        return;
      }

      // RLS will enforce ownership - if the query succeeds, the user has access
      setPanorama(panoramaData as Panorama);

      // Load questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("id,question_text,question_type,options,required,order")
        .eq("panorama_id", id)
        .order("order", { ascending: true });

      if (questionsError) {
        console.error(questionsError);
        if (!mounted) return;
        setError("Failed to load questions");
        setLoading(false);
        return;
      }

      if (!mounted) return;
      setQuestions((questionsData as Question[]) ?? []);
      setLoading(false);
    };
    if (id) void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    // Validate required questions (same validation as live survey)
    for (const q of questions) {
      if (q.required) {
        const response = responses[q.id];
        if (!response) {
          setError(`Please answer the required question: ${q.question_text}`);
          setSubmitting(false);
          return;
        }
        
        // Check for empty arrays
        if (Array.isArray(response) && response.length === 0) {
          setError(`Please answer the required question: ${q.question_text}`);
          setSubmitting(false);
          return;
        }
        
        // Check for empty budget allocation
        if (q.question_type === "budget-allocation") {
          const allocation = response as { [key: string]: number };
          const total = Object.values(allocation || {}).reduce((sum, val) => sum + val, 0);
          if (total === 0) {
            setError(`Please allocate your budget for: ${q.question_text}`);
            setSubmitting(false);
            return;
          }
        }
      }
    }

    // In preview mode, skip database insertion and sessionStorage
    // Just navigate to thank you page with preview flag
    setSubmitting(false);
    router.push(`/panoramas/${id}/thank-you?preview=true`);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6 min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading preview...</p>
      </main>
    );
  }

  if (error && !panorama) {
    return (
      <main className="mx-auto max-w-2xl p-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push(`/panoramas/${id}`)}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Editor
          </button>
        </div>
      </main>
    );
  }

  if (!panorama) {
    return (
      <main className="mx-auto max-w-2xl p-6 min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading preview...</p>
      </main>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <PreviewBanner />
        <main className="mx-auto max-w-2xl p-6 min-h-screen flex items-center justify-center pt-16">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No questions available for preview</p>
            <button
              onClick={() => router.push(`/panoramas/${id}`)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Back to Editor
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <PreviewBanner />
      
      {/* Header with panorama info */}
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-semibold mb-1">{panorama.name}</h1>
        {panorama.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{panorama.description}</p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Survey Layout */}
      <SurveyLayout
        questions={questions}
        responses={responses}
        onResponseChange={handleResponseChange}
        onSubmit={handleSubmit}
        isSubmitting={submitting}
      />
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SurveyLayout from "@/components/survey/SurveyLayout";

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

export default function RespondPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [panorama, setPanorama] = useState<Panorama | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionId] = useState(() => crypto.randomUUID());
  const [responses, setResponses] = useState<{ [questionId: string]: string | string[] | { [key: string]: number } }>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // Check if submission already completed (prevent resubmission on browser back)
      const submissionFlag = sessionStorage.getItem(`submission_${id}`);
      const expirationTime = sessionStorage.getItem(`submission_${id}_expires`);
      
      if (submissionFlag) {
        // Check if expiration time exists and has passed
        if (expirationTime) {
          const expires = parseInt(expirationTime, 10);
          if (Date.now() > expires) {
            // Expired, clear flags and allow new submission
            sessionStorage.removeItem(`submission_${id}`);
            sessionStorage.removeItem(`submission_${id}_expires`);
          } else {
            // Still valid, redirect to thank you page
            router.push(`/panoramas/${id}/thank-you`);
            return;
          }
        } else {
          // No expiration, but flag exists, redirect to thank you page
          router.push(`/panoramas/${id}/thank-you`);
          return;
        }
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

      if (panoramaData.status !== "active") {
        if (!mounted) return;
        setError("This panorama is not accepting responses");
        setLoading(false);
        return;
      }

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
  }, [id, router]);

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    // Validate required questions
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

    // Prepare response rows
    const responseRows: Array<{
      panorama_id: string;
      question_id: string;
      submission_id: string;
      response_text: string;
    }> = [];

    for (const q of questions) {
      const response = responses[q.id];
      if (!response) continue;

      if (q.question_type === "Multi-select" && Array.isArray(response)) {
        // Create one row per selected option
        for (const option of response) {
          responseRows.push({
            panorama_id: id,
            question_id: q.id,
            submission_id: submissionId,
            response_text: option,
          });
        }
      } else if (q.question_type === "budget-allocation") {
        // Store budget allocation as JSON
        const allocation = response as { [key: string]: number };
        responseRows.push({
          panorama_id: id,
          question_id: q.id,
          submission_id: submissionId,
          response_text: JSON.stringify(allocation),
        });
      } else {
        // Single response (text, textarea, single-select, Likert)
        responseRows.push({
          panorama_id: id,
          question_id: q.id,
          submission_id: submissionId,
          response_text: Array.isArray(response) ? response[0] : String(response),
        });
      }
    }

    // Check if already submitted (prevent duplicate submissions)
    const submissionFlag = sessionStorage.getItem(`submission_${id}`);
    const expirationTime = sessionStorage.getItem(`submission_${id}_expires`);
    
    if (submissionFlag) {
      // Check if expiration time exists and has passed
      if (expirationTime) {
        const expires = parseInt(expirationTime, 10);
        if (Date.now() <= expires) {
          // Still valid, redirect to thank you page
          router.push(`/panoramas/${id}/thank-you`);
          return;
        } else {
          // Expired, clear flags and allow new submission
          sessionStorage.removeItem(`submission_${id}`);
          sessionStorage.removeItem(`submission_${id}_expires`);
        }
      } else {
        // No expiration, but flag exists, redirect to thank you page
        router.push(`/panoramas/${id}/thank-you`);
        return;
      }
    }

    // Insert all responses
    const { error: insertError } = await supabase
      .from("responses")
      .insert(responseRows);

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    // Success - set sessionStorage flag and redirect to thank you page
    sessionStorage.setItem(`submission_${id}`, "true");
    // Set expiration (1 hour)
    const newExpirationTime = Date.now() + 60 * 60 * 1000;
    sessionStorage.setItem(`submission_${id}_expires`, newExpirationTime.toString());
    
    router.push(`/panoramas/${id}/thank-you`);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6 min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading survey...</p>
      </main>
    );
  }

  if (error && !panorama) {
    return (
      <main className="mx-auto max-w-2xl p-6 min-h-screen flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  if (!panorama || questions.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-6 min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">No questions available</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header with panorama info */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
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


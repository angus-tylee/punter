"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Question = {
  id: string;
  question_text: string;
  question_type: "text" | "textarea" | "Single-select" | "Multi-select" | "Likert";
  options: string[] | null;
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
  const [responses, setResponses] = useState<{ [questionId: string]: string | string[] }>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
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
  }, [id]);

  const handleResponseChange = (questionId: string, value: string | string[]) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleMultiSelectChange = (questionId: string, option: string, checked: boolean) => {
    const current = (responses[questionId] as string[]) || [];
    if (checked) {
      handleResponseChange(questionId, [...current, option]);
    } else {
      handleResponseChange(
        questionId,
        current.filter((o) => o !== option)
      );
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Validate required questions
    for (const q of questions) {
      if (q.required) {
        const response = responses[q.id];
        if (!response || (Array.isArray(response) && response.length === 0)) {
          setError(`Please answer the required question: ${q.question_text}`);
          setSubmitting(false);
          return;
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
      } else {
        // Single response (text, textarea, single-select)
        responseRows.push({
          panorama_id: id,
          question_id: q.id,
          submission_id: submissionId,
          response_text: Array.isArray(response) ? response[0] : response,
        });
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

    // Success - show message and redirect
    alert("Thank you! Your response has been submitted.");
    router.push("/");
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p>Loading...</p>
      </main>
    );
  }

  if (error && !panorama) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  if (!panorama) return null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold mb-2">{panorama.name}</h1>
      {panorama.description && (
        <p className="text-gray-600 dark:text-gray-400 mb-6">{panorama.description}</p>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {questions.map((q) => (
          <div key={q.id} className="space-y-2">
            <label className="block text-sm font-medium">
              {q.question_text}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {q.question_type === "text" && (
              <input
                type="text"
                value={(responses[q.id] as string) || ""}
                onChange={(e) => handleResponseChange(q.id, e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                required={q.required}
              />
            )}

            {q.question_type === "textarea" && (
              <textarea
                value={(responses[q.id] as string) || ""}
                onChange={(e) => handleResponseChange(q.id, e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[120px]"
                required={q.required}
              />
            )}

            {q.question_type === "Single-select" && q.options && (
              <select
                value={(responses[q.id] as string) || ""}
                onChange={(e) => handleResponseChange(q.id, e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                required={q.required}
              >
                <option value="">Select an option</option>
                {q.options.map((option, idx) => (
                  <option key={idx} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}

            {q.question_type === "Multi-select" && q.options && (
              <div className="space-y-2">
                {q.options.map((option, idx) => {
                  const selected = (responses[q.id] as string[]) || [];
                  return (
                    <label key={idx} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(option)}
                        onChange={(e) => handleMultiSelectChange(q.id, option, e.target.checked)}
                        className="rounded"
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.question_type === "Likert" && q.options && (
              <div className="flex flex-wrap gap-4 items-center">
                {q.options.map((option, idx) => (
                  <label key={idx} className="flex flex-col items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      value={option}
                      checked={(responses[q.id] as string) === option}
                      onChange={(e) => handleResponseChange(q.id, e.target.value)}
                      className="rounded"
                      required={q.required}
                    />
                    <span className="text-xs text-center max-w-[100px]">{option}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Response"}
        </button>
      </form>
    </main>
  );
}


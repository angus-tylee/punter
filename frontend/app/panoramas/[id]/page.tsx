"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Panorama = {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  updated_at: string;
};

type Question = {
  id: string;
  question_text: string;
  question_type: "text" | "textarea" | "Single-select" | "Multi-select";
  options: string[] | null;
  required: boolean;
  order: number;
};

export default function PanoramaDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [item, setItem] = useState<Panorama | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<"text" | "textarea" | "Single-select" | "Multi-select">("text");
  const [questionOptions, setQuestionOptions] = useState("");
  const [questionRequired, setQuestionRequired] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("panoramas")
        .select("id,name,description,status,updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) console.error(error);
      if (!mounted) return;
      if (!data) {
        setError("Not found");
      } else {
        setItem(data as Panorama);
        setName((data as Panorama).name);
        setDescription(((data as Panorama).description ?? "") as string);
        setStatus((data as Panorama).status);
      }
      setLoading(false);
    };
    if (id) void load();
    return () => {
      mounted = false;
    };
  }, [id, router]);

  useEffect(() => {
    let mounted = true;
    const loadQuestions = async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id,question_text,question_type,options,required,order")
        .eq("panorama_id", id)
        .order("order", { ascending: true });
      if (error) console.error(error);
      if (!mounted) return;
      setQuestions((data as Question[]) ?? []);
      setLoadingQuestions(false);
    };
    if (id) void loadQuestions();
    return () => {
      mounted = false;
    };
  }, [id]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setSaving(true);
    const { error } = await supabase
      .from("panoramas")
      .update({
        name: name.trim(),
        description: description || null,
        status
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMsg("Saved");
    setTimeout(() => setMsg(null), 1500);
  };

  const onSoftDelete = async () => {
    setError(null);
    const { error } = await supabase
      .from("panoramas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
  };

  const loadQuestions = async () => {
    const { data, error } = await supabase
      .from("questions")
      .select("id,question_text,question_type,options,required,order")
      .eq("panorama_id", id)
      .order("order", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setQuestions((data as Question[]) ?? []);
  };

  const startAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionText("");
    setQuestionType("text");
    setQuestionOptions("");
    setQuestionRequired(false);
    setShowQuestionForm(true);
  };

  const startEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQuestionText(q.question_text);
    setQuestionType(q.question_type);
    setQuestionOptions(q.options ? q.options.join("\n") : "");
    setQuestionRequired(q.required);
    setShowQuestionForm(true);
  };

  const cancelQuestionForm = () => {
    setShowQuestionForm(false);
    setEditingQuestion(null);
    setQuestionText("");
    setQuestionType("text");
    setQuestionOptions("");
    setQuestionRequired(false);
  };

  const onSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingQuestion(true);
    const options = (questionType === "Single-select" || questionType === "Multi-select") && questionOptions.trim()
      ? questionOptions.split("\n").map(o => o.trim()).filter(o => o)
      : null;

    if (editingQuestion) {
      const { error } = await supabase
        .from("questions")
        .update({
          question_text: questionText.trim(),
          question_type: questionType,
          options: options,
          required: questionRequired
        })
        .eq("id", editingQuestion.id);
      if (error) {
        setError(error.message);
        setSavingQuestion(false);
        return;
      }
    } else {
      const maxOrder = questions.length > 0 ? Math.max(...questions.map(q => q.order)) : -1;
      const { error } = await supabase
        .from("questions")
        .insert({
          panorama_id: id,
          question_text: questionText.trim(),
          question_type: questionType,
          options: options,
          required: questionRequired,
          order: maxOrder + 1
        });
      if (error) {
        setError(error.message);
        setSavingQuestion(false);
        return;
      }
    }
    setSavingQuestion(false);
    cancelQuestionForm();
    await loadQuestions();
  };

  const onDeleteQuestion = async (questionId: string) => {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", questionId);
    if (error) {
      setError(error.message);
      return;
    }
    await loadQuestions();
  };

  const moveQuestion = async (questionId: string, direction: "up" | "down") => {
    const index = questions.findIndex(q => q.id === questionId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === questions.length - 1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    const temp = questions[index].order;
    questions[index].order = questions[newIndex].order;
    questions[newIndex].order = temp;

    await supabase
      .from("questions")
      .update({ order: questions[index].order })
      .eq("id", questions[index].id);
    await supabase
      .from("questions")
      .update({ order: questions[newIndex].order })
      .eq("id", questions[newIndex].id);

    await loadQuestions();
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="mb-4">
          <Link className="underline text-sm" href="/">Back</Link>
        </div>
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  if (!item) return null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4">
        <Link className="underline text-sm" href="/">Back</Link>
      </div>
      <h1 className="text-2xl font-semibold mb-4">Edit Panorama</h1>
      <form onSubmit={onSave} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[120px]"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2"
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onSoftDelete}
            className="rounded-md border border-red-500 text-red-600 py-2 px-4 font-medium"
          >
            Delete (soft)
          </button>
        </div>
      </form>

      <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Questions</h2>
          <div className="flex items-center gap-3">
            {status === "active" && (
              <Link className="underline text-sm" href={`/panoramas/${id}/respond`}>
                Public Form
              </Link>
            )}
            <Link className="underline text-sm" href={`/panoramas/${id}/responses`}>
              View Responses
            </Link>
            <button
              onClick={startAddQuestion}
              className="text-sm underline"
            >
              Add Question
            </button>
          </div>
        </div>

        {showQuestionForm && (
          <form onSubmit={onSaveQuestion} className="mb-6 p-4 border border-gray-200 dark:border-gray-800 rounded-md space-y-3">
            <div>
              <label className="block text-sm mb-1">Question Text</label>
              <input
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Type</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as any)}
                className="rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2"
              >
                <option value="text">Text</option>
                <option value="textarea">Textarea</option>
                <option value="Single-select">Single-select</option>
                <option value="Multi-select">Multi-select</option>
              </select>
            </div>
            {(questionType === "Single-select" || questionType === "Multi-select") && (
              <div>
                <label className="block text-sm mb-1">Options (one per line)</label>
                <textarea
                  value={questionOptions}
                  onChange={(e) => setQuestionOptions(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[80px]"
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  required
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="required"
                checked={questionRequired}
                onChange={(e) => setQuestionRequired(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="required" className="text-sm">Required</label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingQuestion}
                className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60 text-sm"
              >
                {savingQuestion ? "Saving..." : editingQuestion ? "Update" : "Add"} Question
              </button>
              <button
                type="button"
                onClick={cancelQuestionForm}
                className="rounded-md border border-gray-300 dark:border-gray-700 py-2 px-4 font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loadingQuestions ? (
          <p className="text-sm text-gray-500">Loading questions...</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-gray-500">No questions yet. Add one to get started.</p>
        ) : (
          <ul className="space-y-2">
            {questions.map((q) => (
              <li key={q.id} className="rounded border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{q.question_text}</span>
                      {q.required && <span className="text-xs text-red-500">Required</span>}
                      <span className="text-xs text-gray-500">({q.question_type})</span>
                    </div>
                    {q.options && (
                      <div className="text-xs text-gray-500 mt-1">
                        Options: {q.options.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => moveQuestion(q.id, "up")}
                      className="text-xs underline"
                      disabled={questions.findIndex(x => x.id === q.id) === 0}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveQuestion(q.id, "down")}
                      className="text-xs underline"
                      disabled={questions.findIndex(x => x.id === q.id) === questions.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => startEditQuestion(q)}
                      className="text-xs underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteQuestion(q.id)}
                      className="text-xs underline text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}



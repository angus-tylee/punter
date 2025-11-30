// PULSE FEATURE - HIBERNATED
// This feature is currently hibernated due to Meta App Review requirements.
// See PULSE_HIBERNATION.md for re-enablement instructions.

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Pulse = {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  instagram_post_url: string;
  instagram_post_id: string;
  updated_at: string;
};

type PulseQuestion = {
  id: string;
  question_text: string;
  question_type: "text" | "Single-select";
  options: string[] | null;
  required: boolean;
  order: number;
};

export default function PulseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [item, setItem] = useState<Pulse | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PulseQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("pulses")
        .select("id,name,description,status,instagram_post_url,instagram_post_id,updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) console.error(error);
      if (!mounted) return;
      if (!data) {
        setError("Not found");
      } else {
        setItem(data as Pulse);
        setName((data as Pulse).name);
        setDescription(((data as Pulse).description ?? "") as string);
        setStatus((data as Pulse).status);
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
        .from("pulse_questions")
        .select("*")
        .eq("pulse_id", id)
        .order("order", { ascending: true });
      if (error) console.error(error);
      if (!mounted) return;
      if (data) {
        setQuestions((data as PulseQuestion[]) ?? []);
      }
      setLoadingQuestions(false);
    };
    if (id) void loadQuestions();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("pulses")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          status: status
        })
        .eq("id", id);

      if (error) throw error;

      setItem(prev => prev ? { ...prev, name, description, status } : null);
      setMsg("Saved");
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
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

  if (error && !item) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-red-500">{error}</p>
        <Link href="/pulse" className="underline text-sm mt-4 inline-block">Back to Pulse Surveys</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <Link href="/pulse" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          ← Back to Pulse Surveys
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Pulse Survey Details</h1>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[100px]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "active" | "archived")}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {item && (
          <div>
            <label className="block text-sm font-medium mb-2">Instagram Post</label>
            <div className="p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <a
                href={item.instagram_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                {item.instagram_post_url}
              </a>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {msg && (
        <div className="mb-4 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Questions</h2>
        {loadingQuestions ? (
          <p>Loading questions...</p>
        ) : questions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No questions yet. Create questions to get started.</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q, index) => (
              <div key={q.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Question {index + 1}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {q.question_type}
                      </span>
                    </div>
                    <p className="text-gray-900 dark:text-gray-100">{q.question_text}</p>
                    {q.question_type === "Single-select" && q.options && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Options:</span> {q.options.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Link
          href={`/pulse/${id}/insights`}
          className="rounded-md bg-blue-600 text-white dark:bg-blue-500 py-2 px-4 font-medium hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          View Insights
        </Link>
      </div>
    </main>
  );
}


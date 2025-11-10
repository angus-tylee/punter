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
    router.push("/panoramas");
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
          <Link className="underline text-sm" href="/panoramas">Back</Link>
        </div>
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  if (!item) return null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4">
        <Link className="underline text-sm" href="/panoramas">Back</Link>
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
    </main>
  );
}



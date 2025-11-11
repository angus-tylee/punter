"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ManualPanoramaPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not signed in");
      setSaving(false);
      return;
    }
    const { error: insertErr, data } = await supabase
      .from("panoramas")
      .insert({
        owner_id: session.user.id,
        name: cleanName,
        description: description || null,
        status: "draft"
      })
      .select("id")
      .single();
    setSaving(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    router.push(`/panoramas/${data!.id}`);
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4">
        <Link className="underline text-sm" href="/panoramas/new">Back to Wizard</Link>
      </div>
      <h1 className="text-2xl font-semibold mb-4">Create Panorama Manually</h1>
      <form onSubmit={onCreate} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
            placeholder="e.g., Q1 Customer Survey"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[120px]"
            placeholder="Optional details"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create"}
        </button>
      </form>
    </main>
  );
}


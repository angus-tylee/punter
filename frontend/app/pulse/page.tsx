"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Pulse = {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  updated_at: string;
};

export default function PulseListPage() {
  const [items, setItems] = useState<Pulse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const { data, error } = await supabase
        .from("pulses")
        .select("id,name,status,updated_at")
        .order("updated_at", { ascending: false });
      if (error) console.error(error);
      if (!mounted) return;
      setItems((data as Pulse[]) ?? []);
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Pulse Surveys</h1>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Pulse Surveys</h1>
        <Link className="underline" href="/pulse/new">New</Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded border border-gray-200 dark:border-gray-800 p-6">
          <p className="mb-3">No Pulse surveys yet.</p>
          <Link className="underline" href="/pulse/new">Create your first</Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="rounded border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">Status: {p.status} • Updated: {new Date(p.updated_at).toLocaleString()}</div>
                </div>
                <Link className="underline text-sm" href={`/pulse/${p.id}`}>Open</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}


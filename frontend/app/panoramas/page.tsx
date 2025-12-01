"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Panorama = {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  type: "plan" | "pulse" | "playback" | null;
  event_id: string | null;
  updated_at: string;
};

export default function PanoramasListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id");
  const [items, setItems] = useState<Panorama[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect to home if no event_id is provided
    if (!eventId) {
      router.replace("/");
      return;
    }

    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      
      const { data, error } = await supabase
        .from("panoramas")
        .select("id,name,status,type,event_id,updated_at")
        .eq("event_id", eventId)
        .order("updated_at", { ascending: false });
      
      if (error) console.error(error);
      if (!mounted) return;
      setItems((data as Panorama[]) ?? []);
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [eventId, router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Panoramas</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (!eventId) {
    return null; // Will redirect
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <Link className="underline text-sm" href={`/events/${eventId}`}>Back to Event</Link>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Panoramas</h1>
        <Link className="underline" href={`/panoramas/new?event_id=${eventId}`}>New</Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded border border-gray-200 dark:border-gray-800 p-6">
          <p className="mb-3">No panoramas yet.</p>
          <Link className="underline" href={`/panoramas/new?event_id=${eventId}`}>Create your first</Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="rounded border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">
                    {p.type && `${p.type.charAt(0).toUpperCase() + p.type.slice(1)} • `}
                    Status: {p.status} • Updated: {new Date(p.updated_at).toLocaleString()}
                  </div>
                </div>
                <Link className="underline text-sm" href={`/panoramas/${p.id}`}>Open</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}



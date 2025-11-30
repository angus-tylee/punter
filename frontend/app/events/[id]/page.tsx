"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Event = {
  id: string;
  name: string;
  event_type: string | null;
  date: string | null;
  capacity: number | null;
  venue: string | null;
  event_url: string | null;
  current_stage: "early_planning" | "mid_campaign" | "post_event";
  promoter_name: string | null;
  updated_at: string;
};

type Panorama = {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  type: "plan" | "pulse" | "playback" | null;
  updated_at: string;
};

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [panoramas, setPanoramas] = useState<Panorama[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      // Load event
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id,name,event_type,date,capacity,venue,event_url,current_stage,promoter_name,updated_at")
        .eq("id", id)
        .maybeSingle();

      if (eventError) {
        console.error(eventError);
        if (!mounted) return;
        setError("Failed to load event");
        setLoading(false);
        return;
      }

      if (!eventData) {
        if (!mounted) return;
        setError("Event not found");
        setLoading(false);
        return;
      }

      setEvent(eventData as Event);

      // Load panoramas for this event
      const { data: panoramasData, error: panoramasError } = await supabase
        .from("panoramas")
        .select("id,name,status,type,updated_at")
        .eq("event_id", id)
        .order("updated_at", { ascending: false });

      if (panoramasError) {
        console.error(panoramasError);
      }

      if (!mounted) return;
      setPanoramas((panoramasData as Panorama[]) ?? []);
      setLoading(false);
    };
    if (id) void load();
    return () => {
      mounted = false;
    };
  }, [id, router]);

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case "early_planning":
        return "Early Planning";
      case "mid_campaign":
        return "Mid Campaign";
      case "post_event":
        return "Post Event";
      default:
        return stage;
    }
  };

  const getTypeLabel = (type: string | null) => {
    if (!type) return "Standard";
    switch (type) {
      case "plan":
        return "Plan";
      case "pulse":
        return "Pulse";
      case "playback":
        return "Playback";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p>Loading...</p>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="mb-4">
          <Link className="underline text-sm" href="/events">Back to Events</Link>
        </div>
        <p className="text-red-500">{error || "Event not found"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <Link className="underline text-sm" href="/events">Back to Events</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">{event.name}</h1>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          {event.event_type && <div>Type: {event.event_type}</div>}
          {event.date && <div>Date: {new Date(event.date).toLocaleDateString()}</div>}
          {event.venue && <div>Venue: {event.venue}</div>}
          {event.capacity && <div>Capacity: {event.capacity.toLocaleString()}</div>}
          <div>Stage: {getStageLabel(event.current_stage)}</div>
          {event.event_url && (
            <div>
              <a href={event.event_url} target="_blank" rel="noopener noreferrer" className="underline">
                Event Website
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Panoramas</h2>
          <Link
            href={`/panoramas/new?event_id=${event.id}`}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium"
          >
            Create Panorama
          </Link>
        </div>

        {panoramas.length === 0 ? (
          <div className="rounded border border-gray-200 dark:border-gray-800 p-6">
            <p className="mb-3">No panoramas yet for this event.</p>
            <Link
              className="underline"
              href={`/panoramas/new?event_id=${event.id}`}
            >
              Create your first panorama
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {panoramas.map((panorama) => (
              <li
                key={panorama.id}
                className="rounded border border-gray-200 dark:border-gray-800 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{panorama.name}</div>
                    <div className="text-xs text-gray-500">
                      Type: {getTypeLabel(panorama.type)} • Status: {panorama.status} • Updated: {new Date(panorama.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <Link
                    className="underline text-sm"
                    href={`/panoramas/${panorama.id}`}
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}


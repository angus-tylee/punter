"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Event = {
  id: string;
  name: string;
  event_type: string | null;
  date: string | null;
  current_stage: "early_planning" | "mid_campaign" | "post_event";
  promoter_name: string | null;
  updated_at: string;
};

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoterName, setPromoterName] = useState<string>("Promoter Name"); // Stubbed for now

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("events")
        .select("id,name,event_type,date,current_stage,promoter_name,updated_at")
        .order("updated_at", { ascending: false });
      if (error) console.error(error);
      if (!mounted) return;
      setItems((data as Event[]) ?? []);
      // Set promoter name from first event or use stub
      if (data && data.length > 0 && data[0].promoter_name) {
        setPromoterName(data[0].promoter_name);
      }
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Events</h1>
        <p>Loading...</p>
      </main>
    );
  }

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

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">{promoterName}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Events Portal</p>
      </div>

      {/* Create Event Banner */}
      <div className="mb-6 p-4 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold mb-1">Create New Event</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Set up a new event and start collecting feedback
            </p>
          </div>
          <Link
            href="/events/new"
            className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium"
          >
            Create Event
          </Link>
        </div>
      </div>

      {/* Events List */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Your Events</h2>
      </div>
      {items.length === 0 ? (
        <div className="rounded border border-gray-200 dark:border-gray-800 p-6">
          <p className="mb-3">No events yet.</p>
          <Link className="underline" href="/events/new">
            Create your first event
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((event) => (
            <li
              key={event.id}
              className="rounded border border-gray-200 dark:border-gray-800 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{event.name}</div>
                  <div className="text-xs text-gray-500">
                    {event.event_type && `${event.event_type} • `}
                    Stage: {getStageLabel(event.current_stage)}
                    {event.date && ` • ${new Date(event.date).toLocaleDateString()}`}
                    {" • "}
                    Updated: {new Date(event.updated_at).toLocaleString()}
                  </div>
                </div>
                <Link
                  className="underline text-sm"
                  href={`/events/${event.id}`}
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

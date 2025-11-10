"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const user = data.session.user;
      setEmail(user.email ?? null);
      // Load profile; create if missing
      const userId = user.id;
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.error("Load profile error:", error);
      }
      if (!profile) {
        const { error: insertErr } = await supabase
          .from("profiles")
          .insert({ id: userId, display_name: user.email });
        if (insertErr) {
          console.error("Create profile error:", insertErr);
        } else {
          setDisplayName(user.email ?? "");
        }
      } else {
        setDisplayName(profile.display_name ?? "");
      }
      setLoading(false);
    };
    void init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg(null);
    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const userId = session.user.id;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setSaveMsg(error.message || "Failed to save");
      return;
    }
    setSaveMsg("Saved");
    setTimeout(() => setSaveMsg(null), 1500);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h1 className="text-2xl font-semibold mb-2">Account</h1>
        <p className="mb-6">Signed in as {email}</p>

        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
              placeholder="Your name"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            {saveMsg && <span className="text-sm">{saveMsg}</span>}
          </div>
        </form>

        <div className="mt-6">
          <button
            onClick={signOut}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}



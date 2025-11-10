"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function AuthHeader() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const authed = Boolean(data.session);
      setIsAuthed(authed);
      setEmail(data.session?.user.email ?? null);
    };
    void init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session));
      setEmail(session?.user.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  if (!isAuthed) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link className="underline" href="/login">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link className="underline" href="/account">
        {email ?? "Account"}
      </Link>
      <button onClick={onSignOut} className="underline">
        Sign out
      </button>
    </div>
  );
}



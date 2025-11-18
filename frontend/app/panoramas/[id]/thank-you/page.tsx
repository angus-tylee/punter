"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PreviewBanner from "@/components/survey/PreviewBanner";

type Panorama = {
  id: string;
  name: string;
  description: string | null;
};

export default function ThankYouPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const isPreview = searchParams.get("preview") === "true";

  const [panorama, setPanorama] = useState<Panorama | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // In preview mode, skip sessionStorage validation
      if (!isPreview) {
        // Check sessionStorage for submission flag and expiration
        const submissionFlag = sessionStorage.getItem(`submission_${id}`);
        const expirationTime = sessionStorage.getItem(`submission_${id}_expires`);
        
        if (!submissionFlag) {
          // If no submission flag, redirect back to respond page
          // This prevents direct URL access without submission
          router.push(`/panoramas/${id}/respond`);
          return;
        }

        // Check if expiration time exists and has passed
        if (expirationTime) {
          const expires = parseInt(expirationTime, 10);
          if (Date.now() > expires) {
            // Expired, clear flags and redirect
            sessionStorage.removeItem(`submission_${id}`);
            sessionStorage.removeItem(`submission_${id}_expires`);
            router.push(`/panoramas/${id}/respond`);
            return;
          }
        }
      }

      // Load panorama data
      const { data: panoramaData, error: panoramaError } = await supabase
        .from("panoramas")
        .select("id,name,description")
        .eq("id", id)
        .maybeSingle();

      if (panoramaError || !panoramaData) {
        if (!mounted) return;
        setError("Panorama not found");
        setLoading(false);
        return;
      }

      if (!mounted) return;
      setPanorama(panoramaData as Panorama);
      setLoading(false);
    };

    if (id) void load();
    return () => {
      mounted = false;
    };
  }, [id, router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6 min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Return to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {isPreview && <PreviewBanner />}
      <main className={`mx-auto max-w-2xl p-6 min-h-screen flex items-center justify-center ${isPreview ? 'pt-16' : ''}`}>
        <div className="w-full text-center space-y-6">
          {/* Panorama name */}
          {panorama && (
            <div className="mb-4">
              <h2 className="text-lg text-gray-600 dark:text-gray-400">
                {panorama.name}
              </h2>
            </div>
          )}

          {/* Thank you message */}
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Thank you for completing the survey!
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {isPreview ? "This is a preview. Your response would have been recorded." : "Your response has been recorded."}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}


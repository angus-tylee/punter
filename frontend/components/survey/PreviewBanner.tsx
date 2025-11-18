"use client";

import { useRouter, useParams } from "next/navigation";

export default function PreviewBanner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const handleExitPreview = () => {
    // Navigate back to the editor page
    router.push(`/panoramas/${id}`);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Preview Mode — Responses will not be saved
        </p>
        <button
          onClick={handleExitPreview}
          className="text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
        >
          Exit Preview
        </button>
      </div>
    </div>
  );
}


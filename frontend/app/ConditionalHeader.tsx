"use client";

import { usePathname } from "next/navigation";
import { AuthHeader } from "./AuthHeader";

export function ConditionalHeader() {
  const pathname = usePathname();
  
  // Hide header on public survey view and preview pages
  const isPublicSurveyPage = pathname?.match(/^\/panoramas\/[^/]+\/(respond|preview)$/);
  
  if (isPublicSurveyPage) {
    return null;
  }
  
  return (
    <header className="w-full border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <a href="/" className="font-semibold">Punter</a>
        <AuthHeader />
      </div>
    </header>
  );
}


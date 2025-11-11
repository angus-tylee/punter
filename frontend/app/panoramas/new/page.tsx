"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type WizardStep = 1 | 2 | 3 | 4;

export default function NewPanoramaPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Event Basics
  const [eventType, setEventType] = useState("");
  const [eventName, setEventName] = useState("");

  // Step 2: Event Goals
  const [goals, setGoals] = useState<string[]>([]);
  const [learningObjectives, setLearningObjectives] = useState("");

  // Step 3: Audience & Timing
  const [audience, setAudience] = useState("");
  const [timing, setTiming] = useState("");

  // Step 4: Additional Context
  const [additionalContext, setAdditionalContext] = useState("");

  const goalOptions = [
    "Gather feedback",
    "Measure satisfaction",
    "Understand preferences",
    "Collect testimonials",
    "Other"
  ];

  const eventTypeOptions = [
    "Conference",
    "Workshop",
    "Wedding",
    "Corporate Event",
    "Festival",
    "Other"
  ];

  const handleGoalToggle = (goal: string) => {
    if (goals.includes(goal)) {
      setGoals(goals.filter(g => g !== goal));
    } else {
      setGoals([...goals, goal]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return eventType && eventName.trim();
      case 2:
        return goals.length > 0 && learningObjectives.trim();
      case 3:
        return audience.trim() && timing.trim();
      case 4:
        return true; // Optional step
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < 4) {
      setCurrentStep((currentStep + 1) as WizardStep);
      setError(null);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
      setError(null);
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);

    try {
      // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not signed in");
        setLoading(false);
      return;
    }

      // Prepare context
      const context = {
        user_id: session.user.id,
        event_type: eventType,
        event_name: eventName.trim(),
        goals: goals.length > 0 ? goals : ["Gather feedback"],
        learning_objectives: learningObjectives.trim(),
        audience: audience.trim(),
        timing: timing.trim(),
        additional_context: additionalContext.trim() || undefined
      };

      // Call backend API
      const response = await fetch(`${API_URL}/api/panoramas/generate-from-context`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(context)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to generate survey" }));
        throw new Error(errorData.detail || "Failed to generate survey");
      }

      const data = await response.json();
      
      // Redirect to panorama detail page
      router.push(`/panoramas/${data.panorama_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to generate survey. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4">
        <Link className="underline text-sm" href="/">Back</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Create Your Survey</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Answer a few questions and we'll generate a custom survey for your event
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-gray-200 dark:bg-gray-800 text-gray-500"
                }`}
              >
                {step}
              </div>
              {step < 4 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    step < currentStep
                      ? "bg-black dark:bg-white"
                      : "bg-gray-200 dark:bg-gray-800"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Event Basics</span>
          <span>Goals</span>
          <span>Audience</span>
          <span>Context</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Event Type *</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                required
              >
                <option value="">Select event type</option>
                {eventTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Event Name *</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                placeholder="e.g., Annual Tech Conference 2024"
                required
              />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Primary Goals *</label>
              <div className="space-y-2">
                {goalOptions.map((goal) => (
                  <label key={goal} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={goals.includes(goal)}
                      onChange={() => handleGoalToggle(goal)}
                      className="rounded"
                    />
                    <span>{goal}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">What do you want to learn? *</label>
              <textarea
                value={learningObjectives}
                onChange={(e) => setLearningObjectives(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[120px]"
                placeholder="e.g., What sessions were most valuable? How can we improve next year?"
                required
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
        <div>
              <label className="block text-sm font-medium mb-2">Target Audience *</label>
          <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                placeholder="e.g., Tech professionals, Wedding guests, Workshop attendees"
                required
          />
        </div>
        <div>
              <label className="block text-sm font-medium mb-2">When is the event? *</label>
              <input
                type="text"
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                placeholder="e.g., March 15, 2024 or Next week"
                required
              />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <label className="block text-sm font-medium mb-2">Additional Context (Optional)</label>
          <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[120px]"
              placeholder="Any other information that would help us create better questions..."
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 1 && (
            <button
              onClick={handleBack}
              disabled={loading}
              className="rounded-md border border-gray-300 dark:border-gray-700 py-2 px-4 font-medium disabled:opacity-60"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60"
            >
              Next
            </button>
          ) : (
        <button
              onClick={handleGenerate}
              disabled={loading}
          className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60"
        >
              {loading ? "Generating..." : "Generate Survey"}
        </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="mt-6 p-4 rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Generating your survey... This usually takes 10-15 seconds.
          </p>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/panoramas/new/manual" className="text-sm underline text-gray-500">
          Create manually instead
        </Link>
      </div>
    </main>
  );
}

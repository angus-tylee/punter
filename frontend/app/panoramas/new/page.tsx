"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type WizardStep = 1 | 2 | 3;

type Goal = {
  id: string;
  text: string;
};

type PanoramaType = "plan" | "pulse" | "playback";

type Event = {
  id: string;
  name: string;
  event_type: string | null;
  current_stage: "early_planning" | "mid_campaign" | "post_event";
  date: string | null;
  venue: string | null;
  target_market: string | null;
};

function SortableGoalItem({ goal, onRemove }: { goal: Goal; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-gray-900"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        ⋮⋮
      </div>
      <span className="flex-1">{goal.text}</span>
      <button
        type="button"
        onClick={() => onRemove(goal.id)}
        className="text-red-500 hover:text-red-700"
      >
        ×
      </button>
    </div>
  );
}

export default function NewPanoramaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id");

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(!!eventId);

  // Step 1: Type Selection
  const [selectedType, setSelectedType] = useState<PanoramaType | null>(null);
  const [typeDescriptions, setTypeDescriptions] = useState<Record<string, any>>({});

  // Step 2: Goals
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);

  // Step 3: Additional Context
  const [highLevelQuestions, setHighLevelQuestions] = useState("");
  const [lowLevelQuestions, setLowLevelQuestions] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [surveyLength, setSurveyLength] = useState<number>(25);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load event data if event_id is provided
  useEffect(() => {
    if (!eventId) return;

    let mounted = true;
    const loadEvent = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("events")
        .select("id,name,event_type,current_stage,date,venue,target_market")
        .eq("id", eventId)
        .maybeSingle();

      if (error) {
        console.error(error);
        if (!mounted) return;
        setError("Failed to load event");
        setLoadingEvent(false);
        return;
      }

      if (!mounted) return;
      setEvent(data as Event);
      setLoadingEvent(false);

      // Determine suggested panorama type based on stage
      if (data) {
        const stage = data.current_stage;
        if (stage === "early_planning") {
          setSelectedType("plan");
        } else if (stage === "mid_campaign") {
          setSelectedType("pulse");
        } else if (stage === "post_event") {
          setSelectedType("playback");
        }
      }
    };

    void loadEvent();
    return () => {
      mounted = false;
    };
  }, [eventId, router]);

  // Load goals when type is selected
  useEffect(() => {
    if (!selectedType) return;

    let mounted = true;
    const loadGoals = async () => {
      setLoadingGoals(true);
      try {
        const response = await fetch(`${API_URL}/api/panoramas/goals/${selectedType}`);
        if (!response.ok) throw new Error("Failed to load goals");

        const data = await response.json();
        if (!mounted) return;

        setGoals(data.goals || []);
        setTypeDescriptions({
          [selectedType]: data.description,
        });
      } catch (err: any) {
        console.error(err);
        if (!mounted) return;
        setError(err.message || "Failed to load goals");
      } finally {
        if (mounted) setLoadingGoals(false);
      }
    };

    void loadGoals();
    return () => {
      mounted = false;
    };
  }, [selectedType]);

  // Load suggestions when moving to step 3
  useEffect(() => {
    if (currentStep === 3 && eventId && selectedType) {
      loadSuggestions();
    }
  }, [currentStep, eventId, selectedType]);

  const loadSuggestions = async () => {
    if (!eventId || !selectedType) return;

    setLoadingSuggestions(true);
    try {
      const response = await fetch(`${API_URL}/api/panoramas/suggest-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          panorama_type: selectedType,
          high_level_questions: highLevelQuestions,
          low_level_questions: lowLevelQuestions,
        }),
      });

      if (!response.ok) throw new Error("Failed to load suggestions");

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      console.error(err);
      // Don't show error, just continue without suggestions
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setGoals((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeGoal = (id: string) => {
    setGoals(goals.filter((g) => g.id !== id));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedType !== null;
      case 2:
        return goals.length > 0;
      case 3:
        return true; // Optional step
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < 3) {
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

  const getRecommendedLength = () => {
    if (!selectedType) return 25;
    if (selectedType === "plan") return 20;
    if (selectedType === "pulse") return 10;
    if (selectedType === "playback") return 25;
    return 25;
  };

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not signed in");
        setLoading(false);
        return;
      }

      if (!event) {
        setError("Event not loaded");
        setLoading(false);
        return;
      }

      // Prepare context
      const context = {
        user_id: session.user.id,
        event_id: eventId || undefined,
        panorama_type: selectedType || undefined,
        event_type: event.event_type || "Event",
        event_name: event.name,
        goals: goals.map((g) => g.text),
        learning_objectives: goals.map((g) => g.text).join(", "), // Use goals as learning objectives
        audience: event.target_market || "Event attendees",
        timing: event.date ? new Date(event.date).toLocaleDateString() : "Event",
        additional_context: `${highLevelQuestions}\n${lowLevelQuestions}`.trim() || undefined,
        high_level_questions: highLevelQuestions.trim() || undefined,
        low_level_questions: lowLevelQuestions.trim() || undefined,
        survey_length: surveyLength || getRecommendedLength(),
      };

      // Call backend API
      const response = await fetch(`${API_URL}/api/panoramas/generate-from-context`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(context),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to generate survey" }));
        throw new Error(errorData.detail || "Failed to generate survey");
      }

      const data = await response.json();

      // Redirect to staging page with questions data
      const questionsParam = encodeURIComponent(JSON.stringify(data.questions));
      router.push(`/panoramas/${data.panorama_id}/stage?questions=${questionsParam}`);
    } catch (err: any) {
      setError(err.message || "Failed to generate survey. Please try again.");
      setLoading(false);
    }
  };

  if (loadingEvent) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p>Loading event...</p>
      </main>
    );
  }

  if (!event && eventId) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-red-500">Event not found</p>
        <Link href="/events" className="underline text-sm">
          Back to Events
        </Link>
      </main>
    );
  }

  const typeDescription = selectedType ? typeDescriptions[selectedType] : null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4">
        {eventId ? (
          <Link className="underline text-sm" href={`/events/${eventId}`}>
            Back to Event
          </Link>
        ) : (
          <Link className="underline text-sm" href="/panoramas">
            Back
          </Link>
        )}
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Create Panorama</h1>
        {event && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            For event: {event.name}
          </p>
        )}
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3].map((step) => (
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
              {step < 3 && (
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
          <span>Type</span>
          <span>Goals</span>
          <span>Context</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Select Panorama Type</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Based on your event stage, we recommend a panorama type. You can change this if needed.
              </p>
            </div>
            <div className="space-y-3">
              {(["plan", "pulse", "playback"] as PanoramaType[]).map((type) => {
                const desc = typeDescriptions[type];
                const isRecommended =
                  event?.current_stage === "early_planning" && type === "plan" ||
                  event?.current_stage === "mid_campaign" && type === "pulse" ||
                  event?.current_stage === "post_event" && type === "playback";

                return (
                  <label
                    key={type}
                    className={`flex items-start gap-3 p-4 border-2 rounded cursor-pointer ${
                      selectedType === type
                        ? "border-black dark:border-white bg-gray-50 dark:bg-gray-900"
                        : "border-gray-200 dark:border-gray-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="panorama_type"
                      value={type}
                      checked={selectedType === type}
                      onChange={() => setSelectedType(type)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold capitalize mb-1">
                        {desc?.name || type}
                        {isRecommended && (
                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                            (Recommended)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {desc?.description || ""}
                      </div>
                      {desc?.outcomes && (
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          <strong>Expected outcomes:</strong> {desc.outcomes}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Rank Your Goals</h2>
              {typeDescription && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-sm mb-1">
                    <strong>{typeDescription.name} Panorama:</strong> {typeDescription.description}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {typeDescription.outcomes}
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Drag to reorder goals by importance. Remove goals that aren't relevant to your event.
              </p>
            </div>
            {loadingGoals ? (
              <p>Loading goals...</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={goals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {goals.map((goal, index) => (
                      <div key={goal.id} className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 w-6">#{index + 1}</span>
                        <SortableGoalItem goal={goal} onRemove={removeGoal} />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Additional Context</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Share any specific questions or areas you want to cover. We'll use this to generate better survey questions.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">High-Level Questions/Areas</label>
              <textarea
                value={highLevelQuestions}
                onChange={(e) => setHighLevelQuestions(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[100px]"
                placeholder="e.g., Overall event experience, Lineup satisfaction, Venue quality..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Low-Level Questions/Areas</label>
              <textarea
                value={lowLevelQuestions}
                onChange={(e) => setLowLevelQuestions(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[100px]"
                placeholder="e.g., Sound quality, Bar service, Security experience..."
              />
            </div>
            {loadingSuggestions ? (
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                <p className="text-sm text-gray-600">Loading suggestions...</p>
              </div>
            ) : suggestions.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium mb-2">Suggestions based on your event:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {suggestions.map((suggestion, index) => (
                    <li key={index} className="text-gray-700 dark:text-gray-300">
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">
                Survey Length (Recommended: {getRecommendedLength()} questions)
              </label>
              <input
                type="number"
                value={surveyLength}
                onChange={(e) => setSurveyLength(parseInt(e.target.value) || getRecommendedLength())}
                min={5}
                max={50}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
              />
            </div>
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
          {currentStep < 3 ? (
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
            Generating your survey... This usually takes 15-20 seconds.
          </p>
        </div>
      )}
    </main>
  );
}

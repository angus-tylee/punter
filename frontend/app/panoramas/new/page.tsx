"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type WizardStep = 1 | 2 | 3;

type Goal = {
  id: string;
  text: string;
};

type BucketKey = "must_have" | "interested" | "not_important";

type GoalBuckets = {
  must_have: Goal[];
  interested: Goal[];
  not_important: Goal[];
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

// Draggable goal item
function DraggableGoal({ goal, onRemove }: { goal: Goal; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: goal.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 cursor-grab active:cursor-grabbing"
      {...listeners}
      {...attributes}
    >
      <span className="text-gray-400 mr-1">⋮⋮</span>
      <span className="flex-1 text-sm">{goal.text}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(goal.id);
        }}
        className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:bg-red-200"
      >
        ×
      </button>
    </div>
  );
}

// Static goal display for overlay
function GoalOverlay({ goal }: { goal: Goal }) {
  return (
    <div className="flex items-center gap-2 p-3 border-2 border-black dark:border-white rounded bg-white dark:bg-gray-900 shadow-lg cursor-grabbing">
      <span className="text-gray-400 mr-1">⋮⋮</span>
      <span className="flex-1 text-sm">{goal.text}</span>
    </div>
  );
}

// Droppable bucket
function DroppableBucket({
  bucketKey,
  title,
  description,
  questionsPerGoal,
  goals,
  onRemove,
  maxReached,
  isOver,
  canDrop,
}: {
  bucketKey: BucketKey;
  title: string;
  description: string;
  questionsPerGoal: number;
  goals: Goal[];
  onRemove: (id: string) => void;
  maxReached?: boolean;
  isOver: boolean;
  canDrop: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: bucketKey,
  });

  const totalQuestions = goals.length * questionsPerGoal;

  const getBucketStyles = () => {
    const base = bucketKey === "must_have"
      ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950"
      : bucketKey === "interested"
      ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950"
      : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950";

    if (isOver && canDrop) {
      return bucketKey === "must_have"
        ? "border-green-500 dark:border-green-400 bg-green-100 dark:bg-green-900 ring-2 ring-green-400"
        : bucketKey === "interested"
        ? "border-blue-500 dark:border-blue-400 bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-400"
        : "border-gray-500 dark:border-gray-400 bg-gray-100 dark:bg-gray-900 ring-2 ring-gray-400";
    }

    if (isOver && !canDrop) {
      return "border-red-400 bg-red-50 dark:bg-red-950 ring-2 ring-red-400";
    }

    return base;
  };

  return (
    <div
      ref={setNodeRef}
      className={`p-4 rounded-lg border-2 transition-all duration-200 min-h-[120px] ${getBucketStyles()}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
        </div>
        <div className="text-right">
          <span className="text-sm font-medium">
            {goals.length} goal{goals.length !== 1 ? "s" : ""}
          </span>
          {questionsPerGoal > 0 && (
            <p className="text-xs text-gray-500">
              → {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}
            </p>
          )}
          {maxReached && (
            <p className="text-xs text-orange-600 dark:text-orange-400">Max reached</p>
          )}
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded">
          Drag goals here
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => (
            <DraggableGoal key={goal.id} goal={goal} onRemove={onRemove} />
          ))}
        </div>
      )}
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

  // Step 2: Goal Buckets (3-bucket system)
  const [goalBuckets, setGoalBuckets] = useState<GoalBuckets>({
    must_have: [],
    interested: [],
    not_important: [],
  });
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [activeBucket, setActiveBucket] = useState<BucketKey | null>(null);

  // Step 3: Additional Context
  const [additionalContext, setAdditionalContext] = useState("");

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Redirect to home if no event_id is provided
  useEffect(() => {
    if (!eventId) {
      router.replace("/");
      return;
    }
  }, [eventId, router]);

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

      // Always default to "plan" type for MVP (pulse/playback disabled)
      setSelectedType("plan");
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

        // Initialize all goals in "interested" bucket by default
        const allGoals: Goal[] = data.goals || [];
        setGoalBuckets({
          must_have: [],
          interested: allGoals,
          not_important: [],
        });

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

  // Find which bucket contains a goal
  const findGoalBucket = (goalId: string): BucketKey | null => {
    for (const bucket of ["must_have", "interested", "not_important"] as BucketKey[]) {
      if (goalBuckets[bucket].some((g) => g.id === goalId)) {
        return bucket;
      }
    }
    return null;
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const goalId = event.active.id as string;
    const bucket = findGoalBucket(goalId);
    if (bucket) {
      const goal = goalBuckets[bucket].find((g) => g.id === goalId);
      setActiveGoal(goal || null);
      setActiveBucket(bucket);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveGoal(null);
    setActiveBucket(null);

    if (!over) return;

    const goalId = active.id as string;
    const targetBucket = over.id as BucketKey;
    const sourceBucket = findGoalBucket(goalId);

    if (!sourceBucket || sourceBucket === targetBucket) return;

    // Check max 3 for must_have
    if (targetBucket === "must_have" && goalBuckets.must_have.length >= 3) {
      return;
    }

    const goal = goalBuckets[sourceBucket].find((g) => g.id === goalId);
    if (!goal) return;

    setGoalBuckets((prev) => ({
      ...prev,
      [sourceBucket]: prev[sourceBucket].filter((g) => g.id !== goalId),
      [targetBucket]: [...prev[targetBucket], goal],
    }));
  };

  // Check if can drop in bucket
  const canDropInBucket = (bucket: BucketKey): boolean => {
    if (bucket === "must_have" && goalBuckets.must_have.length >= 3) {
      return false;
    }
    return true;
  };

  // Remove goal entirely
  const removeGoal = (goalId: string) => {
    const bucket = findGoalBucket(goalId);
    if (bucket) {
      setGoalBuckets((prev) => ({
        ...prev,
        [bucket]: prev[bucket].filter((g) => g.id !== goalId),
      }));
    }
  };

  // Calculate question count preview
  const calculateQuestionCount = () => {
    const mustHaveCount = goalBuckets.must_have.length * 4;
    const interestedCount = goalBuckets.interested.length * 2;
    return mustHaveCount + interestedCount;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedType !== null;
      case 2:
        // Need at least one goal in must_have or interested
        return goalBuckets.must_have.length > 0 || goalBuckets.interested.length > 0;
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

      // Prepare context with 3-bucket goals
      const context = {
        user_id: session.user.id,
        event_id: eventId || undefined,
        panorama_type: selectedType || undefined,
        event_type: event.event_type || "Event",
        event_name: event.name,
        // 3-bucket goals
        goals_must_have: goalBuckets.must_have.map((g) => g.text),
        goals_interested: goalBuckets.interested.map((g) => g.text),
        goals_not_important: goalBuckets.not_important.map((g) => g.text),
        // Other context
        learning_objectives: [
          ...goalBuckets.must_have.map((g) => g.text),
          ...goalBuckets.interested.map((g) => g.text),
        ].join(", "),
        audience: event.target_market || "Event attendees",
        timing: event.date ? new Date(event.date).toLocaleDateString() : "Event",
        additional_context: additionalContext.trim() || undefined,
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

  if (!eventId) {
    return null; // Will redirect
  }

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
        <Link href="/" className="underline text-sm">
          Back to Events
        </Link>
      </main>
    );
  }

  const typeDescription = selectedType ? typeDescriptions[selectedType] : null;
  const questionCount = calculateQuestionCount();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4">
        <Link className="underline text-sm" href={`/events/${eventId}`}>
          Back to Event
        </Link>
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
                Choose the type of survey for your event stage.
              </p>
            </div>
            <div className="space-y-3">
              {(["plan", "pulse", "playback"] as PanoramaType[]).map((type) => {
                const desc = typeDescriptions[type];
                const isDisabled = type !== "plan"; // Only "plan" is enabled for MVP

                return (
                  <label
                    key={type}
                    className={`flex items-start gap-3 p-4 border-2 rounded ${
                      isDisabled
                        ? "cursor-not-allowed opacity-50 border-gray-200 dark:border-gray-800"
                        : selectedType === type
                        ? "cursor-pointer border-black dark:border-white bg-gray-50 dark:bg-gray-900"
                        : "cursor-pointer border-gray-200 dark:border-gray-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="panorama_type"
                      value={type}
                      checked={selectedType === type}
                      onChange={() => !isDisabled && setSelectedType(type)}
                      disabled={isDisabled}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold capitalize mb-1">
                        {desc?.name || type}
                        {isDisabled && (
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                            (Coming Soon)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {desc?.description || (isDisabled ? "This survey type will be available in a future update." : "")}
                      </div>
                      {desc?.outcomes && !isDisabled && (
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
              <h2 className="text-lg font-semibold mb-2">Prioritize Your Goals</h2>
              {typeDescription && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-sm mb-1">
                    <strong>{typeDescription.name} Panorama:</strong> {typeDescription.description}
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Drag goals between buckets to set priority. Higher priority = more questions.
              </p>

              {/* Question Count Preview */}
              <div className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-lg mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Estimated Questions:</span>
                  <span className="text-xl font-bold">{questionCount}</span>
                </div>
                <p className="text-xs opacity-75 mt-1">
                  Must Have: {goalBuckets.must_have.length} × 4 = {goalBuckets.must_have.length * 4} |
                  Interested: {goalBuckets.interested.length} × 2 = {goalBuckets.interested.length * 2}
                </p>
              </div>
            </div>

            {loadingGoals ? (
              <p>Loading goals...</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="space-y-4">
                  <DroppableBucket
                    bucketKey="must_have"
                    title="🎯 Must Have"
                    description="4 questions per goal (max 3 goals)"
                    questionsPerGoal={4}
                    goals={goalBuckets.must_have}
                    onRemove={removeGoal}
                    maxReached={goalBuckets.must_have.length >= 3}
                    isOver={activeBucket !== "must_have" && activeGoal !== null}
                    canDrop={canDropInBucket("must_have")}
                  />

                  <DroppableBucket
                    bucketKey="interested"
                    title="💡 Interested to Know"
                    description="2 questions per goal"
                    questionsPerGoal={2}
                    goals={goalBuckets.interested}
                    onRemove={removeGoal}
                    isOver={activeBucket !== "interested" && activeGoal !== null}
                    canDrop={canDropInBucket("interested")}
                  />

                  <DroppableBucket
                    bucketKey="not_important"
                    title="⏭️ Not Important"
                    description="0 questions (skipped)"
                    questionsPerGoal={0}
                    goals={goalBuckets.not_important}
                    onRemove={removeGoal}
                    isOver={activeBucket !== "not_important" && activeGoal !== null}
                    canDrop={canDropInBucket("not_important")}
                  />
                </div>

                <DragOverlay>
                  {activeGoal ? <GoalOverlay goal={activeGoal} /> : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Additional Context</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Share any specific context to help customize your survey questions.
              </p>
            </div>

            {/* Summary */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h3 className="font-medium mb-2">Survey Summary</h3>
              <div className="text-sm space-y-1">
                <p><strong>Type:</strong> {selectedType?.charAt(0).toUpperCase()}{selectedType?.slice(1)} Survey</p>
                <p><strong>Estimated Questions:</strong> {questionCount}</p>
                <p><strong>Must Have Goals:</strong> {goalBuckets.must_have.length > 0 ? goalBuckets.must_have.map(g => g.text).join(", ") : "None"}</p>
                <p><strong>Interested Goals:</strong> {goalBuckets.interested.length > 0 ? goalBuckets.interested.map(g => g.text).join(", ") : "None"}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Additional Context (Optional)
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-3 outline-none min-h-[120px]"
                placeholder="e.g., This is a first-time event, we're particularly interested in understanding travel logistics, the venue has limited parking..."
              />
              <p className="text-xs text-gray-500 mt-1">
                This helps the AI generate more relevant and specific questions.
              </p>
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

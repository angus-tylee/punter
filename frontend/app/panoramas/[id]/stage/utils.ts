export type StagingQuestion = {
  id?: string; // Temporary ID for staging
  question_text: string;
  question_type: "text" | "textarea" | "Single-select" | "Multi-select" | "Likert";
  options: string[] | null;
  required: boolean;
  order: number;
  category?: string; // Inferred category
  isEditing?: boolean; // For inline edit state
};

export type QuestionCategory = 
  | "Experience" 
  | "Music/Lineup" 
  | "Venue/Logistics" 
  | "Communication" 
  | "Sustainability" 
  | "Post-Event" 
  | "Other";

const categoryKeywords: Record<QuestionCategory, string[]> = {
  "Experience": ["experience", "atmosphere", "vibe", "energy", "overall", "satisfaction", "enjoy", "feel", "impression"],
  "Music/Lineup": ["music", "artist", "lineup", "sound", "performance", "stage", "genre", "dj", "band", "act", "set"],
  "Venue/Logistics": ["venue", "facilities", "accessibility", "entry", "exit", "amenities", "safety", "clean", "restroom", "parking", "transport"],
  "Communication": ["communication", "information", "schedule", "social media", "marketing", "announcement", "update", "email"],
  "Sustainability": ["sustainability", "eco", "environment", "recycling", "green", "carbon", "waste", "compost"],
  "Post-Event": ["future", "recommend", "share", "attend again", "follow-up", "next", "return", "again"],
  "Other": []
};

export function categorizeQuestion(questionText: string): QuestionCategory {
  const lowerText = questionText.toLowerCase();
  
  // Check each category (excluding "Other")
  const categories: QuestionCategory[] = ["Experience", "Music/Lineup", "Venue/Logistics", "Communication", "Sustainability", "Post-Event"];
  
  for (const category of categories) {
    const keywords = categoryKeywords[category];
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }
  
  return "Other";
}

export function getCategoryColor(category: QuestionCategory): string {
  const colors: Record<QuestionCategory, string> = {
    "Experience": "bg-orange-500",
    "Music/Lineup": "bg-purple-500",
    "Venue/Logistics": "bg-blue-500",
    "Communication": "bg-pink-500",
    "Sustainability": "bg-green-500",
    "Post-Event": "bg-yellow-500",
    "Other": "bg-gray-500"
  };
  return colors[category];
}

export function getCategoryChartColor(category: QuestionCategory): string {
  const colors: Record<QuestionCategory, string> = {
    "Experience": "#f97316", // orange-500
    "Music/Lineup": "#a855f7", // purple-500
    "Venue/Logistics": "#3b82f6", // blue-500
    "Communication": "#ec4899", // pink-500
    "Sustainability": "#22c55e", // green-500
    "Post-Event": "#eab308", // yellow-500
    "Other": "#6b7280" // gray-500
  };
  return colors[category];
}

